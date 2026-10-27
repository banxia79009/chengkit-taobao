'use strict';
function validate(filters={}){
 if(!filters||typeof filters!=='object'||Array.isArray(filters)||Object.keys(filters).some(k=>!['price_min','price_max','groups'].includes(k)))throw Error('筛选仅接受价格区间和网页筛选组。');
 for(const k of ['price_min','price_max'])if(filters[k]!==undefined&&(!Number.isFinite(filters[k])||filters[k]<0||filters[k]>1e8||Math.abs(Math.round(filters[k]*100)-filters[k]*100)>1e-7))throw Error('价格须为非负数字，最多两位小数。');
 if(filters.price_min!==undefined&&filters.price_max!==undefined&&filters.price_min>=filters.price_max)throw Error('最低价须低于最高价，淘宝当前原生区间不接受相等边界。');
 const groups=filters.groups??[];if(!Array.isArray(groups)||groups.length>64)throw Error('每次最多64个网页筛选组。');
 const text=x=>typeof x==='string'&&x.trim()&&x.length<=80&&!/[\x00-\x1f\x7f]/.test(x);
 const names=new Set();for(const g of groups){if(!g||Object.keys(g).some(k=>!['name','values'].includes(k))||!text(g.name)||names.has(g.name.trim())||!Array.isArray(g.values)||g.values.length<1||g.values.length>64||!g.values.every(text)||new Set(g.values.map(x=>x.trim())).size!==g.values.length)throw Error('筛选组名称和选项须使用网页上的完整文字，不得重复。');names.add(g.name.trim());}
 return {...filters,groups:groups.map(g=>({name:g.name.trim(),values:g.values.map(x=>x.trim())}))};
}
function pageFilter(action,args={}){
 if(location.hostname!=='s.taobao.com')throw Error('NOT_TAOBAO_SEARCH');
 const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
 const visible=e=>!!e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none';
 const selected=e=>e.getAttribute('aria-checked')==='true'||e.getAttribute('aria-selected')==='true'||/(?:^|\s)(?:selected|checked|active)(?:--|\s|$)/i.test(e.className||'');
 const blocks=()=>[...document.querySelectorAll('[class*="panelFilterWrapper--"] [class*="filterCPVblock--"]')].filter(visible);
 const title=b=>norm(b.firstElementChild?.textContent);
 const options=b=>[...b.querySelectorAll('[class*="filterItem--"]')].filter(visible);
 const label=e=>norm(e.getAttribute('title')||e.innerText);
 const state=()=>({groups:blocks().map(b=>({name:title(b),values:[...new Set(options(b).map(label))],selected:options(b).filter(selected).map(label)})),quick_options:[...new Set([...document.querySelectorAll('#sortBarWrap [class*="filterItem--"]')].filter(visible).map(label))]});
 const unavailable=()=>{throw Error('FILTER_UNAVAILABLE '+JSON.stringify(state()));};
 const expandControl=b=>[...b.querySelectorAll('[class*="hasMoreTip--"],button,[role="button"],div,span')].filter(visible).find(e=>norm(e.textContent)==='展开全部'&&!e.closest('[class*="filterItem--"]'));
 if(action==='open'){
  const e=document.querySelector('#filterMoreButton_id');if(!visible(e))unavailable();
  if(!blocks().length&&!/rightButtonSelected/.test(e.className||''))e.click();
  e.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));return {opened:true};
 }
 if(action==='state')return state();
 if(action==='discover-step'){
  // Expand through native controls, including buttons that contain an SVG icon.
  for(const b of blocks()){const e=expandControl(b);if(e){e.scrollIntoView({block:'center'});e.click();return {changed:true,expanded:title(b)};}}
  const panels=[...document.querySelectorAll('[class*="panelFilterWrapper--"]')].filter(visible);if(panels.length!==1)unavailable();const p=panels[0];
  if(p.scrollTop+p.clientHeight<p.scrollHeight-2){p.scrollTop=Math.min(p.scrollHeight-p.clientHeight,p.scrollTop+Math.max(80,p.clientHeight*0.8));p.dispatchEvent(new Event('scroll',{bubbles:true}));return {changed:true,scrolled:true};}
  p.scrollTop=0;p.dispatchEvent(new Event('scroll',{bubbles:true}));return {changed:false,complete:true};
 }
 if(action==='choose'||action==='verify'){
  const matchesGroup=blocks().filter(b=>title(b)===args.group);if(matchesGroup.length!==1)unavailable();const b=matchesGroup[0];
  if(action==='choose'){
   const expand=expandControl(b);
   if(expand){expand.click();return {expanded:true};}
  }
  const matches=options(b).filter(e=>label(e)===args.value);if(matches.length!==1)unavailable();
  const e=matches[0];if(action==='verify')return {selected:!!selected(e),group:args.group,value:args.value};
  if(e.getAttribute('aria-disabled')==='true'||e.hasAttribute('disabled')||/(?:^|\s)disabled(?:--|\s|$)/.test(e.className||''))throw Error('FILTER_UNAVAILABLE 当前选项已禁用：'+args.group+'/'+args.value);
  const wasSelected=!!selected(e);if(!wasSelected){e.scrollIntoView({block:'center'});e.click();}return {clicked:!wasSelected,group:args.group,value:args.value};
 }
 if(action==='price-open'){
  const tabs=[...document.querySelectorAll('#sortBarWrap_left [role="tab"]')].filter(e=>norm(e.innerText)==='区间'&&visible(e));if(tabs.length!==1)unavailable();
  tabs[0].setAttribute('data-taobao-price-menu','one');tabs[0].dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));return {opened:true};
 }
 if(action==='price-set'){
  const panels=[...document.querySelectorAll('[class*="sectionPriceSelecter--"]')].filter(visible);if(panels.length!==1)unavailable();const p=panels[0];
  const lo=p.querySelector('input[placeholder*="最低价"]'),hi=p.querySelector('input[placeholder*="最高价"]');if(!lo||!hi)unavailable();
  const set=(e,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,v===undefined?'':String(v));e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));const key=Object.keys(e).find(k=>k.startsWith('__reactProps$'));const handler=key&&e[key]?.onChange;if(typeof handler==='function')handler({target:e,currentTarget:e,type:'change',preventDefault(){},stopPropagation(){}});};
  set(lo,args.price_min);set(hi,args.price_max);
  return {price_min:lo.value,price_max:hi.value};
 }
 if(action==='price-submit'){
  const panels=[...document.querySelectorAll('[class*="sectionPriceSelecter--"]')].filter(visible);if(panels.length!==1)unavailable();
  const buttons=[...panels[0].querySelectorAll('[class*="confirmButton--"]')].filter(visible);if(buttons.length!==1)unavailable();buttons[0].click();return {submitted:true};
 }
 if(action==='price-verify'){
  const u=new URL(location.href),from=u.searchParams.get('start_price'),to=u.searchParams.get('end_price');
  const p=[...document.querySelectorAll('[class*="sectionPriceSelecter--"]')].find(visible);
  const lo=p?.querySelector('input[placeholder*="最低价"]')?.value,hi=p?.querySelector('input[placeholder*="最高价"]')?.value;
  return {price_min:from??lo??null,price_max:to??hi??null,url_confirmed:from!==null||to!==null};
 }
 if(action==='price-closed')return {closed:![...document.querySelectorAll('[class*="sectionPriceSelecter--"]')].some(visible)};
 throw Error('UNKNOWN_FILTER_ACTION');
}
module.exports={validate,pageFilter};
