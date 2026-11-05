'use strict';
// Serialized into the product page. Reads only the product's own public data and DOM.
function productPage(action='inspect',args={}){
 const u=new URL(location.href),id=u.searchParams.get('id');
 if(!['item.taobao.com','detail.tmall.com'].includes(u.hostname)||!/^\d{5,24}$/.test(id||'')||args.item_id&&args.item_id!==id)throw Error('PRODUCT_PAGE_CHANGED');
 const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
 const visible=e=>!!e&&e.getClientRects().length&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden';
 const imageUrl=value=>{try{if(typeof value!=='string'||!value.trim())return null;const x=new URL(value.startsWith('//')?'https:'+value:value,u);return x.protocol==='https:'&&!x.username&&!x.password&&!x.port&&(x.hostname==='alicdn.com'||x.hostname.endsWith('.alicdn.com'))?x.href:null;}catch{return null;}};
 const panel=document.querySelector('[class*="GeneralSkuPanel--"]');
 const details=[...document.querySelectorAll('.descV8-container,[class*="descV8--"],#description,[class*="description--"]')];
 if(action==='scroll'){
  const root=document.scrollingElement,step=Math.max(300,Math.floor(innerHeight*0.8));
  const start=root?.scrollTop||0;window.scrollBy(0,step);return {before:start,after:root?.scrollTop||0};
 }
 if(action==='restore'){window.scrollTo(Number(args.x)||0,Number(args.y)||0);return {restored:true};}
 const priceRoots=[...(panel||document).querySelectorAll('[class*="highlightPrice--"]')].filter(visible);
 const prices=priceRoots.map(e=>({label:clean(e.querySelector('[class*="title--"]')?.textContent),text:clean(e.querySelector('[class*="text--"]')?.textContent),raw:clean(e.innerText||e.textContent)}));
 const uniquePrices=[...new Map(prices.filter(x=>x.text).map(x=>[[x.label,x.text].join('|'),x])).values()];
 if(!uniquePrices.length){const head=document.querySelector('#tbpcDetail_SkuPanelItemhead_fixed');const m=clean(head?.textContent).match(/[￥¥]\s*(\d+(?:\.\d{1,2})?)/);if(m)uniquePrices.push({label:'',text:m[1],raw:clean(head.textContent).slice(0,250)});}
 const prefer=uniquePrices.filter(x=>/优惠后|券后|到手|补贴后/.test(x.label));
 const chosen=prefer.length===1?prefer[0]:!prefer.length&&uniquePrices.length===1?uniquePrices[0]:null;
 const offerNodes=[...(panel||document).querySelectorAll('[class*="romotion"],[class*="priceTip"],[class*="CouponItem--"],[class*="enefit"],[class*="iscount"],[class*="summaryWrap--"]')].filter(visible);
 if(panel)offerNodes.push(...[...panel.querySelectorAll('span,div')].filter(e=>visible(e)&&!e.children.length&&/88VIP|会员|首单|新客|仅限|淘金币|需领券|限购|有效期|\d{1,2}月\d{1,2}日/.test(e.innerText||'')));
 const offerTexts=[...new Set(offerNodes.map(e=>clean(e.innerText||e.textContent)).filter(t=>t&&t.length<1600))];
 const selectedDom=[...(panel||document).querySelectorAll('[class*="valueItem--"]')].filter(e=>visible(e)&&(/(?:^|\s)(?:selected|isSelected|active)(?:--|\s|$)/i.test(e.className||'')||e.getAttribute('aria-selected')==='true')).map(e=>clean(e.querySelector('[class*="valueItemText--"]')?.getAttribute('title')||e.getAttribute('title')||e.textContent));
 const pricing={item_id:id,price_text:chosen?.text||null,price_label:chosen?.label||null,price_candidates:uniquePrices,raw_texts:offerTexts,selected_option_labels:selectedDom};
 if(action==='offers')return pricing;
 let res=null;const contexts=[window.__ICE_APP_CONTEXT__,window.__ICE_APP_CONTEXT];
 for(const script of document.scripts){const text=script.textContent||'';if(text.length>4000000||!text.includes('skuBase'))continue;
  for(const anchor of ['window.__ICE_APP_CONTEXT__ =','window.__ICE_APP_CONTEXT__=','window.__ICE_APP_CONTEXT__']){
   const at=text.indexOf(anchor);if(at<0)continue;const start=text.indexOf('{',at+anchor.length);if(start<0)continue;let depth=0,string=false,escape=false;
   for(let i=start;i<text.length;i++){const c=text[i];if(string){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')string=false;}else if(c==='"')string=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){try{contexts.push(JSON.parse(text.slice(start,i+1)));}catch{}break;}}
  }
 }
 for(const context of contexts){for(const child of Object.values(context?.loaderData||{})){if(child?.data?.res?.skuBase){res=child.data.res;break;}}if(res)break;}
 if(res?.item?.itemId&&String(res.item.itemId)!==id)throw Error('PRODUCT_DATA_ID_MISMATCH');
 const detailSources=[];
 function findDetailSources(value,path,depth){if(depth>7||!value)return;if(typeof value==='object'){for(const [key,child] of Object.entries(value))findDetailSources(child,path+'.'+key,depth+1);return;}if(typeof value==='string'&&/desc|description/i.test(path)&&value.length<5000){try{const link=new URL(value.startsWith('//')?'https:'+value:value,u);if(link.protocol==='https:'&&!link.username&&!link.password&&!link.port&&(link.hostname==='alicdn.com'||link.hostname.endsWith('.alicdn.com'))&&!detailSources.some(x=>x.url===link.href))detailSources.push({url:link.href,source_path:path});}catch{}}}
 findDetailSources(res,'product',0);
 const images=[],keys=new Set(),skus=(res?.skuBase?.skus||[]).map(s=>({sku_id:String(s.skuId),pairs:String(s.propPath||'').split(';').filter(Boolean)}));
 const add=(src,kind,binding={})=>{const url=imageUrl(src);if(!url)return;const key=[kind,url,JSON.stringify(binding.specs||{})].join('|');if(keys.has(key))return;keys.add(key);images.push({url,kind,...binding});};
 const src=e=>e.getAttribute('data-src')||e.getAttribute('data-original')||e.currentSrc||e.src;
 const gallery=[...document.querySelectorAll('[class*="PicGallery"] img,[class*="picGallery"] img,[class*="mainPic"] img,[class*="MainPic"] img,[class*="thumbnail"] img')];
 for(const e of gallery)add(src(e),'main',{sku_binding:'unconfirmed'});
 const activeGallery=gallery.filter(visible).map(e=>({url:imageUrl(src(e)),area:e.getBoundingClientRect().width*e.getBoundingClientRect().height})).filter(x=>x.url).sort((a,b)=>b.area-a.area)[0];
 const meta=document.querySelector('meta[property="og:image"]')?.content;if(meta)add(meta,'main',{sku_binding:'unconfirmed'});
 let inaccessible=0,pending=0;
 for(const detail of details){
  for(const img of detail.querySelectorAll('img')){add(src(img),'detail',{sku_binding:'unconfirmed'});if(!img.complete)pending++;}
  for(const frame of detail.querySelectorAll('iframe')){try{const doc=frame.contentDocument;if(!doc){inaccessible++;continue;}for(const img of doc.querySelectorAll('img'))add(src(img),'detail',{sku_binding:'unconfirmed'});}catch{inaccessible++;}}
 }
 const lookup=new Map();
 for(const p of res?.skuBase?.props||[])for(const v of p.values||[]){
  const pair=String(p.pid)+':'+String(v.vid),specs={[clean(p.name)]:clean(v.name)};lookup.set(pair,{specs,name:clean(v.name)});
  const linked=skus.filter(s=>s.pairs.includes(pair)).map(s=>s.sku_id);
  for(const value of [v.image,v.imageUrl,v.image_url,v.imgUrl,v.img])if(typeof value==='string')add(value,'sku',{specs,sku_ids:linked,sku_binding:'product_sku_attribute_data'});
 }
 for(const option of (panel||document).querySelectorAll('[class*="valueItem--"]')){
  const name=clean(option.querySelector('[class*="valueItemText--"]')?.getAttribute('title')||option.getAttribute('title')||option.textContent);
  const found=[...lookup.entries()].filter(([,x])=>x.name.replace(/\s/g,'')===name.replace(/\s/g,''));if(found.length!==1)continue;const [pair,value]=found[0];
  for(const img of option.querySelectorAll('img'))add(src(img),'sku',{specs:value.specs,sku_ids:skus.filter(s=>s.pairs.includes(pair)).map(s=>s.sku_id),sku_binding:'matching_sku_option_dom'});
 }
 const root=document.scrollingElement,detailEnds=details.filter(visible).map(e=>e.getBoundingClientRect().bottom+(root?.scrollTop||0));
 const scroll={x:scrollX,y:scrollY,height:root?.scrollHeight||0,viewport:innerHeight,at_page_end:!!root&&root.scrollTop+innerHeight>=root.scrollHeight-5,detail_end_passed:!!detailEnds.length&&Math.max(...detailEnds)<=scrollY+innerHeight+5,pending_images:pending,inaccessible_detail_frames:inaccessible};
 return {item_id:id,title:clean(document.querySelector('[class*="mainTitle--"]')?.textContent||res?.item?.title),ready:!!panel,url:u.origin+'/item.htm?id='+id,pricing,images,active_gallery_url:activeGallery?.url||null,detail_sources:detailSources,skus:skus.map(s=>({sku_id:s.sku_id,specs:Object.assign({},...s.pairs.map(p=>lookup.get(p)?.specs||{}))})),scroll,detail_sections:details.length};
}
module.exports={productPage};
