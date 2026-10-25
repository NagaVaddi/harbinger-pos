'use strict';
/* Inbound adapters: turn a delivery-app webhook payload into Harbinger's normalised online order.
   IMPORTANT: this generic mapper guesses common field names. Talabat, Deliveroo, Careem etc. each publish their own
   (partner-only) schema — once you have it, register an exact adapter in ADAPTERS below and unit-test it with real samples. */

const clean=(s,max)=>String(s==null?'':s).replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
const pick=(o,keys)=>{for(const k of keys){if(o&&o[k]!=null&&o[k]!=='')return o[k]}return undefined};
const num=v=>{const n=parseFloat(v);return isFinite(n)?n:0};

function generic(channel,p){
  if(!p||typeof p!=='object')throw new Error('Payload must be a JSON object');
  const extId=clean(pick(p,['orderId','order_id','id','orderToken','code','reference']),64);
  if(!extId)throw new Error('Missing order id');
  const items=pick(p,['items','products','lineItems','line_items','order_items']);
  if(!Array.isArray(items)||!items.length||items.length>100)throw new Error('Order has no items');
  const lines=items.map(i=>{
    const qty=Math.floor(num(pick(i,['quantity','qty','count'])));
    if(!(qty>=1&&qty<=100))throw new Error('Invalid item quantity');
    return {ext:{id:clean(pick(i,['id','itemId','item_id','productId','externalId','sku']),64),name:clean(pick(i,['name','title']),120),sku:clean(pick(i,['sku','posId','pos_id','plu']),64)},
      name:clean(pick(i,['name','title']),120)||'Item',qty:qty,price:num(pick(i,['unitPrice','unit_price','price'])),note:clean(pick(i,['comment','notes','note','instructions']),120)};
  });
  const c=pick(p,['customer','client','consumer'])||{};
  const addr=pick(c,['address','deliveryAddress'])||pick(p,['deliveryAddress','address']);
  const pay=String(pick(p,['paymentType','payment_method','paymentMethod','payment'])||'').toLowerCase();
  const typ=String(pick(p,['orderType','order_type','type','fulfilment','fulfillment'])||'').toLowerCase();
  const total=num(pick(p,['total','grandTotal','grand_total','totalPrice','total_price','amount']));
  return {extId:extId,track:'#'+extId.slice(-6).toUpperCase(),channel:channel,source:'aggregator',
    type:/pick|collect|take/.test(typ)?'pickup':'delivery',table:'',
    customer:{name:clean(pick(c,['name','fullName','firstName'])||pick(p,['customerName']),60)||'App customer',phone:clean(pick(c,['phone','phoneNumber','mobile'])||pick(p,['customerPhone']),20),address:clean(typeof addr==='object'?JSON.stringify(addr):addr,200)},
    lines:lines,note:clean(pick(p,['comment','notes','note','instructions']),200),deliveryFee:num(pick(p,['deliveryFee','delivery_fee'])),total:total,
    payment:/cash|cod/.test(pay)?'cod':'prepaid'};
}
const ADAPTERS={ /* talabat:(p)=>({...}), deliveroo:(p)=>({...}) — add exact, verified adapters here */ };
exports.normalize=(channel,payload)=>(ADAPTERS[channel]||((p)=>generic(channel,p)))(payload);
exports.generic=generic;
