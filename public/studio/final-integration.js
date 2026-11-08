'use strict';
// SE-2626 final frontend integration. Uses existing API routes; never writes to DB by itself.
window.StockroomFinal = (() => {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const model = {
    codes:[], events:[], scan:null, confirmation:null, lastBody:null,
    barcode:'', device:'sim-browser-01', reason:'delivery', units:1,
    scanMessage:'', scanError:false, busy:false,
    historyMode:'live', historical:null, historicalError:'',
    currentStatus:''
  };
  const btnBusy = (val) => { model.busy = val; };
  const asNumber = x => Number.isFinite(Number(x)) ? Number(x) : 0;
  const tabTitle = () => `<div class="final-tab-switch" role="group" aria-label="Analytics data source"><button type="button" class="final-tab ${model.historyMode==='live'?'selected':''}" data-final-mode="live" aria-pressed="${model.historyMode==='live'}">Live inventory insights</button><button type="button" class="final-tab ${model.historyMode==='historical'?'selected':''}" data-final-mode="historical" aria-pressed="${model.historyMode==='historical'}">Historical coursework analysis (A3)</button></div>`;
  const feedback = () => `<p role="status" aria-live="polite" class="final-message ${model.scanError?'final-error':''}">${esc(model.scanMessage)}</p>`;
  const upcoming = () => {
    if(!model.scan?.product || model.confirmation) return '';
    const p=model.scan.product;
    const delta=model.reason==='sale' ? -model.units : model.units;
    return `<div class="final-estimate" id="barcodePreview" role="status">${esc(p.sku)} · Current ${esc(p.quantity)} → <strong>${esc(asNumber(p.quantity)+delta)}</strong> if confirmed. The server validates the final balance.</div>`;
  };
  const rowsHtml = () => `<section class="panel panel-body final-scan-history"><div class="final-section-head"><div><div class="eyebrow">AUDIT TRAIL</div><h2>Recent scan events</h2><p class="muted small">Identification alone does not update the inventory.</p></div><button class="button secondary small" type="button" data-final-action="refresh">Refresh events</button></div><div class="table-wrap responsive-table"><table><caption class="sr-only">Latest barcode simulation events</caption><thead><tr><th scope="col">Code</th><th scope="col">Source</th><th scope="col">Status</th><th scope="col">Movement</th></tr></thead><tbody>${model.events.map(r=>`<tr><td>${esc(r.barcode)}</td><td data-label="Source">${esc(r.source)}</td><td data-label="Status">${r.movement_id?`${asNumber(r.confirmed_change)>0?'+':''}${esc(r.confirmed_change)} units`:'Identification only'}</td><td data-label="Movement">${r.movement_id?'#'+esc(r.movement_id):'Not confirmed'}</td></tr>`).join('')||'<tr><td colspan="4">No scan events yet.</td></tr>'}</tbody></table></div></section>`;
  function barcodeHtml(){
    const options=model.codes.map(c=>`<option value="${esc(c.barcode)}" ${c.barcode===model.barcode?'selected':''}>${esc(c.barcode)} — ${esc(c.sku)} · ${esc(c.name)}</option>`).join('');
    const scan=model.scan;
    const recognized=scan?.found&&scan.product;
    const result=scan && !scan.found ? '<div class="final-estimate final-error">Unknown barcode. Stock is unchanged.</div>' :
      recognized ? `<div class="final-estimate"><strong>${esc(scan.product.name)}</strong> · ${esc(scan.product.sku)}<br>Quantity at scan: ${esc(scan.product.quantity)} units. No movement was recorded by scanning.</div>` : '<p class="muted small">A scan identifies a product. A separate, authorized confirmation is required to change stock.</p>';
    return `<div class="page-heading"><div><div class="eyebrow">SMART TECHNOLOGIES · SOFTWARE SIMULATION</div><h1>Barcode simulator</h1><p>Identify first. Confirm a stock operation only when you intend to change inventory.</p></div><div class="heading-actions"><span class="tag">No physical scanner connected</span></div></div>
      <div class="insight-inline">This is a browser simulation using internal DEMO identifiers—not a camera or Wi-Fi hardware reader. Confirmed movements are saved in PostgreSQL.</div>
      <div class="final-two-columns">
        <section class="panel panel-body"><div class="eyebrow">STEP 01</div><h2>Identify product</h2><p class="muted small">Select an existing DEMO code. The scan creates an audit event, not a stock movement.</p>
          <form id="finalBarcodeScanForm" class="final-form"><label>DEMO barcode<select id="finalBarcodeCode" required>${options||'<option value="">No codes available</option>'}</select></label><label>Simulated device label<input id="finalBarcodeDevice" maxlength="60" pattern="[A-Za-z0-9_.-]+" required value="${esc(model.device)}" autocomplete="off"></label>
          <button class="button" type="submit" ${model.busy||!model.codes.length?'disabled':''}>Simulate scan →</button></form>${result}</section>
        <section class="panel panel-body"><div class="eyebrow">STEP 02</div><h2>Confirm stock movement</h2><p class="muted small">The server checks your role and the current stock before saving.</p>
          ${recognized ? `<form id="finalBarcodeConfirmForm" class="final-form"><div class="final-input-row"><label>Reason<select id="finalBarcodeReason" ${model.confirmation?'disabled':''}><option value="delivery" ${model.reason==='delivery'?'selected':''}>Delivery (+)</option><option value="sale" ${model.reason==='sale'?'selected':''}>Sale (−)</option></select></label><label>Units<input id="finalBarcodeUnits" type="number" min="1" max="10000" step="1" required value="${esc(model.units)}" ${model.confirmation?'disabled':''}></label></div>${upcoming()}${model.confirmation?`<div class="final-estimate final-success"><strong>${model.confirmation.replayed?'Duplicate ignored':'Saved'}.</strong> Movement #${esc(model.confirmation.movement_id)} · Resulting quantity ${esc(model.confirmation.quantity)}.</div>`:''}<div class="action-row">${model.confirmation?'':`<button class="button" type="submit" ${model.busy?'disabled':''}>Confirm operation</button>`}<button class="button secondary" type="button" data-final-action="cancel" ${model.busy?'disabled':''}>New scan</button>${model.lastBody?`<button class="button secondary" type="button" data-final-action="retry" ${model.busy?'disabled':''}>Retry same confirmation</button>`:''}</div></form>` : '<div class="empty">Scan a recognized product to enable confirmation.</div>'}</section>
      </div>${feedback()}
      <div class="final-export-row"><div><h3>Export records</h3><p class="muted small">Staff access only · downloads do not modify stock.</p></div><div class="action-row"><a class="button secondary small" href="/api/endterm/export/stock">Stock CSV ↗</a><a class="button secondary small" href="/api/endterm/export/movements">Movements CSV ↗</a></div></div>${rowsHtml()}`;
  }
  function historicalHtml(){
    const m=model.historical?.metadata;
    if(!m) return `<div class="page-heading"><div><div class="eyebrow">ANALYTICS · SEPARATE SOURCE</div><h1>Historical A3 analysis</h1><p>Archive data is not merged with live inventory.</p></div></div>${tabTitle()}<section class="panel panel-body"><h3>A3 data unavailable</h3><p class="final-message final-error" role="alert">${esc(model.historicalError||'Historical data could not be loaded.')}</p><button class="button secondary" data-final-action="reload-history">Retry archive read</button></section>`;
    const charts=(model.historical.questions||[]).map(q=>{
      const max=Math.max(1,...(q.rows||[]).map(r=>asNumber(r[q.value])));
      const bars=(q.rows||[]).map(r=>{const n=asNumber(r[q.value]);return `<div class="final-bar-item"><div class="final-bar-heading"><span>${esc(r.category)}</span><strong>${esc(n.toLocaleString('en-US',{maximumFractionDigits:2}))}</strong></div><div class="final-bar-bg"><div class="final-bar-fill" style="width:${Math.max(0,Math.min(100,n/max*100)).toFixed(2)}%"></div></div></div>`;}).join('');
      const tabRows=(q.rows||[]).map(r=>`<tr><td>${esc(r.category)}</td><td data-label="${esc(q.unit)}">${esc(r[q.value])}</td></tr>`).join('');
      return `<section class="panel panel-body final-analysis-card"><div class="eyebrow">${esc(q.id)}</div><h2>${esc(q.title)}</h2><p class="muted small">Unit: ${esc(q.unit)} · source: ${esc(m.database_name)}</p><div class="final-bars" role="group" aria-label="${esc(q.title)}">${bars}</div><details><summary>Exact values and SQL method</summary><div class="table-wrap responsive-table"><table><thead><tr><th scope="col">Category</th><th scope="col">${esc(q.unit)}</th></tr></thead><tbody>${tabRows}</tbody></table></div><pre class="final-code">${esc(q.sql)}</pre></details></section>`;
    }).join('');
    return `<div class="page-heading"><div><div class="eyebrow">ANALYTICS · REPRODUCIBLE DATA</div><h1>Historical A3 analysis</h1><p>Read-only coursework snapshot, separated from live inventory decisions.</p></div><div class="heading-actions"><button class="button small secondary" type="button" data-final-action="download-history">Download JSON ↓</button></div></div>${tabTitle()}<div class="insight-inline"><strong>Source:</strong> ${esc(m.database_name)} · ${esc(m.products)} products · ${esc(m.movements)} movements · Captured ${esc(m.captured_at)}. <strong>Historical A3 coursework data; not merged with inventory_db.</strong></div><div class="final-history-list">${charts||'<section class="panel panel-body">No historical questions returned.</section>'}</div>`;
  }
  async function loadBarcode(api){
    const [codes,events]=await Promise.all([api('/api/endterm/barcodes'),api('/api/endterm/scans')]);
    model.codes=Array.isArray(codes)?codes:[];model.events=Array.isArray(events)?events:[];
    if(!model.codes.some(x=>x.barcode===model.barcode))model.barcode=model.codes[0]?.barcode||'';
  }
  async function loadHistorical(api,force=false){
    if(model.historical&&!force)return;
    try{model.historical=await api('/api/endterm/analysis');model.historicalError='';}
    catch(err){model.historical=null;model.historicalError=err.message;}
  }
  const setMode=val=>{if(['live','historical'].includes(val))model.historyMode=val;};
  function updatePreview(){const r=document.getElementById('finalBarcodeReason'),u=document.getElementById('finalBarcodeUnits');if(!r||!u)return;model.reason=r.value;model.units=Math.max(1,Math.floor(asNumber(u.value)));const target=document.getElementById('barcodePreview');if(target&&model.scan?.product){const p=model.scan.product;const diff=model.reason==='sale'?-model.units:model.units;target.innerHTML=`${esc(p.sku)} · Current ${esc(p.quantity)} → <strong>${esc(asNumber(p.quantity)+diff)}</strong> if confirmed. The server validates the final balance.`;}}
  async function doAction(action,api,rerender){
    if(model.busy)return;
    if(action==='cancel'){model.scan=null;model.confirmation=null;model.lastBody=null;model.scanMessage='Ready for another scan.';model.scanError=false;await rerender();return;}
    if(action==='download-history'&&model.historical){const blob=new Blob([JSON.stringify(model.historical,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='a3_analysis_snapshot.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);return;}
    btnBusy(true);
    try{
      if(action==='refresh')await loadBarcode(api);
      else if(action==='reload-history')await loadHistorical(api,true);
      else if(action==='retry'){
        if(!model.scan?.event_id||!model.lastBody)throw new Error('Nothing to retry.');
        const result=await api(`/api/endterm/scans/${encodeURIComponent(model.scan.event_id)}/confirm`,{method:'POST',body:JSON.stringify(model.lastBody)});
        model.confirmation=result;model.scanMessage=result.replayed?'Confirmed event already exists; no second movement was created.':'Operation confirmed.';model.scanError=false;
        await loadBarcode(api);
      }
    }catch(e){model.scanMessage=e.message;model.scanError=true;if(action==='reload-history')model.historicalError=e.message;}
    finally{btnBusy(false);await rerender();}
  }
  async function submitScan(form,api,rerender){
    if(model.busy)return;
    const barcode=form.querySelector('#finalBarcodeCode')?.value||'';
    const device=form.querySelector('#finalBarcodeDevice')?.value||'';
    model.barcode=barcode;model.device=device;model.scan=null;model.lastBody=null;model.confirmation=null;model.scanMessage='Sending simulated scan…';model.scanError=false;btnBusy(true);
    try{
      const id=crypto.randomUUID();
      model.scan=await api('/api/endterm/scans',{method:'POST',body:JSON.stringify({event_id:id,barcode,device_id:device})});
      model.scanMessage=model.scan.message||'Scan recorded.';model.scanError=!model.scan.found;
      await loadBarcode(api);
    }catch(e){model.scanMessage=e.message;model.scanError=true;}
    finally{btnBusy(false);await rerender();}
  }
  async function submitConfirm(form,api,rerender){
    if(model.busy||!model.scan?.found||model.confirmation)return;
    model.reason=form.querySelector('#finalBarcodeReason')?.value||'delivery';
    model.units=Number(form.querySelector('#finalBarcodeUnits')?.value);
    if(!Number.isSafeInteger(model.units)||model.units<1||model.units>10000){model.scanMessage='Units must be a whole number from 1 to 10,000.';model.scanError=true;await rerender();return;}
    const body={quantity_change:(model.reason==='sale'?-1:1)*model.units,reason:model.reason};
    model.lastBody=body;model.scanMessage='Confirming the requested stock change…';model.scanError=false;btnBusy(true);
    try{
      model.confirmation=await api(`/api/endterm/scans/${encodeURIComponent(model.scan.event_id)}/confirm`,{method:'POST',body:JSON.stringify(body)});
      model.scanMessage=model.confirmation.replayed?'Duplicate ignored; the original movement is preserved.':'Stock movement saved successfully.';
      await loadBarcode(api);
    }catch(e){model.scanMessage=e.message+' Check Recent scan events before any manual retry.';model.scanError=true;}
    finally{btnBusy(false);await rerender();}
  }
  function clearSession(){model.scan=null;model.confirmation=null;model.lastBody=null;model.scanMessage='';model.scanError=false;model.codes=[];model.events=[];model.historical=null;model.historicalError='';model.historyMode='live';}
  return { model, tabTitle, isHistorical:()=>model.historyMode==='historical', setMode, barcodeHtml, historicalHtml, loadBarcode,loadHistorical, updatePreview, doAction,submitScan,submitConfirm, clearSession };
})();
