'use strict';
const page=require('./taobao-page.cjs'),{skuPage}=require('./taobao-sku-page.cjs'),{browserGuard}=require('./browser-guard'),{normalize}=require('./taobao-detail.cjs');
const tool={name:'taobao_read_sku',title:'查询真实SKU规格、价格与库存',description:'读取真实商品SKU矩阵和每个SKU对应的价格与库存，不以起价或其他SKU推测。传sku_id或完整specs可选中该组合并读取更新后的价格；不加购、不下单、不付款。未指定组合时分页返回真实SKU数据，live_limit可逐个核验本页最多10个SKU动态价。未知价格/库存返回null与unconfirmed；库存数字是页面数据的数量，不承诺实际仓库库存或最终结算价。',inputSchema:{type:'object',properties:{url:{type:'string',maxLength:3000},sku_id:{type:'string',pattern:'^[0-9]{1,30}$'},specs:{type:'object',additionalProperties:{type:'string',maxLength:200}},offset:{type:'integer',minimum:0,default:0},limit:{type:'integer',minimum:1,maximum:100,default:20},live_limit:{type:'integer',minimum:0,maximum:10,default:0}},required:['url'],additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:false,openWorldHint:true}};
async function read(input){
 if(!input||Object.keys(input).some(k=>!['url','sku_id','specs','offset','limit','live_limit'].includes(k)))throw Error('SKU参数无效。');
 const url=normalize({url:input.url}),{offset=0,limit=20,live_limit=0,sku_id,specs}=input;
 if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(live_limit)||live_limit<0||live_limit>10||sku_id!==undefined&&!/^\d{1,30}$/.test(sku_id)||specs!==undefined&&(!specs||Array.isArray(specs)||typeof specs!=='object'||!Object.keys(specs).length||Object.entries(specs).some(([k,v])=>k.length>100||typeof v!=='string'||!v||v.length>200)))throw Error('SKU组合或分页参数无效。');
 return browserGuard.run('read-sku',async()=>{
  await page.tb.ensureBrowser(url);const current=await page.evaluate(()=>location.href);if(!page.sameProduct(current,url))await page.tb.browserCommand(['open',url]);
  let snapshot;for(let i=0;i<30;i++){await page.check();snapshot=await page.evaluate(skuPage);if(snapshot.data_source&&snapshot.sku_count)break;await page.wait(1000);}
  if(!snapshot?.data_source||!snapshot.sku_count)return {status:'unconfirmed',reason:'SKU_DATA_NOT_AVAILABLE',message:'当前页面未提供可核实的SKU矩阵；未使用标题或展示起价推测。',item_id:snapshot?.item_id||null,dimensions:snapshot?.dimensions||[],skus:[],permissions:'read-only'};
  const item=snapshot.item_id;let targets;
  if(specs&&snapshot.dimensions.some(d=>!Object.hasOwn(specs,d.name))||specs&&Object.keys(specs).some(n=>!snapshot.dimensions.some(d=>d.name===n)))return {status:'incomplete_specification',item_id:item,dimensions:snapshot.dimensions,message:'请使用页面完整组名，指定每个维度的一个真实选项；未选择规格。'};
  if(sku_id||specs){targets=snapshot.skus.filter(s=>(!sku_id||s.sku_id===sku_id)&&(!specs||Object.entries(specs).every(([k,v])=>s.specs[k]===v)));if(targets.length!==1)return {status:'not_exists',item_id:item,requested:{sku_id:sku_id||null,specs:specs||null},dimensions:snapshot.dimensions,skus:[],message:'页面SKU矩阵不存在唯一对应的组合；未推测价格或库存。'};}
  else targets=snapshot.skus.slice(offset,offset+limit);
  const maxLive=sku_id||specs?1:live_limit;let verified=0;
  for(const sku of targets.slice(0,maxLive)){
   sku.embedded_price=sku.price;sku.price=null;sku.price_confirmed=false;
   if(!sku.specs_complete){sku.live_status='unconfirmed_specification';continue;}
   if(sku.stock.status==='out_of_stock'){sku.live_status='out_of_stock';continue;}
   let selectable=true;for(const [name,value] of Object.entries(sku.specs)){await page.check();const r=await page.evaluate(skuPage,'select',{item_id:item,name,value});if(r.disabled){selectable=false;break;}await page.wait(450);}
   if(!selectable){sku.live_status=sku.stock.status==='out_of_stock'?'out_of_stock':'unavailable_or_unconfirmed';continue;}
   await page.wait(1200);await page.check();const live=await page.evaluate(skuPage,'live',{item_id:item});
   const matched=Object.keys(live.selected).length===snapshot.dimensions.length&&Object.entries(sku.specs).every(([k,v])=>live.selected[k]===v);
   sku.selected_specs=live.selected;sku.price=matched?live.price:null;sku.price_confirmed=matched&&live.price!==null;sku.price_type='selected_sku_panel';sku.live_status=sku.price_confirmed?'confirmed':'unconfirmed';sku.live_price_text=live.price_text;
   if(sku.price_confirmed)verified++;
  }
  return {status:targets.length===1&&targets[0].stock.status==='out_of_stock'?'out_of_stock':targets.slice(0,maxLive).some(s=>s.live_status!=='confirmed'&&s.live_status!=='out_of_stock')?'partial':'ready',item_id:item,title:snapshot.title,url:snapshot.url,dimensions:snapshot.dimensions,skus:targets,total_skus:snapshot.sku_count,returned:targets.length,next_offset:sku_id||specs?null:offset+targets.length<snapshot.sku_count?offset+targets.length:null,live_verified_count:verified,price_scope:sku_id||specs?'specified_sku':'per_sku_embedded_data_with_optional_live_checks',permissions:'read-only',fetched_at:new Date().toISOString(),note:'仅选择规格以读取动态价格，没有加购、下单或付款。price=null或price_confirmed=false表示未确认；embedded_price仅为该SKU内嵌数据价。price_confirmed只确认对应数据来源的价格；优惠资格、券后价和最终结算未核对。'};
 });
}
module.exports={tool,read};
