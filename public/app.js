'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const RAW = new URLSearchParams(location.search).get('raw') === '1';
const IMG_DIR = RAW ? 'img/original/' : 'img/optimised/';
const IMG_EXT = RAW ? '.jpg' : '.webp';
const slug = name => name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const ALT = {
  'cables':'Black braided USB-C cable','chargers':'White Xiaomi charger and cable',
  'phone-cases':'Four colourful smartphone cases','screen-protectors':'Overlapping glass screen protectors',
  'headphones':'Black Sony over-ear headphones','power-banks':'Silver portable power bank',
  'adapters-and-hubs':'Black and gold audio jack adapter','memory-and-storage':'Five SD memory cards',
  'batteries':'Four Duracell batteries','holders-and-mounts':'Black Ulanzi phone holder'
};
let user = null, products = [], selectedId = null, videos = [], selectedVideoId = null;
let actionStart = null, pollBusy = false;
window.endtermTimings = [];
let config = {}, requestVersion = 0, videoVersion = 0, searchTimer = null;
const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'KZT',maximumFractionDigits:0}).format(Number(value));
const isStaff = () => user && ['owner','employee'].includes(user.role);
const currentProduct = () => products.find(p => p.product_id === selectedId);
const message = (id, text, error = false) => { $(id).textContent = text; $(id).className = error ? 'err' : 'ok'; };
async function api(url, options = {}) {
  const headers = { ...(options.body && !(options.body instanceof File) ? {'Content-Type':'application/json'} : {}), ...options.headers };
  const r = await fetch(url, { credentials:'same-origin', ...options, headers });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `Request failed (${r.status}).`);
  return body;
}
function fallback(img) {
  img.onerror = null;
  img.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f6f8fb"/><path d="M25 35l25-12 25 12v30L50 77 25 65zM25 35l25 12 25-12M50 47v30" fill="none" stroke="#475467" stroke-width="3"/></svg>');
}
function bindImages(scope) { scope.querySelectorAll('img').forEach(img => { img.onerror = () => fallback(img); }); }
function renderAccount() {
  $('who').textContent = user ? `${user.role_label} · ${user.email}` : 'Guest · read-only catalogue';
  $('logout').hidden = !user; $('showLogin').hidden = Boolean(user);
  if (user) $('loginBox').hidden = true;
  $('roleNote').textContent = !user || user.role === 'customer'
    ? 'Read-only access: browse products and watch or download published product checks.'
    : user.role === 'owner'
      ? 'Administrator: edit product details, record stock changes, upload videos and decide which clips are published.'
      : 'Seller: record sales and deliveries; upload product checks for review. Prices, corrections and publishing are administrator-only.';
  for (const id of ['stockSection','uploadSection','historySection','alertsSection']) $(id).hidden = !isStaff();
  $('adminSection').hidden = user?.role !== 'owner';
  $('reason').innerHTML = '<option value="sale">Sale</option><option value="delivery">Delivery</option>' + (user?.role === 'owner' ? '<option value="correction">Correction</option>' : '');
  $('sound').checked = false;
}
async function loadProducts({background=false} = {}) {
  const started = background ? null : (actionStart ?? performance.now());
  if (!background) actionStart = null;
  const version = ++requestVersion;
  const params = new URLSearchParams({q:$('search').value,category:$('category').value,low_stock:String($('lowOnly').checked)});
  const rows = await api('/api/products?' + params);
  if (version !== requestVersion) return;
  products = rows; $('productCount').textContent = `(${rows.length})`;
  if (!rows.some(p => p.product_id === selectedId)) selectedId = rows[0]?.product_id ?? null;
  $('products').innerHTML = rows.length ? rows.map(p => `<tr class="${p.low_stock?'low ':''}${p.product_id===selectedId?'selected':''}" data-product="${p.product_id}">
    <td><div class="product-name"><img class="thumb" src="${IMG_DIR+slug(p.category)+IMG_EXT}" width="40" height="40" alt="" ${RAW?'':'loading="lazy"'}><div>${esc(p.name)}<span class="sku">${esc(p.sku)}</span></div></div></td>
    <td>${esc(money(p.price))}</td><td>${p.quantity} ${p.low_stock?'<span class="badge">⚠ LOW</span>':''}</td>
    <td>${Number(p.video_count)>0?`${p.video_count} published`:'—'}</td><td><button class="secondary open-product" data-product-id="${p.product_id}" aria-label="Open ${esc(p.sku)}">View</button></td></tr>`).join('') : '<tr><td colspan="5">No matching products.</td></tr>';
  bindImages($('products'));
  $('syncInfo').textContent = 'Last successful sync: ' + new Date().toLocaleTimeString();
  if (!background) requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const elapsed=performance.now()-started;
    $('timingInfo').textContent='Catalogue interaction: '+(elapsed/1000).toFixed(3)+' s (action to rendered list; not Network Finish).';
    window.endtermTimings.push({at:new Date().toISOString(),query:$('search').value,milliseconds:Number(elapsed.toFixed(2))});
  }));
  if (!background) { renderDetail(); await loadVideos(); if (isStaff()) await loadHistory(); }
  else {const p=currentProduct(); if(p)$('detailNumbers').textContent=`${money(p.price)} · ${p.quantity} in stock${p.low_stock?' · Low stock':''}`;}

}
function renderDetail() {
  const p = currentProduct(); $('detail').hidden = !p; if (!p) return;
  $('detailSku').textContent = `${p.sku} · ${p.category}`; $('detailTitle').textContent = p.name;
  $('detailNumbers').textContent = `${money(p.price)} · ${p.quantity} in stock${p.low_stock?' · Low stock':''}${isStaff()?` · Reorder at ${p.reorder_threshold}`:''}`;
  const s = slug(p.category), img = $('preview');
  img.onerror = () => fallback(img); img.src = IMG_DIR+s+IMG_EXT;
  img.alt = (ALT[s] || 'Category photograph') + ` (category illustration for ${p.name})`;
  $('previewCap').textContent = 'Category illustration. The uploaded video below must correspond to this product or its clearly identified unit.';
  $('editName').value = p.name; $('editPrice').value = p.price; $('editThreshold').value = p.reorder_threshold;
}
async function selectProduct(id) {
  selectedId = id; selectedVideoId = null;
  for (const row of $('products').querySelectorAll('tr[data-product]')) row.classList.toggle('selected', Number(row.dataset.product) === id);
  for (const field of ['stockMsg','editMsg','uploadMsg']) message(field,'');
  $('uploadForm').reset(); $('unitBox').hidden = true;
  renderDetail(); await loadVideos(); if (isStaff()) await loadHistory();
  if (matchMedia('(max-width:850px)').matches) $('detail').scrollIntoView({block:'start'});
}
async function loadAlerts() {
  if (!isStaff()) { $('alerts').textContent = ''; return; }
  const rows = await api('/api/alerts'); $('alertCount').textContent = `(${rows.length})`;
  $('alerts').innerHTML = rows.map(a => `<tr><td>${esc(a.sku)}</td><td>${esc(a.name)}</td><td>${a.quantity}</td></tr>`).join('') || '<tr><td colspan="3">No open alerts.</td></tr>';
}
async function loadHistory() {
  if (!isStaff() || !selectedId) return;
  const id = selectedId; const rows = await api(`/api/products/${id}/movements`);
  if (id !== selectedId) return;
  $('history').innerHTML = rows.length ? rows.map(m => `<p>#${m.movement_id} · ${esc(m.reason)} · ${m.quantity_change>0?'+':''}${m.quantity_change} · ${esc(m.email)}<br>${esc(new Date(m.created_at).toLocaleString())}</p>`).join('') : '<p>No stock movements yet.</p>';
}
async function loadVideos() {
  const version = ++videoVersion;
  $('player').pause(); $('player').removeAttribute('src'); $('player').load(); $('playerBox').hidden = true;
  if (!selectedId) return;
  $('videoList').textContent = 'Loading videos…';
  const rows = await api(`/api/products/${selectedId}/videos`);
  if (version !== videoVersion) return;
  videos = rows;
  $('videoList').innerHTML = rows.length ? rows.map(v => `<article class="video-entry"><strong>${esc(v.title)}</strong><p class="small muted">${esc(v.status.toUpperCase())} · ${v.duration_seconds?`${Number(v.duration_seconds).toFixed(1)} s · `:''}${esc(v.scope==='specific_unit'?'Unit / batch: '+v.unit_reference:'Model example')}</p><div class="video-actions">
    ${v.status!=='uploading'?`<button class="secondary" data-watch="${v.video_id}">${v.status==='published'?'Watch':'Review video'}</button>`:''}
    ${user?.role==='owner'&&v.status!=='uploading'&&v.status!=='published'?`<button data-review="${v.video_id}" data-status="published">Publish</button>`:''}
    ${user?.role==='owner'&&v.status==='pending'?`<button class="danger" data-review="${v.video_id}" data-status="rejected">Reject</button>`:''}
    ${user?.role==='owner'&&v.status==='published'?`<button class="secondary" data-review="${v.video_id}" data-status="archived">Unpublish</button>`:''}
    ${v.status==='uploading'&&user?.user_id===v.uploaded_by?`<button class="secondary" data-cancel="${v.video_id}">Cancel unfinished upload</button>`:''}
    </div></article>`).join('') : '<p class="muted">No published video yet. Nothing here is presented as a completed product inspection.</p>';
  if (selectedVideoId && rows.some(v => v.video_id===selectedVideoId && v.status!=='uploading')) showVideo(selectedVideoId);
}
function showVideo(id) {
  const v = videos.find(x => x.video_id===id); if (!v) return;
  selectedVideoId = id; $('videoTitle').textContent = v.title;
  $('player').src = v.file_url; $('player').load(); $('playerBox').hidden = false;
  $('downloadVideo').href = v.download_url;
  $('videoTranscript').textContent = v.transcript;
  $('videoScope').textContent = `${v.scope==='specific_unit'?'Applies to unit / batch '+v.unit_reference:'Model example — not proof for every unit'}${v.recorded_on?' · Recorded '+String(v.recorded_on).slice(0,10):''} · Uploaded ${new Date(v.created_at).toLocaleDateString()}. ${v.status==='published'?'Published by the store.':'Private review copy.'}`;
}
async function refreshAll() { await loadProducts(); await loadAlerts(); }
$('loginForm').addEventListener('submit',async e => {
  e.preventDefault(); $('loginBtn').disabled = true; message('loginMsg','');
  try {
    user = await api('/api/login',{method:'POST',body:JSON.stringify({email:$('email').value,password:$('password').value})});
    $('password').value = ''; renderAccount(); await refreshAll(); message('globalMsg','Signed in. Permissions are checked by the server.');
  } catch (error) { user=null; renderAccount(); $('loginBox').hidden=false; message('loginMsg',error.message,true); }
  finally { $('loginBtn').disabled=false; }
});
$('logout').onclick = async () => {
  try { await api('/api/logout',{method:'POST'}); user=null; renderAccount(); $('loginBox').hidden=false; selectedVideoId=null; await refreshAll(); message('globalMsg','Signed out. The catalogue remains read-only.'); }
  catch(e){message('globalMsg',e.message,true);}
};
$('showLogin').onclick = () => { $('loginBox').hidden=false; $('email').focus(); };
$('browseBtn').onclick = () => { $('loginBox').hidden=true; $('catalogue').scrollIntoView(); };
$('refresh').onclick = () => {actionStart=performance.now(); return refreshAll().catch(e=>message('globalMsg',e.message,true));};
$('search').oninput = () => { actionStart=performance.now(); clearTimeout(searchTimer); searchTimer=setTimeout(()=>loadProducts().catch(e=>message('globalMsg',e.message,true)),250); };
for (const id of ['category','lowOnly']) $(id).onchange=()=>loadProducts().catch(e=>message('globalMsg',e.message,true));
$('products').onclick = e => { const b=e.target.closest('[data-product-id]'); if(b) selectProduct(Number(b.dataset.productId)).catch(e=>message('globalMsg',e.message,true)); };
$('reason').onchange=()=>{const n=Math.max(1,Math.abs(Number($('qty').value)||1));$('qty').value=$('reason').value==='sale'?-n:n;};
$('stockForm').onsubmit=async e=>{
  e.preventDefault(); const product_id=selectedId; $('saveStock').disabled=true;
  try {
    const r=await api('/api/stock-movements',{method:'POST',body:JSON.stringify({product_id,quantity_change:Number($('qty').value),reason:$('reason').value})});
    message('stockMsg',`Saved: ${r.sku} now has ${r.quantity} in stock.${r.new_alert?' Low-stock alert created.':''}`);
    if(r.new_alert&&$('sound').checked)new Audio('media/alert.wav').play().catch(()=>{});
    await refreshAll();
    if(r.new_alert){const row=$('products').querySelector(`[data-product="${product_id}"]`);if(row)row.classList.add('fresh');}
  }catch(error){message('stockMsg',error.message,true);}finally{$('saveStock').disabled=false;}
};
$('editForm').onsubmit=async e=>{
  e.preventDefault();$('saveProduct').disabled=true;
  try{await api(`/api/products/${selectedId}`,{method:'PATCH',body:JSON.stringify({name:$('editName').value,price:Number($('editPrice').value),reorder_threshold:Number($('editThreshold').value)})});await refreshAll();message('editMsg','Product details saved.');}
  catch(error){message('editMsg',error.message,true);}finally{$('saveProduct').disabled=false;}
};
$('scope').onchange=()=>{$('unitBox').hidden=$('scope').value!=='specific_unit';$('unitReference').required=!$('unitBox').hidden;};
$('uploadForm').onsubmit=async e=>{
  e.preventDefault(); const file=$('videoFile').files[0], productId=selectedId;
  if(!file||!file.name.toLowerCase().endsWith('.mp4'))return message('uploadMsg','Select an MP4 file.',true);
  if(file.size>(config.max_video_bytes||40*1024*1024))return message('uploadMsg','Use a file no larger than 40 MiB.',true);
  $('uploadBtn').disabled=true;let reservation=null;
  try{
    message('uploadMsg','Uploading and validating the recording…');
    reservation=await api(`/api/products/${productId}/videos`,{method:'POST',body:JSON.stringify({title:$('videoName').value,transcript:$('transcript').value,scope:$('scope').value,unit_reference:$('unitReference').value,recorded_on:$('recordedOn').value||null,own_content:$('ownContent').checked})});
    await api(`/api/videos/${reservation.video_id}/content`,{method:'PUT',headers:{'Content-Type':'video/mp4'},body:file});
    reservation=null; $('uploadForm').reset();$('unitBox').hidden=true;$('unitReference').required=false;
    message('uploadMsg','Upload saved. An administrator must publish it before buyers can see it.');
    if(selectedId===productId)await loadVideos();
  }catch(error){
    if(reservation)await api(`/api/videos/${reservation.video_id}/upload`,{method:'DELETE'}).catch(()=>{});
    message('uploadMsg',error.message,true);
  }finally{$('uploadBtn').disabled=false;}
};
$('videoList').onclick=async e=>{
  const watch=e.target.closest('[data-watch]'); if(watch){showVideo(watch.dataset.watch);return;}
  const review=e.target.closest('[data-review]'),cancel=e.target.closest('[data-cancel]');
  if(!review&&!cancel)return;
  const b=review||cancel;b.disabled=true;
  try{
    if(review){await api(`/api/videos/${review.dataset.review}/status`,{method:'PATCH',body:JSON.stringify({status:review.dataset.status})});message('globalMsg','Video status updated.');await refreshAll();}
    else{await api(`/api/videos/${cancel.dataset.cancel}/upload`,{method:'DELETE'});await loadVideos();}
  }catch(error){message('globalMsg',error.message,true);}finally{b.disabled=false;}
};
$('player').onerror=()=>message('globalMsg','Video playback failed. Try reloading or use Download MP4; the file may be missing or your session may have expired.',true);
async function init(){
  try{
    config=await api('/api/config');
    if(config.demo){
      $('demoHint').hidden=false;
      $('demoHint').innerHTML='<span class="demo-line">Demo accounts · local coursework only</span>'+config.demo_accounts.map(a=>`<span class="demo-line">${esc(a.role)}: <button type="button" data-demo-email="${esc(a.email)}">${esc(a.email)}</button></span>`).join('')+`<span class="demo-password">Shared demo password: <code>${esc(config.demo_password)}</code></span>`;
      $('demoHint').onclick=e=>{const b=e.target.closest('[data-demo-email]');if(b){$('email').value=b.dataset.demoEmail;$('password').value=config.demo_password;}};
    }
    user=await api('/api/me').catch(()=>null);renderAccount();
    const categories=await api('/api/categories');$('category').innerHTML='<option value="">All categories</option>'+categories.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
    await refreshAll();
  }catch(error){message('globalMsg',error.message+' Check that PostgreSQL is running and the update migration completed.',true);}
}
setInterval(async()=>{
  if(document.hidden || !$('autoRefresh').checked || pollBusy) return;
  pollBusy=true;
  try{await loadProducts({background:true});await loadAlerts();}
  catch(e){$('syncInfo').textContent='Connection unavailable: displayed stock may be stale. Press Refresh after reconnecting.';}
  finally{pollBusy=false;}
},10000);
init();
