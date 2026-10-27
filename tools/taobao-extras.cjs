'use strict';
const cart=require('./taobao-cart-read.cjs'),sku=require('./taobao-sku.cjs');
const tools=[cart.tool,sku.tool];
async function call(name,args){if(name===cart.tool.name)return cart.read(args);if(name===sku.tool.name)return sku.read(args);throw Error('未知淘宝扩展工具。');}
module.exports={tools,call};
