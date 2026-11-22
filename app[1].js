(() => {
  'use strict';
  const config = window.NIHSS_CONFIG;
  const $ = (id) => document.getElementById(id);
  const KEY = 'stroke-assessment-demo-v1';
  const API_KEY = 'stroke-assessment-api-url';
  let records = readRecords();
  const localDate = (date = new Date()) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,10);

  function readRecords() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
  function persist() { localStorage.setItem(KEY, JSON.stringify(records)); }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function total(scores) { return Object.values(scores || {}).reduce((sum, value) => sum + (Number.isFinite(Number(value)) ? Number(value) : 0), 0); }
  function stats(rows) {
    const n = rows.filter(r => Number.isFinite(r.nihss)).map(r => r.nihss);
    const b = rows.filter(r => Number.isFinite(r.barthel)).map(r => r.barthel);
    return {count: rows.length, average: n.length ? n.reduce((a,x)=>a+x,0)/n.length : null, max: n.length ? Math.max(...n) : null,
      barthelAverage: b.length ? b.reduce((a,x)=>a+x,0)/b.length : null, barthelMax: b.length ? Math.max(...b) : null};
  }
  window.AssessmentMath = {total, stats, scoreSum: data => Object.values(data || {}).reduce((a,v)=>a+(typeof v === 'number' ? v : 0),0)};

  function renderCatalog(items, target, prefix) {
    const host = $(target);
    host.innerHTML = items.map(item => {
      const options = item.options.map(([score,label]) => `<span class="choice"><input type="radio" id="${prefix}-${item.id}-${score}" name="${prefix}-${item.id}" value="${score}" data-item="${item.id}"><label for="${prefix}-${item.id}-${score}"><em>${score}</em> ${escapeHtml(label)}</label></span>`).join('');
      const un = item.un ? `<span class="choice"><input type="radio" id="nihss-${item.id}-UN" name="nihss-${item.id}" value="UN" data-item="${item.id}"><label for="nihss-${item.id}-UN"><em>UN</em> ทดสอบไม่ได้</label></span>` : '';
      const reason = (item.un || item.id === '10') ? `<input class="reason" id="reason-${item.id}" maxlength="120" placeholder="ระบุเหตุผลของ UN" aria-label="เหตุผล UN ข้อ ${item.id}">` : '';
      return `<article class="score-card" data-card="${prefix}-${item.id}"><div class="score-title"><b>${item.id} · ${escapeHtml(item.title)}</b><span>สูงสุด ${Math.max(...item.options.map(o=>o[0]))}</span></div><div class="choices">${options}${un}</div>${reason}</article>`;
    }).join('');
  }
  // Build every field before attaching listeners; event delegation covers all generated controls.
  renderCatalog(config.sections, 'scoreSections', 'nihss');
  renderCatalog(config.barthel, 'barthelSections', 'barthel');
  $('examDate').value = localDate();

  function readScores(prefix, items) {
    const result = {}; let complete = true, reasonMissing = false;
    for (const item of items) {
      const selected = document.querySelector(`input[name="${prefix}-${item.id}"]:checked`);
      if (!selected) { complete = false; continue; }
      result[item.id] = selected.value === 'UN' ? 'UN' : Number(selected.value);
      if (selected.value === 'UN') {
        const reason = $(`reason-${item.id}`);
        if (reason && !reason.value.trim()) { reasonMissing = true; reason.closest('.score-card').classList.add('invalid'); }
        else if (reason) result[`${item.id}_reason`] = reason.value.trim();
      }
    }
    return {result, complete, reasonMissing};
  }
  function scoreSum(data) { return Object.values(data).reduce((a,v)=>a+(typeof v === 'number' ? v : 0),0); }
  function updateTotals() {
    document.querySelectorAll('.score-card').forEach(card=>card.classList.remove('invalid'));
    const n=readScores('nihss',config.sections), b=readScores('barthel',config.barthel);
    $('totalScore').textContent=n.complete?scoreSum(n.result):'—';
    $('completion').textContent=n.complete?`ครบ ${config.sections.length} ข้อ · UN ไม่นำมารวมคะแนน`: 'เลือกคะแนนให้ครบทุกข้อ';
    $('barthelScore').textContent=b.complete?scoreSum(b.result):'—';
    $('barthelCompletion').textContent=b.complete?'ครบ 10 กิจกรรม':'เลือกคะแนนให้ครบทั้ง 10 กิจกรรม';
    return {n,b};
  }
  function filteredRecords() {
    const q=$('searchInput').value.trim().toLocaleLowerCase(), interval=$('filterInterval').value;
    return records.filter(r=>(!q||r.recordId.toLocaleLowerCase().includes(q))&&(!interval||r.interval===interval));
  }
  function render() {
    const rows=filteredRecords(), s=stats(rows);
    $('statCount').textContent=s.count;
    $('statAverage').textContent=s.average===null?'—':s.average.toFixed(1);
    $('statMax').textContent=s.max===null?'—':s.max;
    $('recordsBody').innerHTML=rows.map(r=>`<tr><td>${escapeHtml(r.recordId)}</td><td>${escapeHtml(r.examDate)}</td><td>${escapeHtml(r.interval)}</td><td>${escapeHtml(r.barthelRound ? `ครั้งที่ ${r.barthelRound}` : '—')}</td><td>${escapeHtml(r.examiner||'—')}</td><td><span class="score-badge">${r.nihss ?? '—'}</span></td><td><span class="score-badge">${r.barthel ?? '—'}</span></td><td><button class="row-delete" data-delete="${escapeHtml(r.id)}" aria-label="ลบ ${escapeHtml(r.recordId)}">×</button></td></tr>`).join('');
    $('emptyState').style.display=rows.length?'none':'block'; $('resultCount').textContent=`แสดง ${rows.length} รายการ`;
  }
  function toast(message) { const node=$('toast'); node.textContent=message; node.classList.add('show'); setTimeout(()=>node.classList.remove('show'),2600); }

  document.querySelector('#scoreSections').addEventListener('change', e => { if(e.target.matches('input[type=radio]')) { const item=config.sections.find(x=>x.id===e.target.dataset.item); const card=e.target.closest('.score-card'); card.classList.toggle('has-un', e.target.value==='UN'); const reason=card.querySelector('.reason'); if(reason) reason.required=e.target.value==='UN'; updateTotals(); }});
  $('barthelSections').addEventListener('change', updateTotals);
  document.querySelector('#scoreSections').addEventListener('input', updateTotals);
  $('assessmentForm').addEventListener('reset', ()=>setTimeout(()=>{document.querySelectorAll('.score-card').forEach(x=>x.classList.remove('has-un','invalid'));document.querySelectorAll('.reason').forEach(x=>x.required=false);$('formMessage').textContent='';$('examDate').value=localDate();updateTotals();},0));
  $('assessmentForm').addEventListener('submit', async e => {
    e.preventDefault(); $('formMessage').textContent='';
    const {n,b}=updateTotals();
    if(!e.currentTarget.reportValidity()) return;
    if(!n.complete||!b.complete) { $('formMessage').textContent='กรุณาเลือกคะแนนให้ครบทั้ง NIHSS และ Barthel ADL'; return; }
    if(n.reasonMissing) { $('formMessage').textContent='กรุณาระบุเหตุผลทุกข้อที่เลือก UN'; return; }
    const record={id:crypto.randomUUID(),recordId:$('recordId').value.trim(),examDate:$('examDate').value,examiner:$('examiner').value.trim(),interval:$('interval').value,barthelRound:Number($('barthelRound').value),nihss:scoreSum(n.result),nihssScores:n.result,barthel:scoreSum(b.result),barthelScores:b.result,createdAt:new Date().toISOString()};
    if(records.some(r=>r.recordId.toLowerCase()===record.recordId.toLowerCase()&&r.examDate===record.examDate&&r.barthelRound===record.barthelRound)) { $('formMessage').textContent='รหัส วันที่ และครั้งที่ Barthel นี้มีอยู่แล้ว'; return; }
    records.unshift(record); persist(); render();
    const api=localStorage.getItem(API_KEY);
    if(api) { try { await fetch(api,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(record)}); toast('บันทึกในเครื่องแล้ว · ส่งคำขอไปยัง Google Sheets'); } catch { toast('บันทึกในเครื่องแล้ว · ส่งไป Sheets ไม่สำเร็จ'); } }
    else toast('บันทึกในเบราว์เซอร์แล้ว');
    e.currentTarget.reset(); $('recordId').focus();
  });
  $('recordsBody').addEventListener('click',e=>{const id=e.target.dataset.delete;if(!id)return;records=records.filter(r=>r.id!==id);persist();render();toast('ลบรายการจากเบราว์เซอร์แล้ว');});
  $('searchInput').addEventListener('input',render); $('filterInterval').addEventListener('change',render);
  $('exportBtn').addEventListener('click',()=>{
    const rows=filteredRecords(); if(!rows.length){toast('ไม่มีรายการให้ส่งออก');return;}
    if(!window.XLSX){toast('โหลดไลบรารี XLSX ไม่สำเร็จ · ตรวจการเชื่อมต่ออินเทอร์เน็ต');return;}
    const summary=rows.map(r=>({'รหัสอ้างอิงสมมติ':r.recordId,'วันที่ประเมิน':r.examDate,'ช่วงการประเมิน':r.interval,'ครั้งที่ Barthel':r.barthelRound,'ผู้ประเมิน (สมมติ)':r.examiner,'คะแนน NIHSS / 42':r.nihss,'คะแนน Barthel / 100':r.barthel,'NIHSS รายข้อ':JSON.stringify(r.nihssScores),'Barthel รายข้อ':JSON.stringify(r.barthelScores)}));
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(summary),'Assessments'); XLSX.writeFile(wb,'stroke-assessment-demo.xlsx');
  });
  $('loadDemo').addEventListener('click',()=>{if(records.some(r=>r.demo)) {toast('มีข้อมูลตัวอย่างอยู่แล้ว');return;} const sample=[{values:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],barthel:[5,15,5,10,5,15,10,10,10,10]},{values:[1,1,0,1,1,1,2,0,1,1,1,1,2,1,0],barthel:[5,10,5,5,5,10,5,5,5,10]},{values:[2,2,1,2,2,2,3,2,3,2,1,2,3,2,2],barthel:[0,5,0,0,0,5,0,0,5,5]}];sample.forEach((s,i)=>{const ns=Object.fromEntries(config.sections.map((it,j)=>[it.id,s.values[j]])),bs=Object.fromEntries(config.barthel.map((it,j)=>[it.id,s.barthel[j]]));records.push({id:crypto.randomUUID(),recordId:`DEMO-${String(i+1).padStart(3,'0')}`,examDate:localDate(new Date(Date.now()-i*86400000)),examiner:'ผู้ประเมินตัวอย่าง',interval:['Baseline','24 ชั่วโมงหลังเริ่มอาการ','7–10 วัน'][i],barthelRound:i+1,nihss:scoreSum(ns),nihssScores:ns,barthel:scoreSum(bs),barthelScores:bs,createdAt:new Date().toISOString(),demo:true});});persist();render();toast('เพิ่มข้อมูลตัวอย่างที่ไม่ระบุตัวตน 3 รายการ');});
  $('settingsBtn').addEventListener('click',()=>{$('apiUrl').value=localStorage.getItem(API_KEY)||'';$('settingsDialog').showModal();});
  $('saveSettings').addEventListener('click',e=>{e.preventDefault();const url=$('apiUrl').value.trim();if(url&&!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)){toast('URL ต้องเป็น Apps Script Web App HTTPS');return;}if(url)localStorage.setItem(API_KEY,url);else localStorage.removeItem(API_KEY);$('settingsDialog').close();toast(url?'บันทึก URL แล้ว':'ใช้โหมดสาธิตในเครื่อง');});
  $('disconnectBtn').addEventListener('click',()=>{localStorage.removeItem(API_KEY);$('apiUrl').value='';$('settingsDialog').close();toast('กลับไปใช้โหมดสาธิตในเครื่อง');});
  $('settingsDialog').addEventListener('click',e=>{if(e.target===$('settingsDialog'))$('settingsDialog').close();});
  updateTotals(); render();
})();
