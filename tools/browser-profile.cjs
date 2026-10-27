'use strict';
const fs=require('node:fs'),path=require('node:path');
function read(){try{const p=JSON.parse(fs.readFileSync(path.join(__dirname,'..','state','browser-profile.json'),'utf8'));if(!/^[A-Za-z0-9_-]{4,80}$/.test(p.contextId||''))throw Error();return p.contextId;}catch{throw Error('尚未绑定浏览器。请先运行 scripts/bind-browser.cjs。');}}
module.exports={read};
