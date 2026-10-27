'use strict';
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
function createRuntime(root=path.join(__dirname,'..')){
 const file=path.join(root,'state','opencli-runtime.json'),fallback='opencli-1.8.7';
 const valid=name=>typeof name==='string'&&/^(?:opencli-\d+\.\d+\.\d+|managed\/\d+\.\d+\.\d+\/node_modules\/@jackwener\/opencli)$/.test(name);
 function read(){try{const s=JSON.parse(fs.readFileSync(file,'utf8'));if(!valid(s.active)||s.previous&&!valid(s.previous))throw Error('invalid');return s;}catch(e){if(e.code==='ENOENT')return {active:fallback};throw Error('OpenCLI版本记录无法读取，请使用恢复旧版。');}}
 function resolve(name=read().active){if(!valid(name))throw Error('OpenCLI版本路径无效。');return path.join(root,'runtime',name);}
 function select(active,previous){resolve(active);if(previous)resolve(previous);const s={active,previous:previous||null,changed_at:new Date().toISOString()};fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(s));fs.renameSync(file+'.tmp',file);return s;}
 const url=relative=>pathToFileURL(path.join(resolve(),relative)).href;
 return {root,file,read,resolve,select,url,entry:()=>path.join(resolve(),'dist/src/main.js')};
}
module.exports={...createRuntime(),createRuntime};
