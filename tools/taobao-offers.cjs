'use strict';
// Parses labels as evidence; it never applies a discount or guesses coupon eligibility.
function parseOffers({price_text='',price_label='',texts=[],source='unknown',item_id=null,sku_id=null,selected_specs=null}={}){
 const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
 const money=s=>/^\d+(?:\.\d{1,2})?$/.test(s)?Number(s):null;
 const raw=[...new Set(texts.filter(x=>typeof x==='string').map(clean).filter(Boolean))];
 const label=clean(price_label)||null;
 const p=clean(price_text).replace(/^[￥¥]\s*/,'');
 const price=money(p),offers=[];const seen=new Set();
 const add=x=>{const key=[x.type,x.threshold,x.amount,x.discount_percent,x.text,x.status].join('|');if(!seen.has(key)){seen.add(key);offers.push(x);}};
 for(const text of raw){
  const statusAt=index=>{const prefix=text.slice(0,index);const available=Math.max(prefix.lastIndexOf('可再享'),prefix.lastIndexOf('可领取'),prefix.lastIndexOf('待领取'),prefix.lastIndexOf('需领取'));const applied=Math.max(prefix.lastIndexOf('已享受'),prefix.lastIndexOf('已减'),prefix.lastIndexOf('已优惠'));return available>applied?'available_not_confirmed':applied>=0?'displayed_applied':'displayed_eligibility_unknown';};
  for(const m of text.matchAll(/(每)?满\s*([0-9]+(?:\.[0-9]{1,2})?)\s*(?:元)?\s*[-减]\s*([0-9]+(?:\.[0-9]{1,2})?)/g))add({type:m[1]?'repeating_threshold_reduction':'threshold_reduction',text:m[0],threshold:money(m[2]),amount:money(m[3]),currency:'CNY',status:statusAt(m.index),scope_confirmed:false,stacking_confirmed:false});
  for(const m of text.matchAll(/(?:官方)?立减\s*([0-9]+(?:\.[0-9]{1,2})?)\s*(元|%|％)/g))add({type:m[2]==='元'?'instant_reduction':'percentage_reduction',text:m[0],...(m[2]==='元'?{amount:money(m[1]),currency:'CNY'}:{discount_percent:money(m[1])}),status:statusAt(m.index),scope_confirmed:false,stacking_confirmed:false});
  for(const m of text.matchAll(/([0-9]+)\s*件\s*([0-9]+(?:\.[0-9]+)?)\s*折/g))add({type:'quantity_discount',text:m[0],required_quantity:Number(m[1]),pay_ratio:Number(m[2])/10,status:statusAt(m.index),scope_confirmed:false,stacking_confirmed:false});
 }
 const type=/优惠前|原价|划线/.test(label||'')?'before_discount':/优惠后|券后|到手/.test(label||'')?'displayed_after_discount':/补贴后/.test(label||'')?'displayed_after_subsidy':'displayed_unspecified';
 return {source,item_id,sku_id,selected_specs,display_price:price,price_text:clean(price_text)||null,price_label:label,price_type:type,promotions:offers,raw_texts:raw,eligibility_confirmed:false,complete:false,final_payable:null,note:'仅记录本页面展示。优惠后/补贴后价格不可再重复扣减旁列的立减；优惠适用规格、账户资格、凑单及叠加关系未确认。未显示不等于没有优惠。'};
}
module.exports={parseOffers};
