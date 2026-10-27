'use strict';
// Reads product-scoped data only. Never evaluates a page's script source.
function skuPage(action='inspect',args={}){
 if(!['item.taobao.com','detail.tmall.com'].includes(location.hostname))throw Error('SKU_WRONG_PAGE');
 const id=new URL(location.href).searchParams.get('id');if(args.item_id&&args.item_id!==id)throw Error('SKU_ITEM_CHANGED');
 const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
 const visible=e=>!!e&&e.getClientRects().length&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden';
 let res=null;const contexts=[window.__ICE_APP_CONTEXT__,window.__ICE_APP_CONTEXT];
 // Fallback: parse a balanced JSON literal following a known product context anchor.
 for(const script of document.scripts){const text=script.textContent||'';if(text.length>4000000||!text.includes('skuBase'))continue;for(const anchor of ['window.__ICE_APP_CONTEXT__ =','window.__ICE_APP_CONTEXT__=','window.__ICE_APP_CONTEXT__']){const at=text.indexOf(anchor);if(at<0)continue;const start=text.indexOf('{',at+anchor.length);if(start<0)continue;let depth=0,string=false,escape=false;for(let i=start;i<text.length;i++){const c=text[i];if(string){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')string=false;}else if(c==='"')string=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){try{contexts.push(JSON.parse(text.slice(start,i+1)));}catch{}break;}}}}
 for(const context of contexts){for(const child of Object.values(context?.loaderData||{})){const candidate=child?.data?.res;if(candidate?.skuBase){res=candidate;break;}}if(res)break;}
 if(res?.item?.itemId&&String(res.item.itemId)!==id)throw Error('SKU_DATA_ID_MISMATCH');
 const panel=document.querySelector('[class*="GeneralSkuPanel--"]');
 const dimensions=(res?.skuBase?.props||[]).map(p=>({id:String(p.pid),name:norm(p.name),values:(p.values||[]).map(v=>({id:String(v.vid),name:norm(v.name)}))}));
 const lookup=new Map();for(const d of dimensions)for(const v of d.values)lookup.set(d.id+':'+v.id,{name:d.name,value:v.name});
 const strictPrice=info=>{const p=info?.price||{};if(/^\d+$/.test(String(p.priceMoney??''))&&Number(p.priceMoney)>0)return Number(p.priceMoney)/100;const text=norm(p.priceText).replace(/^[￥¥]\s*/,'');return /^\d+(?:\.\d{1,2})?$/.test(text)&&Number(text)>0?Number(text):null;};
 const skus=(res?.skuBase?.skus||[]).map(s=>{const info=res?.skuCore?.sku2info?.[String(s.skuId)]||{},specs={},missing=[];for(const p of String(s.propPath||'').split(';').filter(Boolean)){const pair=lookup.get(p);if(pair)specs[pair.name]=pair.value;else missing.push(p);}
  const raw=info.quantity;const quantity=/^\d+$/.test(String(raw??''))&&Number.isSafeInteger(Number(raw))?Number(raw):null;const stockText=norm(info.quantityText)||null;
  const explicitEmpty=/^(?:已)?售罄$|^(?:已)?无货$|^(?:暂时|暂)?缺货$|^库存不足$/.test(stockText||'');
  const stockStatus=quantity===0?'out_of_stock':explicitEmpty?(quantity>0?'unknown':'out_of_stock'):quantity>0?'in_stock':'unknown';
  return {sku_id:String(s.skuId),specs,price:strictPrice(info),currency:'CNY',price_type:'sku_embedded_price',price_confirmed:strictPrice(info)!==null&&missing.length===0,stock:{status:stockStatus,quantity,text:stockText,warning:/即将售罄|库存紧张/.test(stockText||'')?'low_stock':null,source:'skuCore.sku2info'},specs_complete:missing.length===0&&Object.keys(specs).length===dimensions.length};});
 const title=norm(document.querySelector('[class*="mainTitle--"]')?.textContent||res?.item?.title)||null;
 const groups=()=>panel?[...panel.querySelectorAll('[class*="skuItem--"]')].filter(visible):[];
 const labels=g=>[...g.querySelectorAll('[class*="valueItem--"]')].filter(visible).map(e=>({element:e,name:norm(e.querySelector('[class*="valueItemText--"]')?.getAttribute('title')||e.getAttribute('title')||e.querySelector('[class*="valueItemText--"]')?.textContent||e.textContent)}));
 if(action==='select'){
  const d=dimensions.find(d=>d.name===args.name);if(!d||!d.values.some(v=>v.name===args.value))throw Error('SKU_OPTION_NOT_FOUND');
  const matches=groups().filter(g=>{const opts=labels(g);return opts.some(o=>o.name===args.value)&&opts.every(o=>d.values.some(v=>v.name===o.name));});
  if(matches.length!==1)throw Error('SKU_GROUP_AMBIGUOUS');const opts=labels(matches[0]).filter(o=>o.name===args.value);if(opts.length!==1)throw Error('SKU_OPTION_AMBIGUOUS');const e=opts[0].element;
  if(e.getAttribute('aria-disabled')==='true'||e.getAttribute('data-disabled')==='true'||/disabled|gray/i.test(e.className||''))return {disabled:true};
  if(!/(?:^|\s)(?:selected|isSelected|active)(?:--|\s|$)/i.test(e.className||'')&&e.getAttribute('aria-selected')!=='true'){e.scrollIntoView({block:'center'});e.click();}return {selected:true};
 }
 if(action==='live'){
  const selected={};for(const d of dimensions){const candidates=groups().filter(g=>{const opts=labels(g);return opts.length&&opts.every(o=>d.values.some(v=>v.name===o.name));});if(candidates.length!==1)continue;const values=labels(candidates[0]).filter(o=>/(?:^|\s)(?:selected|isSelected|active)(?:--|\s|$)/i.test(o.element.className||'')||o.element.getAttribute('aria-selected')==='true');if(values.length===1)selected[d.name]=values[0].name;}
  const roots=[...panel.querySelectorAll('[class*="unit--"]')].filter(e=>visible(e)&&/^[￥¥]$/.test(norm(e.textContent))).map(e=>e.parentElement);
  const unique=[...new Set(roots)].filter(e=>/^[￥¥]\s*\d+(?:\.\d{1,2})?$/.test(norm(e.textContent)));
  const priceTexts=[...new Set(unique.map(e=>norm(e.textContent)))];const text=priceTexts.length===1?priceTexts[0]:null;const exact=text?.match(/^[￥¥]\s*(\d+(?:\.\d{1,2})?)$/);
  return {selected,price:exact?Number(exact[1]):null,price_text:text,price_source:'visible_selected_sku_panel',item_id:id};
 }
 return {item_id:id,title,url:'https://'+location.hostname+'/item.htm?id='+id,dimensions,skus,sku_count:skus.length,data_source:res?'product_embedded_sku_data':null,ui_groups:groups().map(g=>({class:g.className,text:norm(g.firstElementChild?.textContent),options:labels(g).map(o=>o.name)})),share_controls:[...document.querySelectorAll('button,a,[role="button"],[title],[aria-label]')].filter(e=>visible(e)&&/^(分享|分享宝贝|分享商品|复制链接)$/.test(norm(e.getAttribute('title')||e.getAttribute('aria-label')||e.textContent))).slice(0,6).map(e=>({tag:e.tagName,text:norm(e.textContent),title:e.getAttribute('title'),class:e.className}))};
}
module.exports={skuPage};
