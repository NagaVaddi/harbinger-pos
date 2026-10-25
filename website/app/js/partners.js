'use strict';
/* Delivery partners (own drivers / riders): directory, status, rating, and delivery counts from orders assigned to them. */

const VEHICLES=[['bike','Motorbike'],['car','Car'],['van','Van'],['cycle','Bicycle']];
const driverDeliveries=id=>DB.orders.filter(o=>o.driverId===id&&o.status==='completed').length;
const stars=n=>n>0?'★'.repeat(Math.round(n))+'<span class="muted">'+'★'.repeat(5-Math.round(n))+'</span> '+n:'—';
function vDrivers(){
  const rows=DB.drivers.filter(d=>match(UIS.q.drivers,[d.name,d.code,d.phone,d.plate])).slice().reverse();
  return head(tr('Delivery Partners'),'Your own riders and drivers, and who delivered what',btn('+ Add','driver-edit',null,'primary'))+'<div class="bar">'+searchBox('drivers','Search here…')+'</div>'+
    tbl([{h:'Partner',r:r=>'<b>'+esc(r.name)+'</b><br><span class="muted sm">'+esc(r.phone||'')+'</span>'},{h:'Code',r:r=>esc(r.code)},{h:'Vehicle',r:r=>esc((VEHICLES.find(v=>v[0]===r.vehicle)||['',''])[1])+(r.plate?'<br><span class="muted sm">'+esc(r.plate)+'</span>':'')},
      {h:'Deliveries',cls:'r',r:r=>driverDeliveries(r.id)},{h:'Rating',r:r=>stars(r.rating||0)},{h:'Status',r:r=>r.active?badge('Active','ok'):badge('Off duty','')},{h:'Added',r:r=>r.created?fmtDate(r.created):'—'},
      {h:'',cls:'r',r:r=>btn(r.active?'Set off duty':'Set active','driver-toggle',r.id)+' '+btn('Edit','driver-edit',r.id)+' '+btn('Delete','driver-del',r.id,'danger')}],rows,'No data found.');
}
A['driver-toggle']=d=>{const x=byId(DB.drivers,d.id);if(x){x.active=!x.active;save();render()}};
A['driver-del']=d=>{if(DB.orders.some(o=>o.driverId===d.id)){toast('This partner has deliveries on record; set them off duty instead','err');return}confirmBox('Delete this partner?',()=>{DB.drivers=DB.drivers.filter(x=>x.id!==d.id);save();render()},'Delete')};
A['driver-edit']=d=>{
  const x=d.id?byId(DB.drivers,d.id):{vehicle:'bike',active:true,rating:0};
  modal({title:d.id?'Edit partner':'New delivery partner',body:'<div class="form2">'+field('Name','name',x.name,{req:1,af:1,max:60})+field('Phone','phone',x.phone,{type:'tel',max:20})+select('Vehicle','vehicle',VEHICLES,x.vehicle)+field('Plate number','plate',x.plate,{max:14})+field('Rating (0–5, optional)','rating',x.rating||'',{type:'number',min:0,max:5,step:'0.1'})+'<span></span></div>'+check('Active','active',x.active),
    actions:[{label:tr('Cancel')},{label:tr('Save'),cls:'primary',fn:el=>{const f=formData(el),nm=(f.name||'').trim();if(!nm){toast('Name is required','err');return false}
      const rec={name:nm,phone:(f.phone||'').replace(/\s+/g,''),vehicle:f.vehicle,plate:(f.plate||'').trim().toUpperCase(),rating:Math.max(0,Math.min(5,Math.round(num(f.rating)*10)/10)),active:!!f.active};
      if(d.id)Object.assign(x,rec);else{DB.seq.driver=(DB.seq.driver||0)+1;DB.drivers.push(Object.assign({id:uid('dr'),code:'DR-'+String(DB.seq.driver).padStart(3,'0'),created:now()},rec))}
      audit(d.id?'driver.edit':'driver.add',nm);save();render()}}]});
};
A['r-driver']=()=>{
  const list=DB.drivers.filter(x=>x.active);
  modal({title:'Who is delivering?',body:'<div class="picks">'+(list.map(p=>'<button type="button" class="pick" data-dv="'+p.id+'"><b>'+esc(p.name)+'</b><span class="muted">'+esc(p.code)+'</span></button>').join('')||'<div class="empty">No active partners. Add them under Delivery Partners.</div>')+'</div>',
    onOpen:el=>el.addEventListener('click',e=>{const b=e.target.closest('[data-dv]');if(b){R.driverId=b.dataset.dv;closeModal(true);render()}}),
    actions:[{label:'No driver',fn:()=>{R.driverId=null;render()}}]});
};
A['r-driver-x']=()=>{R.driverId=null;render()};
