'use strict';
const {parseOffers}=require('./taobao-offers.cjs');
const money=text=>{const s=String(text||'').replace(/[,，\s￥¥]/g,'');return /^\d+(?:\.\d{1,2})?$/.test(s)?Number(s):null;};
function pricing(item){
 const evidence=item.price_evidence||[];
 const before=evidence.filter(e=>e.role==='original'&&e.amount!==null);
 const after=evidence.filter(e=>e.role==='after_discount'&&e.amount!==null);
 const unique=list=>{const values=[...new Set(list.map(e=>e.amount))];return values.length===1?values[0]:null;};
 const offers=parseOffers({price_text:item.price===null?'':String(item.price),price_label:item.price_label,texts:item.promotion_texts||[],source:'cart_row_dom',item_id:item.item_id,sku_id:item.sku_id,selected_specs:item.selected_spec});
 return {...item,original_price:unique(before),discounted_price:unique(after),pricing:{...offers,original_price:unique(before),discounted_price:unique(after),price_evidence:evidence,quantity_scope:'unit_price',final_payable:null,note:'保留网页原价、优惠后价及优惠原文；优惠后价格不可重复扣旁列立减。满减是否适用与叠加须以勾选后购物车合计为准，不能当作结算金额。'}};
}
module.exports={pricing,money};
