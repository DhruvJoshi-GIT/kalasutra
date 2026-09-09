/* ── seller listing flow: photo (studio) → description → price → submit ── */
let upState = {photo:false,desc:false,price:false};
const listing = { cat:'sarees', descHtml:'', title:'', desc:'', band:null, price:'' };   // survives the studio round-trip
const priceBand = b => b
  ? `<div style="padding:12px;border-right:1px solid var(--fg)"><div class="label muted">Floor</div><div style="font-size:20px">${fmt(b[0])}</div></div><div style="padding:12px;border-right:1px solid var(--fg);background:var(--acc);color:#111"><div class="label">Fair</div><div style="font-size:26px">${fmt(b[1])}</div></div><div style="padding:12px"><div class="label muted">Premium</div><div style="font-size:20px">${fmt(b[2])}</div></div>`
  : `<div style="padding:12px;border-right:1px solid var(--fg)"><div class="label muted">Floor</div><div style="font-size:20px">—</div></div><div style="padding:12px;border-right:1px solid var(--fg)"><div class="label">Fair</div><div style="font-size:26px">—</div></div><div style="padding:12px"><div class="label muted">Premium</div><div style="font-size:20px">—</div></div>`;

/* demo copy per category until the voice cataloguer (Sarvam + Claude) is wired: transcript, title, description, price band */
const DEMO_COPY = {
  sarees:  {hi:'ये बगरू की सूती साड़ी है, नील और मजीठ से हाथ से छापी हुई…', hiName:'हाथ से छपी सूती साड़ी', t:'Hand Block-Printed Mulmul Cotton Saree', d:'Hand block-printed in Bagru on hand-loomed mulmul cotton with natural indigo and madder. 5.5 m with blouse piece. Gentle hand wash in cold water.', band:[1450,1899,2400], craft:'Hand block print'},
  men:     {hi:'ये हथकरघे का सूती कुर्ता है, हाथ से सिला हुआ…', hiName:'हथकरघा सूती कुर्ता', t:'Handloom Cotton Kurta', d:'Hand-woven cotton kurta, hand-finished with a mandarin collar and side slits. Sizes S to XL. Cold machine wash, dry in shade.', band:[1100,1499,1900], craft:'Handloom cotton'},
  jewel:   {hi:'ये चाँदी के झुमके हैं, हाथ से ढले हुए, मोतियों के साथ…', hiName:'चाँदी के झुमके', t:'Oxidised Silver Jhumkas', d:'Hand-cast oxidised silver jhumkas with pearl and glass-bead drops. Free size, push-back closure. Keep dry and store in the pouch provided.', band:[950,1450,1900], craft:'Oxidised silver'},
  foot:    {hi:'ये चमड़े की जूती है, हाथ से कढ़ाई की हुई…', hiName:'कढ़ाई वाली चमड़े की जूती', t:'Embroidered Leather Jutti', d:'Hand-stitched vegetable-tanned leather jutti with zari embroidery. UK sizes 4 to 11. Wipe clean, keep away from water.', band:[1050,1399,1800], craft:'Hand-stitched leather'},
  home:    {hi:'ये जूट की टोकरी है, हाथ से बुनी हुई…', hiName:'हाथ से बुनी जूट की टोकरी', t:'Hand-woven Jute Basket', d:'Hand-braided jute basket with cotton handles, woven by women weavers near Guwahati. Approx. 40 cm across. Spot clean.', band:[750,1099,1400], craft:'Braided jute'},
  art:     {hi:'ये मधुबनी चित्र है, प्राकृतिक रंगों से बना हुआ…', hiName:'मधुबनी चित्र', t:'Madhubani Painting', d:'Hand-painted Madhubani work in natural pigments on handmade paper, nib-pen line work, wooden frame. Approx. 30 × 40 cm. Keep out of direct sunlight.', band:[2100,2799,3500], craft:'Madhubani painting'},
  toys:    {hi:'ये लकड़ी का खिलौना है, हाथ से रंगा हुआ…', hiName:'हाथ से रंगा लकड़ी का खिलौना', t:'Hand-painted Wooden Toy', d:'Hand-carved and hand-painted wooden toy in non-toxic colours. Approx. 30 cm. Wipe clean; not for children under 3.', band:[650,899,1200], craft:'Hand-carved wood'},
  pottery: {hi:'ये खुर्जा का चमकदार मिट्टी का फूलदान है, चाक पर बना…', hiName:'चमकदार मिट्टी का फूलदान', t:'Glazed Stoneware Vase', d:'Wheel-thrown stoneware vase, hand-carved and glazed in Khurja, fired twice. Approx. 22 cm. Dust with a dry cloth.', band:[950,1299,1700], craft:'Glazed stoneware'},
};
function doDescribe(){
  listing.cat = document.getElementById('catSel')?.value || listing.cat;
  const c = DEMO_COPY[listing.cat] || DEMO_COPY.sarees;
  listing.title = c.t; listing.desc = c.d; listing.band = c.band;
  listing.descHtml = `<div class="hi muted" style="font-size:13px;border-bottom:1px solid var(--fg);padding-bottom:8px;margin-bottom:8px">“${esc(c.hi)}” <span class="mono">0:22</span></div><b id="genTitle">${esc(c.t)}</b><br><span id="genDesc">${esc(c.d)}</span>`;
  const b=document.getElementById('descBox'); b.style.background='var(--bg)'; b.innerHTML = listing.descHtml;
  document.getElementById('editBtn').disabled=false; document.getElementById('descState').textContent='written from your voice · ✓';
  document.getElementById('priceBox').innerHTML = priceBand(c.band);
  const pi=document.getElementById('priceInput'); pi.disabled=false; pi.placeholder=c.band[1]+' suggested'; document.getElementById('priceState').textContent='from 12 similar pieces'; pi.focus(); check();
}
function editDesc(){ const b=document.getElementById('descBox'); b.contentEditable = b.isContentEditable ? 'false' : 'true'; b.style.boxShadow = b.isContentEditable ? '3px 3px 0 0 var(--acc)' : 'none'; if(b.isContentEditable) b.focus(); else { listing.title=(document.getElementById('genTitle')?.textContent||listing.title).trim(); listing.desc=(document.getElementById('genDesc')?.textContent||listing.desc).trim(); listing.descHtml=b.innerHTML; } }
function check(){
  const pi=document.getElementById('priceInput'); if(!pi) return;
  upState.photo = !!studio.result; upState.desc = !!listing.descHtml; upState.price = !!(Number(pi.value)>0); listing.price = pi.value;
  [['ck1',upState.photo],['ck2',upState.desc],['ck3',upState.price]].forEach(([id,ok])=>{ const el=document.getElementById(id); if(!el) return; el.classList.toggle('ok',ok); el.querySelector('.m').textContent = ok?'✓':'✕'; });
  const all = upState.photo&&upState.desc&&upState.price; document.getElementById('submitBtn')?.classList.toggle('off',!all);
  const m=document.getElementById('ckMsg'); if(m){ m.textContent = all ? '✓ It can be submitted to the market.' : "✕ It can't be submitted to the market yet."; m.style.color = all ? 'var(--ok)' : 'var(--err)'; }
}
async function submitListing(){
  check(); if(!(upState.photo&&upState.desc&&upState.price)) return;
  const slug = session?.user?.artisanSlug; if(!slug){ toast('Sign in as a maker first'); return; }
  const cat = document.getElementById('catSel')?.value || listing.cat;
  const title = (document.getElementById('genTitle')?.textContent || listing.title || 'New listing').trim();
  const desc = (document.getElementById('genDesc')?.textContent || listing.desc || '').trim();
  const body = { name:title, nameHi:(DEMO_COPY[cat]||{}).hiName||'नई सूची', price:Number(document.getElementById('priceInput').value), categorySlug:cat, craft:(DEMO_COPY[cat]||{}).craft||'', description:desc, imageData:studio.result };
  const btn=document.getElementById('submitBtn'); btn.classList.add('off');
  try{
    const p = await api('/artisan/products',{method:'POST',body});
    if(!P.some(x=>x.id===p.id)) P.push(p);
    studio.result=null; studio.src=null; studio.cut=null; listing.descHtml=''; listing.band=null; listing.price=''; upState={photo:false,desc:false,price:false};
    toast(window.KS_OFFLINE ? 'Listed in your shop (demo mode — saved in this browser)' : 'Listed in your shop'); location.hash='#seller';
  }catch(e){ toast(e.message); btn.classList.remove('off'); }
}
function toggleStory(btn){ const t=document.getElementById('storyText'); const hi = btn.dataset.hi==='1'; t.textContent = hi ? t.dataset.en : t.dataset.hi; t.className = hi ? '' : 'hi'; btn.dataset.hi = hi ? '0':'1'; btn.textContent = hi ? 'Read in हिन्दी' : 'Read in English'; }
