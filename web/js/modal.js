/* ── product modal ───────────────────────────────────────────────── */
let mQty = 1, mPick = 0;
async function openProduct(id){ const p=byId(id); if(!p) return; mQty=1; mPick=0; document.getElementById('modal').innerHTML = productHtml(p); document.getElementById('mbg').classList.add('on'); document.getElementById('mbg').scrollTop=0; document.body.classList.add('lock');
  try{ const [rv,cm] = await Promise.all([api(`/products/${id}/reviews`), api(`/products/${id}/comments`)]); reviews[id]=rv; comments[id]=cm; if(document.getElementById('mbg').classList.contains('on')){ const y=document.getElementById('mbg').scrollTop; document.getElementById('modal').innerHTML=productHtml(p); document.getElementById('mbg').scrollTop=y; } }catch(e){} }
function closeProduct(){ document.getElementById('mbg').classList.remove('on'); document.body.classList.remove('lock'); }
function productHtml(p){
  const m=maker(p), d={...DEF[p.cat],...(p.d||{})}, rv=reviews[p.id]||[], cm=comments[p.id]||[];
  const avg = rv.length ? rv.reduce((a,r)=>a+r.stars,0)/rv.length : 0;
  const inCart = cart.find(c=>c.id===p.id);
  return `<button class="x press" onclick="closeProduct()" title="Close">✕</button>
  <div class="top">
    <div class="gal">${pic(p)}</div>
    <div class="info">
      <span class="label muted"><a href="#shop/${p.cat}" onclick="closeProduct()">${catName(p.cat)}</a> › ${esc(m.n)}</span>
      <h2>${esc(p.n)}</h2>
      <span class="hi muted" style="font-size:14px">${esc(p.hi||'')}</span>
      <a class="label" href="#artist/${p.mk}" onclick="closeProduct()" style="text-decoration:underline">${esc(m.shop)} · ${esc(m.place)} →</a>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span class="stars">${'★'.repeat(Math.round(avg))}${'☆'.repeat(5-Math.round(avg))}</span><span class="mono muted" style="font-size:12px">${rv.length?`${avg.toFixed(1)} · ${rv.length} review${rv.length===1?'':'s'}`:'no reviews yet'}</span></div>
      <div class="price">${fmt(p.price)}${p.was?`<s>${fmt(p.was)}</s>`:''}</div>
      <span class="mono muted" style="font-size:12px">In stock · made to order in 2–4 days · ${p.price>=999?'free shipping':'shipping ₹79, free above ₹999'}</span>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:6px">
        <div class="qty"><button onclick="mQty=Math.max(1,mQty-1);document.getElementById('mq').textContent=mQty">−</button><span id="mq">${mQty}</span><button onclick="mQty=Math.min(20,mQty+1);document.getElementById('mq').textContent=mQty">+</button></div>
        <button class="btn ink lg neo" id="mAdd" onclick="addToCart(${p.id},mQty);this.textContent='Added ✓ · view cart';this.onclick=()=>{closeProduct();location.hash='#cart'}">${inCart?`In cart (${inCart.qty}) · add more`:'Add to cart'}</button>
        <button class="btn acc lg neo" onclick="addToCart(${p.id},mQty);closeProduct();location.hash='#cart'">Buy now →</button>
        <button class="btn neo" data-wl="${p.id}" onclick="toggleWish(${p.id});this.textContent=wish.includes(${p.id})?'♥ Saved':'♡ Wishlist'">${wish.includes(p.id)?'♥ Saved':'♡ Wishlist'}</button>
      </div>
    </div>
  </div>
  <section><h3>Details</h3><div class="kv"><span class="label muted">Technique</span><span>${esc(d.technique)}</span><span class="label muted">Materials</span><span>${esc(d.materials)}</span><span class="label muted">Size</span><span>${esc(d.size)}</span><span class="label muted">Care</span><span>${esc(d.care)}</span><span class="label muted">Made in</span><span>${esc(m.place)} by ${esc(m.n)}</span></div></section>
  <section><h3>Shipping &amp; returns</h3><div class="kv"><span class="label muted">Delivery</span><span>Ships from ${esc(m.place.split(',')[0])} in 2–4 days; delivered across India in 5–9 days. Tracking by SMS.</span><span class="label muted">Returns</span><span>7-day return for unused pieces in original packing. Refund to the same UPI / card within 5 working days.</span><span class="label muted">Not returnable</span><span>Custom sizes and personalised pieces.</span><span class="label muted">Makers' promise</span><span>Every piece is checked by the maker before it ships; slight variations are part of handwork.</span></div></section>
  <section><h3>Reviews <span class="mono muted" style="font:400 12px 'IBM Plex Mono'">${rv.length}</span></h3>
    ${!reviews[p.id] ? `<div class="mono muted" style="font-size:12px">Loading…</div>` : rv.length ? rv.map(r=>`<div class="rev"><div class="who"><b>${esc(r.name)}</b><span class="muted mono">${new Date(r.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span></div><span class="stars">${'★'.repeat(r.stars)}${'☆'.repeat(5-r.stars)}</span><div style="margin-top:4px">${esc(r.text)}</div></div>`).join('') : `<div class="empty" style="padding:16px">No reviews yet. Bought this? Be the first.</div>`}
    <form class="form" style="margin-top:14px" onsubmit="return addReview(this,${p.id})">
      <div class="full" style="display:flex;align-items:center;gap:10px"><span class="label muted">Your rating</span><span class="stars pick" id="pick">${[1,2,3,4,5].map(i=>`<span onclick="pickStar(${i})">★</span>`).join('')}</span></div>
      <input name="name" placeholder="Your name" required value="${esc(session.user?.name||user.name)}"><input name="text" placeholder="What did you think?" required>
      <button class="btn ink neo" type="submit">Post review</button>
    </form>
  </section>
  <section><h3>Comments &amp; questions <span class="mono muted" style="font:400 12px 'IBM Plex Mono'">${cm.length}</span></h3>
    ${!comments[p.id] ? `<div class="mono muted" style="font-size:12px">Loading…</div>` : cm.length ? cm.map(c=>`<div class="rev"><div class="who"><b>${esc(c.name)}</b><span class="muted mono">${new Date(c.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span></div><div>${esc(c.text)}</div></div>`).join('') : `<div class="empty" style="padding:16px">No questions yet. Ask the maker anything about this piece.</div>`}
    <form class="form" style="margin-top:14px" onsubmit="return addComment(this,${p.id})">
      <input name="name" placeholder="Your name" required value="${esc(session.user?.name||user.name)}"><input name="text" placeholder="Ask a question or leave a comment" required>
      <button class="btn neo" type="submit">Post</button>
    </form>
  </section>`;
}
function pickStar(n){ mPick=n; document.querySelectorAll('#pick span').forEach((s,i)=>s.classList.toggle('on',i<n)); }
async function addReview(f,id){ if(!mPick){ toast('Pick a star rating'); return false } if(!loggedIn()){ toast('Sign in to post a review'); location.hash='#login'; closeProduct(); return false } const d=Object.fromEntries(new FormData(f));
  try{ reviews[id]=await api(`/products/${id}/reviews`,{method:'POST',body:{stars:mPick,text:d.text,name:d.name}}); if(d.name&&!user.name){user.name=d.name;db.set('ks-user',user)} const y=document.getElementById('mbg').scrollTop; mPick=0; document.getElementById('modal').innerHTML=productHtml(byId(id)); document.getElementById('mbg').scrollTop=y; toast('Review posted'); }catch(e){ toast(e.message) } return false; }
async function addComment(f,id){ if(!loggedIn()){ toast('Sign in to ask a question'); location.hash='#login'; closeProduct(); return false } const d=Object.fromEntries(new FormData(f));
  try{ comments[id]=await api(`/products/${id}/comments`,{method:'POST',body:{text:d.text,name:d.name}}); if(d.name&&!user.name){user.name=d.name;db.set('ks-user',user)} const y=document.getElementById('mbg').scrollTop; document.getElementById('modal').innerHTML=productHtml(byId(id)); document.getElementById('mbg').scrollTop=y; toast('Posted'); }catch(e){ toast(e.message) } return false; }
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closeProduct(); togglePanel(); } });
