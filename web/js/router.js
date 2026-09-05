/* ── router ──────────────────────────────────────────────────────── */
async function render(){
  const parts = (location.hash||'#home').slice(1).split('/');
  let key = S[parts[0]] ? parts[0] : 'home', arg = decodeURIComponent(parts[1]||'');
  if(key==='shop'||key==='home'){ state.cat = CATS.some(c=>c.k===arg) ? arg : 'all'; }
  const plain = ['login'].includes(key);
  const app = document.getElementById('app'); app.className = plain ? 'plain' : '';
  document.getElementById('cap').style.display = plain ? 'none' : '';
  if(LOAD[key]){ app.innerHTML = '<div class="empty" style="margin:30px 0">Loading…</div>'; try{ await LOAD[key](arg); }catch(e){ toast(e.message) } }
  app.innerHTML = S[key](arg);
  paintCap(key==='shop'||key==='home' ? state.cat : '');
  if(key==='upload') upState = {photo:false,desc:false,price:false};
  window.scrollTo(0,0); paintTop(); document.body.classList.remove('cats-open'); paintBnav();
  if(document.getElementById('ftrack')) featArm(); else clearInterval(featT);
}
window.addEventListener('hashchange', render);
