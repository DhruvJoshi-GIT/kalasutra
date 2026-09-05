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
let featI = 0, featT = null;
function featured(){
  const items = FEATURED.map(byId).filter(Boolean); if(!items.length) return '';
  const ctrl = `<div class="ctrl" onclick="event.stopPropagation()"><span class="nav press" onclick="featGo(-1)">‹</span><span class="dots">${items.map((_,k)=>`<span class="d ${k===featI?'on':''}" onclick="featGo(${k},true)"></span>`).join('')}</span><span class="nav press" onclick="featGo(1)">›</span></div>`;
  const slide = p => { const m = maker(p); return `<div class="fslide">
    <div class="ph" onclick="openProduct(${p.id})">${pic(p)}<span class="tag">From the workshop</span>${ctrl}</div>
    <div class="tx">
      <div class="who"><img src="${m.img||''}" alt=""><div><div style="font-weight:700">${esc(m.n)}</div><span class="label muted">${esc(m.craft)} · ${esc(m.place)}</span></div></div>
      <h2>${esc(p.n)}</h2>
      <q>${esc(m.en.split('. ').slice(0,2).join('. ').replace(/\.$/,''))}.</q>
      <div class="pr">${fmt(p.price)}${p.was?` <s class="mono muted" style="font:400 14px 'IBM Plex Mono'">${fmt(p.was)}</s>`:''}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn ink neo" onclick="openProduct(${p.id})">See the piece</button><a class="btn neo" href="#artist/${p.mk}">Meet the maker</a></div>
    </div>
  </div>`; };
  return `<div class="feat" onmouseenter="clearInterval(featT)" onmouseleave="featArm()">
    <div class="ftrack" id="ftrack" style="transform:translateX(-${featI*100}%)">${items.map(slide).join('')}</div>
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
const filtered = () => allP().filter(p => (state.cat==='all' || p.cat===state.cat) && (!state.q || (p.n+' '+(p.hi||'')+' '+p.craft+' '+maker(p).n+' '+maker(p).place+' '+catName(p.cat)).toLowerCase().includes(state.q.toLowerCase())));
