/* ── seller listing flow: photo (studio) → description → price → submit ── */
let upState = {photo:false,desc:false,price:false};
const listing = { cat:'sarees', title:'', desc:'', band:null, price:'', lang:(()=>{ try{ return localStorage.getItem('ks-lang')||'hi-IN'; }catch(e){ return 'hi-IN'; } })() };   // survives the studio round-trip
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
/* dictation languages (BCP-47 codes as used by Android / Chrome speech recognition and by Sarvam) */
const LANGS = [['hi-IN','हिन्दी'],['en-IN','English'],['bn-IN','বাংলা'],['ta-IN','தமிழ்'],['te-IN','తెలుగు'],['mr-IN','मराठी'],['gu-IN','ગુજરાતી'],['kn-IN','ಕನ್ನಡ'],['ml-IN','മലയാളം'],['pa-IN','ਪੰਜਾਬੀ'],['od-IN','ଓଡ଼ିଆ']];
const langOptions = () => LANGS.map(([k,n])=>`<option value="${k}" ${k===listing.lang?'selected':''}>${n}</option>`).join('');
/* how "Dictate" will work here: the Android app exposes the phone's own speech recogniser as KSNative; browsers may have the Web Speech API; otherwise the keyboard's mic key */
function dictationMode(){ if(window.KSNative && typeof KSNative.dictate==='function') return 'native'; if(window.SpeechRecognition || window.webkitSpeechRecognition) return 'web'; return 'keyboard'; }
function voiceHint(){ const m=dictationMode(); return m==='native' ? "🎙 uses your phone's own speech recognition (works in the languages your phone has). You can always type instead."
  : m==='web' ? '🎙 dictates through the browser (needs an internet connection). You can always type instead.'
  : 'Dictation is not available in this browser: tap the 🎙 key on your keyboard to speak, or type.'; }
/* every change to the form goes through here: it keeps `listing` current, unlocks the price once there is a description, and repaints the checklist */
function descChanged(){
  listing.cat = document.getElementById('catSel')?.value || listing.cat;
  listing.title = document.getElementById('titleInput')?.value || '';
  listing.desc = document.getElementById('descInput')?.value || '';
  const has = listing.desc.trim().length > 0;
  const c = DEMO_COPY[listing.cat] || DEMO_COPY.sarees;
  listing.band = has ? c.band : null;                       // comparables band per category — demo until the pricing assistant is wired
  const ds=document.getElementById('descState'); if(ds) ds.textContent = has ? '✓ written' : 'type it, or dictate';
  const pb=document.getElementById('priceBox'); if(pb) pb.innerHTML = priceBand(listing.band);
  const pi=document.getElementById('priceInput'); if(pi){ pi.disabled=!has; pi.placeholder = has ? c.band[1]+' suggested' : '—'; }
  const ps=document.getElementById('priceState'); if(ps) ps.textContent = has ? 'from 12 similar pieces' : 'waiting for description';
  check();
}
function suggestCopy(){
  const c = DEMO_COPY[document.getElementById('catSel')?.value || listing.cat] || DEMO_COPY.sarees;
  const t=document.getElementById('titleInput'), d=document.getElementById('descInput');
  if(t && !t.value.trim()) t.value = c.t;
  if(d && !d.value.trim()) d.value = c.d;
  descChanged(); d?.focus(); toast('Sample text filled in — change it to match your piece');
}
function appendDictation(text){
  const d=document.getElementById('descInput'); if(!d || !text) return;
  d.value = (d.value.trim() ? d.value.replace(/\s+$/,'') + ' ' : '') + text.trim();
  descChanged(); d.focus(); d.selectionStart = d.selectionEnd = d.value.length;
}
let rec = null;   // active Web Speech recognition, if any
function dictate(){
  listing.lang = document.getElementById('langSel')?.value || listing.lang;
  const btn=document.getElementById('voiceBtn'); const mode=dictationMode();
  if(mode==='native'){ btn.textContent='🎙 Listening…'; btn.disabled=true; try{ KSNative.dictate(listing.lang); }catch(e){ onNativeDictation(null,'unavailable'); } return; }
  if(mode==='web'){
    if(rec){ rec.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; rec = new SR(); rec.lang = listing.lang; rec.interimResults = false; rec.continuous = true;
    rec.onresult = e => { for(let i=e.resultIndex; i<e.results.length; i++) if(e.results[i].isFinal) appendDictation(e.results[i][0].transcript); };
    rec.onerror = e => { toast(e.error==='not-allowed' ? 'Microphone access was refused' : e.error==='network' ? 'Dictation needs an internet connection' : e.error==='no-speech' ? 'Nothing heard — try again, or type' : 'Could not hear you — try again, or type'); };
    rec.onend = () => { rec=null; btn.textContent='🎙 Dictate'; btn.classList.remove('acc'); btn.classList.add('ink'); };
    try{ rec.start(); btn.textContent='■ Stop'; btn.classList.remove('ink'); btn.classList.add('acc'); }catch(e){ rec=null; toast('Could not start dictation — type instead'); }
    return;
  }
  document.getElementById('descInput')?.focus(); toast('Tap the 🎙 key on your keyboard to dictate');
}
/* called by the Android app when the phone's recogniser returns (text, or an error: cancelled / unavailable) */
function onNativeDictation(text, err){
  const btn=document.getElementById('voiceBtn'); if(btn){ btn.textContent='🎙 Dictate'; btn.disabled=false; }
  if(text) appendDictation(text);
  else if(err==='unavailable'){ toast('No speech recogniser on this phone — tap the 🎙 key on your keyboard'); document.getElementById('descInput')?.focus(); }
  else if(err && err!=='cancelled') toast('Could not hear you — try again, or type');
}
function check(){
  const pi=document.getElementById('priceInput'); if(!pi) return;
  upState.photo = !!studio.result; upState.desc = listing.desc.trim().length>0; upState.price = !!(Number(pi.value)>0); listing.price = pi.value;
  [['ck1',upState.photo],['ck2',upState.desc],['ck3',upState.price]].forEach(([id,ok])=>{ const el=document.getElementById(id); if(!el) return; el.classList.toggle('ok',ok); el.querySelector('.m').textContent = ok?'✓':'✕'; });
  const all = upState.photo&&upState.desc&&upState.price; document.getElementById('submitBtn')?.classList.toggle('off',!all);
  const m=document.getElementById('ckMsg'); if(m){ m.textContent = all ? '✓ It can be submitted to the market.' : "✕ It can't be submitted to the market yet."; m.style.color = all ? 'var(--ok)' : 'var(--err)'; }
}
async function submitListing(){
  check(); if(!(upState.photo&&upState.desc&&upState.price)) return;
  const slug = session?.user?.artisanSlug; if(!slug){ toast('Sign in as a maker first'); return; }
  descChanged();
  const cat = listing.cat, desc = listing.desc.trim();
  const title = (listing.title.trim() || desc.split(/[.\n।]/)[0].trim().slice(0,80) || 'New listing');
  const nameHi = /[\u0900-\u097F]/.test(title) ? title : ((DEMO_COPY[cat]||{}).hiName||'नई सूची');   // a Devanagari name is already the Hindi name
  const body = { name:title, nameHi, price:Number(document.getElementById('priceInput').value), categorySlug:cat, craft:(DEMO_COPY[cat]||{}).craft||'', description:desc, imageData:studio.result };
  const btn=document.getElementById('submitBtn'); btn.classList.add('off');
  try{
    const p = await api('/artisan/products',{method:'POST',body});
    if(!P.some(x=>x.id===p.id)) P.push(p);
    studio.result=null; studio.src=null; studio.cut=null; listing.title=''; listing.desc=''; listing.band=null; listing.price=''; upState={photo:false,desc:false,price:false};
    toast(window.KS_OFFLINE ? 'Listed in your shop (demo mode — saved in this browser)' : 'Listed in your shop'); location.hash='#seller';
  }catch(e){ toast(e.message); btn.classList.remove('off'); }
}
function toggleStory(btn){ const t=document.getElementById('storyText'); const hi = btn.dataset.hi==='1'; t.textContent = hi ? t.dataset.en : t.dataset.hi; t.className = hi ? '' : 'hi'; btn.dataset.hi = hi ? '0':'1'; btn.textContent = hi ? 'Read in हिन्दी' : 'Read in English'; }
