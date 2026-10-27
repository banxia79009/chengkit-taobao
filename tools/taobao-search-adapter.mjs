import filtersApi from './taobao-filters.cjs';
import assistance from './taobao-assistance.cjs';
const {pageFilter,validate}=filtersApi,{gateSnapshot}=assistance;
function extract(limit){
 const norm=s=>String(s||'').replace(/\s+/g,' ').trim(),rows=[],seen=new Set();
 for(const card of document.querySelectorAll('[class*="doubleCard--"]')){
  const title=norm(card.querySelector('[class*="title--"]')?.textContent);if(title.length<3||seen.has(title))continue;seen.add(title);
  let id='';for(let e=card,n=0;e&&n<4;e=e.parentElement,n++){const x=e.getAttribute('data-spm-act-id');if(/^\d{5,24}$/.test(x||'')){id=x;break;}}
  if(!id){const a=card.closest('a[href]')||card.querySelector('a[href]');try{const u=new URL(a?.href);if(['item.taobao.com','detail.tmall.com'].includes(u.hostname)&&/^\d{5,24}$/.test(u.searchParams.get('id')||''))id=u.searchParams.get('id');}catch{}}
  const integer=norm(card.querySelector('[class*="priceInt--"]')?.textContent),decimal=norm(card.querySelector('[class*="priceFloat--"]')?.textContent);
  rows.push({rank:rows.length+1,title:title.slice(0,200),price:integer?'¥'+integer+decimal:'',sales:norm(card.querySelector('[class*="realSales--"]')?.textContent),shop:norm(card.querySelector('[class*="shopName--"]')?.textContent),location:[...card.querySelectorAll('[class*="procity--"]')].map(e=>norm(e.textContent)).join(''),item_id:id,url:id?'https://item.taobao.com/item.htm?id='+id:''});if(rows.length>=limit)break;
 }
 return rows;
}
function searchReadiness(){
 const visible=e=>!!e&&e.getClientRects().length&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden';
 return {cards:[...document.querySelectorAll('[class*="doubleCard--"]')].filter(visible).length,filter_button:visible(document.querySelector('#filterMoreButton_id')),body_present:!!document.body?.innerText?.trim()};
}
export async function runSearch(page,args){
 let stage='validate';
 try{
 const query=String(args.query||'').trim(),limit=Number(args.limit||5),requested=validate(args['filters-json']?JSON.parse(args['filters-json']):{});
 const include=args['include-filters'];if(include!==undefined&&![true,false,'true','false'].includes(include))throw Error('INVALID_INCLUDE_FILTERS');
 const needsFilters=include===true||include==='true'||requested.groups.length>0||requested.price_min!==undefined||requested.price_max!==undefined;
 if(!query||query.length>100||!Number.isInteger(limit)||limit<1||limit>40)throw Error('INVALID_SEARCH');
 const sort={default:'',sale:'&sort=sale-desc',price:'&sort=price-asc'}[args.sort||'default'];if(sort===undefined)throw Error('INVALID_SORT');
 const evaluate=async(fn,...values)=>{let r=await page.evaluate('('+fn.toString()+')('+values.map(x=>JSON.stringify(x)).join(',')+')');return r&&typeof r==='object'&&'session'in r&&'data'in r?r.data:r;};
 const check=async()=>{const g=await evaluate(gateSnapshot);if(g?.status==='waiting_for_user')throw Error(g.interception_type==='login'?'LOGIN_REQUIRED':'VERIFICATION_REQUIRED');if(g?.status==='wrong_page')throw Error('SEARCH_PAGE_MISMATCH');};
 const control=(action,value)=>evaluate(pageFilter,action,value||{});
 const open=async()=>{stage='open_filters';await control('open');await page.wait(0.4);};
 const discover=async()=>{
  await open();stage='discover_filters';const groups=new Map(),quick=new Set();
  for(let i=0;i<256;i++){
   const snapshot=await control('state');
   for(const g of snapshot.groups){const old=groups.get(g.name);groups.set(g.name,{...g,values:[...new Set([...(old?.values||[]),...g.values])]});}
   for(const v of snapshot.quick_options||[])quick.add(v);
   const progress=await control('discover-step');
   if(progress.complete){const all=[...groups.values()];return {groups:all,quick_options:[...quick],discovery:{complete:true,group_count:all.length,option_count:all.reduce((n,g)=>n+g.values.length,0)}};}
   await page.wait(0.15);
  }
  throw Error('FILTER_DISCOVERY_INCOMPLETE 右侧筛选未能完整展开，请检查当前页面。');
 };
 stage='navigate';await page.goto('https://s.taobao.com/search?q='+encodeURIComponent(query)+sort);
 stage='wait_results';let ready;
 // A completed document can still be an empty shell while Taobao hydrates.
 // Observe this one navigation; never reload or resubmit the search on timeout.
 for(let i=0;i<40;i++){await check();ready=await evaluate(searchReadiness);if(ready?.cards>0&&(!needsFilters||ready.filter_button))break;await page.wait(1);}
 if(!ready?.cards||needsFilters&&!ready.filter_button)throw Error(ready?.cards?'SEARCH_FILTER_ENTRY_MISSING':ready?.body_present?'SEARCH_RESULTS_NOT_READY':'SEARCH_PAGE_BLANK');
 let available=needsFilters?await discover():null;
 stage='validate_filters';
 // Validate all requested groups/options before changing the page.
 for(const g of requested.groups){const group=available.groups.find(x=>x.name===g.name);if(!group||g.values.some(v=>!group.values.includes(v)))throw Error('FILTER_UNAVAILABLE '+JSON.stringify(available));}
 const applied=[];
 if(requested.price_min!==undefined||requested.price_max!==undefined){
  stage='apply_price';
  await control('price-open');await page.wait(0.3);await control('price-set',requested);await page.wait(0.2);await control('price-submit');await page.wait(2);await check();
  const closed=await control('price-closed');if(!closed.closed)throw Error('FILTER_NOT_APPLIED 价格确定面板未关闭。');
  await control('price-open');await page.wait(0.2);const confirmed=await control('price-verify');
  for(const k of ['price_min','price_max'])if(requested[k]!==undefined&&(confirmed[k]===null||confirmed[k]===''||Number(confirmed[k])!==requested[k]))throw Error('FILTER_NOT_APPLIED 价格区间未被网页确认。');
  applied.push({group:'价格区间',...confirmed,confirmation:'原生确定后面板关闭，重开仍保留区间'});
 }
 for(const g of requested.groups)for(const value of g.values){
  await open();stage='apply_filters';let r=await control('choose',{group:g.name,value});if(r.expanded){await page.wait(0.2);r=await control('choose',{group:g.name,value});}
  await page.wait(1.2);await check();await open();stage='verify_filters';const selected=await control('verify',{group:g.name,value});if(!selected.selected)throw Error('FILTER_NOT_APPLIED '+g.name+'：'+value);applied.push({group:g.name,value});
 }
  // Only changed filters require a fresh discovery of the updated options.
  if(applied.length)available=await discover();
 stage='verify_filters';
 // Recheck every selected option after all changes to catch mutually exclusive filters.
 for(const x of applied.filter(x=>x.value)){const s=await control('verify',{group:x.group,value:x.value});if(!s.selected)throw Error('FILTER_NOT_APPLIED 条件互斥：'+x.value);}
 if(applied.some(x=>x.group==='价格区间')){
  await control('price-open');await page.wait(0.2);const after=await control('price-verify');
  for(const k of ['price_min','price_max'])if(requested[k]!==undefined&&(after[k]===null||after[k]===''||Number(after[k])!==requested[k]))throw Error('FILTER_NOT_APPLIED 后续条件改变了价格区间。');
 }
 stage='extract_results';await page.autoScroll({times:1,delayMs:1000});await check();const results=await evaluate(extract,limit);
 return [{payload:{results,available_filters:available,applied_filters:applied,filter_source:'淘宝搜索页原生筛选控件',price_note:'搜索展示价并非已选SKU成交价，活动价可能与区间依据不同。'}}];
 }catch(error){throw Error('[TAOBAO_SEARCH_STAGE:'+stage+'] '+String(error?.message||error));}
}
