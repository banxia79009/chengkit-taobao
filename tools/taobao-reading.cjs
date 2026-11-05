'use strict';
const page=require('./taobao-page.cjs'),{browserGuard}=require('./browser-guard'),{productPage}=require('./taobao-product-page.cjs'),{parseOffers}=require('./taobao-offers.cjs'),media=require('./taobao-media.cjs'),{cache}=require('./taobao-selection-cache.cjs');
const annotations={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true};
const {gap}=require('./taobao-action-gap.cjs');
const urlProperty={type:'string',maxLength:3000,description:'用户给的真实商品链接，或搜索返回的url，不接受搜索关键词。'};
const tools=[
 {name:'taobao_read_reviews',title:'按需读取商品评论',description:'由AI按选品需要自主调用，不要求用户逐步指定。只读取指定商品的已加载评论和中差评/追评首批；不搜索、不加购。与基础详情分开，普通详情不再自动打开评论。未提供筛选不代表没有差评。refresh=false优先复用5分钟内同商品记录；评论尚未加载时明确说明。',inputSchema:{type:'object',properties:{url:urlProperty,refresh:{type:'boolean',default:false}},required:['url'],additionalProperties:false},annotations},
 {name:'taobao_read_images',title:'分批读取全部可取得商品图片及规格图',description:'读取真实主图、详情图和页面SKU属性明确对应的规格图，并把图片内容交给AI比较。默认向下加载详情图，返回完整已发现目录和分批图片；按next_offset继续，discovery.complete=false时还能继续发现，不能把一批或未能加载的图片声称为全部已看。kind=sku配合sku_id或完整specs筛选规格图；普通详情图未确认属于哪个SKU时不会冒充指定规格图。image_ids可精确挑选之前返回的图片。保留商品/规格编号和真实链接，禁止用搜索引擎图片替代。所有只读步骤由AI自主选择。',inputSchema:{type:'object',properties:{url:urlProperty,kind:{type:'string',enum:['all','main','detail','sku'],default:'all'},sku_id:{type:'string',pattern:'^[0-9]{1,30}$'},specs:{type:'object',additionalProperties:{type:'string',maxLength:200}},image_ids:{type:'array',maxItems:30,items:{type:'string',pattern:'^[a-f0-9]{24}$'}},offset:{type:'integer',minimum:0,default:0},limit:{type:'integer',minimum:1,maximum:6,default:4},discover:{type:'boolean',default:true},refresh:{type:'boolean',default:false}},required:['url'],additionalProperties:false},annotations},
 {name:'taobao_saved_items',title:'查看已读商品与规格的选品记录',description:'不访问淘宝、不受网页冷却影响，查看过去24小时本机已读取的商品、规格、价格来源、优惠和图片目录，供AI自主跨商品比较、算满减。价格有读取时间与过期标记，不能把记录当成当前最终结算价；不自动扣减优惠，不覆盖不同规格或来源。仅返回本工具记录的选品数据，不读取浏览历史或购物车。',inputSchema:{type:'object',properties:{item_ids:{type:'array',maxItems:30,items:{type:'string',pattern:'^[0-9]{5,24}$'}},limit:{type:'integer',minimum:1,maximum:100,default:30}},additionalProperties:false},annotations}
];
const normalize=input=>require('./taobao-detail.cjs').normalize(input);
function itemId(url){try{return new URL(url).searchParams.get('id')}catch{return null;}}
async function openProduct(url){
 await page.tb.ensureBrowser(url);
 const runtime=require('./opencli-runtime.cjs'),{Page}=await import(runtime.url('dist/src/browser/page.js'));
 const p=new Page('site:taobao',undefined,page.tb.PROFILE,'foreground','adapter','persistent');
 const tabs=await p.tabs(),matching=tabs.find(x=>page.sameProduct(x.url,url));if(matching)p.setActivePage(matching.page||matching.targetId||matching.id);
 const evaluate=async(fn,...args)=>{const task=()=>p.evaluate('('+fn.toString()+')('+args.map(x=>JSON.stringify(x)).join(',')+')');const r=await (['select','scroll','restore'].includes(args[0])?gap.run(task):task());return r&&typeof r==='object'&&'session'in r&&'data'in r?r.data:r;};
 const check=async()=>{const g=await evaluate(require('./taobao-assistance.cjs').gateSnapshot);if(g.status==='waiting_for_user'&&g.verified)throw Error('VERIFICATION_REQUIRED '+JSON.stringify(g));};
 const current=await p.evaluate('location.href');if(!page.sameProduct(current,url))await gap.run(()=>p.goto(url));
 let data;for(let i=0;i<40;i++){await check();try{data=await evaluate(productPage,'inspect');if(data?.item_id&&data.title&&data.ready){Object.defineProperty(data,'_session',{value:{p,evaluate,check}});return data;}}catch(e){if(!/PRODUCT_PAGE_CHANGED/.test(e.message))throw e;}await page.wait(500);}
 if(data?.item_id&&data.title){Object.defineProperty(data,'_session',{value:{p,evaluate,check}});return data;}
 throw Error('商品页未就绪，没有用其他商品的数据替代。');
}
function normalizeCatalog(data,old){
 const merged=new Map((old?.images||[]).map(x=>[x.image_id,x]));
 for(const image of media.catalog(data.images||[]))merged.set(image.image_id,{...image,item_id:data.item_id});
 return {item_id:data.item_id,title:data.title,url:data.url,images:[...merged.values()],skus:data.skus||[],verified_selected_sku:data.verified_selected_sku||old?.verified_selected_sku||null,pricing:parseOffers({...data.pricing,texts:data.pricing?.raw_texts||[],source:'detail_page_display'}),fetched_at:new Date().toISOString()};
}
async function images(input={}){
 const allowed=['url','kind','sku_id','specs','image_ids','offset','limit','discover','refresh'];
 if(!input||Object.keys(input).some(k=>!allowed.includes(k)))throw Error('图片读取参数无效。');
 const url=normalize({url:input.url}),id=itemId(url),{kind='all',offset=0,limit=4,discover=true,refresh=false,sku_id,specs,image_ids}=input;
 if(!['all','main','detail','sku'].includes(kind)||!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>6||typeof discover!=='boolean'||typeof refresh!=='boolean'||sku_id!==undefined&&!/^\d{1,30}$/.test(sku_id)||image_ids!==undefined&&(!Array.isArray(image_ids)||image_ids.length>30||image_ids.some(x=>!/^[a-f0-9]{24}$/.test(x)))||specs!==undefined&&(!specs||Array.isArray(specs)||typeof specs!=='object'||!Object.keys(specs).length||Object.values(specs).some(x=>typeof x!=='string'||x.length>200)))throw Error('图片种类、规格或分页参数无效。');
 let stored=!refresh&&id?cache.get('catalog',id):null;
 const deep=discover&&['all','detail'].includes(kind);
 if(!stored||deep&&!stored.discovery?.complete||refresh&&(sku_id||specs)){
  stored=await browserGuard.run('read-images',async()=>{
   let data=await openProduct(url);const {p,evaluate,check}=data._session;
   if(sku_id||specs){
    const found=data.skus.filter(s=>(!sku_id||s.sku_id===sku_id)&&(!specs||Object.keys(s.specs).length===Object.keys(specs).length&&Object.entries(specs).every(([k,v])=>s.specs[k]===v)));
    if(found.length!==1)throw Error('未找到唯一真实规格组合，本次未选规格。');
    const target=found[0],{skuPage}=require('./taobao-sku-page.cjs');
    for(const [name,value] of Object.entries(target.specs)){await check();const selected=await evaluate(skuPage,'select',{item_id:data.item_id,name,value});if(selected.disabled)throw Error('规格不可选，未用其他规格替代');await page.wait(450);}
    await page.wait(1200);await check();data=await evaluate(productPage,'inspect',{item_id:data.item_id});
    const compact=s=>String(s).replace(/\s/g,'');if(data.pricing.selected_option_labels.length!==Object.keys(target.specs).length||!Object.values(target.specs).every(v=>data.pricing.selected_option_labels.some(x=>compact(x)===compact(v))))throw Error('未确认页面已选中目标规格，不返回冒充的规格图');
    data.verified_selected_sku=target;
    const base=s=>s?.replace(/_\d+x\d+[^/]*$/,'');
    const match=data.images.find(x=>x.kind==='sku'&&x.sku_ids?.includes(target.sku_id)&&base(x.url)===base(data.active_gallery_url));
    if(match&&data.active_gallery_url)data.images.push({...match,url:data.active_gallery_url,sku_binding:'verified_selected_sku_gallery'});
   }
   let out=normalizeCatalog(data,stored);const original={x:data.scroll.x,y:data.scroll.y};let stable=0,complete=false,steps=0;
   try{
    if(deep){
     if(stored?.discovery?.next_scroll_y)await evaluate(productPage,'restore',{y:stored.discovery.next_scroll_y});
     for(;steps<24;steps++){
      const before=out.images.length;await evaluate(productPage,'scroll');await page.wait(450);await check();data=await evaluate(productPage,'inspect',{item_id:out.item_id});out=normalizeCatalog(data,out);
      stable=out.images.length===before?stable+1:0;
      if(stable>=2&&(data.scroll.at_page_end||data.scroll.detail_end_passed)&&data.scroll.pending_images===0){complete=data.detail_sections>0&&out.images.some(x=>x.kind==='detail')&&data.scroll.inaccessible_detail_frames===0;break;}
     }
    }
    out.discovery={complete:deep&&complete,basis:deep?'loaded_detail_dom_after_scrolling':'currently_loaded_images',scroll_steps:steps,next_scroll_y:data.scroll.y,inaccessible_detail_frames:data.scroll.inaccessible_detail_frames,pending_images:data.scroll.pending_images};
    cache.put('catalog',out);return out;
   }finally{await evaluate(productPage,'restore',original).catch(()=>{});}
  });
 }
 let targetSku=null;
 if(sku_id||specs){
  const found=stored.skus.filter(s=>(!sku_id||s.sku_id===sku_id)&&(!specs||Object.keys(s.specs).length===Object.keys(specs).length&&Object.entries(specs).every(([k,v])=>s.specs[k]===v)));
  if(found.length!==1)return {content:[{type:'text',text:'没有找到唯一的真实规格组合，未使用其他规格图片替代。'}],structuredContent:{status:'sku_not_confirmed',item_id:stored.item_id,available_skus:stored.skus},isError:false};targetSku=found[0];
 }
 let candidates=stored.images.filter(x=>kind==='all'||x.kind===kind);
 if(targetSku)candidates=candidates.filter(x=>x.kind!=='sku'||x.sku_ids?.includes(targetSku.sku_id));
 if(image_ids){const wanted=new Set(image_ids);if(image_ids.some(id=>!candidates.some(x=>x.image_id===id)))throw Error('所选图片不属于当前商品/规格和图片类型。');candidates=candidates.filter(x=>wanted.has(x.image_id));}
 const batch=candidates.slice(offset,offset+limit),attached=await media.embed(batch);
 const data={status:!candidates.length&&targetSku?'sku_image_not_available':'ready',item_id:stored.item_id,title:stored.title,url:stored.url,selected_sku:targetSku,verified_selected_sku:stored.verified_selected_sku||null,images:attached.statuses,catalog:candidates,total_images:candidates.length,returned:batch.length,next_offset:offset+batch.length<candidates.length?offset+batch.length:null,discovery:stored.discovery,more_discovery_available:deep&&!stored.discovery?.complete,fetched_at:stored.fetched_at,cache:stored.cache||{hit:false},note:'图片对应当前商品；只有sku_ids明确匹配时才是对应规格图。详情图可能是多规格共用。目录/链接不等于视觉已读，embedded=true才已交付图片内容。按需选择规格以读取对应图片，没有加购或修改购物车。'};
 return {content:[{type:'text',text:JSON.stringify(data)},...attached.content],structuredContent:data,isError:false};
}
async function reviews(input={}){
 if(Object.keys(input).some(k=>!['url','refresh'].includes(k))||input.refresh!==undefined&&typeof input.refresh!=='boolean')throw Error('评论参数无效。');
 const url=normalize({url:input.url}),id=itemId(url),saved=!input.refresh&&id?cache.get('reviews',id):null;
 const data=saved||await browserGuard.run('read-reviews',async()=>{
  const info=await openProduct(url);const {readFocusedReviews}=await import('./taobao-detail-adapter.mjs');
  const adapter=info._session.p;
  const result={item_id:info.item_id,title:info.title,url:info.url,reviews:await readFocusedReviews(adapter),fetched_at:new Date().toISOString(),permissions:'read-only'};cache.put('reviews',result);return result;
 });return {content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError:false};
}
function saved(input={}){
 const {item_ids=[],limit=30}=input;if(Object.keys(input).some(k=>!['item_ids','limit'].includes(k))||!Array.isArray(item_ids)||item_ids.length>30||item_ids.some(x=>!/^\d{5,24}$/.test(x))||!Number.isInteger(limit)||limit<1||limit>100)throw Error('选品记录参数无效。');
 const entries=cache.list(item_ids,limit),data={status:'ready',records:entries,count:entries.length,browser_accessed:false,note:'按商品、规格、信息来源分别保留；stale=true需要核对时效。展示优惠的适用资格和最终支付金额均未自动确认。'};
 return {content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError:false};
}
async function call(name,args){if(name==='taobao_read_images')return images(args);if(name==='taobao_read_reviews')return reviews(args);if(name==='taobao_saved_items')return saved(args);throw Error('未知读取工具');}
module.exports={tools,call,images,reviews,saved,normalizeCatalog,openProduct};
