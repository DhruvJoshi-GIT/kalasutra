/* ── screens ─────────────────────────────────────────────────────── */
const S = {};
function shopArea(){
  const list = sortList(filtered());
  const home = state.cat==='all' && !state.q;
  return `${home ? featured() : ''}
  <div class="sec"><h1>${state.q ? `Results for “${esc(state.q)}”` : catName(state.cat)}</h1><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span class="label muted">${list.length} listing${list.length===1?'':'s'}</span>${sortSel()}</div></div>
  ${list.length ? `<div class="grid shop">${tiles(list)}</div>` : `<div class="empty" style="margin:12px 0">Nothing matches. Try another word or category.</div>`}
  <div class="sec" style="border-top:2px solid var(--fg);padding-top:14px"><span class="label muted">© KalaSutra · UPI · Cards · Ships across India</span><a class="label" href="#login" style="text-decoration:underline">Sell with us →</a></div>`;
}
S.home = () => `<div id="shopArea">${shopArea()}</div>`;
S.shop = S.home;

S.cart = () => {
  const items = cart.map(c=>({...c,p:byId(c.id)})).filter(x=>x.p);
  const sub = cartSub(), ship = shipping(sub), total = sub+ship;
  const ids = new Set(cart.map(c=>c.id));
  const rel = allP().filter(p=>!ids.has(p.id) && items.some(i=>i.p.cat===p.cat || i.p.mk===p.mk)).slice(0,10);
  if(loggedIn()){ if(state.selAddr==null || !addrs.some(a=>a.id===state.selAddr)) state.selAddr = addrs[0]?.id ?? null; if(state.selPay==null || !pays.some(p=>p.id===state.selPay)) state.selPay = pays[0]?.id ?? null; }
  const canOrder = loggedIn() && items.length && state.selAddr!=null && state.selPay!=null;
  return `
  <div class="sec"><h1>Your cart</h1><span class="label muted">${cartCount()} item${cartCount()===1?'':'s'}</span></div>
  <div class="split">
    <div>
      ${items.length ? items.map(({p,qty})=>`<div class="crow"><div class="thumb" onclick="openProduct(${p.id})">${pic(p)}</div><div class="nm"><div style="font-weight:700;line-height:1.25">${esc(p.n)}</div><span class="label muted">${esc(maker(p).n)} · ${esc(maker(p).place)}</span><div class="mono muted" style="font-size:12px;margin-top:2px">${fmt(p.price)} each</div></div><div class="qty"><button onclick="setQty(${p.id},${qty-1});render()">−</button><span>${qty}</span><button onclick="setQty(${p.id},${qty+1});render()">+</button></div><span style="font-weight:900;min-width:90px;text-align:right">${fmt(p.price*qty)}</span><button class="btn sm ghost" title="Remove" onclick="removeFromCart(${p.id});render()">✕</button></div>`).join('')
      : `<div class="empty">Your cart is empty.<a class="btn ink neo" href="#shop/all">Shop the crafts</a></div>`}
      ${rel.length ? `<div class="sec" style="padding-top:26px"><h2 style="font-size:15px">You may also like</h2><span class="label muted">scroll →</span></div><div class="strip">${rel.map(card).join('')}</div>` : ''}
    </div>
    <div class="sticky">
      <div class="box" style="padding:16px 18px">
        <div class="label" style="margin-bottom:8px">Order summary</div>
        <div class="line"><span class="muted">Subtotal</span><span>${fmt(sub)}</span></div>
        <div class="line"><span class="muted">Shipping</span><span>${sub===0?'—':(ship?fmt(ship):'Free')}</span></div>
        <div class="line" style="font:900 18px 'Archivo'"><span>Total</span><span>${fmt(total)}</span></div>
        ${sub && sub<999 ? `<div class="mono muted" style="font-size:11px;margin-top:6px">Add ${fmt(999-sub)} more for free shipping.</div>`:''}
      </div>
      ${!loggedIn() ? authBox('Sign in to check out') : `<div class="box" style="padding:16px 18px;margin-top:12px">
        <div class="label" style="margin-bottom:10px">Deliver to</div>
        ${addrs.length ? addrs.map((a,i)=>`<div class="opt ${a.id===state.selAddr?'on':''}" onclick="state.selAddr=${a.id};render()"><span class="rd"></span><div><b>${esc(a.name)}</b> · ${esc(a.phone)}<br><span class="muted">${esc(a.line)}, ${esc(a.city)}, ${esc(a.state)} ${esc(a.pin)}</span></div></div>`).join('') : `<div class="muted" style="font-size:13px;margin-bottom:8px">No address saved yet.</div>`}
        <details ${addrs.length?'':'open'}><summary class="label" style="cursor:pointer;margin:4px 0 8px">+ Add an address</summary>${addrForm()}</details>
      </div>
      <div class="box" style="padding:16px 18px;margin-top:12px">
        <div class="label" style="margin-bottom:10px">Pay with</div>
        ${pays.length ? pays.map((a,i)=>`<div class="opt ${a.id===state.selPay?'on':''}" onclick="state.selPay=${a.id};render()"><span class="rd"></span><div><b>${a.type==='upi'?'UPI':'Card'}</b> · <span class="mono">${esc(a.label)}</span></div></div>`).join('') : `<div class="muted" style="font-size:13px;margin-bottom:8px">No payment method saved yet.</div>`}
        <details ${pays.length?'':'open'}><summary class="label" style="cursor:pointer;margin:4px 0 8px">+ Add a payment method</summary>${payForm()}</details>
      </div>`}
      <button class="btn acc lg neo" style="width:100%;margin-top:12px" ${canOrder?'':'disabled'} onclick="placeOrder()">Place order · ${fmt(total)}</button>
      ${!canOrder && items.length && loggedIn() ? `<div class="mono muted" style="font-size:11px;margin-top:6px;text-align:center">Add an address and a payment method to place the order.</div>`:''}
    </div>
  </div>`;
};
function addrForm(){ return `<form class="form" onsubmit="return saveAddr(this)">
  <input name="name" placeholder="Full name" required value="${esc(user.name)}"><input name="phone" placeholder="Mobile" required value="${esc(user.phone)}">
  <input class="full" name="line" placeholder="House, street, area" required>
  <input name="city" placeholder="City" required><input name="state" placeholder="State" required><input name="pin" placeholder="PIN code" required pattern="[0-9]{6}">
  <button class="btn ink neo full" type="submit">Save address</button></form>`; }
async function saveAddr(f){ const d=Object.fromEntries(new FormData(f)); try{ const a=await api('/addresses',{method:'POST',body:d}); addrs=await api('/addresses'); state.selAddr=a.id; if(!user.name){ user.name=d.name; user.phone=d.phone; db.set('ks-user',user);} toast('Address saved'); render(); }catch(e){ toast(e.message) } return false; }
async function delAddr(id){ try{ await api(`/addresses/${id}`,{method:'DELETE'}); addrs=await api('/addresses'); state.selAddr=null; render(); }catch(e){ toast(e.message) } }
function payForm(){ return `<form class="form" onsubmit="return savePay(this)">
  <select name="type" class="full" onchange="this.form.querySelector('[name=upi]').hidden=this.value!=='upi';this.form.querySelector('[name=card]').hidden=this.value!=='card';this.form.querySelector('[name=cname]').hidden=this.value!=='card'"><option value="upi">UPI</option><option value="card">Debit / credit card</option></select>
  <input class="full" name="upi" placeholder="yourname@upi">
  <input class="full" name="card" placeholder="Card number" hidden inputmode="numeric"><input class="full" name="cname" placeholder="Name on card" hidden>
  <button class="btn ink neo full" type="submit">Save</button></form>`; }
async function savePay(f){ const d=Object.fromEntries(new FormData(f));
  try{ const p=await api('/payment-methods',{method:'POST',body:d}); pays=await api('/payment-methods'); state.selPay=p.id; toast('Payment method saved'); render(); }catch(e){ toast(e.message) } return false; }
async function delPay(id){ try{ await api(`/payment-methods/${id}`,{method:'DELETE'}); pays=await api('/payment-methods'); state.selPay=null; render(); }catch(e){ toast(e.message) } }
async function placeOrder(){
  if(!loggedIn() || !cart.length || state.selAddr==null || state.selPay==null) return;
  try{ const o = await api('/orders',{method:'POST',body:{addressId:state.selAddr, paymentMethodId:state.selPay, items:cart}});
       cart=[]; db.set('ks-cart',cart); orders=[o,...orders]; paintBar(); location.hash='#confirmed/'+o.no; }
  catch(e){ toast(e.message) }
}

S.confirmed = (no) => { const o = orders.find(x=>x.no===no) || orders[0]; return `
<div class="box" style="min-height:calc(100vh - 160px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;padding:40px;margin-top:20px">
  <div style="width:150px;height:150px;border:3px solid var(--fg);border-radius:48px;display:flex;align-items:center;justify-content:center;box-shadow:6px 6px 0 0 var(--ink)"><svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" stroke-width="3" stroke-linecap="round"><path d="M4 12l5 5 11-11"/></svg></div>
  <h1 class="display" style="font-size:clamp(36px,5vw,72px)">Order confirmed</h1>
  <div class="hi" style="font-size:34px;font-weight:700">धन्यवाद${(session.user?.name||user.name)?', '+esc((session.user?.name||user.name).split(' ')[0]):''}</div>
  ${o ? `<span class="mono muted" style="font-size:13px">Order ${o.no} · ${o.items.length} item${o.items.length===1?'':'s'} · ${fmt(o.total)} · paid by ${o.pay.type==='upi'?'UPI':'card'}<br>Delivering to ${esc(o.addr.city)} · the makers will accept it within a day · updates by SMS</span>`:''}
  <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><a class="btn ink neo" href="#account/orders">Your orders</a><a class="btn neo" href="#shop/all">Keep shopping</a></div>
</div>`; };

S.account = (open='') => {
  if(!loggedIn()) return `<div class="sec"><h1>Your account</h1></div><div class="split"><div>${authBox('Sign in or create an account')}</div><div class="box" style="padding:20px"><div class="label muted">Makers</div><p style="margin:8px 0 12px;font-size:14px">Sell your work on KalaSutra: log in with your phone number.</p><a class="btn acc neo" href="#login/seller">Seller login →</a></div></div>`;
  const ini = (user.name||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || '?';
  const acc = (key,title,sub,body) => `<div class="acc-item ${open===key?'on':''}" id="acc-${key}"><div class="hd" onclick="this.parentElement.classList.toggle('on')"><div><div class="display" style="font-size:20px">${title}</div><div class="mono muted" style="font-size:12px;margin-top:4px">${sub}</div></div><span style="font-size:22px">›</span></div><div class="bd">${body}</div></div>`;
  return `
  <div class="sec"><h1>Your account</h1><span style="display:flex;gap:10px;align-items:center"><span class="label muted">${esc(session.user.email||session.user.phone||'')}</span><button class="btn sm neo" onclick="logout()">Sign out</button></span></div>
  <div class="split">
    <div>
      ${acc('addr','Address', addrs.length?`${addrs.length} saved`:'nothing saved yet',
        (addrs.length?addrs.map((a,i)=>`<div class="opt" style="cursor:default"><div style="flex:1"><b>${esc(a.name)}</b> · ${esc(a.phone)}<br><span class="muted">${esc(a.line)}, ${esc(a.city)}, ${esc(a.state)} ${esc(a.pin)}</span></div><button class="btn sm ghost" onclick="delAddr(${a.id})">✕</button></div>`).join(''):`<div class="empty" style="margin-bottom:12px">No address yet. Add one below — it is used at checkout.</div>`) + addrForm())}
      ${acc('pay','Payment', pays.length?`${pays.length} saved`:'nothing saved yet',
        (pays.length?pays.map((a,i)=>`<div class="opt" style="cursor:default"><div style="flex:1"><b>${a.type==='upi'?'UPI':'Card'}</b> · <span class="mono">${esc(a.label)}</span></div><button class="btn sm ghost" onclick="delPay(${a.id})">✕</button></div>`).join(''):`<div class="empty" style="margin-bottom:12px">No payment method yet.</div>`) + payForm())}
      ${acc('orders','Your orders', orders.length?`${orders.length} order${orders.length===1?'':'s'}`:'no orders yet',
        orders.length?orders.map(o=>`<div class="box" style="padding:14px;margin-bottom:10px"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span class="mono" style="font-size:12px">${o.no} · ${new Date(o.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span><span class="label" style="color:var(--ok)">${o.status}</span></div>${o.items.map(i=>`<div class="line"><span><a href="javascript:void(0)" onclick="openProduct(${i.id})" style="text-decoration:underline">${esc(i.n)}</a> × ${i.qty}</span><span>${fmt(i.price*i.qty)}</span></div>`).join('')}<div class="line" style="font-weight:900"><span>Total (incl. shipping)</span><span>${fmt(o.total)}</span></div><div class="mono muted" style="font-size:11px;margin-top:6px">To ${esc(o.addr.name)}, ${esc(o.addr.city)} · ${o.pay.type==='upi'?'UPI':'Card'} ${esc(o.pay.label)}</div></div>`).join('')
        :`<div class="empty">You haven't ordered anything yet.<a class="btn ink neo" href="#shop/all">Shop the crafts</a></div>`)}
    </div>
    <div class="sticky">
      <div class="box" style="padding:20px;display:flex;flex-direction:column;gap:14px;align-items:center">
        <div class="avatar">${ini}</div>
        <form class="form" style="width:100%" onsubmit="return saveUser(this)">
          <div class="label muted full">Details</div>
          <input class="full" name="name" placeholder="Your name" value="${esc(user.name)}">
          <input class="full" name="phone" placeholder="Mobile" value="${esc(user.phone)}">
          <input class="full" name="email" type="email" placeholder="Email" value="${esc(user.email)}">
          <button class="btn neo full" type="submit">Save</button>
        </form>
        <div class="line" style="width:100%"><span class="muted">Cart</span><span>${cartCount()} items</span></div>
        <div class="line" style="width:100%"><span class="muted">Wishlist</span><span>${wish.length} saved</span></div>
        <a class="label" href="#login/seller" style="text-decoration:underline">Are you a maker? Seller login →</a>
      </div>
    </div>
  </div>`;
};
async function saveUser(f){ const d=Object.fromEntries(new FormData(f)); Object.keys(d).forEach(k=>{ if(d[k]==='') delete d[k]; }); try{ if(loggedIn()){ const u=await api('/me',{method:'PATCH',body:d}); session.user=u; db.set('ks-session',session); } user={...user,...d}; db.set('ks-user',user); toast('Saved'); render(); }catch(e){ toast(e.message) } return false; }

S.login = (tab) => { if(tab==='seller'||tab==='buyer') state.tab=tab; const seller = state.tab==='seller'; return `
<div class="box split login" style="grid-template-columns:clamp(320px,32vw,720px) minmax(0,1fr);gap:0;align-items:stretch;height:calc(100vh - 110px);min-height:560px;margin-top:20px;overflow:hidden">
  <div style="border-right:2px solid var(--fg);padding:clamp(24px,3vw,80px);display:flex;flex-direction:column;justify-content:center;gap:clamp(14px,1.2vw,28px)">
    <div style="display:flex;gap:8px"><button class="btn ${seller?'':'ink'} neo" onclick="state.tab='buyer';render()">Buyer</button><button class="btn ${seller?'ink':''} neo" onclick="state.tab='seller';render()">Maker / seller</button></div>
    ${seller ? `
    <span class="label muted">Seller login · <span class="hi">विक्रेता लॉगिन</span></span>
    <h1 class="display" style="font-size:clamp(30px,2.4vw,64px)">Welcome back, maker</h1>
    ${state.otpPhone ? `
    <form onsubmit="return otpVerify(this)" style="display:flex;flex-direction:column;gap:12px">
      <span class="mono muted" style="font-size:13px">Code sent to ${esc(state.otpPhone)} <a href="javascript:void(0)" onclick="state.otpPhone='';render()" style="text-decoration:underline">change</a></span>
      <div class="field"><span class="label">One-time code</span><input name="code" inputmode="numeric" placeholder="123456" required autofocus></div>
      <button class="btn acc lg neo" type="submit">Enter my shop</button>
      ${state.devCode?`<span class="mono muted" style="font-size:11px">Demo: the code is ${state.devCode}</span>`:''}
    </form>` : `
    <form onsubmit="return otpRequest(this)" style="display:flex;flex-direction:column;gap:12px">
      <div class="field"><span class="label">Mobile number</span><input name="phone" inputmode="tel" placeholder="98110 00001" required></div>
      <button class="btn acc lg neo" type="submit">Send code</button>
      <span class="mono muted" style="font-size:11px">Demo makers: 9811000001 (Priya) · 9811000002 (Meera). New numbers get a fresh shop.</span>
    </form>`}` : `
    <span class="label muted">Buyer account</span>
    <h1 class="display" style="font-size:clamp(30px,2.4vw,64px)">Welcome</h1>
    ${authBox('', true)}`}
  </div>
  <div style="position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;gap:clamp(16px,2vw,48px);padding:clamp(24px,3vw,80px);background:repeating-linear-gradient(135deg,transparent 0 18px,color-mix(in srgb,var(--fg) 6%,transparent) 18px 20px)">
    <span class="label">Motivation · for the women who make</span>
    <svg viewBox="0 0 600 320" style="width:100%;max-width:min(100%,1300px);margin:0 auto;flex:1 1 auto;min-height:0;max-height:min(40vh,640px)" fill="none" stroke="var(--fg)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M60 280h480"/><path d="M120 280V120h360v160"/><path d="M120 120l-20-40h400l-20 40"/>
      <g stroke-width="2">${[150,180,210,240,270,300,330,360,390,420,450].map(x=>`<path d="M${x} 130v140"/>`).join('')}</g>
      <path d="M120 200h360" stroke="var(--acc)" stroke-width="6"/>
      <circle cx="90" cy="150" r="22"/><path d="M90 172c-30 0-42 30-42 60v48h84v-48c0-30-12-60-42-60z" fill="var(--bg)"/><path d="M110 200l40 10"/><path d="M76 132c6-14 24-16 30-2"/>
      <circle cx="540" cy="160" r="20"/><path d="M540 180c-26 0-36 26-36 52v48h72v-48c0-26-10-52-36-52z" fill="var(--bg)"/><path d="M520 208l-40 6"/>
    </svg>
    <div><div class="display" style="font-size:clamp(26px,2.5vw,68px);max-width:15ch">Your hands made it. Let the whole country see it.</div><div class="hi" style="font-size:clamp(18px,1.1vw,32px);font-weight:700;margin-top:10px">आपके हाथ का हुनर, पूरे देश तक।</div></div>
  </div>
</div>`; };

S.seller = () => { const slug = session.user?.artisanSlug; if(!slug) return `<div class="sec"><h1>My shop</h1></div><div class="empty">Sign in as a maker to see your shop.<a class="btn acc neo" href="#login/seller">Seller login</a></div>`; const me = MAKERS[slug]||{}; const mine = P.filter(p=>p.mk===slug); return `
  <div class="box" style="margin-top:20px;padding:10px 18px;background:var(--fg);color:var(--bg);display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span class="label" style="color:var(--acc)">Seller account · ${esc(me.shop||me.n||'')} · ${(me.kycStatus||'').toLowerCase()||'pending'}</span><span class="mono" style="font-size:12px">${mine.length} live listing${mine.length===1?'':'s'}</span></div>
  <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">${crumb(['My shop','Products','Live'])}<a class="btn acc neo" href="#upload" style="margin-top:20px;width:56px;height:56px;padding:0;font-size:26px" title="Add product">+</a></div>
  <div class="sec"><h1>My products <span class="hi" style="font:700 18px 'Noto Sans Devanagari';letter-spacing:0;text-transform:none;color:var(--muted)">· मेरे प्रोडक्ट</span></h1><a class="label" href="#upload" style="text-decoration:underline">Add a product · नया प्रोडक्ट</a></div>
  <div class="grid shop">${mine.map(card).join('')}</div>`; };
const crumb = parts => `<div class="crumb">${parts.map(x=>`<span>${x}</span>`).join('')}</div>`;

S.upload = () => `
  <div class="sec"><h1>Add a product <span class="hi" style="font:700 18px 'Noto Sans Devanagari';letter-spacing:0;text-transform:none;color:var(--muted)">· नया प्रोडक्ट</span></h1><span class="label muted">Seller · ${esc(MAKERS[session.user?.artisanSlug]?.n||'')}</span></div>
  <div class="split" style="grid-template-columns:minmax(0,1fr) clamp(300px,24vw,400px)">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:16px;align-content:start">
      <div class="box" style="padding:16px;display:flex;flex-direction:column;gap:12px;min-height:300px">
        <span class="label">1 · Photo upload</span>
        <div id="photoZone" class="box" style="flex:1;border-style:dashed;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:170px;position:relative;overflow:hidden">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg>
          <button class="btn ink neo" onclick="doUpload()">Upload photo</button>
          <span class="mono muted" style="font-size:11px">Studio: background cleaned automatically</span>
        </div>
      </div>
      <div class="box" style="padding:16px;display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="label">2 · Product description</span><span class="label muted" id="descState">waiting for photo</span></div>
        <div id="descBox" class="box" style="min-height:150px;padding:12px;font-size:14px;line-height:1.6;background:var(--sec)"><span class="muted">Describe it by voice, or let the app write it from the photo.</span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn neo" id="voiceBtn" onclick="doDescribe()" disabled>🎙 Describe by voice</button><button class="btn neo" id="editBtn" onclick="editDesc()" disabled>Edit</button></div>
      </div>
      <div class="box" style="padding:16px;display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="label">3 · Price approx.</span><span class="label muted" id="priceState">waiting for description</span></div>
        <div id="priceBox" class="box mono" style="display:grid;grid-template-columns:repeat(3,1fr);overflow:hidden"><div style="padding:12px;border-right:1px solid var(--fg)"><div class="label muted">Floor</div><div style="font-size:20px">—</div></div><div style="padding:12px;border-right:1px solid var(--fg)"><div class="label">Fair</div><div style="font-size:26px">—</div></div><div style="padding:12px"><div class="label muted">Premium</div><div style="font-size:20px">—</div></div></div>
        <div class="field"><span class="label">Your price (₹)</span><input id="priceInput" placeholder="—" oninput="check()" disabled inputmode="numeric"></div>
      </div>
      <div class="box" style="padding:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px">
        <span class="label" style="align-self:flex-start">4 · Submit</span>
        <div class="diamond off" id="submitBtn" onclick="submitListing()"><span>Submit<br>to market</span></div>
        <span class="mono muted" style="font-size:11px;text-align:center" id="submitHint">Only works when the checklist is OK</span>
      </div>
    </div>
    <div class="box sticky" style="overflow:hidden">
      <div class="sec" style="padding:12px 16px"><span class="label">Checklist of requirements</span></div>
      <div class="check" id="ck1"><span class="m">✕</span>Photo <span class="hi muted" style="font-weight:500;margin-left:auto">फ़ोटो</span></div>
      <div class="check" id="ck2"><span class="m">✕</span>Description <span class="hi muted" style="font-weight:500;margin-left:auto">विवरण</span></div>
      <div class="check" id="ck3"><span class="m">✕</span>Price <span class="hi muted" style="font-weight:500;margin-left:auto">दाम</span></div>
      <div style="padding:14px 16px;font-weight:700;color:var(--err)" id="ckMsg">✕ It can't be submitted to the market yet.</div>
      <div class="mono muted" style="font-size:12px;padding:12px 16px;border-top:1px solid var(--fg)">Prototype: click Upload → Describe → type a price → Submit. The listing then appears in your shop and in the store.</div>
    </div>
  </div>`;

S.artist = (key='priya') => { const m = MAKERS[key]||Object.values(MAKERS)[0]; if(!m) return `<div class="empty" style="margin:40px 0">Maker not found.</div>`; key = m.slug||key; const work = P.filter(p=>p.mk===key); return `
  <div class="split" style="margin-top:20px;grid-template-columns:minmax(0,1fr) clamp(300px,26vw,440px)">
    <div>
      <div style="display:grid;grid-template-columns:clamp(160px,18vw,260px) minmax(0,1fr);gap:20px;align-items:start">
        <div class="box pimg" style="aspect-ratio:1;overflow:hidden"><img src="${m.img||''}" alt="${esc(m.n)}"></div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <span class="label muted">Artist portfolio · verified maker</span>
          <h1 class="display" style="font-size:clamp(28px,3vw,50px)">${esc(m.shop)}</h1>
          <span class="mono" style="font-size:13px">${esc(m.craft)} · ${esc(m.place)} · since ${m.since} · ${work.length} listing${work.length===1?'':'s'}</span>
          <div class="box" style="padding:14px;font-size:15px;line-height:1.6">“${esc(m.en)}”</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn acc neo" href="javascript:void(0)" onclick="openEnquiry('${key}')">Request a bulk quote</a></div>
        </div>
      </div>
      <div class="sec"><h2>Work</h2><span class="label muted">${work.length} pieces</span></div>
      <div class="grid shop">${work.map(card).join('')}</div>
    </div>
    <div class="box sticky" style="padding:20px;display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;justify-content:space-between"><span class="label">${key==='priya'||key==='meera'?'Her':'Their'} story</span><span class="label muted">3 languages</span></div>
      <div><span class="label muted">English / हिन्दी · translated by the app</span><p style="font-size:14px;line-height:1.65;margin-top:6px" id="storyText" data-en="${esc(m.en)}" data-hi="${esc(m.hi)}">${esc(m.en)}</p></div>
      <div><span class="label muted">Regional language · given by the seller</span><p class="hi" style="font-size:15px;line-height:1.8;margin-top:6px">${esc(m.hi)}</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn neo" onclick="toggleStory(this)">Read in हिन्दी</button><button class="btn neo" title="Read aloud" onclick="toast('Voice playback comes with the AI phase')">🔊 सुनें</button></div>
    </div>
  </div>`; };

/* screens that need server data before they render */
const LOAD = {
  cart: async () => { if(loggedIn()){ [addrs, pays] = await Promise.all([api('/addresses'), api('/payment-methods')]); } },
  account: async () => { if(loggedIn()){ [addrs, pays, orders] = await Promise.all([api('/addresses'), api('/payment-methods'), api('/orders')]); } },
  confirmed: async (no) => { if(loggedIn() && no && !orders.find(o=>o.no===no)){ try{ orders=[await api(`/orders/${no}`), ...orders]; }catch(e){} } },
};

/* sign-in / register box used by the cart, the account page and the login screen */
function authBox(title, plain=false){ return `<div class="${plain?'':'box'}" style="${plain?'':'padding:16px 18px;margin-top:12px'}">
  ${title?`<div class="label" style="margin-bottom:10px">${title}</div>`:''}
  <form class="form" onsubmit="return buyerAuth(this, event.submitter?.value)">
    <input class="full" name="email" type="email" placeholder="Email" required autocomplete="email">
    <input class="full" name="password" type="password" placeholder="Password (6+ characters)" required minlength="6" autocomplete="current-password">
    <input class="full" name="name" placeholder="Your name (for a new account)" autocomplete="name">
    <button class="btn ink neo" type="submit" value="login">Sign in</button><button class="btn neo" type="submit" value="register">Create account</button>
  </form>
  <div class="mono muted" style="font-size:11px;margin-top:8px">Demo buyer: demo@kalasutra.in / password123</div>
</div>`; }
async function buyerAuth(f, action){ const d=Object.fromEntries(new FormData(f)); try{
    const path = action==='register' ? '/auth/register' : '/auth/login';
    const body = action==='register' ? d : {email:d.email, password:d.password};
    const data = await api(path,{method:'POST',body}); await afterLogin(data); toast(action==='register'?'Account created':'Signed in');
    if((location.hash||'').startsWith('#login')) location.hash='#account'; else render();
  }catch(e){ toast(e.message) } return false; }
async function otpRequest(f){ const phone=new FormData(f).get('phone'); try{ const r=await api('/auth/otp/request',{method:'POST',body:{phone}}); state.otpPhone=phone; state.devCode=r.devCode||''; render(); }catch(e){ toast(e.message) } return false; }
async function otpVerify(f){ const code=new FormData(f).get('code'); try{ const data=await api('/auth/otp/verify',{method:'POST',body:{phone:state.otpPhone, code}}); await afterLogin(data); state.otpPhone=''; if(data.needsProfile){ toast('Welcome! Seller onboarding comes in the next build step'); location.hash='#account'; } else { location.hash='#seller'; } }catch(e){ toast(e.message) } return false; }
async function openEnquiry(makerSlug){ if(!loggedIn()){ toast('Sign in to request a quote'); location.hash='#login'; return; } const m=MAKERS[makerSlug]; const first=P.find(p=>p.mk===makerSlug); if(!first) return;
  const qty = prompt(`How many pieces of “${first.n}” do you need from ${m.n}?`, '50'); if(!qty) return;
  try{ await api('/enquiries',{method:'POST',body:{productId:first.id, quantity:Number(qty)||1, message:'Bulk quote request from the maker page'}}); toast(`Quote request sent to ${m.n}`); }catch(e){ toast(e.message) } }
