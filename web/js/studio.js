/* ── AI photo studio (sellers only) ───────────────────────────────────
   photo → cutout (KalaSutra server with a fal.ai key, else an on-device model in the browser)
         → alpha clean-up → studio backdrop of the maker's choice → contact shadow → JPEG.
   Every step has a fallback, so the flow always ends with a usable studio photo:
     server cutout (needs FAL_KEY on the API)  →  browser model (@imgly/background-removal, ~45 MB, cached)
     →  "framed" mode (no cutout, the photo on a paper backdrop) when neither is available. */
/* the model + runtime are served by this site itself (web/vendor/bg/: bundled library, ONNX runtime, isnet_quint8
   model chunks, resources.json) so the studio needs nothing but kalasutra.live; the public CDN is only a fallback */
const STUDIO_LOCAL = new URL('vendor/bg/', location.href).href;
const STUDIO_CDN = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
const STUDIO_CDN_DATA = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';
const STUDIO_SIZE = 1024;
const BACKDROPS = [
  {k:'paper',      n:'Paper',              hi:'कागज़'},
  {k:'plain',      n:'Plain white',        hi:'सादा सफ़ेद'},
  {k:'warm',       n:'Warm studio',        hi:'स्टूडियो'},
  {k:'terracotta', n:'Terracotta wall',    hi:'मिट्टी की दीवार'},
  {k:'indigo',     n:'Indigo block print', hi:'नील छपाई'},
  {k:'haveli',     n:'Haveli sandstone',   hi:'हवेली'},
  {k:'marigold',   n:'Marigold',           hi:'गेंदा'},
  {k:'ink',        n:'Ink',                hi:'स्याही'},
];
const studio = { src:null, cut:null, bd:'paper', shadow:true, result:null, busy:false, mode:'', note:'', stage:'', pct:0, showOrig:false, modP:null };

/* ── entry points used by the screens ─────────────────────────────── */
function studioPick(){
  const i = document.createElement('input'); i.type='file'; i.accept='image/*';   // no `capture`: phones then offer both the camera and the gallery
  i.onchange = async () => { const f = i.files && i.files[0]; if(!f) return;
    try{ studio.src = await fileToDataURL(f); }catch(e){ toast('Could not read that photo'); return; }
    studio.cut=null; studio.result=null; studio.note=''; studio.mode=''; studio.showOrig=false;
    if((location.hash||'').startsWith('#studio')) { render(); } else location.hash='#studio';
  };
  i.click();
}
function studioModeLabel(){
  if(studio.busy) return 'working…';
  if(studio.mode==='server') return 'Cutout by the KalaSutra server (fal.ai)';
  if(studio.mode==='browser') return 'Cutout on this device · nothing uploaded';
  if(studio.mode==='lite') return 'Framed (no cutout available here)';
  return (window.KS_STUDIO && window.KS_STUDIO.server && !window.KS_OFFLINE) ? 'Server studio ready' : 'On-device studio';
}
function studioMount(){
  document.querySelectorAll('canvas.sw[data-bd]').forEach(c=>{ const x=c.getContext('2d'); paintBackdrop(x, c.width, c.height, c.dataset.bd); });
  if(studio.src && !studio.cut && !studio.busy) studioRun();
}
function studioSet(k){ studio.bd=k; document.querySelectorAll('.bd[data-bdk]').forEach(el=>el.classList.toggle('on', el.dataset.bdk===k)); studioCompose(); }
function studioRedo(){ studio.cut=null; studio.result=null; studio.mode=''; studio.note=''; studioRun(); }
function studioToggleOrig(btn){ studio.showOrig=!studio.showOrig; const im=document.getElementById('stOut'); if(im) im.src = studio.showOrig ? studio.src : (studio.result||studio.src); btn.textContent = studio.showOrig ? 'Show studio photo' : 'Show original'; }
function studioUse(){ if(!studio.result) return; location.hash='#upload'; }

/* ── pipeline ─────────────────────────────────────────────────────── */
function setStage(s, pct){ studio.stage=s; if(pct!=null) studio.pct=pct; const a=document.getElementById('stStage1'), b=document.getElementById('stBar'), p=document.getElementById('stProg'); if(a) a.textContent=s; if(b) b.style.width=(studio.pct||0)+'%'; if(p) p.hidden=!studio.busy; const m=document.getElementById('stMode'); if(m) m.textContent=studioModeLabel(); }
async function studioRun(){
  if(studio.busy || !studio.src) return;
  studio.busy=true; studio.pct=0; setStage('Preparing the photo…', 2);
  document.getElementById('stUse')?.setAttribute('disabled','');
  try{
    const small = await fitBlob(studio.src, STUDIO_SIZE);
    let png = null;
    if(window.KS_STUDIO && window.KS_STUDIO.server && !window.KS_OFFLINE && loggedIn()){
      try{ setStage('Cutting out on the KalaSutra server…', 20); png = await serverCutout(small); studio.mode='server'; }
      catch(e){ studio.note = 'Server studio unavailable ('+(e.message||e)+') — using the on-device model instead.'; }
    }
    if(!png){
      setStage('Loading the on-device model (first time ≈ 45 MB, then cached)…', 5);
      const mod = await loadBgModule();
      png = await mod.removeBackground(small, { model:'isnet_quint8', publicPath: studio.assets, progress:(key, cur, tot)=>{
        if(key.startsWith('fetch')) setStage(`Downloading model ${Math.round(cur/1048576)} / ${Math.round(tot/1048576)} MB`, 5 + 55*(tot?cur/tot:0));
        else setStage(key.replace('compute:','').replace(/^\w/,c=>c.toUpperCase())+'…', 60 + 30*(tot?cur/tot:0));
      }});
      studio.mode='browser';
    }
    setStage('Cleaning the edges…', 92);
    const img = await blobToImage(png);
    studio.cut = cleanCut(img);
    if(!studio.cut){ throw new Error('nothing found in the photo'); }
  }catch(e){
    studio.mode='lite';
    studio.note = 'Background removal is not available right now ('+(e && e.message ? e.message : e)+'). Showing a framed version — try again when online, or add the fal.ai key on the server.';
    try{ const img = await blobToImage(await fitBlob(studio.src, STUDIO_SIZE)); studio.cut = plainCut(img); }catch(_){ studio.cut=null; }
  }
  studio.busy=false; setStage('Done', 100);
  studioCompose();
}
function studioCompose(){
  if(!studio.cut) return;
  const c = compose(studio.cut, studio.bd, studio.shadow && studio.mode!=='lite');
  studio.result = c.toDataURL('image/jpeg', 0.88);
  const im=document.getElementById('stOut'); if(im && !studio.showOrig) im.src=studio.result;
  const dl=document.getElementById('stDl'); if(dl){ dl.href=studio.result; dl.hidden=false; }
  const u=document.getElementById('stUse'); if(u) u.removeAttribute('disabled');
  const n=document.getElementById('stNote'); if(n) n.textContent=studio.note||'';
  const m=document.getElementById('stMode'); if(m) m.textContent=studioModeLabel();
  const p=document.getElementById('stProg'); if(p) p.hidden=true;
}
function loadBgModule(){
  if(studio.modP) return studio.modP;
  studio.modP = import(STUDIO_LOCAL + 'bg.mjs').then(m=>{ studio.assets = STUDIO_LOCAL; return m; })
    .catch(()=> import(STUDIO_CDN).then(m=>{ studio.assets = STUDIO_CDN_DATA; studio.note = 'Loaded the model from the public CDN (the site copy was not reachable).'; return m; }))
    .catch(e=>{ studio.modP=null; throw new Error('model could not be loaded'); });
  return studio.modP;
}
async function serverCutout(blob){
  const fd = new FormData(); fd.append('file', blob, 'photo.jpg');
  const res = await fetch(API_URL + '/ai/cutout', {method:'POST', body:fd, headers:{'Authorization':'Bearer '+session.token}});
  if(!res.ok){ let msg='HTTP '+res.status; try{ const j=await res.json(); msg=j.detail||j.error||msg; }catch(_){} throw new Error(msg); }
  return await res.blob();
}

/* ── image helpers ────────────────────────────────────────────────── */
const fileToDataURL = f => new Promise((ok,no)=>{ const r=new FileReader(); r.onload=()=>ok(r.result); r.onerror=()=>no(new Error('read failed')); r.readAsDataURL(f); });
const loadImg = src => new Promise((ok,no)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=()=>no(new Error('bad image')); i.src=src; });
const blobToImage = async b => { const u=URL.createObjectURL(b); try{ return await loadImg(u); } finally { setTimeout(()=>URL.revokeObjectURL(u), 30000); } };
async function fitBlob(dataUrl, max){       // downscale (and re-encode as JPEG) so the model and the network get ≤ max px
  const img = await loadImg(dataUrl); const k = Math.min(1, max/Math.max(img.naturalWidth, img.naturalHeight));
  const c=document.createElement('canvas'); c.width=Math.round(img.naturalWidth*k); c.height=Math.round(img.naturalHeight*k);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  return new Promise(ok=>c.toBlob(ok,'image/jpeg',0.92));
}
function plainCut(img){ const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight; c.getContext('2d').drawImage(img,0,0); return c; }
/* sharpen the matte, drop stray specks (keep the biggest blob + anything at least 6% of its size, e.g. a pair of earrings), crop to content */
function cleanCut(img){
  const W=img.naturalWidth, H=img.naturalHeight; const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d'); x.drawImage(img,0,0);
  const d=x.getImageData(0,0,W,H), a=d.data;
  const S=4, w4=Math.ceil(W/S), h4=Math.ceil(H/S), m=new Uint8Array(w4*h4);
  for(let y=0;y<H;y+=S) for(let xx=0;xx<W;xx+=S){ if(a[(y*W+xx)*4+3]>175) m[(y/S|0)*w4+(xx/S|0)]=1; }   // only solid pixels count as "object"; semi-transparent wisps of backdrop do not
  const lab=new Int32Array(w4*h4).fill(-1), areas=[]; const q=new Int32Array(w4*h4);
  for(let i=0;i<w4*h4;i++){ if(!m[i]||lab[i]>=0) continue; let head=0,tail=0,area=0; const id=areas.length; q[tail++]=i; lab[i]=id;
    while(head<tail){ const j=q[head++]; area++; const jx=j%w4, jy=(j/w4)|0;
      if(jx>0&&m[j-1]&&lab[j-1]<0){lab[j-1]=id;q[tail++]=j-1;} if(jx<w4-1&&m[j+1]&&lab[j+1]<0){lab[j+1]=id;q[tail++]=j+1;}
      if(jy>0&&m[j-w4]&&lab[j-w4]<0){lab[j-w4]=id;q[tail++]=j-w4;} if(jy<h4-1&&m[j+w4]&&lab[j+w4]<0){lab[j+w4]=id;q[tail++]=j+w4;} }
    areas.push(area); }
  if(!areas.length) return null;
  const big=Math.max(...areas); const keep=areas.map(v=>v>=big*0.06);
  const keepM=new Uint8Array(w4*h4); for(let i=0;i<w4*h4;i++) if(lab[i]>=0&&keep[lab[i]]) keepM[i]=1;
  const dil=new Uint8Array(w4*h4);                        // dilate by one cell so edges are not nibbled
  for(let y=0;y<h4;y++) for(let xx=0;xx<w4;xx++){ let v=0; for(let dy=-1;dy<=1&&!v;dy++) for(let dx=-1;dx<=1;dx++){ const yy=y+dy,x2=xx+dx; if(yy>=0&&yy<h4&&x2>=0&&x2<w4&&keepM[yy*w4+x2]){v=1;break;} } dil[y*w4+xx]=v; }
  let minX=W,minY=H,maxX=-1,maxY=-1;
  for(let y=0;y<H;y++){ const row=(y/S|0)*w4; for(let xx=0;xx<W;xx++){ const i=(y*W+xx)*4+3; let al=a[i];
    if(!dil[row+(xx/S|0)]) al=0; else al = al<96 ? 0 : al>200 ? 255 : Math.round((al-96)*255/104);
    a[i]=al; if(al>8){ if(xx<minX)minX=xx; if(xx>maxX)maxX=xx; if(y<minY)minY=y; if(y>maxY)maxY=y; } } }
  if(maxX<0) return null;
  x.putImageData(d,0,0);
  const pad=Math.round(Math.max(W,H)*0.01); minX=Math.max(0,minX-pad); minY=Math.max(0,minY-pad); maxX=Math.min(W-1,maxX+pad); maxY=Math.min(H-1,maxY+pad);
  const o=document.createElement('canvas'); o.width=maxX-minX+1; o.height=maxY-minY+1; o.getContext('2d').drawImage(c,minX,minY,o.width,o.height,0,0,o.width,o.height); return o;
}
function silhouette(cut){ const s=document.createElement('canvas'); s.width=cut.width; s.height=cut.height; const x=s.getContext('2d'); x.drawImage(cut,0,0); x.globalCompositeOperation='source-in'; x.fillStyle='#000'; x.fillRect(0,0,s.width,s.height); return s; }
function compose(cut, bd, shadow){
  const S=STUDIO_SIZE, c=document.createElement('canvas'); c.width=c.height=S; const x=c.getContext('2d');
  paintBackdrop(x, S, S, bd);
  const pad=S*0.09, k=Math.min((S-2*pad)/cut.width, (S-2*pad)/cut.height), w=cut.width*k, h=cut.height*k, px=(S-w)/2, py=(S-h)/2 + (bd==='plain'?0:S*0.015);
  if(shadow){
    const sil=silhouette(cut);
    const soft=(dx,dy,dw,dh,blur,alpha)=>{                       // blurred silhouette; browsers without canvas filters get a stacked approximation
      if('filter' in x){ x.save(); x.filter=`blur(${blur}px)`; x.globalAlpha=alpha; x.drawImage(sil,dx,dy,dw,dh); x.restore(); return; }
      x.save(); x.globalAlpha=alpha/9; for(let i=-4;i<=4;i++){ const k=1+i*0.035; x.drawImage(sil, dx+(dw-dw*k)/2, dy+(dh-dh*k)/2, dw*k, dh*k); } x.restore();
    };
    soft(px+w*0.04, py+h*0.9, w*0.92, h*0.16, 22, 0.28);       // contact shadow under the base
    soft(px+10, py+18, w, h, 26, 0.16);                         // soft drop shadow
  }
  x.drawImage(cut, px, py, w, h);
  return c;
}

/* ── backdrops (also painted as the swatches) ─────────────────────── */
function paintBackdrop(x, w, h, key){
  const g=(a,b,vert=true)=>{ const gr=vert?x.createLinearGradient(0,0,0,h):x.createLinearGradient(0,0,w,h); gr.addColorStop(0,a); gr.addColorStop(1,b); return gr; };
  const vignette=(alpha)=>{ const r=x.createRadialGradient(w/2,h*0.42,w*0.2,w/2,h/2,w*0.85); r.addColorStop(0,'rgba(0,0,0,0)'); r.addColorStop(1,`rgba(0,0,0,${alpha})`); x.fillStyle=r; x.fillRect(0,0,w,h); };
  const floor=(col)=>{ const gr=x.createLinearGradient(0,h*0.68,0,h); gr.addColorStop(0,'rgba(0,0,0,0)'); gr.addColorStop(1,col); x.fillStyle=gr; x.fillRect(0,0,w,h); };
  const tile=(size, draw)=>{ const t=document.createElement('canvas'); t.width=t.height=size; const tx=t.getContext('2d'); draw(tx,size); const pat=x.createPattern(t,'repeat'); x.fillStyle=pat; x.fillRect(0,0,w,h); };
  const u = w/1024;                                    // scale motifs with the canvas
  switch(key){
    case 'plain': x.fillStyle='#ffffff'; x.fillRect(0,0,w,h); break;
    case 'paper': x.fillStyle='#F6F5F0'; x.fillRect(0,0,w,h); vignette(0.05); break;
    case 'warm': x.fillStyle=g('#F6EBDB','#D8B893'); x.fillRect(0,0,w,h); { const r=x.createRadialGradient(w*0.5,h*0.3,0,w*0.5,h*0.3,w*0.7); r.addColorStop(0,'rgba(255,255,255,.45)'); r.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=r; x.fillRect(0,0,w,h); } floor('rgba(120,80,40,.28)'); break;
    case 'terracotta': x.fillStyle=g('#C8724B','#9E4E2E'); x.fillRect(0,0,w,h);
      tile(Math.round(120*u), (t,s)=>{ t.strokeStyle='rgba(255,235,210,.16)'; t.fillStyle='rgba(255,235,210,.16)'; t.lineWidth=Math.max(1,1.2*u); const buti=(cx,cy,r)=>{ for(let i=0;i<6;i++){ const a=i*Math.PI/3; t.beginPath(); t.arc(cx+Math.cos(a)*r,cy+Math.sin(a)*r,r*0.42,0,7); t.fill(); } t.beginPath(); t.arc(cx,cy,r*0.35,0,7); t.fill(); t.beginPath(); t.moveTo(cx,cy+r*1.2); t.quadraticCurveTo(cx+r*0.6,cy+r*2.2,cx,cy+r*3); t.stroke(); t.beginPath(); t.ellipse(cx-r*0.9,cy+r*2.1,r*0.7,r*0.3,-0.6,0,7); t.fill(); }; buti(s*0.28,s*0.2,s*0.07); buti(s*0.78,s*0.62,s*0.07); });
      vignette(0.22); floor('rgba(40,15,5,.35)'); break;
    case 'indigo': x.fillStyle=g('#24405F','#101F36'); x.fillRect(0,0,w,h);
      tile(Math.round(140*u), (t,s)=>{ t.strokeStyle='rgba(246,245,240,.17)'; t.fillStyle='rgba(246,245,240,.17)'; t.lineWidth=Math.max(1,1.4*u); const paisley=(cx,cy,r,rot)=>{ t.save(); t.translate(cx,cy); t.rotate(rot); t.beginPath(); t.moveTo(0,-r*1.6); t.bezierCurveTo(r*1.3,-r*1.2,r*1.1,r*0.9,0,r); t.bezierCurveTo(-r*1.1,r*0.9,-r*1.2,-r*0.4,0,-r*1.6); t.stroke(); t.beginPath(); t.arc(0,-r*0.1,r*0.28,0,7); t.fill(); for(let i=0;i<5;i++){ t.beginPath(); t.arc(Math.cos(i*1.25-1.9)*r*0.62,Math.sin(i*1.25-1.9)*r*0.62-r*0.1,r*0.09,0,7); t.fill(); } t.restore(); }; paisley(s*0.3,s*0.3,s*0.11,-0.3); paisley(s*0.8,s*0.8,s*0.11,2.8); t.beginPath(); t.arc(s*0.8,s*0.28,s*0.02,0,7); t.fill(); t.beginPath(); t.arc(s*0.3,s*0.78,s*0.02,0,7); t.fill(); });
      vignette(0.3); floor('rgba(0,0,10,.4)'); break;
    case 'haveli': x.fillStyle=g('#EAD8B8','#CDAE84'); x.fillRect(0,0,w,h);
      tile(Math.round(96*u), (t,s)=>{ t.strokeStyle='rgba(90,60,30,.16)'; t.lineWidth=Math.max(1,1.6*u); const o=s/2, r=s*0.31; t.beginPath(); for(let i=0;i<8;i++){ const a=i*Math.PI/4+Math.PI/8; const px=o+Math.cos(a)*r, py=o+Math.sin(a)*r; i?t.lineTo(px,py):t.moveTo(px,py); } t.closePath(); t.stroke(); t.strokeRect(-s*0.08,-s*0.08,s*0.16,s*0.16); t.strokeRect(s*0.92,-s*0.08,s*0.16,s*0.16); t.strokeRect(-s*0.08,s*0.92,s*0.16,s*0.16); t.strokeRect(s*0.92,s*0.92,s*0.16,s*0.16); });
      { const r=x.createRadialGradient(w*0.5,h*0.25,0,w*0.5,h*0.25,w*0.8); r.addColorStop(0,'rgba(255,250,235,.5)'); r.addColorStop(1,'rgba(255,250,235,0)'); x.fillStyle=r; x.fillRect(0,0,w,h); } floor('rgba(90,60,30,.32)'); break;
    case 'marigold': x.fillStyle=g('#F7C948','#DE9A00'); x.fillRect(0,0,w,h);
      tile(Math.round(150*u), (t,s)=>{ t.fillStyle='rgba(255,255,255,.14)'; const flower=(cx,cy,R)=>{ for(let ring=3;ring>=1;ring--){ const r=R*ring/3; for(let i=0;i<ring*6;i++){ const a=i*2*Math.PI/(ring*6); t.beginPath(); t.arc(cx+Math.cos(a)*r,cy+Math.sin(a)*r,R*0.11,0,7); t.fill(); } } }; flower(s*0.3,s*0.3,s*0.17); flower(s*0.8,s*0.8,s*0.17); });
      vignette(0.14); floor('rgba(120,60,0,.3)'); break;
    case 'ink': default: x.fillStyle='#161616'; x.fillRect(0,0,w,h); { const r=x.createRadialGradient(w*0.5,h*0.35,0,w*0.5,h*0.35,w*0.75); r.addColorStop(0,'rgba(255,255,255,.12)'); r.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=r; x.fillRect(0,0,w,h); } break;
  }
}
