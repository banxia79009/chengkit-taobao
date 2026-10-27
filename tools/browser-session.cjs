'use strict';
// One readiness path, shared by search, detail, homepage and cart.
function createSession({connected,launchChrome,cli,prepareSite=async()=>{},sleep=ms=>new Promise(r=>setTimeout(r,ms))}){
 let pending;
 async function start(){
  if(await connected()){await prepareSite(false);return {started:false};}
  try{await cli(['doctor'],20000);}catch{}
  if(await connected()){await prepareSite(false);return {started:false};}
  await launchChrome('https://www.taobao.com/');
  for(let i=0;i<10;i++){if(await connected()){await prepareSite(true);return {started:true};}await sleep(1000);}
  throw Error('原 Chrome 未连接：已尝试启动一次，请检查原配置的扩展；不会切换账号或反复启动。');
 }
 return {ensure:async()=>{if(!pending)pending=start().finally(()=>{pending=null});return pending;}};
}
function createRuntime(deps){
 const session='site:taobao',surface='adapter',siteSession='persistent',contextId=deps.PROFILE;
 async function page(){if(deps.pageFactory)return deps.pageFactory({session,surface,siteSession,contextId});const {Page}=await import(require('./opencli-runtime.cjs').url('dist/src/browser/page.js'));return new Page(session,undefined,contextId,'foreground',surface,siteSession);}
 const valid=url=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&['www.taobao.com','cart.taobao.com','s.taobao.com','item.taobao.com','detail.tmall.com','market.m.taobao.com'].includes(u.hostname)}catch{return false}};
 const prepareSite=async started=>{
  const p=await page();const tabs=await p.tabs();
  const match=tabs.find(t=>valid(t.url)&&!/(?:^|\/)(?:punish|captcha|_____tmd_____|baxia)(?:\/|$)/i.test(new URL(t.url).pathname));
  if(match){if(tabs.length>1)await p.selectTab(match.page||match.targetId||match.id);}
  else {
   const {bindTab}=deps.bindTab?deps:await import(require('./opencli-runtime.cjs').url('dist/src/browser/daemon-client.js'));
   await bindTab(session,{surface,siteSession,contextId});
   let url=await p.evaluate('location.href');
   if(!valid(url)&&!started){
    // An unregistered user tab is not a missing browser tab. Inspect it first.
    await deps.launchChrome('https://www.taobao.com/');
    await (deps.sleep||((ms)=>new Promise(r=>setTimeout(r,ms))))(700);
    await bindTab(session,{surface,siteSession,contextId});
    url=await (await page()).evaluate('location.href');
   }
   if(!valid(url))throw Error('原 Chrome 中当前标签不是可确认的淘宝页面，请切到刚打开的淘宝；本次未操作其他网页。');
  }
  const gate=await p.evaluate('('+require('./taobao-assistance.cjs').gateSnapshot.toString()+')()');
  const state=gate&&typeof gate==='object'&&'session'in gate&&'data'in gate?gate.data:gate;
  if(state?.status==='waiting_for_user'&&state.verified===true)throw Error('VERIFICATION_REQUIRED '+JSON.stringify(state));
 };
 const ready=createSession({...deps,prepareSite});
 return {ensure:ready.ensure,async command(args){
  const p=await page();
  if(args[0]==='tab'&&args[1]==='list')return p.tabs();
  if(args[0]==='tab'&&args[1]==='select'){const tabs=await p.tabs();if(!(tabs.length===1&&tabs[0].page===args[2]))await p.selectTab(args[2]);return {selected:args[2]};}
  if(args[0]==='open'){await p.goto(args[1]);await p.wait(2);return {url:await p.evaluate('location.href')};}
  if(args[0]==='eval')return p.evaluate(args[1]);
  throw Error('不支持的淘宝页面操作。');
 }};
}
module.exports={createSession,createRuntime};
