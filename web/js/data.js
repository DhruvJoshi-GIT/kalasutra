/* ── icons ────────────────────────────────────────────────────────── */
const ICON = {
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>`,
  cart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.4 11h11l2-8H6.4"/><circle cx="9" cy="20" r="1.6"/><circle cx="17" cy="20" r="1.6"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="#E0473A" stroke="#B3261E" stroke-width="1.6" stroke-linejoin="round"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.6 8.2 3.6 5 6.8 5c2 0 3.4 1.1 5.2 3 1.8-1.9 3.2-3 5.2-3 3.2 0 5.2 3.2 4.1 6.3C19.5 15.9 12 20.5 12 20.5z"/></svg>`,
  rupee: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12M6 9h12M6 4h3a5 5 0 0 1 0 10H6l8 7"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>`,
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
  up: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`,
};
/* ── data ────────────────────────────────────────────────────────── */
let CATS = [
  {k:'all',n:'All crafts',ab:'AL'},{k:'sarees',n:'Sarees & textiles',ab:'SA'},{k:'men',n:'Menswear',ab:'ME'},
  {k:'jewel',n:'Jewellery',ab:'JE'},{k:'foot',n:'Footwear',ab:'FO'},{k:'home',n:'Home & decor',ab:'HO'},
  {k:'art',n:'Art & craft',ab:'AR'},{k:'toys',n:'Toys & games',ab:'TO'},
];
const catName = k => (CATS.find(c=>c.k===k)||CATS[0]).n;
const DEF = {
  sarees:{technique:'Handloom weaving',materials:'Cotton / mulberry silk, zari',size:'5.5 m × 1.1 m, with blouse piece',care:'Dry clean, or gentle cold hand wash'},
  men:{technique:'Handloom weaving, hand finishing',materials:'Cotton',size:'S · M · L · XL (choose at checkout)',care:'Cold machine wash, dry in shade'},
  jewel:{technique:'Hand-set, hand-painted',materials:'Brass, silver, glass beads, thread',size:'Adjustable / free size',care:'Keep dry, store in the pouch provided'},
  foot:{technique:'Hand-stitched',materials:'Vegetable-tanned leather, jute',size:'UK 4 – 11 (choose at checkout)',care:'Wipe clean, keep away from water'},
  home:{technique:'Hand-made and hand-painted',materials:'Cane, bamboo, terracotta, marble, wood',size:'See listing photo for scale',care:'Dust with a dry cloth'},
  art:{technique:'Natural pigments, hand-painted',materials:'Paper, wood, cloth',size:'Approx. 25 cm',care:'Keep out of direct sunlight'},
  toys:{technique:'Hand-carved, hand-painted',materials:'Wood, cloth, non-toxic paint',size:'Approx. 30 cm tall',care:'Wipe clean; not for children under 3'},
};
let FEATURED = [];            // filled from the catalogue (isFeatured)
let P = [];                   // products, from GET /api/catalogue/bootstrap
let MAKERS = {};              // makers by slug, same call
const fmt = n => '₹' + Math.round(n).toLocaleString('en-IN');
const esc = s => String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pic = p => `<img src="${p.img}" alt="${esc(p.n)}" loading="lazy">`;
const maker = p => MAKERS[p.mk];
