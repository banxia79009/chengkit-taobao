'use strict';
const cart=require('./taobao-cart-read.cjs'),sku=require('./taobao-sku.cjs');
const reading=require('./taobao-reading.cjs'),cards=require('./taobao-cards.cjs'),selection=require('./taobao-cart-select.cjs');
const tools=[cart.tool,selection.tool,sku.tool,...reading.tools,cards.tool];
async function call(name,args){if(name===cart.tool.name)return cart.read(args);if(name===selection.tool.name)return selection.call(args);if(name===sku.tool.name)return sku.read(args);if(name===cards.tool.name)return cards.render(args);if(reading.tools.some(t=>t.name===name))return reading.call(name,args);throw Error('未知淘宝扩展工具。');}
module.exports={tools,call};
