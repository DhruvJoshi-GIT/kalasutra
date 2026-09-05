/* ── chrome: header, capsule, panels ─────────────────────────────── */
const state = { cat:'all', q:'', sort:'newest', selAddr:null, selPay:null, tab:'buyer', otpPhone:'' };
function paintBar(){
  document.getElementById('bar').innerHTML = `
  <a class="logo press" id="logo" href="#home" title="Home">K<span class="nm">alaSutra</span></a>
  <div class="search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="q" placeholder="Search crafts, makers, places…" value="${esc(state.q)}" oninput="search(this.value)"></div>
  <div class="icons">
    <a class="icell press" href="#account" title="${loggedIn()?'Your account':'Sign in'}"><span class="k">${ICON.user}</span><span class="t">${loggedIn()?'Account':'Sign in'}</span></a>
    <a class="icell press" href="#cart" title="Cart"><span class="k">${ICON.cart}</span><span class="t">Cart</span><span class="badge">${cartCount()||''}</span></a>
    <a class="icell press" href="javascript:void(0)" onclick="togglePanel('wish')" title="Wishlist"><span class="k">${ICON.heart}</span><span class="t">Wishlist</span><span class="badge">${wish.length||''}</span></a>
    <a class="icell press acc" href="javascript:void(0)" onclick="togglePanel('support')" title="Sell / Support"><span class="k">${ICON.rupee}</span><span class="t">Sell</span></a>
    <a class="icell press" href="javascript:void(0)" onclick="window.scrollTo({top:0,behavior:'smooth'})" title="Back to top"><span class="k">${ICON.up}</span><span class="t">Top</span></a>
  </div>`;
  paintTop(); paintBnav();
  const q=document.getElementById('q'); if(document.activeElement && document.activeElement.id==='q'){ q.focus(); q.setSelectionRange(q.value.length,q.value.length); }
}
/* logo: full name while at the top of the page, square K once scrolled */
function paintTop(){ const l=document.getElementById('logo'); if(l) l.classList.toggle('wide', window.scrollY < 40); }
window.addEventListener('scroll', paintTop, {passive:true});
/* bottom navigation — phones only (CSS hides it above 600px) */
function paintBnav(){
  const key = (location.hash||'#home').slice(1).split('/')[0];
  const on = k => (k===key || (k==='home' && key==='shop')) ? 'on' : '';
  document.getElementById('bnav').innerHTML = `
    <a class="${on('home')}" href="#home">${ICON.home}<span>Home</span></a>
    <a class="${document.body.classList.contains('cats-open')?'on':''}" href="javascript:void(0)" onclick="toggleCats()">${ICON.grid}<span>Categories</span></a>
    <a class="${on('cart')}" href="#cart">${ICON.cart}<span>Cart</span><b class="badge">${cartCount()||''}</b></a>
    <a href="javascript:void(0)" onclick="togglePanel('wish')">${ICON.heart}<span>Wishlist</span><b class="badge">${wish.length||''}</b></a>
    <a class="${on('account')||on('login')||on('seller')||on('upload')}" href="#account">${ICON.user}<span>Profile</span></a>`;
}
function toggleCats(force){ document.body.classList.toggle('cats-open', force); paintBnav(); }
function paintCap(active){
  const open = !document.body.classList.contains('side-closed');
  document.getElementById('cap').innerHTML = `
  <div class="tg" onclick="toggleSide()" title="${open?'Collapse':'Expand'} categories"><span class="tx">Categories</span><span>${open?'‹':'›'}</span></div>
  ${CATS.map(c=>`<a href="#shop/${c.k}" class="press ${c.k===active?'on':''}" title="${c.n}"><span class="ab">${c.ab}</span><span class="tx">${c.n}</span></a>`).join('')}
  <div class="mk"><div class="label muted">Makers</div><a href="#artist/priya" style="min-height:0;padding:4px 0;text-transform:none;font-size:12px">Priya Devi · Bagru →</a><a href="#artist/meera" style="min-height:0;padding:4px 0;text-transform:none;font-size:12px">Meera Kumari · Madhubani →</a></div>`;
}
function toggleSide(){ document.body.classList.toggle('side-closed'); db.set('ks-side', document.body.classList.contains('side-closed')?'closed':'open'); paintCap(currentCat()); }
function currentCat(){ const h=(location.hash||'#home').slice(1).split('/'); return h[0]==='shop' ? (h[1]||'all') : (h[0]==='home'?'all':''); }
function togglePanel(id){ ['wish','support'].forEach(k=>{ const el=document.getElementById(k); el.classList.toggle('on', k===id ? !el.classList.contains('on') : false); }); if(id==='wish') paintWish(); }
document.addEventListener('click', e=>{ if(!e.target.closest('.panel') && !e.target.closest('.icell') && !e.target.closest('.bnav')) document.querySelectorAll('.panel.on').forEach(p=>p.classList.remove('on')); if(document.body.classList.contains('cats-open') && !e.target.closest('.cap') && !e.target.closest('.bnav')) toggleCats(false); });
function paintWish(){
  const items = wish.map(byId).filter(Boolean);
  document.getElementById('wish').innerHTML = `<h4>Wishlist <span class="mono" style="font-weight:400">${items.length}</span></h4>
  ${items.length ? `<ul>${items.map(p=>`<li><a href="javascript:void(0)" onclick="togglePanel();openProduct(${p.id})" title="Open product" style="display:flex;align-items:center;gap:10px;flex:1;min-width:0"><div class="thumb">${pic(p)}</div><div style="flex:1;min-width:0"><div style="font-weight:700;line-height:1.2;text-decoration:underline">${esc(p.n)}</div><span class="mono muted" style="font-size:12px">${fmt(p.price)}</span></div></a><button class="btn sm neo" onclick="addToCart(${p.id})">+ Cart</button><button class="btn sm ghost" onclick="toggleWish(${p.id})" title="Remove">✕</button></li>`).join('')}</ul>
  <div style="padding:10px 14px;border-top:2px solid var(--fg)"><button class="btn ink neo" style="width:100%" onclick="wish.forEach(id=>addToCart(id));">Move all to cart</button></div>`
  : `<div style="padding:18px"><div class="empty">Nothing saved yet.<br>Tap ♥ on any product to keep it here.</div></div>`}`;
}
document.getElementById('support').innerHTML = `<h4>Sell &amp; support</h4>
  <div style="padding:14px;display:flex;flex-direction:column;gap:10px">
    <a class="btn acc neo" href="#login/seller" onclick="togglePanel()">Open a shop → seller login</a>
    <div class="box" style="padding:12px"><div class="label muted">Contact</div><div class="mono" style="font-size:13px;margin-top:6px">Call 1800-[NUMBER]<br>WhatsApp: [NUMBER]<br>help@kalasutra.in</div></div>
    <div class="hi" style="font-size:13px">हिन्दी में मदद के लिए कॉल करें</div>
  </div>`;
function search(v){ state.q=v; const g=document.getElementById('shopArea'); if(g) g.innerHTML = shopArea(); else location.hash='#shop/all'; }
