'use strict';
// Offline protocol checks use a disposable, unconnected browser identity.
// They never prove a live Taobao session, cart operation or client rendering.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),readline=require('node:readline'),{spawn}=require('node:child_process');
test('standalone protocol exposes tools, native UI resources and safe local cache responses',async t=>{
 const source=path.dirname(__dirname),fixture=fs.mkdtempSync(path.join(__dirname,'protocol-fixture-'));
 for(const name of ['tools','taobao-cart','server.cjs','package.json'])fs.cpSync(path.join(source,name),path.join(fixture,name),{recursive:true});
 fs.mkdirSync(path.join(fixture,'state'));fs.writeFileSync(path.join(fixture,'state/browser-profile.json'),JSON.stringify({contextId:'offline-protocol-fixture'}));
 const child=spawn(process.execPath,[path.join(fixture,'server.cjs')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 let n=0,stderr='';const pending=new Map();child.stderr.on('data',b=>stderr+=b.toString());
 child.on('exit',()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error(stderr||'server exited'));}pending.clear();});
 readline.createInterface({input:child.stdout}).on('line',line=>{let r;try{r=JSON.parse(line)}catch{return;}const p=pending.get(r.id);if(p){pending.delete(r.id);clearTimeout(p.timer);p.resolve(r);}});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++n,timer=setTimeout(()=>reject(Error('protocol timeout '+stderr)),8000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
 try{
  const init=await call('initialize');assert.equal(init.result.serverInfo.version,'1.1.0');assert.ok(init.result.capabilities.resources);
  const list=await call('tools/list'),tools=list.result.tools,names=tools.map(x=>x.name);assert.equal(names.length,14);
  for(const name of ['taobao_search','taobao_browse_home','taobao_read_item','taobao_add_cart','taobao_contact_seller','taobao_resume','taobao_status','taobao_read_cart','taobao_read_sku','taobao_read_reviews','taobao_read_images','taobao_saved_items','taobao_product_cards','taobao_cart_select'])assert.ok(names.includes(name),name);
  assert.ok(!names.some(n=>/pay|checkout|place_order|tpwd/.test(n)));
  assert.equal(tools.find(t=>t.name==='taobao_search').inputSchema.properties.include_filters.default,false);
  assert.equal(tools.find(t=>t.name==='taobao_read_cart').annotations.readOnlyHint,true);
  assert.equal(tools.find(t=>t.name==='taobao_cart_select').annotations.readOnlyHint,false);
  const card=tools.find(t=>t.name==='taobao_product_cards');
  const resource=await call('resources/read',{uri:card._meta.ui.resourceUri});assert.equal(resource.result.contents[0].mimeType,'text/html;profile=mcp-app');assert.deepEqual(resource.result.contents[0]._meta.ui.csp.resourceDomains,[]);assert.match(resource.result.contents[0].text,/data:/);
  const saved=await call('tools/call',{name:'taobao_saved_items',arguments:{limit:1}});assert.equal(saved.result.structuredContent.browser_accessed,false);assert.equal(saved.result.structuredContent.count,0);
  const invalid=await call('tools/call',{name:'taobao_cart_select',arguments:{action:'preview',changes:[{line_id:'invalid',selected:true}]}});assert.equal(invalid.result.isError,true);assert.ok(!fs.existsSync(path.join(fixture,'state/taobao-browser-activity.json')));
  if(process.env.CHENG_RELEASE_SCHEMA_OUTPUT)fs.writeFileSync(process.env.CHENG_RELEASE_SCHEMA_OUTPUT,JSON.stringify(tools,null,2));
 }finally{
  const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();for(const p of pending.values())clearTimeout(p.timer);await exited;
  const resolved=path.resolve(fixture);if(!resolved.startsWith(path.resolve(__dirname)+path.sep)||!path.basename(resolved).startsWith('protocol-fixture-'))throw Error('Unsafe fixture cleanup path');fs.rmSync(resolved,{recursive:true,force:true});
 }
});
