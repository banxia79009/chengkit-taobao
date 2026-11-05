'use strict';
const fs=require('node:fs'),path=require('node:path');
const ACTION_INTERVAL_MS=10_000;
function createGap({directory=path.join(__dirname,'..','state'),now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms)),interval=ACTION_INTERVAL_MS}={}){
 const file=path.join(directory,'taobao-action-gap.json'),lock=file+'.lock';
 async function run(task){
  fs.mkdirSync(directory,{recursive:true});let fd;
  try{fd=fs.openSync(lock,'wx');}catch(e){if(e.code==='EEXIST')throw Error('已有淘宝内部操作正在进行，本次没有重复操作。');throw e;}
  const save=()=>{const temp=file+'.'+process.pid+'.tmp';fs.writeFileSync(temp,JSON.stringify({next_allowed_at:now()+interval}));fs.renameSync(temp,file);};
  try{
   let next=0;try{const state=JSON.parse(fs.readFileSync(file,'utf8'));if(!Number.isFinite(state.next_allowed_at))throw Error('淘宝内部间隔记录无效');next=state.next_allowed_at;}catch(e){if(e.code!=='ENOENT')throw e;}
   while(now()<next)await sleep(Math.min(interval,next-now()));
   save();try{return await task();}finally{save();}
  }finally{fs.closeSync(fd);fs.unlinkSync(lock);}
 }
 return {run};
}
module.exports={ACTION_INTERVAL_MS,createGap,gap:createGap()};
