/* ── seller upload flow ──────────────────────────────────────────── */
let upState = {photo:false,desc:false,price:false};
function doUpload(){
  const z=document.getElementById('photoZone'); z.style.borderStyle='solid'; z.innerHTML = `<img src="img/saree-cream.jpg" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"><span class="label" style="position:absolute;left:8px;top:8px;background:var(--fg);color:var(--bg);padding:3px 8px;border-radius:6px">Studio · cleaned</span>`;
  upState.photo=true; document.getElementById('voiceBtn').disabled=false; document.getElementById('descState').textContent='photo ready · speak or generate'; check();
}
function doDescribe(){
  const b=document.getElementById('descBox'); b.style.background='var(--bg)';
  b.innerHTML = `<div class="hi muted" style="font-size:13px;border-bottom:1px solid var(--fg);padding-bottom:8px;margin-bottom:8px">“ये बगरू की सूती साड़ी है, नील और मजीठ से हाथ से छापी हुई…” <span class="mono">0:22</span></div><b id="genTitle">Hand Block-Printed Mulmul Cotton Saree, Indigo &amp; Madder</b><br>Hand block-printed in Bagru on hand-loomed mulmul cotton with natural indigo and madder. 5.5 m with blouse piece. Gentle hand wash in cold water.`;
  upState.desc=true; document.getElementById('editBtn').disabled=false; document.getElementById('descState').textContent='written from your voice · ✓';
  const pb=document.getElementById('priceBox'); pb.innerHTML=`<div style="padding:12px;border-right:1px solid var(--fg)"><div class="label muted">Floor</div><div style="font-size:20px">₹1,450</div></div><div style="padding:12px;border-right:1px solid var(--fg);background:var(--acc);color:#111"><div class="label">Fair</div><div style="font-size:26px">₹1,899</div></div><div style="padding:12px"><div class="label muted">Premium</div><div style="font-size:20px">₹2,400</div></div>`;
  const pi=document.getElementById('priceInput'); pi.disabled=false; pi.placeholder='1899 suggested'; document.getElementById('priceState').textContent='from 12 similar pieces'; pi.focus(); check();
}
function editDesc(){ const b=document.getElementById('descBox'); b.contentEditable = b.isContentEditable ? 'false' : 'true'; b.style.boxShadow = b.isContentEditable ? '3px 3px 0 0 var(--acc)' : 'none'; if(b.isContentEditable) b.focus(); }
function check(){
  const pi=document.getElementById('priceInput'); upState.price = !!(pi && Number(pi.value)>0);
  [['ck1',upState.photo],['ck2',upState.desc],['ck3',upState.price]].forEach(([id,ok])=>{ const el=document.getElementById(id); el.classList.toggle('ok',ok); el.querySelector('.m').textContent = ok?'✓':'✕'; });
  const all = upState.photo&&upState.desc&&upState.price; document.getElementById('submitBtn').classList.toggle('off',!all);
  const m=document.getElementById('ckMsg'); m.textContent = all ? '✓ It can be submitted to the market.' : "✕ It can't be submitted to the market yet."; m.style.color = all ? 'var(--ok)' : 'var(--err)';
}
function submitListing(){
  if(!(upState.photo&&upState.desc&&upState.price)) return;
  const title = (document.getElementById('genTitle')?.textContent || 'New listing').trim();
  const np = {id: 1000+P.length, n:title, mk:session.user?.artisanSlug||'priya', craft:'Hand block print', price:Number(document.getElementById('priceInput').value), img:'img/saree-cream.jpg', cat:'sarees', hi:'नई सूची', d:{technique:'Hand block print',materials:'Mulmul cotton · indigo · madder',size:'5.5 m × 1.1 m',care:'Gentle cold hand wash'}};
  P.push(np); toast('Listed in your shop (demo — saving to the server comes in the next build step)'); location.hash='#seller';
}
function toggleStory(btn){ const t=document.getElementById('storyText'); const hi = btn.dataset.hi==='1'; t.textContent = hi ? t.dataset.en : t.dataset.hi; t.className = hi ? '' : 'hi'; btn.dataset.hi = hi ? '0':'1'; btn.textContent = hi ? 'Read in हिन्दी' : 'Read in English'; }
