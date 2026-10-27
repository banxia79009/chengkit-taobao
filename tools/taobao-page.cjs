'use strict';
const tb=require('./taobao'),{gateSnapshot}=require('./taobao-assistance.cjs');
const unwrap=r=>r&&typeof r==='object'&&'session'in r&&'data'in r?r.data:r;
async function evaluate(fn,...args){return unwrap(await tb.browserCommand(['eval','('+fn.toString()+')('+args.map(x=>JSON.stringify(x)).join(',')+')']));}
async function check(){const g=await evaluate(gateSnapshot);if(g.status==='waiting_for_user'&&g.verified)throw Error((g.interception_type==='login'?'LOGIN_REQUIRED ':'VERIFICATION_REQUIRED ')+JSON.stringify(g));if(g.status==='wrong_page')throw Error('当前不是淘宝页面，已停止。');return g;}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function sameProduct(a,b){try{const x=new URL(a),y=new URL(b);return ['item.taobao.com','detail.tmall.com'].includes(x.hostname)&&['item.taobao.com','detail.tmall.com'].includes(y.hostname)&&/^\d{5,24}$/.test(x.searchParams.get('id')||'')&&x.searchParams.get('id')===y.searchParams.get('id');}catch{return false;}}
module.exports={evaluate,check,wait,tb,sameProduct};
