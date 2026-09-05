/* ── local "database" (what a real site would keep on the server) ── */
const db = {
  get(k,d){ try{ const v=JSON.parse(localStorage.getItem(k)); return v==null?d:v }catch(e){ return d } },
  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)) }catch(e){} },
};
let cart    = db.get('ks-cart', []);      // [{id, qty}]
let wish    = db.get('ks-wish', []);      // [id]
let addrs   = [];                         // from GET /api/addresses (logged in)
let pays    = [];                         // from GET /api/payment-methods
let orders  = [];                         // from GET /api/orders
let reviews = {};                         // cache of GET /api/products/{id}/reviews
let comments= {};                         // cache of GET /api/products/{id}/comments
let user    = db.get('ks-user', {name:'',phone:'',email:''});
const allP = () => P;
const byId = id => P.find(p=>p.id===Number(id));

const cartCount = () => cart.reduce((a,c)=>a+c.qty,0);
const cartSub = () => cart.reduce((a,c)=>a+(byId(c.id)?.price||0)*c.qty,0);
const shipping = sub => sub===0?0:(sub>=999?0:79);
function addToCart(id,qty=1){ const c=cart.find(x=>x.id===id); if(c) c.qty+=qty; else cart.push({id,qty}); db.set('ks-cart',cart); paintBar(); syncCart(); toast('Added to cart'); }
function setQty(id,q){ const c=cart.find(x=>x.id===id); if(!c) return; c.qty=Math.max(0,q); if(c.qty===0) cart=cart.filter(x=>x.id!==id); db.set('ks-cart',cart); paintBar(); syncCart(); }
function removeFromCart(id){ cart=cart.filter(x=>x.id!==id); db.set('ks-cart',cart); paintBar(); syncCart(); }
function toggleWish(id, ev){ if(ev){ ev.stopPropagation(); ev.preventDefault(); } const on = !wish.includes(id); wish = on ? [...wish,id] : wish.filter(x=>x!==id); db.set('ks-wish',wish); if(loggedIn()) api(`/wishlist/${id}`,{method:on?'POST':'DELETE'}).catch(()=>{}); paintBar(); paintWish(); document.querySelectorAll(`[data-wl="${id}"]`).forEach(el=>el.classList.toggle('on',wish.includes(id))); }
let toastT; function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('on'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('on'),1600); }

/* mirror the local cart to the server once signed in (debounced) */
let syncT; function syncCart(){ if(!loggedIn()) return; clearTimeout(syncT); syncT=setTimeout(()=>api('/cart',{method:'PUT',body:{items:cart}}).catch(()=>{}),400); }
