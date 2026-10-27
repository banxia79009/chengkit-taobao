'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),page=require('./taobao-page.cjs'),{browserGuard}=require('./browser-guard');
const tool={name:'taobao_read_cart',title:'只读淘宝购物车',description:'读取当前真实购物车已加载的商品、规格、SKU、展示价、数量、店铺、勾选及可见异常状态。action=read开始；action=next带上次cursor继续未返回的行并按需滚动。只读，不勾选、不改数量、不删商品、不结算；已加载不代表全部购物车。验证后使用taobao_resume。',inputSchema:{type:'object',properties:{action:{type:'string',enum:['read','next'],default:'read'},cursor:{type:'string',maxLength:80},limit:{type:'integer',minimum:1,maximum:50,default:20},screens:{type:'integer',minimum:1,maximum:3,default:1,description:'继续读取时向当前已加载列表末端推进的最多次数；每次按需触发下一批，范围1～3。'}},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:false,openWorldHint:true}};
function cartSnapshot(action='read'){
 if(location.hostname!=='cart.taobao.com')throw Error('CART_PAGE_CHANGED');
 const visible=e=>!!e&&e.getClientRects().length&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden';
 if(action==='scroll'){const last=[...document.querySelectorAll('.trade-cart-item-info')].filter(visible).at(-1);last?.scrollIntoView({block:'end'});window.scrollBy(0,Math.max(200,innerHeight*0.6));return {scrolled:true};}
 const norm=s=>String(s||'').replace(/\s+/g,' ').trim();const items=[];
 for(const row of document.querySelectorAll('.trade-cart-item-info')){
  if(!visible(row))continue;
  const anchor=row.querySelector('.trade-cart-item-detail a[href]')||row.querySelector('a[href*="item.htm"]');let u,id=null,sku=null;
  try{u=new URL(anchor.href);if(['item.taobao.com','detail.tmall.com'].includes(u.hostname)&&/^\d{5,24}$/.test(u.searchParams.get('id')||'')){id=u.searchParams.get('id');sku=u.searchParams.get('skuId');}}catch{}
  const title=norm(anchor?.getAttribute('title')||anchor?.innerText)||null;
  const spec=norm(row.querySelector('.trade-cart-item-sku-old,[class*="trade-cart-item-sku"]')?.innerText)||null;
  const priceEl=row.querySelector('.trade-cart-item-price .trade-price-container');
  const integer=norm(priceEl?.querySelector('.trade-price-integer')?.textContent),decimal=norm(priceEl?.querySelector('.trade-price-decimal')?.textContent);
  const rawPrice=integer+(decimal&&!decimal.startsWith('.')?'.'+decimal:decimal);const price=/^\d+(?:\.\d{1,2})?$/.test(rawPrice)?Number(rawPrice):null;
  const quantityInput=row.querySelector('.trade-cart-item-quantity input');const quantity=/^[1-9]\d*$/.test(quantityInput?.value||'')?Number(quantityInput.value):null;
  const checkbox=row.querySelector('.trade-cart-item-status input[type="checkbox"]');
  const shop=norm(row.closest('.trade-cart-shop-container')?.querySelector('.trade-cart-shop-info [class*="cartShopName--"]')?.textContent)||null;
  const text=norm(row.innerText);const flags=[];for(const [code,re] of [['out_of_stock',/无货|缺货|售罄|库存不足/],['invalid',/失效|下架|宝贝不存在/],['price_drop',/距加入降|已降价|降价/],['limited_stock',/仅剩\s*\d|库存紧张/]])if(re.test(text))flags.push(code);
  items.push({line_id:row.id||[id,sku,spec,shop].join('|'),item_id:id,sku_id:/^\d+$/.test(sku||'')?sku:null,title,url:id?'https://'+u.hostname+'/item.htm?id='+id:null,selected_spec:spec,price,currency:'CNY',price_label:norm(priceEl?.querySelector('.trade-price-label')?.textContent)||null,price_type:'cart_display',quantity,shop,selected:checkbox?checkbox.checked:null,status_flags:flags,status_text:flags.length?text.slice(0,500):null,field_evidence:'当前购物车商品行DOM'});
 }
 const main=document.querySelector('.type-of-doc-infinite')?.parentElement;const totalMatch=document.body.innerText.match(/全部商品\s*[（(]\s*(\d+)\s*[)）]/);
 const scroll=document.scrollingElement;return {items,loaded_count:items.length,reported_total:totalMatch?Number(totalMatch[1]):null,page_fingerprint:String(performance.timeOrigin),can_scroll:scroll.scrollTop+innerHeight<scroll.scrollHeight-4,empty_confirmed:!items.length&&/购物车空空|购物车还是空的|购物车竟然是空的/.test(document.body.innerText),end_confirmed:/没有更多宝贝|没有更多商品|已显示全部商品/.test(main?.innerText||'')};
}
const stateFile=path.join(__dirname,'..','state','taobao-cart-read.json');
async function read(input={}){
 const {action='read',limit=20,screens=1,cursor}=input;
 if(Object.keys(input).some(k=>!['action','limit','screens','cursor'].includes(k))||!['read','next'].includes(action)||!Number.isInteger(limit)||limit<1||limit>50||!Number.isInteger(screens)||screens<1||screens>3||action==='next'&&(typeof cursor!=='string'||!/^[a-f0-9-]{36}$/.test(cursor)))throw Error('购物车参数无效；继续读取须传上次cursor。');
 return browserGuard.run('read-cart',async()=>{
  let state=null;if(action==='next'){try{state=JSON.parse(fs.readFileSync(stateFile,'utf8'));}catch{}if(!state||state.cursor!==cursor)throw Error('购物车读取游标已失效，请重新read；未重新打开或修改页面。');}
  if(action==='read')await page.tb.ensureBrowser();
  const current=await page.evaluate(()=>location.hostname);
  if(current!=='cart.taobao.com'){if(action==='next')throw Error('购物车原页面已切换，请重新read；未操作其他页面。');await page.tb.browserCommand(['open','https://cart.taobao.com/cart.htm']);}
  let snapshot;for(let i=0;i<30;i++){await page.check();snapshot=await page.evaluate(cartSnapshot);if(snapshot.loaded_count||snapshot.empty_confirmed)break;await page.wait(1000);}
  if(!snapshot.loaded_count&&!snapshot.empty_confirmed)throw Error('CART_NOT_READY：购物车内容未就绪；未认定为空，未自动重试。');
  if(state&&state.page_fingerprint!==snapshot.page_fingerprint)throw Error('购物车页面已重新加载，旧游标失效；请重新read。');
  state||={cursor:crypto.randomUUID(),page_fingerprint:snapshot.page_fingerprint,seen:[]};const seen=new Set(state.seen),found=new Map();
  const collect=()=>{for(const item of snapshot.items)if(!seen.has(item.line_id))found.set(item.line_id,item);};collect();
  if(action==='next')for(let i=0;i<screens&&found.size<limit&&snapshot.can_scroll;i++){await page.evaluate(cartSnapshot,'scroll');await page.wait(1200);await page.check();snapshot=await page.evaluate(cartSnapshot);collect();}
  const items=[...found.values()].slice(0,limit);for(const item of items)seen.add(item.line_id);
  state.seen=[...seen];fs.mkdirSync(path.dirname(stateFile),{recursive:true});const tmp=stateFile+'.tmp';fs.writeFileSync(tmp,JSON.stringify(state),{mode:0o600});fs.renameSync(tmp,stateFile);
  const completeByCount=snapshot.reported_total!==null&&snapshot.loaded_count>=snapshot.reported_total&&snapshot.items.every(i=>seen.has(i.line_id));
  return {status:snapshot.empty_confirmed?'empty':'ready',items,count:items.length,loaded_count:snapshot.loaded_count,reported_total:snapshot.reported_total,cursor:state.cursor,has_more:!completeByCount&&(found.size>items.length||snapshot.can_scroll||(snapshot.reported_total!==null&&seen.size<snapshot.reported_total)),end_confirmed:snapshot.end_confirmed||completeByCount,read_scope:'currently_loaded_rows_only',permissions:'read-only',fetched_at:new Date().toISOString(),note:'只读取和滚动；未勾选、改数量、删除或结算。价格是当前购物车展示价。缺失字段为null；不能把未加载的商品当成不存在。'};
 });
}
module.exports={tool,read,cartSnapshot};
