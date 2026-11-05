'use strict';
// One readiness path, shared by search, detail, homepage and cart.
function createSession({connected,connectionState,prepareSite=async()=>{},sleep=ms=>new Promise(r=>setTimeout(r,ms))}){
 let pending;
 async function start(){
  const check=connectionState|| (async()=>await connected()?'ready':'extension_disconnected');
  let state=await check();
  if(state==='extension_disconnected'||state==='daemon_unavailable'){
   await sleep(1000);
   state=await check();
  }
  if(state==='ready'){await prepareSite();return {started:false};}
  const messages={
   daemon_unavailable:'OpenCLI 本地服务未响应，请检查工作台的浏览器连接。',
   profile_mismatch:'OpenCLI 已连到其他 Chrome 配置。请打开工作台绑定的 Chrome，并确认该配置的 OpenCLI 扩展已启用。',
   extension_disconnected:'工作台绑定的 Chrome 扩展未连接。请打开原 Chrome，并确认 OpenCLI 扩展已启用。'
  };
  throw Error(messages[state]||messages.extension_disconnected);
 }
 return {ensure:async()=>{if(!pending)pending=start().finally(()=>{pending=null});return pending;}};
}
function createRuntime(deps){
 const session='site:taobao',surface='adapter',siteSession='persistent',contextId=deps.PROFILE;
 async function page(){if(deps.pageFactory)return deps.pageFactory({session,surface,siteSession,contextId});const {Page}=await import(require('./opencli-runtime.cjs').url('dist/src/browser/page.js'));return new Page(session,undefined,contextId,'foreground',surface,siteSession);}
 const valid=url=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&['www.taobao.com','cart.taobao.com','s.taobao.com','item.taobao.com','detail.tmall.com','market.m.taobao.com'].includes(u.hostname)}catch{return false}};
 const prepareSite=async()=>{
  let p=await page();const tabs=await p.tabs();
  const match=tabs.find(t=>valid(t.url)&&!/(?:^|\/)(?:punish|captcha|_____tmd_____|baxia)(?:\/|$)/i.test(new URL(t.url).pathname));
  if(match){if(tabs.length>1)await p.selectTab(match.page||match.targetId||match.id);}
  else {
   const bridge=deps.bindTab?deps:await import(require('./opencli-runtime.cjs').url('dist/src/browser/daemon-client.js'));
   const {bindTab}=bridge;
   await bindTab(session,{surface,siteSession,contextId});
   const result=await p.evaluate('location.href');
   const url=result&&typeof result==='object'&&'data'in result?result.data:result;
   if(!valid(url)){
    // Release only the borrowed binding. Never navigate or close the user's unrelated tab.
    const released=await bridge.sendCommand('close-window',{session,surface,siteSession,contextId});
    if(released?.closed!==true)throw Error('未能确认释放临时页面连接，本次没有打开淘宝。');
    p=await page();
    await p.goto('https://www.taobao.com/');
   }
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
  if(args[0]==='eval-once'){
   if(typeof p.evaluateOnce!=='function')throw Error('当前OpenCLI不支持单次执行，未操作页面。');
   return p.evaluateOnce(args[1]);
  }
  throw Error('不支持的淘宝页面操作。');
 }};
}
module.exports={createSession,createRuntime};
