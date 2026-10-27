import assistance from './taobao-assistance.cjs';
const {gateSnapshot}=assistance;
export function snapshot(gate) {
 const clean=x=>String(x||'').replace(/\s+/g,' ').trim();
 const text=document.body?.innerText||'';
 if(gate?.status==='waiting_for_user'&&gate.verified===true)return {error:gate.interception_type==='login'?'LOGIN_REQUIRED':'VERIFICATION_REQUIRED',verification:gate};
 const u=new URL(location.href),id=u.searchParams.get('id');
 if(!['item.taobao.com','detail.tmall.com'].includes(u.hostname)||!/^\d{5,24}$/.test(id||'')) {
  const candidates=[...document.querySelectorAll('a[href]')].map(a=>a.href);
  const matches=[...text.matchAll(/https?:\/\/(?:item\.taobao\.com|detail\.tmall\.com)\/item\.htm\?[^\s<>"']+/g)].map(m=>m[0]);
  for(const href of [...candidates,...matches]){try{const v=new URL(href);if(['item.taobao.com','detail.tmall.com'].includes(v.hostname)&&/^\d{5,24}$/.test(v.searchParams.get('id')||''))return {redirect:'https://'+v.hostname+'/item.htm?id='+v.searchParams.get('id')};}catch{}}
  return {error:'SHARE_NOT_RESOLVED'};
 }
 const visible=e=>e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
 const title=clean(document.querySelector('[class*="mainTitle--"]')?.textContent||document.querySelector('meta[property="og:title"]')?.content);
 if(!title)return {error:'DETAIL_NOT_READY'};
 const panel=document.querySelector('[class*="GeneralSkuPanel--"]');
 const head=document.querySelector('#tbpcDetail_SkuPanelItemhead_fixed');
 const priceEl=[...(panel||document).querySelectorAll('[class*="normalPrice--"], [class*="priceWrap--"], [class*="highlightPrice--"]')].find(visible);
 const priceText=clean(priceEl?.textContent||head?.textContent).slice(0,180);
 const specs=[...(panel||document).querySelectorAll('[class*="skuItem--"], [class*="prop--"]')].filter(e=>e.querySelector('[class*="valueItem--"]')).slice(0,12).map(e=>({name:clean(e.querySelector('[class*="label--"], [class*="propName--"]')?.textContent),options:[...e.querySelectorAll('[class*="valueItem--"]')].slice(0,50).map(v=>({name:clean(v.textContent).slice(0,160),selected:/selected|active/i.test(v.className),disabled:/disabled|gray/i.test(v.className)}))}));
 const imageEls=[...document.querySelectorAll('[class*="PicGallery"] img, [class*="picGallery"] img, [class*="mainPic"] img, [class*="MainPic"] img, [class*="thumbnail"] img')];
 const meta=document.querySelector('meta[property="og:image"]')?.content;
 const images=[...new Set([meta,...imageEls.map(e=>e.currentSrc||e.src)].filter(Boolean).map(s=>s.startsWith('//')?'https:'+s:s).filter(s=>{try{const v=new URL(s);return v.protocol==='https:'&&(v.hostname==='alicdn.com'||v.hostname.endsWith('.alicdn.com'));}catch{return false;}}))].slice(0,6);
 const reviewRoots=[...document.querySelectorAll('[class*="Comments--"], [class*="comments--"], [class*="Comment--"], [class*="comment--"], [class*="Rate--"], [class*="rate--"], [class*="Review--"], [class*="review--"]')].filter(e=>visible(e)&&/评价|评论/.test(e.textContent));
const reviewRoot=reviewRoots.sort((a,b)=>b.textContent.length-a.textContent.length)[0];
const reviews=reviewRoot?clean(reviewRoot.innerText).slice(0,14000):'';
const attrs=document.querySelector('[class*="paramsWrap--"], #attributes, [class*="Attrs--"], [class*="attrs--"], [class*="Attribute--"], [class*="attribute--"]');
const entries=reviewRoot?[...reviewRoot.querySelectorAll('[class*="Comment--"], [class*="commentItem--"], [class*="rateItem--"]')].slice(0,20).map(e=>({text:clean(e.innerText).slice(0,2500)})):[];
const detail=document.querySelector(' .descV8-container, [class*="descV8--"], [class*="description--"], #description');
const detailImages=[...(detail?.querySelectorAll('img')||[])].map(e=>e.currentSrc||e.src||e.getAttribute('data-src')).filter(x=>{try{const v=new URL(x);return v.protocol==='https:'&&v.hostname.endsWith('.alicdn.com');}catch{return false;}}).slice(0,12);
 return {detail_images:detailImages,detail_text:clean(detail?.innerText).slice(0,10000),attributes:clean(attrs?.innerText).slice(0,10000),reviews:{status:reviews?'visible_section_only':'not_loaded',count:entries.length,entries,text:reviews,note:'仅页面已加载的评价区域；不是全部评论，不据此推断整体好评率。'},item_id:id,url:'https://'+u.hostname+'/item.htm?id='+id,title:title.slice(0,300),price_text:priceText||'页面价格未识别',price_status:'页面展示价；未选择或更改规格，不代表最终成交价',specifications:specs,images,shop:clean(document.querySelector('[class*="shopName--"], [class*="ShopName"]')?.textContent).slice(0,160)};
}
export function reviewAction(action){
 if(!['item.taobao.com','detail.tmall.com'].includes(location.hostname))return {status:'wrong_page'};
 const visible=e=>e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
 const roots=[...document.querySelectorAll('[class*="Comments--"]')].filter(visible);
 const root=roots.at(-1);if(!root)return {status:'unavailable'};
 const labels={open:/^查看全部评价$/,negative:/^差评(?:\s*[（(]?\d+\+?[）)]?)?$/,neutral:/^中评(?:\s*[（(]?\d+\+?[）)]?)?$/,followup:/^追评(?:\s*[（(]?\d+\+?[）)]?)?$/};
 const pattern=labels[action];if(!pattern)return {status:'unavailable'};
 const candidates=[...root.querySelectorAll('button,div,span,a')].filter(e=>visible(e)&&pattern.test(e.textContent.trim()));
 const leaves=candidates.filter(e=>!candidates.some(x=>x!==e&&e.contains(x)));
 if(leaves.length!==1)return {status:'filter_not_available'};
 leaves[0].click();return {status:'opened'};
}
export function reviewSnapshot(){
 const roots=[...document.querySelectorAll('[class*="Comments--"]')].filter(e=>e.getClientRects().length);
 const root=roots.at(-1);if(!root)return {entries:[]};
 const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
 const entries=[...root.querySelectorAll('[class*="Comment--"], [class*="commentItem--"], [class*="rateItem--"]')].slice(0,20).map(e=>({text:clean(e.innerText).slice(0,3500)}));
 return {entries,available_labels:[...root.querySelectorAll('span,button,div')].filter(e=>e.children.length===0&&/^(中评|差评|追评)/.test(e.textContent.trim())).map(e=>clean(e.textContent)).slice(0,10)};
}
export async function readFocusedReviews(page){
 const evalFn=async(fn,arg)=>{let x=await page.evaluate('('+fn.toString()+')('+JSON.stringify(arg??null)+')');if(x&&typeof x==='object'&&'session'in x&&'data'in x)x=x.data;return x;};
 const opened=await evalFn(reviewAction,'open');
 if(opened?.status==='opened')await page.wait({time:3});
 const initial=await evalFn(reviewSnapshot);
 const concern=/追评|差评|中评|可惜|但是|不过|失望|退货|退款|异味|掉色|起球|塌陷|变形|不舒服|不满意|太软|太硬|没办法|不能|无法|质量差|破损|线头/;
 const relevant=(initial?.entries||[]).filter(x=>concern.test(x.text.replace(/(?:不|没|没有|不会|不易)(?:塌陷|变形|异味|线头|掉色|起球)/g,'')));
 const groups=[];
 for(const focus of ['negative','neutral','followup']){
  const clicked=await evalFn(reviewAction,focus);
  if(clicked?.status!=='opened'){groups.push({focus,status:'filter_not_available',entries:[]});continue;}
  await page.wait({time:3});
  const state=await page.evaluate('('+snapshot.toString()+')(('+gateSnapshot.toString()+')())');const checked=state&&typeof state==='object'&&'session'in state&&'data'in state?state.data:state;if(checked?.error)throw Error(checked.error);
  const result=await evalFn(reviewSnapshot);
  groups.push({focus,status:result?.entries?.length?'loaded_first_batch':'no_visible_entries',entries:result?.entries||[]});
 }
 return {focus:'中差评与追评优先',groups,visible_concerns:relevant,available_labels:initial?.available_labels||[],note:'仅首批已加载评论，未翻页。中差评筛选缺失不代表没有中差评；关键词命中只是待核实线索，不代表负面评级。追评也可能是好评。'};
}
export async function readDetail(page,args){
 const u=new URL(args.url);
 if(u.protocol!=='https:'||u.username||u.password||u.port||!['item.taobao.com','detail.tmall.com','e.tb.cn','m.tb.cn'].includes(u.hostname))throw Error('INVALID_URL');
 let current=await page.evaluate('location.href');if(current&&typeof current==='object'&&'data'in current)current=current.data;
 let same=false;try{const active=new URL(current);same=['item.taobao.com','detail.tmall.com'].includes(active.hostname)&&['item.taobao.com','detail.tmall.com'].includes(u.hostname)&&active.searchParams.get('id')===u.searchParams.get('id');}catch{}
 if(!same){await page.goto(u.href);await page.wait({time:2});}
 const read=async()=>{let x=await page.evaluate('('+snapshot.toString()+')(('+gateSnapshot.toString()+')())');if(x&&typeof x==='object'&&'session'in x&&'data'in x)x=x.data;return x;};
 let data=await read();
 for(let i=0;i<20&&data?.error==='DETAIL_NOT_READY';i++){await page.wait({time:1});data=await read();}
 if(data?.redirect){await page.goto(data.redirect);await page.wait({time:6});data=await read();}
 if(!data||data.error||data.redirect)throw Error(data?.error||'DETAIL_NOT_READY');
 if(!['e.tb.cn','m.tb.cn'].includes(u.hostname)&&data.item_id!==u.searchParams.get('id'))throw Error('ITEM_MISMATCH');
 data.reviews=await readFocusedReviews(page);
 return [{payload:data}];
}
