/* ── tiles ───────────────────────────────────────────────────────── */
const card = (p, wide=false) => `<a class="card ${wide?'wide':''}" href="javascript:void(0)" onclick="openProduct(${p.id})"><div class="img">${pic(p)}<span class="wl ${wish.includes(p.id)?'on':''}" data-wl="${p.id}" onclick="toggleWish(${p.id},event)" title="Wishlist">♥</span></div><div class="in"><span class="n">${esc(p.n)}</span><span class="craft">${esc(p.craft)} · ${esc(maker(p).place.split(',')[0])}</span><span class="p">${fmt(p.price)}${p.was?`<s>${fmt(p.was)}</s>`:''}</span></div></a>`;
/* every 7th tile is double-width so the grid has a rhythm */
const tiles = list => list.map((p,i)=>card(p, i%7===3)).join('');
const SORTS = {newest:'Newest', 'price-asc':'Price: low to high', 'price-desc':'Price: high to low', sale:'Discounted first', name:'Name A–Z'};
function sortList(l){ const a=[...l]; switch(state.sort){
  case 'price-asc': return a.sort((x,y)=>x.price-y.price);
  case 'price-desc': return a.sort((x,y)=>y.price-x.price);
  case 'sale': return a.sort((x,y)=>((y.was?1:0)-(x.was?1:0)) || (y.id-x.id));
  case 'name': return a.sort((x,y)=>x.n.localeCompare(y.n));
  default: return a.sort((x,y)=>y.id-x.id); } }
function setSort(v){ state.sort=v; const g=document.getElementById('shopArea'); if(g) g.innerHTML=shopArea(); }
const sortSel = () => `<select class="sortsel" onchange="setSort(this.value)" title="Sort">${Object.entries(SORTS).map(([k,v])=>`<option value="${k}" ${state.sort===k?'selected':''}>${v}</option>`).join('')}</select>`;
/* opening slider: full-width banners (BANNERS in data.js), each a link to its category; the box has the
   banners' own 3.2:1 ratio, so nothing is ever cropped — on a phone, a tablet or a 3440px monitor */
let featI = 0, featT = null;
function featured(){
  if(!BANNERS.length) return '';
  const ctrl = `<div class="ctrl"><span class="nav press" onclick="featGo(-1)" title="Previous">‹</span><span class="dots">${BANNERS.map((_,k)=>`<span class="d ${k===featI?'on':''}" onclick="featGo(${k},true)"></span>`).join('')}</span><span class="nav press" onclick="featGo(1)" title="Next">›</span></div>`;
  const slide = b => `<a class="fslide" href="${b.href}" draggable="false"><img src="${b.img}" srcset="${b.img.replace('.jpg','-s.jpg')} 900w, ${b.img} 1923w" sizes="100vw" alt="${esc(b.alt)}" draggable="false"></a>`;
  return `<div class="feat" onmouseenter="clearInterval(featT)" onmouseleave="featArm()">
    <div class="ftrack" id="ftrack" style="transform:translateX(-${featI*100}%)">${BANNERS.map(slide).join('')}</div>${ctrl}
  </div>`;
}
function featGo(n, abs){
  const t = document.getElementById('ftrack'); if(!t) return; const N = t.children.length;
  featI = abs ? n : (featI + n + N) % N;
  t.style.transform = `translateX(-${featI*100}%)`;
  document.querySelectorAll('.feat .dots').forEach(g=>[...g.children].forEach((d,k)=>d.classList.toggle('on', k===featI)));
  featArm();
}
function featArm(){ clearInterval(featT); featT = setInterval(()=>{ if(document.getElementById('ftrack') && !document.hidden) featGo(1); }, 5000); }
/* swipe on touch screens: a horizontal flick moves the slider and does not follow the banner link */
let swX = null, swY = null, swT = 0;
document.addEventListener('touchstart', e=>{ if(!e.target.closest('.feat')){ swX=null; return; } swX=e.touches[0].clientX; swY=e.touches[0].clientY; }, {passive:true});
document.addEventListener('touchend', e=>{ if(swX==null) return; const dx=e.changedTouches[0].clientX-swX, dy=e.changedTouches[0].clientY-swY; swX=null; if(Math.abs(dx)>36 && Math.abs(dx)>Math.abs(dy)){ featGo(dx<0?1:-1); swT=Date.now(); } }, {passive:true});
document.addEventListener('click', e=>{ if(Date.now()-swT<600 && e.target.closest('.fslide')){ e.preventDefault(); e.stopPropagation(); } }, true);
const filtered = () => allP().filter(p => (state.cat==='all' || p.cat===state.cat) && (!state.q || (p.n+' '+(p.hi||'')+' '+p.craft+' '+maker(p).n+' '+maker(p).place+' '+catName(p.cat)).toLowerCase().includes(state.q.toLowerCase())));
