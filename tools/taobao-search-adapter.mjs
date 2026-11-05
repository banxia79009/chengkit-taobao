import filtersApi from './taobao-filters.cjs';
import assistance from './taobao-assistance.cjs';
import actionGap from './taobao-action-gap.cjs';
import diagnostics from './search-diagnostics.js';
const {pageFilter,validate}=filtersApi,{gateSnapshot}=assistance;
function extract(limit){
 const norm=s=>String(s||'').replace(/\s+/g,' ').trim(),rows=[],seen=new Set();
 for(const card of document.querySelectorAll('[class*="doubleCard--"]')){
  const title=norm(card.querySelector('[class*="title--"]')?.textContent);if(title.length<3||seen.has(title))continue;seen.add(title);
  let id='';for(let e=card,n=0;e&&n<4;e=e.parentElement,n++){const x=e.getAttribute('data-spm-act-id');if(/^\d{5,24}$/.test(x||'')){id=x;break;}}
  if(!id){const a=card.closest('a[href]')||card.querySelector('a[href]');try{const u=new URL(a?.href);if(['item.taobao.com','detail.tmall.com'].includes(u.hostname)&&/^\d{5,24}$/.test(u.searchParams.get('id')||''))id=u.searchParams.get('id');}catch{}}
  const integer=norm(card.querySelector('[class*="priceInt--"]')?.textContent),decimal=norm(card.querySelector('[class*="priceFloat--"]')?.textContent);
  const img=card.querySelector('img');let thumbnail=null;try{const raw=img?.currentSrc||img?.getAttribute('data-src')||img?.src;const u=new URL(raw,location.href);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&u.hostname.endsWith('.alicdn.com'))thumbnail=u.href;}catch{}
  rows.push({rank:rows.length+1,title:title.slice(0,200),price:integer?'¥'+integer+decimal:'',price_label:norm(card.querySelector('[class*="priceDesc--"]')?.textContent),promotion_texts:[norm(card.innerText).slice(0,1600)],thumbnail_url:thumbnail,sales:norm(card.querySelector('[class*="realSales--"]')?.textContent),shop:norm(card.querySelector('[class*="shopName--"]')?.textContent),location:[...card.querySelectorAll('[class*="procity--"]')].map(e=>norm(e.textContent)).join(''),item_id:id,url:id?'https://item.taobao.com/item.htm?id='+id:''});if(rows.length>=limit)break;
 }
 return rows;
}
function searchReadiness(){
 const visible=e=>!!e&&e.getClientRects().length&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden';
 return {cards:[...document.querySelectorAll('[class*="doubleCard--"]')].filter(visible).length,filter_button:visible(document.querySelector('#filterMoreButton_id')),body_present:!!document.body?.innerText?.trim()};
}
async function configureTransport(){
 const runtime=(await import('./opencli-runtime.cjs')).default;
 const {setDaemonCommandTimeoutSeconds}=await import(runtime.url('dist/src/browser/daemon-client.js'));
 setDaemonCommandTimeoutSeconds(60);
}
export async function runSearch(page,args,{gap=actionGap.gap,now=Date.now,record=diagnostics.record,signal,configure=configureTransport}={}){
 let stage='validate',deadline=Infinity;
 const started=now(),request_id=args['request-id']||null;
 let progressState={};
 const progress=(extra={})=>{progressState={...progressState,...extra};record({phase:'progress',request_id,stage,elapsed_ms:now()-started,...progressState});};
 const guard=()=>{if(signal?.aborted)throw Error('SEARCH_CANCELLED');if(now()>=deadline)throw Error('SEARCH_TIMEOUT');};
 const wait=async seconds=>{guard();await page.wait(Math.min(seconds,Math.max(0,(deadline-now())/1000)));guard();};
 const mutate=async task=>{guard();const value=await gap.run(async()=>{guard();return task();});guard();return value;};
 try{
 await configure();
 const query=String(args.query||'').trim(),limit=Number(args.limit||5),requested=validate(args['filters-json']?JSON.parse(args['filters-json']):{});
 const include=args['include-filters'];if(include!==undefined&&![true,false,'true','false'].includes(include))throw Error('INVALID_INCLUDE_FILTERS');
 const needsFilters=include===true||include==='true'||requested.groups.length>0||requested.price_min!==undefined||requested.price_max!==undefined;
 deadline=started+(needsFilters?300:90)*1000;progress({budget_seconds:needsFilters?300:90});
 if(!query||query.length>100||!Number.isInteger(limit)||limit<1||limit>40)throw Error('INVALID_SEARCH');
 const sort={default:'',sale:'&sort=sale-desc',price:'&sort=price-asc'}[args.sort||'default'];if(sort===undefined)throw Error('INVALID_SORT');
 const evaluate=async(fn,...values)=>{guard();progress();const evaluateOnce=page.evaluateOnce?.bind(page)||page.evaluate.bind(page);let r=await evaluateOnce('('+fn.toString()+')('+values.map(x=>JSON.stringify(x)).join(',')+')');guard();return r&&typeof r==='object'&&'session'in r&&'data'in r?r.data:r;};
 const check=async()=>{const g=await evaluate(gateSnapshot);if(g?.status==='waiting_for_user')throw Error(g.interception_type==='login'?'LOGIN_REQUIRED':'VERIFICATION_REQUIRED');if(g?.status==='wrong_page')throw Error('SEARCH_PAGE_MISMATCH');};
 const control=(action,value)=>['state','verify','price-verify','price-closed','discover-next','panel-state'].includes(action)?evaluate(pageFilter,action,value||{}):mutate(()=>evaluate(pageFilter,action,value||{}));
 const open=async()=>{stage='open_filters';const panel=await control('panel-state');if(!panel.open){await control('open');await wait(0.4);}};
 const discover=async(targets)=>{
  await open();stage='discover_filters';const groups=new Map(),quick=new Set(),attempted=new Map();
  for(let i=0;i<256;i++){
   const snapshot=await control('state');
   for(const g of snapshot.groups){const old=groups.get(g.name);groups.set(g.name,{...g,values:[...new Set([...(old?.values||[]),...g.values])]});}
   for(const v of snapshot.quick_options||[])quick.add(v);
   // For a filter request, validate all requested options before selecting any;
   // defer the single complete catalogue read until the resulting page is ready.
   if(Array.isArray(targets)&&targets.every(t=>t.values.every(v=>groups.get(t.name)?.values.includes(v)))){
    const all=[...groups.values()];return {groups:all,quick_options:[...quick],discovery:{complete:false,scope:'requested_options',group_count:all.length,option_count:all.reduce((n,g)=>n+g.values.length,0)}};
   }
   const plan=await control('discover-next');
   const fingerprint=JSON.stringify(snapshot),key=JSON.stringify(plan);
   if(attempted.get(key)===fingerprint)throw Error('FILTER_DISCOVERY_STALLED');
   attempted.set(key,fingerprint);
   progress({group_count:groups.size,option_count:[...groups.values()].reduce((n,g)=>n+g.values.length,0),current_group:plan.group||null,discovery_action:plan.kind||'unknown'});
   const step=await control('discover-step');
   if(step.complete){const all=[...groups.values()];return {groups:all,quick_options:[...quick],discovery:{complete:true,group_count:all.length,option_count:all.reduce((n,g)=>n+g.values.length,0)}};}
   await wait(0.15);
  }
  throw Error('FILTER_DISCOVERY_INCOMPLETE 右侧筛选未能完整展开，请检查当前页面。');
 };
 stage='navigate';progress();await mutate(()=>page.goto('https://s.taobao.com/search?q='+encodeURIComponent(query)+sort));
 stage='wait_results';let ready;
 // A completed document can still be an empty shell while Taobao hydrates.
 // Observe this one navigation; never reload or resubmit the search on timeout.
 for(let i=0;i<40;i++){await check();ready=await evaluate(searchReadiness);if(ready?.cards>0&&(!needsFilters||ready.filter_button))break;await wait(1);}
 if(!ready?.cards||needsFilters&&!ready.filter_button)throw Error(ready?.cards?'SEARCH_FILTER_ENTRY_MISSING':ready?.body_present?'SEARCH_RESULTS_NOT_READY':'SEARCH_PAGE_BLANK');
 const hasRequested=requested.groups.length>0||requested.price_min!==undefined||requested.price_max!==undefined;
 let available=needsFilters?await discover(hasRequested?requested.groups:undefined):null;
 stage='validate_filters';
 // Validate all requested groups/options before changing the page.
 for(const g of requested.groups){const group=available.groups.find(x=>x.name===g.name);if(!group||g.values.some(v=>!group.values.includes(v)))throw Error('FILTER_UNAVAILABLE '+JSON.stringify(available));}
 const applied=[];
 if(requested.price_min!==undefined||requested.price_max!==undefined){
  stage='apply_price';
  await control('price-open');await wait(0.3);await control('price-set',requested);await wait(0.2);await control('price-submit');await wait(2);await check();
  const closed=await control('price-closed');if(!closed.closed)throw Error('FILTER_NOT_APPLIED 价格确定面板未关闭。');
  await control('price-open');await wait(0.2);const confirmed=await control('price-verify');
  for(const k of ['price_min','price_max'])if(requested[k]!==undefined&&(confirmed[k]===null||confirmed[k]===''||Number(confirmed[k])!==requested[k]))throw Error('FILTER_NOT_APPLIED 价格区间未被网页确认。');
  applied.push({group:'价格区间',...confirmed,confirmation:'原生确定后面板关闭，重开仍保留区间'});
 }
 for(const g of requested.groups)for(const value of g.values){
  await open();stage='apply_filters';let r=await control('choose',{group:g.name,value});if(r.expanded){await wait(0.2);r=await control('choose',{group:g.name,value});}
  await wait(1.2);await check();await open();stage='verify_filters';const selected=await control('verify',{group:g.name,value});if(!selected.selected)throw Error('FILTER_NOT_APPLIED '+g.name+'：'+value);applied.push({group:g.name,value});
 }
  // Only changed filters require a fresh discovery of the updated options.
  if(applied.length)available=await discover();
 stage='verify_filters';
 // Recheck every selected option after all changes to catch mutually exclusive filters.
 for(const x of applied.filter(x=>x.value)){const s=await control('verify',{group:x.group,value:x.value});if(!s.selected)throw Error('FILTER_NOT_APPLIED 条件互斥：'+x.value);}
 if(applied.some(x=>x.group==='价格区间')){
  await control('price-open');await wait(0.2);const after=await control('price-verify');
  for(const k of ['price_min','price_max'])if(requested[k]!==undefined&&(after[k]===null||after[k]===''||Number(after[k])!==requested[k]))throw Error('FILTER_NOT_APPLIED 后续条件改变了价格区间。');
 }
 stage='extract_results';await mutate(()=>page.autoScroll({times:1,delayMs:1000}));await check();const results=await evaluate(extract,limit);
 progress({phase:'adapter-completed',result_count:results.length});
 return [{payload:{results,available_filters:available,applied_filters:applied,filter_source:'淘宝搜索页原生筛选控件',price_note:'搜索展示价并非已选SKU成交价，活动价可能与区间依据不同。'}}];
 }catch(error){progress({phase:'adapter-failed',failure_code:String(error?.message||error).match(/\b(?:SEARCH_TIMEOUT|SEARCH_CANCELLED|FILTER_DISCOVERY_STALLED)\b/)?.[0]||null});throw Error('[TAOBAO_SEARCH_STAGE:'+stage+'] '+String(error?.message||error));}
}
