// Where the API lives. Override for a session with ?api=https://host/api (stored in localStorage as ks-api).
(function(){
  try{ const q = new URLSearchParams(location.search).get('api'); if(q) localStorage.setItem('ks-api', q); }catch(e){}
  let saved = null; try{ saved = localStorage.getItem('ks-api'); }catch(e){}
  const host = location.hostname;
  const guess = host.endsWith('kalasutra.live') ? 'https://api.kalasutra.live/api'
            : host.endsWith('github.io') ? 'https://kalasutra-api.onrender.com/api'
            : location.origin + '/api';
  window.KS_CONFIG = { API_URL: saved || guess };
})();
