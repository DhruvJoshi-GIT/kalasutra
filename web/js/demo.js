/* ── demo mode: no server reachable ───────────────────────────────
   When the API cannot be reached (site served from Pages before the backend is
   deployed, or offline at the venue) the buyer and maker flows still run:
   OTP / email sign-in, cart, addresses, payment labels, orders, reviews and
   comments are simulated here and kept in localStorage['ks-demo'].
   Nothing here is billed or persisted anywhere else. */
const DEMO_CODE = '123456';
function demoStore(){ return db.get('ks-demo', {seq:1, addrs:[], pays:[], orders:[], reviews:{}, comments:{}}); }
function demoSave(d){ db.set('ks-demo', d); return d; }
function demoDigits(phone){ const d=String(phone||'').replace(/\D/g,''); return d.length>10 ? d.slice(-10) : d; }
function demoMakerForPhone(phone){ const m=/^98110000(\d\d)$/.exec(demoDigits(phone)); if(!m) return null; const slug=Object.keys(MAKERS)[Number(m[1])-1]; return slug ? {slug, ...MAKERS[slug]} : null; }
function demoUser(u){ return {id:u.id||1, name:u.name||'', email:u.email||null, phone:u.phone||null, role:u.role||'BUYER', artisanSlug:u.artisanSlug||null, preferredLanguage:'en-IN'}; }
async function demoApi(path, method, body){
  await new Promise(r=>setTimeout(r,120));                       // a beat, so buttons feel real
  const d = demoStore(); const p = path.replace(/\?.*$/,''); const id = p.split('/')[2];
  const need = () => { if(!loggedIn()) { const e=new Error('Please sign in first'); e.status=401; throw e; } };
  const orderNo = () => 'KS' + Date.now().toString(36).toUpperCase();
  /* auth */
  if(p==='/auth/otp/request' && method==='POST'){ if(demoDigits(body.phone).length!==10) throw new Error('Enter a 10-digit mobile number'); return {sent:true, expiresIn:300, devCode:DEMO_CODE}; }
  if(p==='/auth/otp/verify' && method==='POST'){
    if(String(body.code).trim()!==DEMO_CODE) throw new Error('Wrong code — the demo code is '+DEMO_CODE);
    const phone='+91'+demoDigits(body.phone), mk=demoMakerForPhone(body.phone);
    const user = demoUser(mk ? {id:100+Object.keys(MAKERS).indexOf(mk.slug), name:mk.n, phone, role:'ARTISAN', artisanSlug:mk.slug} : {id:900+Number(demoDigits(body.phone).slice(-3)), phone, role:'ARTISAN'});
    return {token:'demo', user, needsProfile:!mk};
  }
  if((p==='/auth/login'||p==='/auth/register') && method==='POST'){
    const email=String(body.email||'').trim().toLowerCase(); if(!email||!body.password) throw new Error('Email and password are required');
    if(p==='/auth/login' && email==='demo@kalasutra.in' && body.password!=='password123') throw new Error('Wrong password (demo buyer: password123)');
    return {token:'demo', user:demoUser({id:1, name: email==='demo@kalasutra.in' ? 'Demo Buyer' : (body.name||email.split('@')[0]), email, role:'BUYER'}), needsProfile:false};
  }
  if(p==='/me'){ need(); if(method==='PATCH'){ session.user={...session.user, ...body}; } return session.user; }
  /* cart + wishlist mirror what the browser already holds */
  if(p==='/cart'){ if(method==='PUT') return {items: body.items||[]}; if(method==='DELETE') return {items:[]}; return {items: cart}; }
  if(p==='/cart/merge') return {items: body.items||[]};
  if(p==='/wishlist') return wish;
  if(p==='/wishlist/merge') return body.productIds||[];
  if(p.startsWith('/wishlist/')){ const pid=Number(id); if(method==='POST' && !wish.includes(pid)) wish.push(pid); if(method==='DELETE') wish=wish.filter(x=>x!==pid); return wish; }
  /* addresses, payment labels, orders */
  if(p==='/addresses'){ need(); if(method==='POST'){ if(!/^\d{6}$/.test(String(body.pin||''))) throw new Error('PIN code must be 6 digits'); const a={id:d.seq++, name:body.name, phone:body.phone, line:body.line, city:body.city, state:body.state, pin:body.pin}; d.addrs.push(a); demoSave(d); return a; } return d.addrs; }
  if(p.startsWith('/addresses/') && method==='DELETE'){ need(); d.addrs=d.addrs.filter(a=>a.id!==Number(id)); demoSave(d); return {ok:true}; }
  if(p==='/payment-methods'){ need(); if(method==='POST'){ const type=body.type==='card'?'card':'upi'; let label;
      if(type==='upi'){ if(!/^[\w.\-]{2,}@[a-z]{2,}$/i.test(String(body.upi||'').trim())) throw new Error('Enter a UPI id like name@bank'); label=String(body.upi).trim(); }
      else { const n=String(body.card||'').replace(/\s/g,''); if(!/^\d{12,19}$/.test(n)) throw new Error('Enter a valid card number'); label='•••• '+n.slice(-4)+(body.cname?' · '+body.cname:''); }
      const pm={id:d.seq++, type, label}; d.pays.push(pm); demoSave(d); return pm; } return d.pays; }
  if(p.startsWith('/payment-methods/') && method==='DELETE'){ need(); d.pays=d.pays.filter(a=>a.id!==Number(id)); demoSave(d); return {ok:true}; }
  if(p==='/orders'){ need(); if(method==='POST'){
      const addr=d.addrs.find(a=>a.id===Number(body.addressId)), pay=d.pays.find(a=>a.id===Number(body.paymentMethodId));
      if(!addr||!pay) throw new Error('Choose an address and a payment method');
      const items=(body.items||[]).map(i=>{ const pr=byId(i.id); return pr ? {id:pr.id, n:pr.n, qty:i.qty, price:pr.price} : null; }).filter(Boolean);
      if(!items.length) throw new Error('Your cart is empty');
      const subtotal=items.reduce((s,i)=>s+i.price*i.qty,0), shipping=subtotal>=999?0:79;
      const o={no:orderNo(), date:new Date().toISOString(), status:'PENDING', paymentStatus:'PAID', items, subtotal, shipping, total:subtotal+shipping, addr, pay};
      d.orders.unshift(o); demoSave(d); return o; }
    return d.orders; }
  if(p.startsWith('/orders/')){ need(); const o=d.orders.find(o=>o.no===id); if(!o) throw new Error('Order not found'); return o; }
  /* reviews + comments per product */
  const rc=/^\/products\/(\d+)\/(reviews|comments)$/.exec(p);
  if(rc){ const pid=rc[1], kind=rc[2]; const list=d[kind][pid]||(d[kind][pid]=[]);
    if(method==='POST'){ if(!String(body.text||'').trim()) throw new Error('Write something first'); const name=(body.name||session.user?.name||'Guest').trim();
      if(kind==='reviews'){ if(!(body.stars>=1)) throw new Error('Pick a star rating'); const i=list.findIndex(r=>r.name===name); const r={id:d.seq++, stars:body.stars, text:body.text, name, date:new Date().toISOString()}; if(i>=0) list[i]=r; else list.unshift(r); }
      else list.unshift({id:d.seq++, text:body.text, name, date:new Date().toISOString(), answer:null});
      demoSave(d); }
    return list; }
  if(p==='/enquiries' && method==='POST'){ need(); return {id:d.seq++, status:'OPEN'}; }
  throw new Error('Not available in demo mode — this needs the KalaSutra server');
}
