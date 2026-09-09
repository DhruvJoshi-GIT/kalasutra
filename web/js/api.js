/* ── api: fetch wrapper, session, catalogue bootstrap ─────────────── */
const API_URL = (window.KS_CONFIG && window.KS_CONFIG.API_URL) || (location.origin + '/api');
let session = db.get('ks-session', null);          // {token, user}
const loggedIn = () => !!(session && session.token);
function setSession(s){ session = s; db.set('ks-session', s); }

async function api(path, {method='GET', body, headers={}} = {}){
  if(window.KS_OFFLINE) return demoApi(path, method, body);           // server unreachable: simulate (js/demo.js)
  const h = {'Accept':'application/json', ...headers};
  if(body !== undefined && !(body instanceof FormData)){ h['Content-Type']='application/json'; body = JSON.stringify(body); }
  if(loggedIn()) h['Authorization'] = 'Bearer ' + session.token;
  let res;
  try { res = await fetch(API_URL + path, {method, headers:h, body}); }
  catch(e){ throw new Error('Cannot reach the KalaSutra server'); }
  const json = await res.json().catch(()=>({}));
  if(res.status === 401 && loggedIn()){ setSession(null); paintBar(); }
  if(!res.ok){
    const msg = json.error || (typeof json.detail==='string' ? json.detail : json.detail?.[0]?.msg) || `Request failed (${res.status})`;
    const err = new Error(json.details?.[0]?.msg ? `${msg}: ${json.details[0].msg}` : msg); err.status = res.status; err.details = json.details; throw err;
  }
  return json.data !== undefined ? json.data : json;
}

/* after any sign-in: keep the token, merge the guest cart + wishlist into the account */
async function afterLogin(data){
  setSession({token:data.token, user:data.user});
  user = {...user, name:data.user.name||user.name, phone:data.user.phone||user.phone, email:data.user.email||user.email}; db.set('ks-user', user);
  try{
    const c = cart.length ? await api('/cart/merge',{method:'POST',body:{items:cart}}) : await api('/cart');
    cart = c.items; db.set('ks-cart', cart);
    wish = wish.length ? await api('/wishlist/merge',{method:'POST',body:{productIds:wish}}) : await api('/wishlist');
    db.set('ks-wish', wish);
  }catch(e){}
  paintBar(); paintWish();
}
async function refreshSession(){ try{ session.user = await api('/me'); db.set('ks-session', session); }catch(e){} }
function logout(){ setSession(null); addrs=[]; pays=[]; orders=[]; cart=[]; wish=[]; db.set('ks-cart',cart); db.set('ks-wish',wish); paintBar(); paintWish(); toast('Signed out'); location.hash='#home'; render(); }

/* catalogue: cached copy paints instantly, the network copy replaces it */
function applyCatalogue(d){
  P = d.products; MAKERS = d.makers;
  CATS = [{k:'all',n:'All crafts',ab:'AL'}, ...d.categories.map(c=>({k:c.slug,n:c.name,ab:c.abbr||c.name.slice(0,2).toUpperCase()}))];
  FEATURED = P.filter(p=>p.isFeatured).map(p=>p.id);
}
/* can the server cut out photos (fal.ai key configured)? sets window.KS_STUDIO for js/studio.js */
async function probeStudio(){ try{ window.KS_STUDIO = await api('/ai/studio'); }catch(e){ window.KS_STUDIO = {server:false, provider:'browser'}; } }
async function loadCatalogue(){
  const cached = db.get('ks-catalogue', null); if(cached && cached.products && cached.products.length) applyCatalogue(cached);
  try{ const d = await api('/catalogue/bootstrap'); applyCatalogue(d); db.set('ks-catalogue', d); probeStudio(); return true; }
  catch(e){
    // no server yet (or offline): demo mode — the bundled catalogue snapshot (always the newest), and js/demo.js answers the API calls locally
    window.KS_OFFLINE = true; if(session && session.token && session.token!=='demo') setSession(null);
    let ok = false;
    try{ const r = await fetch('catalogue.json', {cache:'no-cache'}); if(r.ok){ const d = await r.json(); applyCatalogue(d); db.set('ks-catalogue', d); ok = true; } }catch(_){}
    if(!ok && cached && cached.products && cached.products.length) ok = true;
    if(ok){ try{ demoListings().forEach(p=>{ if(!P.some(x=>x.id===p.id)) P.push(p); }); }catch(_){} toast('Demo mode — the server is not reachable'); return true; }
    document.getElementById('app').innerHTML = `<div class="empty" style="margin:40px 0">Cannot reach the KalaSutra server.<br><span class="mono" style="font-size:11px">${esc(API_URL)}</span><button class="btn ink neo" onclick="location.reload()">Retry</button></div>`; return false; }
}
