'use strict';
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.dirname(__dirname),version='2.0.2';
const runtime=path.join(root,'runtime','managed',version,'node_modules','@jackwener','opencli');
if(!fs.existsSync(path.join(runtime,'package.json')))throw Error('请先运行 Install.ps1 安装官方OpenCLI。');
const state=path.join(root,'state');fs.mkdirSync(state,{recursive:true});
const pointer=path.join(state,'opencli-runtime.json');if(!fs.existsSync(pointer))fs.writeFileSync(pointer,JSON.stringify({active:'managed/'+version+'/node_modules/@jackwener/opencli'}));
const adapters=path.join(state,'opencli-home','.opencli','clis','taobao');fs.mkdirSync(adapters,{recursive:true});
for(const name of ['search.js','read-cheng.js','add-cart.js']){const template=fs.readFileSync(path.join(root,'templates',name),'utf8');const text=template.replaceAll('{{TOOLS_URL}}',pathToFileURL(path.join(root,'tools')).href).replaceAll('{{CART_CORE_URL}}',pathToFileURL(path.join(root,'taobao-cart','core.cjs')).href);fs.writeFileSync(path.join(adapters,name),text);}
const command=process.execPath,args=[path.join(root,'server.cjs')];
fs.writeFileSync(path.join(root,'mcp-config.generated.json'),JSON.stringify({mcpServers:{taobao:{command,args}}},null,2));
console.log('官方程序及独立适配器已准备好；未改动其他OpenCLI的适配器、浏览器账号或凭证。');
