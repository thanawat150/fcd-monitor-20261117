/* Hash-addressable pages and a single overview comparison/audit. */
(() => {
  'use strict';
  const root=document.querySelector('#dash-root > .fcd'),nav=root.querySelector('.dashboard-nav');
  const filter=root.querySelector('.fcd-bar'),pair=root.querySelector('.fcd-pair'),grid=root.querySelector('.fcd-grid');
  const sourceNotes=Array.from(root.children).find(el=>el.tagName==='DETAILS');
  const create=(name,label)=>{const panel=document.createElement('section');panel.id='page-'+name;panel.className='dashboard-page';panel.setAttribute('aria-label',label);root.append(panel);return panel;};
  const overview=create('overview','ภาพรวม FCD'),maps=create('map','แผนที่รายแปลง'),province=create('province','กราฟรายจังหวัด'),table=create('table','ตารางข้อมูล');
  overview.append(document.getElementById('fcd-overview'),root.querySelector('.fcd-tiles'));
  maps.append(document.getElementById('map'),document.getElementById('by-plot'));
  province.append(document.getElementById('by-province'),document.getElementById('ranking'));
  table.append(document.getElementById('table'));
  const baseline=document.getElementById('baseline');
  const baselineDetails=document.createElement('details');baselineDetails.innerHTML='<summary>ข้อมูล baseline เดิม</summary><p class="fcd-sub">ระดับ FCD ของ baseline อ้างอิงชุดเดิม ไม่จัดระดับใหม่จากการกรองพื้นที่แดง</p>';baselineDetails.append(baseline);
  pair.remove();grid.remove();
  filter.id='dashboard-filters';nav.after(filter);
  const audit=document.createElement('section');audit.className='fcd-card edition-audit';audit.id='edition-audit';
  audit.innerHTML='<h2>พื้นที่ลดลงและค่าที่ควรตรวจ</h2><p id="edition-summary-line" aria-live="polite"></p><details><summary>เปรียบเทียบตัวเลขและสัดส่วนก่อน–หลัง</summary><div id="edition-comparison"></div></details><details><summary>ค่าที่ควรตรวจและที่มาของความต่าง</summary><div id="edition-issues"></div><button id="edition-download" type="button">ดาวน์โหลดผลเทียบรายแปลง CSV</button></details>';
  overview.append(audit,baselineDetails,sourceNotes);
  const plan=document.getElementById('planting-plan');plan.classList.add('dashboard-page');
  const panels={overview,map:maps,province,table,plan};
  const routes={'#overview':'overview','#fcd-overview':'overview','#map':'map','#by-plot':'map','#by-province':'province','#ranking':'province','#table':'table','#planting-plan':'plan'};
  function route(event) {
    const page=routes[location.hash]||'overview';
    for(const [name,panel] of Object.entries(panels))panel.hidden=name!==page;
    filter.hidden=page==='plan';
    document.getElementById('fcd-edition').hidden=page==='map';
    filter.querySelector('label[for=fcd-edition]').hidden=page==='map';
    for(const link of nav.querySelectorAll('a')){
      if(routes[link.hash]===page)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    }
    document.body.dataset.dashboardPage=page;
    window.dispatchEvent(new Event('dashboard-page-change'));
    if(page==='map'){
      const target=document.querySelector('.filtered-plot-map');if(target)window.CanopyMap.fit(target);
    }
    if(event){nav.scrollIntoView({block:'start'});const heading=panels[page].querySelector('h2,h3');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
  }
  const F=window.FCD,P=window.PlanCore,D=window.REDUCED_DATA;
  const fmt=n=>P.number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const pct=(value,total)=>fmt(total?value/total*100:0)+'%';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function comparisonRows() {return D.comparison.filter(r=>F.inScope({...r,book:r.pdd_book,ptype:r.plot.split('-').at(-1)}));}
  function renderAudit() {
    if(!F.originalRows)return;
    const before=F.originalRows.filter(F.inScope),after=F.filteredRows.filter(F.inScope),a=P.editionAudit(before,after,comparisonRows());
    const selected=F.state.edition==='filtered'?'FCD ลดสีแดง':'FCD เดิม';
    document.getElementById('edition-summary-line').textContent=`${selected} · เทียบชุดเดิม: พื้นที่แดงลด ${fmt(a.redDifference)} ไร่ (${pct(a.redDifference,a.old.low)}) · พบ ${fmt(new Set(a.issues.map(i=>i.plot)).size)} แปลงที่มีหมายเหตุควรตรวจ`;
    document.getElementById('edition-comparison').innerHTML=`
      <div class="edition-table-scroll"><table><thead><tr><th>ระดับ</th><th>FCD เดิม (ไร่ / %)</th><th>FCD ลดสีแดง (ไร่ / %)</th><th>ต่างกัน (ไร่)</th></tr></thead><tbody>${[['high','มาก · เขียว'],['mid','ปานกลาง · เหลือง'],['low','น้อย · แดง'],['none','ไม่ระบุระดับ']].map(([key,label])=>`<tr><td>${label}</td><td>${fmt(a.old[key])} / ${pct(a.old[key],a.old.total)}</td><td>${fmt(a.current[key])} / ${pct(a.current[key],a.current.total)}</td><td>${fmt(a.old[key]-a.current[key])}</td></tr>`).join('')}<tr><th>รวมที่แสดง</th><td>${fmt(a.old.total)} / ${pct(a.old.total,a.old.total)}</td><td>${fmt(a.current.total)} / ${pct(a.current.total,a.current.total)}</td><td>${fmt(a.old.total-a.current.total)}</td></tr></tbody></table></div>
      <p class="fcd-sub">สัดส่วนใหม่หารด้วยพื้นที่คงเหลือ ไม่รวมพื้นที่ที่ตัดออก และไม่ได้ย้ายพื้นที่ตัดออกไปเป็นสีเขียว • เปอร์เซ็นต์ปัด 2 ตำแหน่ง ผลรวมที่แสดงอาจต่างจาก 100.00% เล็กน้อย</p>
      <p class="fcd-sub">แยกที่มาของความต่างแดง: คัดพื้นที่/แยกผลตรวจภาพในชุดเดียวกัน ${fmt(a.filterRemoved)} ไร่ + ความต่างระหว่างชุดข้อมูลเดิมกับก่อนกรอง ${fmt(a.sourceRedDifference)} ไร่</p>`;
    const issues=a.issues.map(issue=>issue.kind==='source'?`${issue.plot}: เขียวต่าง ${fmt(issue.high)} ไร่ / เหลืองต่าง ${fmt(issue.mid)} ไร่ ระหว่างข้อมูลเดิมกับชุดปัจจุบัน ไม่ใช่ผลกรองแดง`:issue.kind==='boundary'?`${issue.plot}: หมายเหตุต้นฉบับระบุ “${issue.note}” ต้องตรวจขอบเขตและเวอร์ชันข้อมูล`:issue.kind==='increase'?`${issue.plot}: พื้นที่แดงเพิ่ม ${fmt(issue.rai)} ไร่ ต้องตรวจ`: `${issue.plot}: ค่า ${issue.field} ผิดรูปแบบหรือติดลบ`);
    const current=D.rows.filter(F.inScope),issueHigh=current.reduce((sum,r)=>sum+r.issue_high,0),issueMid=current.reduce((sum,r)=>sum+r.issue_mid,0);
    const levelDifference=['high','mid','low','none'].reduce((sum,k)=>sum+a.current[k],0)-a.current.total;
    document.getElementById('edition-issues').innerHTML=`${issues.length?`<ul>${issues.map(text=>`<li>${esc(text)}</li>`).join('')}</ul>`:'<p>ไม่พบค่าเพิ่มผิดทิศทาง ค่าติดลบ หรือหมายเหตุผิดสังเกตในตัวกรองนี้</p>'}<p>ชุดภาพล่าสุด: เขียวต่าง ${fmt(a.highDifference)} ไร่; เหลืองต่าง ${fmt(a.midDifference)} ไร่; ไม่ระบุระดับลด ${fmt(a.old.none-a.current.none)} ไร่ตามการเอาสีเทาออกบางแปลง</p><p>ผลตรวจภาพที่แยกไว้: ม่วง (ควรเป็นมาก) ${fmt(issueHigh)} ไร่; ชมพู (ควรเป็นปานกลาง) ${fmt(issueMid)} ไร่ ไม่บวกเข้าเขียว/เหลืองโดยอัตโนมัติ</p><p>ยอดรวม CSV กับผลบวกคอลัมน์ระดับต่าง ${fmt(levelDifference)} ไร่จากการปัดตัวเลขรายแปลง ใช้ยอดรวมตาม fcd_area.csv ชุดเดียวกับภาพที่แสดง</p><p>ตัวเลขกรองเป็นการคัดพื้นที่สำหรับวางแผน ไม่ใช่การวัดการลดลงของเรือนยอดตามเวลา</p>`;
  }
  document.getElementById('edition-download').onclick=()=>{
    const rows=comparisonRows(),url=URL.createObjectURL(new Blob([P.csv(rows,Object.keys(D.comparison[0]))],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='เปรียบเทียบก่อนหลังกรอง.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  window.addEventListener('hashchange',route);
  window.addEventListener('fcd-redraw',renderAudit);window.addEventListener('fcd-data-ready',renderAudit);
  renderAudit();route();
})();
