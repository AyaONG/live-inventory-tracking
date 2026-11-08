'use strict';
/* Final R1 product creation/deletion. Isolated from Stockroom's SPA so that
   frontend branches can be merged without rewriting the inventory router.
   Server APIs remain the authority for authorization, validation and safety. */
(() => {
  const byId = id => document.getElementById(id);
  const isPreview = Boolean(window.STUDIO_PREVIEW);
  const isAdministrator = () => !isPreview &&
    byId('accountName')?.textContent.trim() === 'Administrator' &&
    byId('accountRole')?.textContent.trim() === 'Signed-in workspace';
  const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  async function request(url, options={}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(url, {
        credentials: 'same-origin',
        ...options,
        headers: { ...(options.body ? {'Content-Type':'application/json'} : {}), ...options.headers },
        signal: controller.signal
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const error = new Error(data.error || `Request failed (${res.status}).`);
        error.status = res.status;
        throw error;
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Request timed out. Check the inventory before retrying; the operation might have succeeded.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  async function ensureAdministrator() {
    const user = await request('/api/me');
    if (user.role !== 'owner') throw new Error('Only Administrator can manage product records.');
  }
  function message(text, error=false) {
    const notice = byId('notice');
    if (!notice) return;
    notice.textContent = text;
    notice.className = error ? 'error' : '';
    notice.hidden = !text;
    notice.scrollIntoView?.({block:'nearest'});
  }
  function refreshInventory() {
    const trigger = byId('refreshButton');
    if (trigger) trigger.click();
  }
  function showError(id, error) {
    const el = byId(id);
    if (el) el.textContent = error?.message || String(error);
  }
  function buildDialog() {
    if (byId('r1CreateDialog')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'r1CreateDialog';
    dialog.className = 'modal r1-create-dialog';
    dialog.setAttribute('aria-labelledby', 'r1CreateTitle');
    dialog.innerHTML = `
      <button type="button" class="icon-button dialog-close" id="r1CloseCreate" aria-label="Close add product">×</button>
      <div class="eyebrow">PRODUCT MANAGEMENT · ADMINISTRATOR</div>
      <h2 id="r1CreateTitle">Add a product.</h2>
      <p class="muted r1-caption">Create a real inventory record. For a safe R1 test, use a unique test SKU and an initial quantity of zero.</p>
      <form id="r1CreateForm">
        <div class="form-row">
          <label>SKU<input name="sku" type="text" minlength="3" maxlength="30" pattern="[A-Za-z0-9][A-Za-z0-9-]{2,29}" placeholder="QA-R1-001" autocomplete="off" required></label>
          <label>Category<select name="category_id" required><option value="">Loading categories…</option></select></label>
        </div>
        <label>Product name<input name="name" maxlength="150" minlength="2" placeholder="Final QA sample product" required></label>
        <div class="form-row">
          <label>Price · KZT<input name="price" type="number" min="0" max="10000000" step="0.01" value="1000" required></label>
          <label>Initial quantity<input name="quantity" type="number" min="0" max="100000" step="1" value="0" required></label>
        </div>
        <label>Reorder threshold<input name="reorder_threshold" type="number" min="0" max="10000" step="1" value="0" required></label>
        <p id="r1CreateError" class="inline-message" role="alert" aria-live="assertive"></p>
        <button class="button full" id="r1CreateSubmit" type="submit">Create product</button>
        <p class="fine-print r1-caption">Product creation changes the live PostgreSQL database. It is not a preview.</p>
      </form>`;
    document.body.appendChild(dialog);
    byId('r1CloseCreate').addEventListener('click', () => dialog.close());
    byId('r1CreateForm').addEventListener('submit', submitCreate);
  }
  async function openCreate() {
    if (!isAdministrator()) return;
    buildDialog();
    const dialog = byId('r1CreateDialog');
    const select = dialog.querySelector('select[name="category_id"]');
    byId('r1CreateError').textContent = '';
    select.innerHTML = '<option value="">Loading categories…</option>';
    dialog.showModal();
    try {
      await ensureAdministrator();
      const categories = await request('/api/categories');
      if (!Array.isArray(categories) || !categories.length) throw new Error('No categories available.');
      select.innerHTML = '<option value="">Choose category</option>' + categories
        .map(c => `<option value="${Number(c.category_id)}">${esc(c.name)}</option>`).join('');
      dialog.querySelector('input[name="sku"]').focus();
    } catch (error) {
      showError('r1CreateError', error);
      select.innerHTML = '<option value="">Unavailable</option>';
    }
  }
  async function submitCreate(event) {
    event.preventDefault();
    if (!isAdministrator()) return showError('r1CreateError', new Error('Sign in as Administrator.'));
    const form = event.currentTarget, button = byId('r1CreateSubmit');
    if (button.disabled) return;
    const input = name => form.elements.namedItem(name).value;
    const payload = {
      sku: input('sku').trim().toUpperCase(),
      name: input('name').trim(),
      category_id: Number(input('category_id')),
      price: Number(input('price')),
      quantity: Number(input('quantity')),
      reorder_threshold: Number(input('reorder_threshold'))
    };
    button.disabled = true;
    byId('r1CreateError').textContent = '';
    try {
      await ensureAdministrator();
      const created = await request('/api/products', {method:'POST',body:JSON.stringify(payload)});
      form.reset();
      byId('r1CreateDialog').close();
      // The Stockroom app owns the table and state; ask it to refresh them.
      // Reset the filters so the new record is not accidentally hidden.
      const search = byId('inventorySearch');
      if (search) { search.value = ''; search.dispatchEvent(new Event('input', {bubbles:true})); }
      for (const filterId of ['inventoryCategory','inventoryStatus']) {
        const filter = byId(filterId);
        if (filter) { filter.value = ''; filter.dispatchEvent(new Event('change', {bubbles:true})); }
      }
      refreshInventory();
      message(`Product created: ${created.sku || payload.sku}. The inventory is refreshing.`);
    } catch (error) { showError('r1CreateError', error); }
    finally { button.disabled = false; }
  }
  function currentDrawerId() {
    const raw = byId('drawerPanel')?.querySelector('button[data-record]')?.dataset.record;
    const id = Number(raw);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }
  async function submitDelete(event) {
    event.preventDefault();
    const form = event.currentTarget, button = form.querySelector('button[type="submit"]');
    if (button.disabled) return;
    button.disabled = true;
    const feedback = form.querySelector('[role="alert"]');
    feedback.textContent = '';
    try {
      if (!isAdministrator()) throw new Error('Sign in as Administrator.');
      await ensureAdministrator();
      const id = currentDrawerId();
      if (!id) throw new Error('Product details changed. Reopen the product and try again.');
      const rows = await request('/api/products');
      const current = Array.isArray(rows) && rows.find(p => Number(p.product_id) === id);
      if (!current) throw new Error('Product is no longer in inventory. Refresh to continue.');
      const typedSku = form.elements.namedItem('confirm_sku').value.trim().toUpperCase();
      if (typedSku !== current.sku) throw new Error('Enter the exact product SKU.');
      const response = await request(`/api/products/${id}`, {method:'DELETE', body:JSON.stringify({confirm_sku:typedSku})});
      if (!response.ok) throw new Error('The server did not confirm deletion.');
      byId('productDialog')?.close();
      refreshInventory();
      message(`Product ${typedSku} removed from the active catalog. Stock and history are preserved.`);
    } catch (error) { feedback.textContent = error.message; }
    finally { button.disabled = false; }
  }
  // Admin-only archived products browser, embedded without changing studio.js.
  async function openArchivedProducts() {
    if (!isAdministrator()) return;
    let dlg = byId('r1ArchiveDialog');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'r1ArchiveDialog'; dlg.className='modal r1-create-dialog';
      dlg.innerHTML = `<button type="button" class="icon-button dialog-close" id="r1CloseArchived" aria-label="Close archived products">×</button>
        <div class="eyebrow">PRODUCT MANAGEMENT · ADMINISTRATOR</div><h2>Archived products.</h2>
        <p class="muted">Removed from the active catalog. Quantities, stock movements and product identifiers are preserved.</p>
        <div id="r1ArchivedContent" aria-live="polite"></div>`;
      document.body.appendChild(dlg);
      dlg.querySelector('#r1CloseArchived').addEventListener('click',()=>dlg.close());
      dlg.addEventListener('click',async e=>{
        const historyButton=e.target.closest('[data-archive-history]');
        const restoreButton=e.target.closest('[data-archive-restore]');
        if (!historyButton && !restoreButton) return;
        const id=Number((historyButton||restoreButton).dataset[historyButton?'archiveHistory':'archiveRestore']);
        if (!Number.isSafeInteger(id) || id<1) return;
        const target=dlg.querySelector('[data-archive-detail="'+id+'"]');
        try {
          if (historyButton) {
            historyButton.disabled=true;
            const [movements,events]=await Promise.all([
              request(`/api/products/${id}/movements`), request(`/api/products/${id}/catalog-history`)
            ]);
            target.innerHTML=`<strong>Stock movements</strong><ul>${movements.length?movements.map(m=>`<li>${esc(m.created_at)} · ${esc(m.reason)}: ${esc(m.quantity_change)} · ${esc(m.email)}</li>`).join(''):'<li>No recorded stock movements</li>'}</ul>
              <strong>Catalog changes</strong><ul>${events.map(x=>`<li>${esc(x.created_at)} · ${esc(x.action)} · stock ${esc(x.stock_at_event)} · ${esc(x.performed_by)}</li>`).join('')}</ul>`;
          } else {
            const sku=restoreButton.dataset.sku;
            if (window.prompt(`Type ${sku} to restore this product to the live catalog:`)?.trim().toUpperCase() !== sku) return;
            restoreButton.disabled=true;
            await request(`/api/products/${id}/restore`,{method:'POST',body:JSON.stringify({confirm_sku:sku})});
            message(`Product ${sku} restored to the active catalog.`);
            refreshInventory();
            await renderArchivedProducts();
          }
        } catch(error) { target.textContent=error.message; }
        finally { if(historyButton)historyButton.disabled=false; if(restoreButton)restoreButton.disabled=false; }
      });
    }
    dlg.showModal();
    await renderArchivedProducts();
  }
  async function renderArchivedProducts() {
    const content=byId('r1ArchivedContent');if(!content)return;
    content.textContent='Loading archived products…';
    try {
      await ensureAdministrator();
      const products=await request('/api/products/archived');
      if(!products.length){content.textContent='No archived products yet.';return;}
      content.innerHTML=products.map(p=>`<section class="r1-archive-card" style="border-top:1px solid #ddd;padding:12px 0">
        <strong>${esc(p.name)}</strong> · <code>${esc(p.sku)}</code><br>
        <span class="muted">Archived: ${esc(p.archived_at)} · Retained stock: ${esc(p.quantity)} · Recorded movements: ${esc(p.movement_count)} · ${esc(p.archived_by_email||'')}</span>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0"><button class="button secondary" type="button" data-archive-history="${Number(p.product_id)}">View history</button>
        <button class="button secondary" type="button" data-archive-restore="${Number(p.product_id)}" data-sku="${esc(p.sku)}">Restore to catalog</button></div>
        <div data-archive-detail="${Number(p.product_id)}"></div></section>`).join('');
    } catch(error){content.textContent=error.message;}
  }

  function syncControls() {
    const admin = isAdministrator();
    if (!admin && byId('r1CreateDialog')?.open) byId('r1CreateDialog').close();
    // Main inventory page: native action in the heading, no duplicate links.
    const heading = byId('page')?.querySelector('.page-heading .heading-actions');
    const existingCreate = byId('r1AddProduct');
    if (existingCreate && !admin) existingCreate.remove();
    if (admin && heading && !byId('r1ViewArchived') && (location.hash === '#inventory' || (!location.hash && byId('page')?.querySelector('#inventoryResults')))) {
      const btn=document.createElement('button');btn.id='r1ViewArchived';btn.type='button';btn.className='button secondary';btn.textContent='Archived products';btn.addEventListener('click',openArchivedProducts);heading.appendChild(btn);
    }
    if (!admin && byId('r1ViewArchived')) byId('r1ViewArchived').remove();
    if (admin && heading && !existingCreate && (location.hash === '#inventory' || (!location.hash && byId('page')?.querySelector('#inventoryResults')))) {
      const button = document.createElement('button');
      button.id = 'r1AddProduct'; button.type='button';
      button.className = 'button'; button.textContent = '+ Add product';
      button.addEventListener('click', openCreate);
      heading.prepend(button);
    }
    // The Stockroom SPA replaces the details panel when a product/tab changes.
    // Inject only when a product Details panel is currently shown.
    const panel = byId('drawerPanel');
    const existingDelete = byId('r1DeletePanel');
    if (existingDelete && !admin) existingDelete.remove();
    if (admin && panel && currentDrawerId() && !existingDelete) {
      const section = document.createElement('section');
      section.id = 'r1DeletePanel';
      section.className = 'r1-delete-panel';
      section.innerHTML = `
        <h3>Remove from catalog</h3>
        <p class="muted small">Administrator only. Remove this item from the active catalog at any quantity. Its stock balance, movements and videos stay in PostgreSQL. You can restore it later.</p>
        <form id="r1DeleteForm">
          <label>Type the exact SKU to confirm<input name="confirm_sku" type="text" maxlength="30" autocomplete="off" placeholder="Product SKU" required></label>
          <p class="inline-message" role="alert" aria-live="assertive"></p>
          <button class="button danger" type="submit">Remove from active catalog</button>
        </form>`;
      section.querySelector('form').addEventListener('submit', submitDelete);
      panel.appendChild(section);
    }
  }
  function start() {
    if (!byId('page') || !byId('productDialog')) return;
    const observer = new MutationObserver(syncControls);
    observer.observe(byId('page'), {childList:true,subtree:true});
    observer.observe(byId('productBody'), {childList:true,subtree:true});
    if (byId('accountName')) observer.observe(byId('accountName'), {childList:true,subtree:true,characterData:true});
    window.addEventListener('hashchange', syncControls);
    syncControls();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
