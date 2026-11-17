/* Shared map for the filtered plot view and planting page; no point layer. */
(() => {
  'use strict';
  const P=window.PlanCore, pending={}, instances=new WeakMap();
  const labels={green:'มาก (เขียว)',yellow:'ปานกลาง (เหลือง)',red:'น้อย (แดง)',removed:'ตัดออก/เว้นว่าง (ฟ้า)',issue_high:'ควรเป็นมากจากการตรวจภาพ (ม่วง)',issue_mid:'ควรเป็นปานกลางจากการตรวจภาพ (ชมพู)',boundary:'ขอบเขตใช้งาน'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>P.number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  function read(name) {
    if(window.CURRENT_LAYERS?.[name])return Promise.resolve(window.CURRENT_LAYERS[name]);
    if(pending[name])return pending[name];
    pending[name]=(location.protocol==='file:'?new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=`data/current/${name}.js`;
      script.onload=()=>resolve(window.CURRENT_LAYERS[name]);script.onerror=()=>reject(new Error(name));document.head.append(script);
    }):fetch(`data/current/${name}.geojson?v=${window.REDUCED_DATA.version||''}`,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();})).then(data=>{
      window.CURRENT_LAYERS=window.CURRENT_LAYERS||{};window.CURRENT_LAYERS[name]=data;return data;
    }).catch(error=>{delete pending[name];throw error;});
    return pending[name];
  }
  function style(f,name) {
    if(name==='boundary')return {color:'#fff',weight:2,fill:false,interactive:false};
    if(name==='removed')return {color:'#35b7d6',dashArray:'7 5',weight:2,fillColor:'#35b7d6',fillOpacity:.2};
    if(name==='issue_high')return {color:'#aa00dc',weight:3,fillColor:'#c000ff',fillOpacity:.42};
    if(name==='issue_mid')return {color:'#e63c96',weight:3,fillColor:'#ff69b4',fillOpacity:.47};
    if(name==='green')return {color:'#3d9a58',weight:1,fillOpacity:.38};
    if(name==='yellow')return {color:'#efbf36',weight:1,fillOpacity:.38};
    const review=f.properties.visual_class||'';
    return {fillColor:'#e54535',fillOpacity:.5,weight:3,
      color:review.includes('น้ำ/บ่อ')?'#159dc9':review.includes('ก้ำกึ่ง')?'#ec8b21':review.includes('แดงปลอม')?'#9953ba':'#e64639',
      dashArray:/ก้ำกึ่ง|แดงปลอม/.test(review)?'7 5':null};
  }
  function popup(f) {
    const p=f.properties;
    const box=document.createElement('div');box.className='plan-popup';
    const hasCoordinates=p.lat!==null&&p.lon!==null&&p.lat!==undefined&&p.lon!==undefined&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lon);
    box.innerHTML=`<h3>${esc(p.plot)} · ${esc(labels[p.level]||p.level)}</h3><dl>${[['จังหวัด',p.province],['เล่ม PDD',p.pdd_book],['เนื้อที่',fmt(p.rai)+' ไร่'],['E / N',p.E?`${fmt(p.E)} / ${fmt(p.N)} ม. (UTM 47N)`:'—'],['หมายเหตุ',p.visual_note||'—']].map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>${hasCoordinates?`<div class="plan-row"><button type="button" data-copy>คัดลอกพิกัด</button><a href="https://www.google.com/maps/search/?api=1&query=${+p.lat},${+p.lon}" target="_blank" rel="noopener">เปิด Google Maps</a></div><p data-copy-status role="status">${p.lat}, ${p.lon} (WGS84)</p>`:''}`;
    if(hasCoordinates)box.querySelector('[data-copy]').onclick=async()=>{
      const text=`${p.lat}, ${p.lon}`;
      try {await navigator.clipboard.writeText(text);box.querySelector('[data-copy-status]').textContent='คัดลอกแล้ว: '+text;}
      catch {box.querySelector('[data-copy-status]').textContent='คัดลอกด้วยตนเอง: '+text;}
    };
    return box;
  }
  function update(engine) {
    if(engine.disposed)return;
    const {map,groups,query,loaded}=engine;
    for(const [name,data] of Object.entries(loaded)) {
      const visible=data.features.filter(f=>P.filter([f.properties],query).length);
      groups[name].clearLayers();
      L.geoJSON(visible,{style:f=>style(f,name),onEachFeature:(f,layer)=>{
        if(name==='boundary')return;
        layer.bindPopup(()=>popup(f),{minWidth:200,maxWidth:330,maxHeight:Math.max(180,Math.min(380,map.getSize().y-100))});
        layer.bindTooltip(esc(f.properties.part_id||f.properties.plot));
      }}).eachLayer(layer=>groups[name].addLayer(layer));
    }
    fit(engine);
    const active=Object.keys(labels).filter(name=>map.hasLayer(groups[name]));
    const plotCount=loaded.boundary?.features.filter(f=>P.filter([f.properties],query).length).length;
    engine.status.textContent=plotCount===0?'ไม่พบพื้นที่ตามตัวกรอง':`แสดง ${active.map(n=>labels[n]).join(' · ')}${plotCount===undefined?'':` · ${fmt(plotCount)} แปลง`}`;
    if(engine.errors.size) {
      engine.status.append(' · โหลดไม่สำเร็จ: '+[...engine.errors].map(n=>labels[n]).join(', '));
      const retry=document.createElement('button');retry.type='button';retry.textContent='ลองใหม่';retry.onclick=()=>load(engine,[...engine.errors]);engine.status.append(retry);
    }
  }
  function fit(engine) {
    if(engine.disposed)return;
    engine.map.invalidateSize();
    if(!engine.loaded.boundary)return;
    const features=engine.loaded.boundary.features.filter(f=>P.filter([f.properties],engine.query).length);
    if(!features.length)return;
    const bounds=L.geoJSON(features).getBounds();if(bounds.isValid())engine.map.fitBounds(bounds,{padding:[22,22],maxZoom:18,animate:false});
  }
  async function load(engine,names) {
    const results=await Promise.allSettled(names.map(read));
    results.forEach((result,i)=>{const name=names[i];if(result.status==='fulfilled'){engine.loaded[name]=result.value;engine.errors.delete(name);}else engine.errors.add(name);});
    if(!engine.disposed)update(engine);
  }
  function dispose(target) {
    const engine=instances.get(target);
    if(engine){engine.disposed=true;engine.map.stop();engine.map.remove();instances.delete(target);}
  }
  function render(target,query={},status) {
    let engine=instances.get(target);
    if(engine&&!target.contains(engine.surface)){dispose(target);engine=null;}
    if(engine){engine.query={...query};engine.status=status;update(engine);return;}
    if(!window.L){status.textContent='โหลดแผนที่ไม่สำเร็จ กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วโหลดหน้าใหม่';return;}
    const surface=document.createElement('div');surface.className='canopy-map-surface';surface.setAttribute('aria-label','แผนที่ FCD ฉบับลดสีแดง');target.replaceChildren(surface);
    const map=L.map(surface,{preferCanvas:true,scrollWheelZoom:false,zoomControl:false}).setView([9,99],7);
    L.control.zoom({zoomInTitle:'ขยายแผนที่',zoomOutTitle:'ย่อแผนที่'}).addTo(map);
    const sat=L.tileLayer('https://mt1.google.com/vt/lyrs=y&hl=th&x={x}&y={y}&z={z}',{attribution:'© <a href="https://www.google.com/maps" target="_blank" rel="noopener">Google</a>',maxZoom:21,maxNativeZoom:20}).addTo(map);
    const street=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',maxZoom:19});
    const groups=Object.fromEntries(Object.keys(labels).map(name=>[name,L.featureGroup().addTo(map)]));
    L.control.layers({'Google Satellite Hybrid':sat,'แผนที่ถนน':street},Object.fromEntries(Object.entries(labels).map(([key,label])=>[label,groups[key]])),{collapsed:true}).addTo(map);
    const toggle=surface.querySelector('.leaflet-control-layers-toggle');toggle.title='เปิดปิดชั้นข้อมูล';toggle.setAttribute('aria-label','เปิดปิดชั้นข้อมูล');
    L.control.scale({imperial:false}).addTo(map);
    engine={map,surface,groups,query:{...query},status,loaded:{},errors:new Set(),disposed:false};instances.set(target,engine);
    map.on('overlayadd overlayremove',()=>update(engine));
    status.textContent='กำลังโหลดพื้นที่ FCD…';load(engine,Object.keys(labels));
  }
  window.CanopyMap={render,fit:target=>{const engine=instances.get(target);if(engine)fit(engine);},dispose};
})();
