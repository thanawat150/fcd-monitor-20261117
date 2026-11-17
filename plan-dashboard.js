/* A concise planting page: area cards, PDD chart and shared polygon map. */
(() => {
  'use strict';
  const P=window.PlanCore,D=window.REDUCED_DATA;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>P.number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const nav=document.querySelector('.dashboard-nav');
  const link=document.createElement('a');link.href='#planting-plan';link.textContent='วางแผน ตรวจติดตาม';nav.append(link);
  const root=document.createElement('section');root.id='planting-plan';root.hidden=true;root.setAttribute('aria-labelledby','plan-title');nav.after(root);
  if(!D){root.textContent='โหลดข้อมูลวางแผนไม่สำเร็จ กรุณาโหลดหน้าใหม่';return;}
  const plots=D.rows.map(r=>({...r,pdd_book:r.book,red:r.low,yellow:r.mid,green:r.high}));
  const state={province:'',book:'',type:'',plot:''};let syncing=false;
  root.innerHTML=`<header class="plan-head"><div><h2 id="plan-title">วางแผน ตรวจติดตาม</h2><p>พื้นที่การปกคลุมเรือนยอดฉบับลดสีแดง</p></div><span class="plan-tag">ข้อมูลกรองแล้ว</span></header>
    <div class="fcd-card"><div class="plan-filters">
      <label>จังหวัด<select id="plan-province"><option value="">ทุกจังหวัด</option></select></label>
      <label>เล่ม PDD<select id="plan-book"><option value="">ทุกเล่ม PDD</option></select></label>
      <label>ประเภทแปลง<select id="plan-type"><option value="">STC และ VSD</option><option>STC</option><option>VSD</option></select></label>
      <label>แปลง<select id="plan-plot"><option value="">ทุกแปลง</option></select></label>
      <button id="plan-reset" type="button">ล้างตัวกรอง</button></div><p id="plan-scope" class="fcd-sub" role="status"></p></div>
    <section class="fcd-card"><h3 class="plan-panel-title">พื้นที่รายเล่ม PDD</h3><div class="plan-legend"><span><i class="sw sw-high"></i>มาก (เขียว)</span><span><i class="sw sw-mid"></i>ปานกลาง (เหลือง)</span><span><i class="sw sw-low"></i>น้อย (แดง)</span></div><p class="fcd-sub">หน่วยไร่ • กดแถบเพื่อกรอง</p><div class="plan-chart" id="plan-book-chart"></div></section>
    <section class="fcd-card" id="plan-map-section"><div class="plan-row"><h3 class="plan-panel-title">แผนที่พื้นที่วางแผน</h3><button id="plan-fit" type="button">แสดงพื้นที่ตามตัวกรอง</button></div>
      <div class="plan-kpis" id="plan-kpis" aria-live="polite"></div>
      <div class="plan-map-navigation"><p id="plan-current-plot" role="status" aria-live="polite"></p><div class="plan-map-buttons"><button id="plan-back" type="button" aria-label="แสดงแปลงก่อนหน้า">← Back</button><button id="plan-next" type="button" aria-label="แสดงแปลงถัดไป">Next →</button></div></div>
      <p id="plan-map-status" class="fcd-sub" role="status"></p><div id="plan-map" class="plan-map"></div>
      <div class="plan-legend"><span>🟩 มาก</span><span>🟨 ปานกลาง</span><span>🟥 น้อย</span><span>เส้นขาว = ขอบเขต</span><span><i class="plan-key" style="border-color:#35b7d6;border-style:dashed"></i>ฟ้า = ตัดออก/เว้นว่าง</span><span><i class="plan-key" style="border-color:#c000ff"></i>ม่วง = ควรเป็นมาก</span><span><i class="plan-key" style="border-color:#ff69b4"></i>ชมพู = ควรเป็นปานกลาง</span></div>
      <p class="fcd-sub">ม่วง/ชมพูเป็นผลตรวจภาพแยกไว้ ไม่รวมเป็นเขียว/เหลืองอัตโนมัติ • คลิกพื้นที่เพื่อดูรายละเอียด</p></section>
    <details class="plan-methods"><summary>ที่มา ขั้นตอนการกรอง และข้อจำกัด</summary><div class="fcd-card plan-explainer">
      <p>การ์ดและกราฟใช้ fcd_area.csv ชุดเดียวกับภาพแผนที่ล่าสุด กราฟรวมเฉพาะเขียว/เหลือง/แดง ไม่รวมไม่ระบุระดับและโซนผลตรวจภาพ ดูค่าที่ลดลงในหน้าภาพรวม FCD และเปิดภาพรายแปลงในหน้าแผนที่</p>
      <ul><li>ตัดตามขอบเขตใช้งาน กรองแดงริมน้ำที่ตรวจภาพแล้ว และผืนแดงเล็กกว่า 2.00 ไร่; ไม่กรองสีเหลือง</li><li>ตัดแดงทั้งแปลง 79-STC/80-STC และบางโซนของ 81-STC, 88-STC, 102-VSD ตามคำสั่งเดิม; เก็บหาดเลน 68/69-STC, 97-VSD และบ่อกุ้ง 19-VSD ตามที่กำหนด</li><li>FCD จาก Landsat 8 ความละเอียด 30 ม. และภาพดาวเทียมไม่ทราบวันถ่าย/ระดับน้ำ ต้องยืนยันภาคสนามก่อนปลูก</li><li>ผลตรวจภาพแดงจริง/แดงปลอมจาก AI และประมาณเรือนยอด RGB ไม่ใช่การคำนวณ FCD ใหม่</li><li>พื้นที่จาก geometry ใน UTM 47N; 1 ไร่ = 1,600 ม² ไม่ใช่เนื้อที่ตารางคุม รูปเว็บลดความละเอียดเพื่อแสดงผล ไม่ใช้รังวัด</li></ul></div></details>`;
  const $=id=>document.getElementById(id);
  for(const [id,key] of [['plan-province','province'],['plan-book','pdd_book']])
    for(const value of [...new Set(plots.map(r=>r[key]))].sort((a,b)=>a.localeCompare(b,'th')))$(id).append(new Option(value,value));
  function setFilter(key,value) {
    state[key]=value;if(key!=='plot')state.plot='';
    const prefix={province:'p:',book:'b:',type:'t:'}[key];
    if(prefix){syncing=true;window.FCD?.setScope(value?prefix+value:'all');syncing=false;}
    render();
  }
  for(const [id,key] of [['plan-province','province'],['plan-book','book'],['plan-type','type'],['plan-plot','plot']])$(id).onchange=e=>setFilter(key,e.target.value);
  $('plan-reset').onclick=()=>{Object.assign(state,{province:'',book:'',type:'',plot:''});syncing=true;window.FCD?.setScope('all');syncing=false;render();};
  $('plan-fit').onclick=()=>window.CanopyMap.fit($('plan-map'));
  $('plan-next').onclick=()=>setFilter('plot',P.nextPlot(plots,state));
  $('plan-back').onclick=()=>setFilter('plot',P.nextPlot(plots,state,-1));
  if(window.FCD) {
    const previous=FCD.setScope;
    FCD.setScope=function(scope){previous(scope);if(syncing)return;Object.assign(state,{province:'',book:'',type:'',plot:''});const key={'p:':'province','b:':'book','t:':'type'}[scope.slice(0,2)];if(key)state[key]=scope.slice(2);render();};
  }
  function render() {
    const options=P.filter(plots,{...state,plot:''});if(state.plot&&!options.some(r=>r.plot===state.plot))state.plot='';
    $('plan-plot').replaceChildren(new Option('ทุกแปลง',''),...options.map(r=>new Option(`${r.plot} · ${r.province}`,r.plot)));
    const current=options.find(r=>r.plot===state.plot);
    $('plan-current-plot').textContent=current?`แปลงปัจจุบัน: ${current.plot} · ${current.province} (${options.indexOf(current)+1}/${options.length})`:options.length?`แสดงทุกแปลงตามตัวกรอง (${options.length} แปลง)`:'ไม่พบแปลงตามตัวกรอง';
    $('plan-next').disabled=options.length===0;
    $('plan-back').disabled=options.length===0;
    for(const [id,key] of [['plan-province','province'],['plan-book','book'],['plan-type','type'],['plan-plot','plot']])$(id).value=state[key];
    const rows=P.filter(plots,state),sum=key=>rows.reduce((s,r)=>s+r[key],0);
    $('plan-scope').textContent=`${[state.province,state.book,state.type,state.plot].filter(Boolean).join(' · ')||'ทุกแปลง'} · ${fmt(rows.length)} แปลง`;
    $('plan-kpis').innerHTML=[['พื้นที่แดง','red','red'],['พื้นที่เหลือง','yellow','yellow'],['พื้นที่เขียว','green','green']].map(([name,key,color])=>`<dl class="plan-kpi ${color}"><dt>${name}</dt><dd>${fmt(sum(key))} <small>ไร่</small></dd></dl>`).join('');
    const grouped=new Map();for(const row of rows){if(!grouped.has(row.pdd_book))grouped.set(row.pdd_book,[]);grouped.get(row.pdd_book).push(row);}
    const books=[...grouped].map(([label,group])=>({label,...Object.fromEntries(['red','yellow','green'].map(k=>[k,group.reduce((s,r)=>s+r[k],0)]))})).sort((a,b)=>(b.red+b.yellow+b.green)-(a.red+a.yellow+a.green));
    const max=Math.max(1,...books.map(b=>b.red+b.yellow+b.green));
    $('plan-book-chart').innerHTML=books.map((b,i)=>`<button class="plan-bar" type="button" data-book="${i}" title="${esc(b.label)}: เขียว ${fmt(b.green)} / เหลือง ${fmt(b.yellow)} / แดง ${fmt(b.red)} ไร่"><span class="plan-bar-label">${esc(b.label)}</span><span class="plan-bar-track">${[['green','#3d9a58'],['yellow','#dfae1c'],['red','#d6452f']].map(([k,c])=>`<i style="width:${b[k]/max*100}%;background:${c}"></i>`).join('')}</span><span class="plan-bar-total">${fmt(b.green+b.yellow+b.red)}</span></button>`).join('')||'<p>ไม่พบพื้นที่ตามตัวกรอง</p>';
    $('plan-book-chart').querySelectorAll('button').forEach(b=>b.onclick=()=>setFilter('book',books[+b.dataset.book].label));
    if(location.hash==='#planting-plan')window.CanopyMap.render($('plan-map'),state,$('plan-map-status'));
  }
  window.addEventListener('dashboard-page-change',()=>{if(location.hash==='#planting-plan')render();});
  render();
})();
