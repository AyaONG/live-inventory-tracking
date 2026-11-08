'use strict';
/* Stockroom shell for older routes. Only presentation is altered; existing forms and API handlers remain intact. */
(() => {
  function init() {
    if (document.body.classList.contains('stockroom-legacy')) return;
    const pathname = window.location.pathname;
    const isWorkbench = pathname.endsWith('/endterm.html');
    const isReport = pathname.endsWith('/analysis.html');
    const label = isWorkbench ? 'BARCODE SIMULATOR' : isReport ? 'COURSEWORK REPORTS' : 'CLASSIC CATALOGUE';
    document.body.classList.add('stockroom-legacy');
    const shell = document.createElement('div');
    shell.className = 'stockroom-legacy-content';
    while (document.body.firstChild) shell.appendChild(document.body.firstChild);
    document.body.appendChild(shell);
    const sidebar = document.createElement('aside');
    sidebar.className = 'stockroom-legacy-sidebar';
    sidebar.id = 'stockroomLegacySidebar';
    sidebar.setAttribute('aria-label', 'Stockroom navigation');
    const item = (href, title, current) => `<a href="${href}" ${current ? 'aria-current="page"' : ''} class="stockroom-legacy-nav-link${current?' current':''}">${title}</a>`;
    sidebar.innerHTML = `<a class="stockroom-legacy-brand" href="/workspace.html#overview"><span class="stockroom-legacy-logo">s.</span><span>stockroom<small>Electronics inventory</small></span></a>
      <div class="stockroom-legacy-section">WORKSPACE</div><nav>
      ${item('/workspace.html#overview','Overview',false)}
      ${item('/workspace.html#inventory','Inventory',false)}
      ${item('/workspace.html#analytics','Analytics',false)}
      ${item('/workspace.html#restock','Replenishment',false)}
      ${item('/workspace.html#activity','Activity',false)}
      ${item('/workspace.html#media','Product videos',false)}
      ${item('/workspace.html#settings','Help & settings',false)}
      </nav><div class="stockroom-legacy-section">COURSEWORK TOOLS</div><nav>
      ${item('/endterm.html','Barcode simulator',isWorkbench)}
      
      ${item('/index.html','Classic catalogue',!isWorkbench&&!isReport)}
      </nav><div class="stockroom-legacy-footnote">SE-2626 · Coursework prototype<br>Archived data is separate from live metrics.</div>`;
    document.body.insertBefore(sidebar, shell);
    const toolbar = document.createElement('div');
    toolbar.className = 'stockroom-legacy-toolbar';
    toolbar.innerHTML = `<button id="stockroomLegacyMenu" class="stockroom-legacy-menu" type="button" aria-controls="stockroomLegacySidebar" aria-expanded="false" aria-label="Toggle navigation">☰</button>
     <span class="stockroom-legacy-breadcrumb">STORE OPERATIONS <span>/</span> <strong>${label}</strong></span>
     <a href="/workspace.html" class="stockroom-legacy-back">Main workspace ↗</a>`;
    shell.insertBefore(toolbar, shell.firstChild);
    const menu = toolbar.querySelector('#stockroomLegacyMenu');
    menu.addEventListener('click', () => {
      const open = !sidebar.classList.contains('stockroom-legacy-open');
      sidebar.classList.toggle('stockroom-legacy-open', open);
      menu.setAttribute('aria-expanded', String(open));
    });
    sidebar.addEventListener('click', e => { if (e.target.closest('a')) {
      sidebar.classList.remove('stockroom-legacy-open');
      menu.setAttribute('aria-expanded', 'false');
    }});
    document.addEventListener('keydown', e => { if (e.key === 'Escape') {
      sidebar.classList.remove('stockroom-legacy-open');
      menu.setAttribute('aria-expanded','false');
    }});
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
