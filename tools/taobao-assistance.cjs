'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const instruction='请立刻在用户可见的进度消息中说明：淘宝需要你帮忙完成验证或登录，我已保留任务，等你说“好了”再继续。不要连续调用、搜索或刷新。不要声称任务已完成。';
const tool={name:'taobao_resume',title:'人工验证后继续淘宝任务',description:'仅当用户明确说已完成验证/登录时，传入 waiting_for_user 返回的 resume_id 和 user_completed=true。只检查一次原页面，恢复只读任务的调用参数；不自动重做加购或发送消息。不能自行假定用户已完成，不轮询。',inputSchema:{type:'object',properties:{resume_id:{type:'string'},user_completed:{type:'boolean',const:true}},required:['resume_id','user_completed'],additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:false,openWorldHint:true}};
function gateSnapshot(){
 const visible=e=>{if(!e||!e.getClientRects().length)return false;const s=getComputedStyle(e);return s.visibility!=='hidden'&&s.display!=='none'&&s.opacity!=='0';};
 const u=new URL(location.href);
 const allowed=u.protocol==='https:'&&['taobao.com','tmall.com'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h));
 if(!allowed)return {status:'wrong_page'};
 // Never treat product descriptions, reviews, footer text, or an unrelated tab
 // as a login challenge. Return evidence from this exact document only.
 const safeUrl=v=>{const x=new URL(v,u);return x.origin+x.pathname+(x.searchParams.has('id')?'?id='+encodeURIComponent(x.searchParams.get('id')):'');};
 const challenge=v=>{try{const x=new URL(v,u);if(!['taobao.com','tmall.com','alicdn.com'].some(h=>x.hostname===h||x.hostname.endsWith('.'+h)))return null;
  if(/^(login|passport)\.(taobao|tmall)\.com$/.test(x.hostname))return 'login';
  if(/^(punish|captcha)\.(taobao|tmall)\.com$/.test(x.hostname)||/(?:^|\/)(?:punish|captcha|_____tmd_____|baxia)(?:\/|$)/i.test(x.pathname))return 'captcha';
 }catch{}return null;};
 const found=(type,source,text)=>({status:'waiting_for_user',verified:true,current_url:safeUrl(u.href),interception_type:type,evidence:{source,text:String(text||'').replace(/\s+/g,' ').trim().slice(0,180)}});
 const route=challenge(u.href);if(route)return found(route,'current_page_url',safeUrl(u.href));
 for(const e of document.querySelectorAll('iframe,[role="dialog"],[aria-modal="true"],[class*="captcha"],[id*="captcha"],.nc-container,.nc_wrapper,.nc_scale,[id^="nc_"],[id*="baxia"]')){
  if(!visible(e))continue;
  const text=String(e.innerText||e.textContent||'').replace(/\s+/g,' ').trim();
  if(e.tagName==='IFRAME'){
   const src=e.getAttribute('src');const kind=src&&challenge(src);if(kind)return found(kind,'visible_iframe',safeUrl(src));
  }
  const identity=String(e.id||'')+' '+String(e.className||'');
  const widget=/captcha|nc[-_]|baxia/i.test(identity);
  const dialog=e.getAttribute('role')==='dialog'||e.getAttribute('aria-modal')==='true';
  if((widget||dialog)&&/拖动.{0,12}(滑块|验证)|滑动.{0,12}验证|请.{0,12}(完成|进行).{0,8}(安全|人机|滑块)?验证|点击.{0,12}验证|验证码.{0,8}(错误|输入)|访问被限制|访问验证/.test(text))return found('captcha','visible_challenge_widget',text);
  if(dialog&&/扫码登录|密码登录|请先登录|登录淘宝/.test(text)&&e.querySelector('input[type="password"],input[name="username"],input[name="TPL_username"],[class*="qrcode"],[class*="Qrcode"]'))return found('login','visible_login_dialog',text);
 }
 const body=(document.body?.innerText||'').slice(0,16000);
 if(!document.body||body.trim().length<80)return {status:'not_ready'};
 return {status:'ready',current_url:safeUrl(u.href)};
}
async function probe(name){
 const {sendCommand}=await import(require('./opencli-runtime.cjs').url('dist/src/browser/daemon-client.js'));
 const slot=['site:taobao','adapter'];
 const opts={session:slot[0],surface:slot[1],contextId:require('./taobao').PROFILE,...(slot[1]==='adapter'?{siteSession:'persistent'}:{})};
 // Read only: never navigate, create a tab, click a challenge, or access cookies.
 const tabs=await sendCommand('tabs',{op:'list',...opts});
 if(!Array.isArray(tabs)||!tabs.length)return {status:'page_missing'};
 const result=await sendCommand('exec',{code:'('+gateSnapshot.toString()+')()',...opts});
 return result&&typeof result==='object'&&'session'in result&&'data'in result?result.data:result;
}
function createAssistance({file=path.join(__dirname,'..','state','taobao-assistance.json'),check=probe,release=()=>require('./browser-guard').browserGuard.releaseVerification(),now=Date.now,maxAgeMs=30*60*1000}={}){
 const read=()=>{try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw Error('协助状态无法读取，请检查本地文件。')}};
 const save=s=>{fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(s),{mode:0o600});fs.renameSync(tmp,file);};
 const unresolvedFile=file+'.unresolved.json';
 const unresolved=()=>{try{const rows=JSON.parse(fs.readFileSync(unresolvedFile,'utf8'));if(!Array.isArray(rows))throw Error();return rows;}catch(e){if(e.code==='ENOENT')return [];throw Error('未知写入记录无法读取，已停止。');}};
 function preserveUncertainWrite(s){
  const rows=unresolved();if(rows.some(r=>r.id===s.id))return;
  rows.push({...s,retired_at:now(),write_result_uncertain:true});
  const tmp=unresolvedFile+'.tmp';fs.writeFileSync(tmp,JSON.stringify(rows),{mode:0o600});fs.renameSync(tmp,unresolvedFile);
 }
 function retire(s,reason){
  const archiveDir=file+'.archive';fs.mkdirSync(archiveDir,{recursive:true});
  const archive=path.join(archiveDir,crypto.createHash('sha256').update(s.id).digest('hex')+'.json');
  if(!fs.existsSync(archive))fs.writeFileSync(archive,JSON.stringify({...s,retired_at:now(),reason,write_result_uncertain:s.write===true}),{flag:'wx',mode:0o600});
  if(s.write)preserveUncertainWrite(s);
  fs.unlinkSync(file);
 }
 function current(){
  const s=read();if(!s)return null;
  if(!Number.isFinite(s.time)||now()<s.time||now()-s.time<maxAgeMs)return s;
  // Retire only the expired assistance gate. Keep original intent and uncertainty.
  retire(s,'assistance_expired');return null;
 }
 const response=s=>{const data={status:'waiting_for_user',resume_id:s.id,message:instruction,task:s.name,write_result_uncertain:s.write,...(s.verification?{verification:s.verification}:{})};return {content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError:false};};
 const hinted=value=>{const text=(value.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n');return (value.isError||['unknown','waiting_for_user'].includes(value.structuredContent?.status))&&/验证码|人工验证|要求验证|要求.*登录|重新登录|需要登录|当时没有登录|VERIFICATION_REQUIRED|LOGIN_REQUIRED|AUTH_REQUIRED|\bcaptcha\b|页面信号：[^\n]*\blogin\b/i.test(text);};
 return {
  blocked(name,args={}){
   const s=current();
   // A new user-directed task supersedes the old pending task. Retain uncertain
   // outcomes as history; they are not authority to prohibit later operations.
   // Cart operation IDs and consumed message tokens still prevent replay.
   if(s&&name){retire(s,'superseded_by_new_task');release();return null;}
   return s?response(s):null;
  },
  status(){const s=read();const active=s&&Number.isFinite(s.time)&&now()-s.time<maxAgeMs?s:null;return {pending_task:active?{tool:active.name,resume_id:active.id,verification:active.verification||null}:null,unresolved_write_count:unresolved().length,unresolved_write_policy:'history_only',unresolved_write_notice:'旧写入记录仅供核对，不限制新的授权操作；不自动重做结果未知的旧操作。'};},
  async captureVerified(name,args,value){
   if(!hinted(value))return value;
   let evidence;try{evidence=await check(name);}catch{}
   if(evidence?.status!=='waiting_for_user'||evidence.verified!==true){
    // A CLI keyword or a historical signal cannot establish current login state.
    // End the failed call without creating a task that blocks subsequent reads.
    release();
    const data={status:value.structuredContent?.status==='unknown'?'unknown':'verification_unconfirmed',message:'本次读取或操作未完成，但未在当前淘宝页面确认登录或验证码拦截；不能要求你处理不存在的提示。可按你的新要求继续，未知写入不要重试。',page_status:evidence?.status||'check_failed',...(evidence?.current_url?{current_url:evidence.current_url}:{}),...(value.structuredContent?.status==='unknown'?{operation_result:value.structuredContent}:{})};
    if(value.structuredContent?.status==='unknown')return {...value,content:[...(value.content||[]),{type:'text',text:JSON.stringify(data)}]};
    return {content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError:true};
   }
   const captured=this.capture(name,args,value);
   const s=read();if(s){s.verification=evidence;save(s);return response(s);}return captured;
  },
  capture(name,args,value){
   if(!hinted(value))return value;
   const existing=current();if(existing)return response(existing);
   const write=['taobao_add_cart'].includes(name)||name==='taobao_contact_seller'&&args.action==='send';
   const state={id:crypto.randomUUID(),name,args:write?{}:args,write,time:now()};save(state);return response(state);
  },
  async resume(args){
   if(!args||Object.keys(args).some(k=>!['resume_id','user_completed'].includes(k))||args.user_completed!==true)throw Error('需要用户明确完成验证后才检查一次。');
   const s=current();if(!s||s.id!==args.resume_id){if(unresolved().some(r=>r.id===args.resume_id))return {status:'manual_check_required',message:'旧写操作已隔离，结果仍未知；请人工核对，不能自动恢复或重复执行。'};throw Error('没有对应的待协助任务，过期的只读任务不会自动恢复。');}
   let state;try{state=await check(s.name)}catch{return {status:'check_failed',message:'原页面检查未完成，任务仍保留；不自动重试。'};}
   if(state?.status==='waiting_for_user'&&state.verified===true){s.verification=state;save(s);return response(s).structuredContent;}
   if(state?.status!=='ready'&&state?.status!=='page_missing')return {status:'check_failed',resume_id:s.id,message:'未取得可确认的页面状态；没有认定存在验证拦截，可按用户的新要求继续。',page_status:state?.status||'unknown'};
   // Completing login/verification does not establish the outcome of a write.
   // Persist uncertainty before removing the active gate, including across restarts.
   if(s.write)preserveUncertainWrite(s);
   release();fs.unlinkSync(file);
   return s.write?{status:'manual_check_required',message:'用户已确认处理，但此前写操作结果未知。请核对购物车或聊天记录，不能自动再次加购或发送。'}:{status:'ready_to_resume',page_missing:state.status==='page_missing',resume_request:{tool:s.name,arguments:s.args},message:state.status==='page_missing'?'原标签已丢失，尚未验证登录状态；按用户已处理的确认，恢复原只读任务一次。如果再次遇到验证，仍需用户协助。':'请继续原只读任务一次；若再次遇到验证，请再次通知用户，不连续重试。'};
  }
 };
}
module.exports={tool,createAssistance,gateSnapshot};
