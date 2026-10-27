'use strict';
// Executed only on the selected, already-open Taobao homepage. No navigation,
// clicks, API requests, account storage, or clipboard access.
function pageStep(scroll, expires) {
  if(location.protocol!=='https:' || !['www.taobao.com','www.taobao.com.cn'].includes(location.hostname) || !['/','/index.htm'].includes(location.pathname))
    throw Error('NOT_TAOBAO_HOME');
  if(Date.now()>expires)throw Error('EXPIRED_ACTION');
  const shown=e=>!!e.getClientRects().length;
  if([...document.querySelectorAll('[class*="redPacketPopupClose"]')].some(shown))throw Error('RED_PACKET_POPUP');
  const gates=[...document.querySelectorAll('[role="dialog"],iframe')].filter(shown);
  if(gates.some(e=>/验证码|安全验证|滑动验证|访问受限|登录|login|captcha|punish/i.test((e.innerText||'')+' '+(e.getAttribute('src')||''))))throw Error('VERIFICATION_REQUIRED');
  if(scroll){window.scrollBy({top:Math.min(480,Math.floor(innerHeight*0.65)),left:0,behavior:'instant'});return {scrolled:true,y:scrollY};}
  const items=[],seen=new Set();
  for(const a of document.querySelectorAll('a[data-nid],a[href]')){
    let u;try{u=new URL(a.href,location.href);}catch{continue;}
    if(!['item.taobao.com','detail.tmall.com'].includes(u.hostname)||u.pathname!=='/item.htm')continue;
    const id=u.searchParams.get('id');if(!/^\d{5,24}$/.test(id||'')||seen.has(id))continue;
    const r=a.getBoundingClientRect();if(!shown(a)||r.bottom<=0||r.top>=innerHeight||r.right<=0||r.left>=innerWidth)continue;
    const lines=(a.innerText||'').split(/\n/).map(x=>x.trim()).filter(Boolean);
    if(!lines.length)continue;
    seen.add(id);
    const clean=new URL(u.origin+'/item.htm');clean.searchParams.set('id',id);
    const sku=u.searchParams.get('skuId');if(/^\d+$/.test(sku||''))clean.searchParams.set('skuId',sku);
    const text=lines.join(' '),price=text.match(/[¥￥]\s*([\d,.]+)/);
    items.push({title:lines[0].slice(0,250),url:clean.href,item_id:id,displayed_price:price?.[1]||'',summary:text.slice(0,500)});
    if(items.length>=10)break;
  }
  return {items,y:scrollY,homepage:location.origin+location.pathname};
}
function dismissRedPacket(expires){
 if(location.protocol!=='https:'||!['www.taobao.com','www.taobao.com.cn'].includes(location.hostname)||!['/','/index.htm'].includes(location.pathname))throw Error('NOT_TAOBAO_HOME');
 if(Date.now()>expires)throw Error('EXPIRED_ACTION');
 const candidates=[...document.querySelectorAll('[class*="redPacketPopupClose"]')].filter(e=>e.getClientRects().length&&/红包/.test(e.parentElement?.innerText||''));
 if(candidates.length>1)throw Error('AMBIGUOUS_POPUP');
 if(candidates.length===1){candidates[0].click();return {closed:true};}
 return {closed:false};
}
module.exports={pageStep,dismissRedPacket};
