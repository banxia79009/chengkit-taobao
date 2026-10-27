'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function createGate(root=path.join(__dirname,'..')){
 const lock=path.join(root,'state','opencli-update.lock'),directory=path.join(root,'state','opencli-operations');
 async function run(task){fs.mkdirSync(directory,{recursive:true});const marker=path.join(directory,process.pid+'-'+crypto.randomUUID()+'.json');fs.writeFileSync(marker,JSON.stringify({pid:process.pid,time:Date.now()}),{flag:'wx'});
  try{if(fs.existsSync(lock))throw Error('工具正在更新，当前操作尚未执行；更新完成后即可继续。');return await task();}finally{fs.unlinkSync(marker);}
 }
 function hasActive(){try{return fs.readdirSync(directory).some(n=>n.endsWith('.json'));}catch(e){if(e.code==='ENOENT')return false;throw e;}}
 const runMessage=(message,task)=>message.method==='tools/call'&&/^taobao_/.test(message.params?.name||'')?run(task):task();
 return {run,runMessage,hasActive,lock};
}
module.exports={...createGate(),createGate};
