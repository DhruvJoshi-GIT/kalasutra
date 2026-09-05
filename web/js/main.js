/* ── theme ───────────────────────────────────────────────────────── */
const sun=`<svg class="sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>`;
const moon=`<svg class="moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
function paintTheme(){ document.getElementById('theme').innerHTML = document.documentElement.classList.contains('dark') ? moon : sun; }
document.getElementById('theme').onclick = () => { const next = !document.documentElement.classList.contains('dark'); const apply=()=>{ document.documentElement.classList.toggle('dark',next); try{localStorage.setItem('ks-theme',next?'dark':'light')}catch(e){} paintTheme(); }; document.startViewTransition ? document.startViewTransition(apply) : apply(); };

/* ── boot ────────────────────────────────────────────────────────── */
if(db.get('ks-side','open')==='closed') document.body.classList.replace('side-open','side-closed');
paintTheme(); paintBar(); paintWish();
(async () => {
  const ok = await loadCatalogue();
  if(ok){ await render(); if(loggedIn()) refreshSession(); }
})();
