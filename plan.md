# KalaSutra — Python backend, real frontend, AI features (implementation plan)

## Context

The clickable prototype (`D:/swadesh/prototype/kalasutra-prototype.html`, live at https://dhruvjoshi-git.github.io/kalasutra/) is approved. Its "backend" is `localStorage`. The user now wants the real product: every screen backed by a server, plus the three AI features the hackathon statement scores — **image studio** (cutout + QC coaching in Hindi), **multilingual voice cataloguer** (Indic speech → bilingual listing → read-back), **pricing assistant** (comparables + cost floor + reasoning) — and multilingual support throughout. Android comes later on the same API.

### Decisions made by the user (do not re-open)

| Decision | Choice |
|---|---|
| Stack | **Python FastAPI + PostgreSQL**; the **prototype becomes the frontend** (vanilla JS split into ES modules, calling the JSON API). The Next.js app in `D:/swadesh/pickindian` is dropped; its schema, contracts and API shapes are ported. |
| Hosting | **Heroku via GitHub Student credits** ($13/mo × 24 months): Basic dyno ($7, never sleeps) + Postgres Essential-0 ($5). Frontend on GitHub Pages. Domain from **Name.com** (Student Pack, free 1 year; try `kalasutra.in` → `.co` → `.app`). |
| Heavy AI models | **Hosted APIs** (fal.ai cutout, Voyage embeddings) — no local ML on a 512 MB dyno. Sarvam for all language work, Claude (`claude-opus-5`) for structured/vision/reasoning. |
| Keys | **Sarvam now; Anthropic, fal.ai, Voyage later** → every AI route must run in fixture mode today. |
| Scope guards | Checkout simulated (no gateway). B2B = enquiry → quote only. Seed = the prototype's 25 real products + 11 makers, plus ~500 **flagged-synthetic** SKUs for pricing comparables (excluded from the shop, disclosed). |
| Repo | `D:/swadesh` is the repo root (`DhruvJoshi-GIT/kalasutra`, public). Commit as the user only, when asked. Keep `progress.md` updated after each phase. |

### Hosting facts verified (Sept 2026)
- Heroku student offer: $13/month platform credits for 24 months, spendable on dynos + Postgres ([offer](https://www.heroku.com/github-students/)). Basic dyno + Essential-0 Postgres = $12. Dyno filesystem is ephemeral → uploads cannot live on disk.
- Render free Postgres expires after 30 days; DigitalOcean's student credit ended Aug 2026; Cloudflare R2 needs a card. All avoided.

### Topology

```
Browser ──HTTPS──▶ GitHub Pages  (web/ static; custom domain from Name.com)
   │ fetch + Bearer JWT
   └──HTTPS──▶ Heroku Basic dyno  (FastAPI, api.<domain>)  ──▶ Heroku Postgres (data + uploaded files as bytea)
                        └──▶ Sarvam · Anthropic · Voyage · fal.ai (all behind a fixture/record/live switch)
Local dev: uvicorn serves web/ at http://localhost:8000 (same origin) + portable Postgres (D:/swadesh/tools/pgsql), DB `kalasutra`.
```

Uploads go into a `stored_file` table (bytea, ≤ 2048 px re-encoded JPEG/WebP ≈ 300 KB each) and are served by `GET /api/files/{key}` with long cache headers. This avoids a third account and Supabase's weekly pause; an S3 backend stays available behind the same `Storage` protocol if volume ever grows. Seed images stay static in `web/img/` on Pages.

---

## Key design choices

| Area | Choice | Why |
|---|---|---|
| FastAPI style | sync `def` endpoints, SQLAlchemy 2.x (`Mapped[]`), `psycopg[binary]` 3.2 | AI calls are blocking HTTP anyway; no asyncpg debugging at 2 am. |
| ORM/schemas | SQLAlchemy models + Pydantic v2 schemas with `alias_generator=to_camel` | Frontend keeps camelCase (`compareAt`, `nameHi`). |
| IDs | integer PKs (not cuid) | The prototype's inline handlers use numeric ids (`openProduct(${p.id})`); nothing to rewrite. |
| Money / arrays / JSON | `Numeric(10,2)`; Postgres `ARRAY`; `JSONB` for comparables, qc_notes, kyc_docs | Mirrors the Prisma schema. |
| Enums | `Enum(PyEnum, native_enum=False)` | Painless Alembic. |
| Auth | PyJWT HS256, 30-day token in `localStorage['ks-token']`, `Authorization: Bearer`; `bcrypt` 4.x directly | Pages → Heroku is cross-site; bearer tokens avoid cookie/CORS pain. |
| Catalogue delivery | one `GET /api/catalogue/bootstrap` (categories + makers + shop products, never synthetic) | The prototype's `filtered/sortList/search` stay client-side verbatim. Paginated `GET /api/products` also exists for Expo. |
| Frontend modules | ES modules + a `window` bridge for the ~35 inline `onclick=` handlers | Minimal rewrite of the approved file. |
| AI switch | `AI_MODE=fixture|record|live` + per-provider override; missing key ⇒ fixture with a warning | Sarvam key exists, others don't; `record` captures real outputs as fixtures (also the venue-wifi fallback). |
| Background work | `job` table + FastAPI `BackgroundTasks` + `GET /api/jobs/{id}` polling every 1.5 s | One worker, no Redis; 30–60 s pipelines must not hold a request open. |
| kNN | numpy cosine over an in-process matrix (500 × 1024 float32 ≈ 2 MB), category-filtered; token-Jaccard fallback without a Voyage key | Already decided; pricing works with zero keys. |
| Python | 3.13 on Heroku (`.python-version`); local 3.14 is fine (numpy/Pillow/pydantic/psycopg/bcrypt have wheels) | |

---

## A. Repository layout (under `D:/swadesh`)

```
index.html, vercel.json          → redirect to web/ (edit)          CNAME → custom domain (new)
Procfile, requirements.txt, .python-version, runtime hooks → root-level pointers into backend/ so Heroku's Python buildpack works without a subdir buildpack
prototype/                       ← frozen reference (untouched)
web/                             ← THE frontend (GitHub Pages)
  index.html                     ← shell: head (fonts, anti-flash), <header id=bar>, <aside id=cap>, <main id=app>, panels, modal, theme, toast, config.js + main.js
  config.js                      ← window.KS_CONFIG = { API_URL } (github.io → https://api.<domain>/api; localhost → location.origin + '/api'; ?api= override stored in ks-api)
  css/system.css                 ← the prototype's <style> block verbatim (+ ~30 lines: job stage row, login tabs, order-status select, before/after slider)
  img/                           ← moved from prototype/img
  js/main.js api.js state.js router.js util.js i18n.js audio.js
  js/components/{card,modal,capsule,bar}.js
  js/screens/{shop,cart,confirmed,account,login,seller,upload,artist}.js
backend/
  pyproject.toml / requirements.txt, .env.example, alembic.ini, alembic/versions/0001_initial.py
  app/main.py config.py db.py
  app/models/{user,artisan,catalogue,commerce,social,ai,files}.py
  app/schemas/{auth,catalogue,cart,orders,artisan,ai}.py
  app/auth/{jwt,passwords,deps,otp}.py
  app/routers/{auth,catalogue,cart,wishlist,addresses,payments,orders,reviews,comments,enquiries,artisan,uploads,files,ai,jobs,admin}.py
  app/services/{catalogue,orders,cart,jobs}.py
  app/services/storage/{base,db,s3}.py
  app/services/ai/{provider,sarvam,claude,voyage,fal,image,knn,wages,pipelines}.py
  fixtures/{sarvam,anthropic,voyage,fal}/<op>/default.json (+ <sha256>.json when recorded), fixtures/audio/demo-bagru-saree-hi.wav, fixtures/images/demo-saree-original.jpg
  data/seed_products.json (25 products + 11 makers, lifted from the prototype's P[]/MAKERS{}/DEF{}), data/synthetic_catalogue.json (~500 SKUs, committed)
  scripts/{seed,generate_catalogue,load_synthetic,embed_catalogue,verify_sarvam,record_demo_fixtures,smoke}.py
  tests/{conftest,test_auth,test_catalogue,test_cart_orders,test_artisan,test_ai_pipelines,test_knn,test_image}.py
```

### How the single file maps onto modules (minimal rewrite)
1. CSS block → `web/css/system.css` unchanged.
2. `index.html` = the prototype's shell markup + `config.js` + `<script type="module" src="js/main.js">`. (ES modules don't load from `file://`; dev is uvicorn serving `web/`, or `python -m http.server`.)
3. Each JS module ends with `Object.assign(window, {…})` for every function referenced by inline `onclick/onsubmit/oninput/onchange` (grep the prototype once for the list).
4. `CATS`, `DEF`, `FEATURED` stay as constants in `state.js` (`FEATURED` becomes slugs → ids after bootstrap). `P` and `MAKERS` are filled by bootstrap. `CRAFT{}` goes away — `craft` comes from `Product.craft_technique`.
5. `render()` becomes async: `if (S[key].load) await S[key].load(arg); app.innerHTML = S[key].view(arg)`; screens needing server data (`cart`, `account`, `confirmed`, `seller`, `artist`) get `load()`; show `<div class="empty">Loading…</div>` meanwhile.
6. `pic(p)`: seeded rows keep `img/x.jpg` (relative to `web/`), artisan uploads are absolute API file URLs.

### localStorage → API (guest mode kept)
| Key | Guest | Logged in | On login |
|---|---|---|---|
| `ks-cart` | local | local mirror + `PUT /api/cart` | `POST /api/cart/merge` (union, qty = max) |
| `ks-wish` | local | `POST/DELETE /api/wishlist/{id}` | `POST /api/wishlist/merge` |
| `ks-addr`, `ks-pay`, `ks-orders`, `ks-reviews` (write), `ks-comments` (write), `ks-extra` | require login | real endpoints | — |
| `ks-user` | draft | `GET/PATCH /api/me` | — |
| `ks-side`, `ks-theme`, `ks-lang`, `ks-api`, `ks-token`, `ks-catalogue` (bootstrap cache + ETag) | always local | | |

The one UX change: at checkout, a guest sees a compact "Sign in or create a buyer account" form (email + password + name) in place of the address/payment boxes; on success the cart merges and the screen re-renders. A demo buyer `demo@kalasutra.in / password123` is seeded.

---

## B. Data model (SQLAlchemy 2.x, ported from `D:/swadesh/pickindian/prisma/schema.prisma`)

Port everything except NextAuth tables and `ProductVariant`. Snake_case columns.

- **user**: id, name, email (nullable, unique), phone (nullable, unique), password_hash, image, role `USER|ADMIN|ARTISAN|BUYER`, preferred_language `en-IN`, timestamps.
- **address**: user_id, name, phone, line1, line2, city, state, postal_code, country='India', is_default.
- **payment_method** (new): user_id, type `UPI|CARD`, label (`name@upi` or `•••• 1234 · Name`), is_default. Raw card numbers are validated and discarded, never stored.
- **artisan_profile**: user_id (unique), slug (new: `priya`, `meera`…), display_name, craft_type, cluster_name, district, state, languages ARRAY, story, story_hi, avatar_key, established_year (new), bank_account, ifsc, upi_id, kyc_status `PENDING|SUBMITTED|VERIFIED|REJECTED`, kyc_docs JSONB.
- **otp_challenge**: phone, code_hash, expires_at, attempts, consumed.
- **category**: name, slug (`sarees, men, jewel, foot, home, art, toys`), parent_id.
- **product**: all Prisma columns (name, slug, description, short_desc, price, compare_at, cost_price, sku, stock, category_id, brand, origin, is_active, is_featured, tags ARRAY, artisan_id, name_hi, short_desc_hi, description_hi, bullets/bullets_hi ARRAY, materials ARRAY, craft_technique, dimensions, care_instructions, is_handmade, gi_tag, hsn_code, seo_keywords ARRAY, ai_status `NONE|DRAFT|AI_ENHANCED|PUBLISHED`, embedding ARRAY(Float), is_synthetic). Indexes on category_id, artisan_id, (is_active, is_featured), is_synthetic.
- **product_image**: product_id, url, alt, position, original_key, enhanced_key, enhance_status, qc_notes JSONB.
- **cart / cart_item** (unique cart_id+product_id), **wishlist_item** (unique user+product).
- **order**: order_number (`KS` + base36 time), user_id, address_id, address_snapshot JSONB (new), status (Prisma enum), payment_status, payment_method label, subtotal, shipping, tax, discount, total, tracking_number, delivered_at, cancelled_at, timestamps. **order_item**: name, sku, price, quantity, total.
- **review** (unique product+user; rating, comment), **product_comment** (new: text, answer, answered_at), **enquiry** (buyer_id, artisan_id, product_id, quantity, target_price, quoted_price, message, status `OPEN|QUOTED|ACCEPTED|DECLINED|CLOSED`).
- **voice_note**, **price_suggestion** (product_id nullable — made before the product exists; artisan_id; floor/fair/premium; rationale/rationale_hi; comparables JSONB; cost_inputs JSONB; accepted), **ai_cache** (provider, operation, hash unique; result JSONB).
- **job** (new): kind `ENHANCE|CATALOG|PRICE`, status `QUEUED|RUNNING|DONE|FAILED`, stage, input JSONB, result JSONB, error, artisan_id.
- **stored_file** (new): key (unique), content_type, size, data bytea, kind `images|audio|kyc|enhanced`, owner_user_id, created_at. KYC files are served only via an owner-checked route (fixes the public-KYC leak found in the old app).

Alembic: `env.py` on `Base.metadata`; `0001_initial` generated before the first deploy; `alembic upgrade head` in the Heroku `release` phase. Heroku Essential-0 has a 10 000-row cap — fine for 25 + 500 products, cache rows and demo orders; keep AiCache and jobs pruned by a tiny admin route if needed.

---

## C. Auth

- `app/auth/jwt.py`: `create_token(user_id, role)` (sub, role, iat, exp 30 d), `decode_token`.
- `app/auth/deps.py`: `optional_user`, `require_user` (401), `require_artisan` (403 unless role ARTISAN with profile; returns user + profile), `require_role`.
- Routes: `POST /api/auth/register {email,password,name?,phone?}`, `POST /api/auth/login`, `POST /api/auth/otp/request {phone}` (creates challenge; `devCode` returned only when `OTP_DEV_MODE=1`, code `OTP_DEV_CODE=123456`; SMS provider stub in `services/sms.py`), `POST /api/auth/otp/verify {phone,code}` → token + `needsProfile`; `POST /api/artisan/profile` promotes to ARTISAN and returns a fresh token; `GET/PATCH /api/me`.
- `api.js` attaches the bearer token; a 401 clears it and toasts "Signed out".

## D. API surface (`/api`, envelope `{data}` / `{error, details?}`)

- **Catalogue (public)**: `GET /catalogue/bootstrap` → `{categories, makers{slug:…}, products:[ProductCard]}` with ETag, where `ProductCard = {id, slug, n, hi, mk, price, was, img, cat, craft, d:{technique,materials,size,care}, stock, isFeatured}` — exactly the prototype's shape. `GET /products?page&limit&category&search&sort&artisan` (port of `pickindian/src/app/api/products/route.ts`), `GET /products/{idOrSlug}`, `GET /categories`, `GET /makers`, `GET /makers/{slug}`.
- **Cart / wishlist**: `GET/PUT/DELETE /cart`, `POST /cart/merge`; `GET /wishlist`, `POST/DELETE /wishlist/{productId}`, `POST /wishlist/merge`.
- **Addresses / payment methods**: `GET/POST /addresses`, `DELETE /addresses/{id}`; `GET/POST /payment-methods`, `DELETE`. Accept the prototype's form field names (`line`, `pin`, `upi`, `card`, `cname`) via Pydantic aliases so `saveAddr()/savePay()` post unchanged.
- **Orders**: `POST /orders {addressId, paymentMethodId, items}` (prices re-read from DB; shipping 0 if ≥ ₹999 else ₹79; payment simulated PAID; clears cart), `GET /orders`, `GET /orders/{no}`; artisan side `GET /artisan/orders` (own line items + own total, port of `orders/shared.ts`), `PATCH /artisan/orders/{id} {status, trackingNumber?}`. Order JSON matches what `S.confirmed`/`S.account` already render.
- **Reviews / comments**: `GET/POST /products/{id}/reviews`, `GET/POST /products/{id}/comments`, `POST /artisan/comments/{id}/answer` (nice-to-have).
- **Enquiries**: `POST /enquiries`, `GET /enquiries`, `GET /artisan/enquiries`, `PATCH /artisan/enquiries/{id} {status, quotedPrice?}`.
- **Artisan**: `GET/POST/PUT /artisan/profile` (PUT merges kyc_docs; PAN arrival flips PENDING/REJECTED → SUBMITTED), `GET/POST /artisan/products` (slug = slugify(name)+4 chars, sku `KS-<id4>-NNN`, brand = display_name, origin = "district, state"; accepts `priceSuggestionId`, `voiceNoteId`, `aiStatus`), `GET/PATCH/DELETE /artisan/products/{id}` (deactivate if ever ordered), `GET /artisan/dashboard`.
- **Uploads / files**: `POST /uploads` multipart `{file, kind}` (artisan; 20 MB; MIME allowlist; images re-encoded through Pillow, EXIF stripped, ≤ 2048 px) → `{key, url, contentType, size}`; `GET /files/{key}` (public for images/audio, owner-only for kyc); `GET /artisan/kyc/{doc}`.
- **AI (artisan, async)**: `POST /ai/enhance {imageKey}`, `POST /ai/catalog {audioKey, language, imageKey?}`, `POST /ai/price {name, description, materials, categorySlug, imageKey?, materialCost, hours}` → `202 {jobId}`; `GET /jobs/{id}` → `{status, stage, result?, error?}`; `?sync=1` for tests only. `GET /admin/ai-usage` (call counters) behind `ADMIN_KEY`.

### AI pipelines (`services/ai/pipelines.py`)
- **run_enhance**: original → `fal.cutout` (fixture: `image.studio_lite` = autocontrast + pad) → `image.composite_on_paper` (paper `#F6F5F0` gradient, contact shadow from the alpha, 8 % padding, 2048² WebP + 400 px thumb) → store → `claude.photo_qc` on a 1024 px copy → `QcOut{inFocus, productFullyVisible, lightingScore 1-5, clutterScore 1-5, retakeAdvice}` → `sarvam.translate` → `retakeAdviceHi` → result `{originalUrl, enhancedUrl, thumbUrl, qc, needsRetake}`.
- **run_catalog**: `voice_note` row → `sarvam.stt_saarika` (native) + `sarvam.stt_saaras` (English) → `claude.listing(transcript_en, image, context{craftType, clusterName, district, state, categorySlugs})` → `ListingOut` (14 fields from `plan.md`; `categorySlug` constrained to real slugs) → `sarvam.translate` name/shortDesc/description → `sarvam.tts("<nameHi>. <shortDescHi>. क्या यह सही है?")` (the only TTS call) → `{voiceNoteId, transcript, transcriptEn, listing, listingHi, ttsAudioB64}`.
- **run_price**: `voyage.embed(text, image)` (no key → `knn.jaccard_fallback`) → `knn.query(k=12, category)` → `wages.cost_floor(material, hours, state)` = material + hours × (state daily wage ÷ 8) + packaging 40 + 8 % fee, with the wage table's source cited → `claude.price_reasoning` → clamp `floor ≥ costFloor`, `floor ≤ fair ≤ premium` → `sarvam.translate(rationale)` → `price_suggestion` row → `{suggestionId, floor, fair, premium, rationale, rationaleHi, comparables[{productId, name, price, origin, similarity, isSynthetic}], costInputs}`.
- **Fixture strategy (`provider.py`)**: `mode = <PROVIDER>_MODE or AI_MODE or ("live" if key else "fixture")`; `hash = sha256(op + PROMPT_VERSION + canonical inputs)`; resolution: `ai_cache` hit → `fixtures/<provider>/<op>/<hash>.json` → `default.json`; `record` mode calls live and writes both; `live` writes `ai_cache` and increments a counter. Hand-written `default.json` fixtures for the Bagru saree demo (transcript, listing, Hindi copy, short TTS wav, QC advice, ₹1,450/1,899/2,400 band with 12 comparables) make the whole seller flow demonstrable with zero keys.
- **Claude**: `anthropic>=1.0`, `client.messages.parse(model="claude-opus-5", thinking={"type":"adaptive"}, output_config={"effort":"low"|"high"}, output_format=PydanticModel)`; guard `parsed_output is None` / refusal → job FAILED. Verify the `parse` kwarg names against the installed SDK on day 1 (the `claude-api` skill reference is available for this).
- **Sarvam**: shapes in `api-notes.md` are unverified → `scripts/verify_sarvam.py` hits all four endpoints with tiny inputs on the first live day and updates `api-notes.md` and the credit count. Browser records **16 kHz mono WAV** (`audio.js`) so no ffmpeg is needed.

## E. Background work
Route creates `job(QUEUED)`, returns `202 {jobId}`, `BackgroundTasks.add_task(run_job)`; `run_job` opens its own session, updates `stage` between steps (`cutout`, `qc`, `transcribing`, `writing`, `translating`, `speaking`, `embedding`, `comparing`, `reasoning`). `GET /jobs/{id}` marks RUNNING > 10 min as FAILED ("server restarted — retry"). Frontend `api.pollJob(id, onStage)` every 1.5 s, max 150 s, updates the bilingual stage labels under each upload box; active job ids kept in `sessionStorage` so a refresh resumes polling.

## F. Dataset bootstrap and kNN
1. `data/seed_products.json` from the prototype (makers get phones `+9198110000NN` for OTP demo logins); `scripts/seed.py` idempotent; also seeds the demo buyer and one ADMIN.
2. `scripts/generate_catalogue.py --template` (no key): ~25 craft clusters × material tier × size tier → ~500 rows, **price = nearest real SKU's price × tier multiplier × U(0.85, 1.15)**; `--claude` later regenerates with `messages.parse` in batches of 50. Output committed to `data/synthetic_catalogue.json`.
3. `scripts/load_synthetic.py` inserts with `is_synthetic=True, is_active=False`.
4. `scripts/embed_catalogue.py` (Voyage, batches of 50, skips without a key).
5. `services/ai/knn.py`: `EmbeddingIndex` (numpy, L2-normalised, lazy-loaded, `refresh()` after new embeddings, category filter with fallback to all if < 5) + `jaccard_fallback(db, text, category, k)`.

## G. Deployment
- **Heroku**: app `kalasutra-api`; root `requirements.txt` (`-r backend/requirements.txt`), root `Procfile` (`release: cd backend && alembic upgrade head`, `web: cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1`), root `.python-version` = 3.13. Add-on `heroku-postgresql:essential-0`. Config vars from `.env.example`. Custom domain `api.<domain>` with Automated Certificate Management (included on Basic dynos). Deploy via the Heroku GitHub integration on `main` (or `git push heroku main`). One-off: `heroku run "cd backend && python scripts/seed.py && python scripts/load_synthetic.py"`.
- **GitHub Pages**: publish from `main` root as today; root `index.html`/`vercel.json` redirect to `web/`; `.nojekyll`; `CNAME` file with the Name.com domain; DNS at Name.com: `www` CNAME → `dhruvjoshi-git.github.io`, apex A records → GitHub Pages IPs, `api` CNAME → the Heroku DNS target. Until DNS is live, `github.io` + `herokuapp.com` work as-is.
- **CORS**: `allow_origins` = localhost origins + `https://dhruvjoshi-git.github.io` + the custom domain; `allow_credentials=False` (no cookies).
- **`web/config.js`** picks the API URL by hostname; `?api=` overrides via `ks-api` for stage switching.
- **Local**: `createdb -U postgres kalasutra` on the portable Postgres (don't reuse `pickindian`), `SERVE_WEB=1` mounts `web/` on uvicorn, `AI_MODE=fixture`, `SARVAM_MODE=live` only for real passes.
- `backend/.env.example`: `DATABASE_URL, JWT_SECRET, OTP_DEV_MODE, OTP_DEV_CODE, CORS_ORIGINS, STORAGE_BACKEND=db|s3, S3_* (optional), AI_MODE, SARVAM_API_KEY, SARVAM_MODE, ANTHROPIC_API_KEY, VOYAGE_API_KEY, FAL_KEY, ADMIN_KEY, SERVE_WEB`.
- Packages: `fastapi>=0.115 uvicorn[standard] sqlalchemy>=2.0.36 alembic psycopg[binary]>=3.2.10 pydantic>=2.12 pydantic-settings PyJWT>=2.9 bcrypt>=4.3 python-multipart httpx pillow>=11 numpy>=2 anthropic>=1.0 boto3 python-slugify pytest pytest-env`.

---

## H. Build order

| Phase | Work | Done when |
|---|---|---|
| **0 — Backend skeleton** (½ day) | `backend/` layout, settings, models, Alembic `0001`, `seed.py` + `seed_products.json`, `/health`, CORS, db storage, `GET /catalogue/bootstrap`, `SERVE_WEB` mount | uvicorn on the portable Postgres; bootstrap returns 25 products + 11 makers; `pytest tests/test_catalogue.py` green |
| **1 — Frontend split + buyer wiring** (1 day) | `web/` split; bootstrap → `P/MAKERS`; modal with server reviews/comments; guest cart/wishlist + merge; register/login; addresses, payment methods, orders, confirmed, account; paginated `GET /products` | Local click-through: browse → modal → ♥ → cart → inline sign-up → address + UPI → place order → confirmed → account shows it |
| **2 — Artisan side, non-AI** (½ day) | OTP flow + onboarding, profile, products CRUD, uploads, `#seller`, `#upload` manual path (photo → typed description → typed price → submit), `#artist/<slug>` from DB, artisan orders + status | OTP `123456` as Priya → upload photo → list product → visible in shop and on her page |
| **3 — Deploy** (½ day) | Heroku app + Postgres, root Procfile/requirements, seed on Heroku, `config.js`, Pages redirect, domain + DNS + CORS | The Pages site places an order against Heroku; an upload renders from `/api/files/…`; `api.<domain>` answers over HTTPS |
| **4 — AI plumbing in fixture mode** (1 day) — **the score** | `provider.py`, `job` + polling UI, `image.py`, the three pipelines with `default.json` fixtures, `audio.js`, `wages.py`, template synthetic catalogue + loader, `knn.py` with Jaccard, `smoke.py`; then `SARVAM_MODE=live` once on the demo wav via `verify_sarvam.py` | With no keys the full seller flow runs end to end; pytest green; Sarvam shapes verified and credits logged in `progress.md` |
| **5 — Go live per key** (½ day, as keys arrive) | Anthropic: verify `parse`, `--claude` catalogue, re-seed; Voyage: embed + switch kNN; fal: real cutout; `AI_MODE=record` on demo inputs | Real outputs recorded as fixtures; `smoke.py --live` passes |
| **6 — Linkage + polish + rehearsal** (½ day) | Enquiry → quote, comment answers, empty/error states, catalogue cache, demo reset script, fallback video | Two 4-minute rehearsals (hotspot, and fixture mode) |
| **7 — Android (Expo)** | later, same API and JWT | — |

Critical path: 0 → 1 → 2 → 4 → (5) → 6; phase 3 can slide after 4 if needed. **Cut first if short on time**: Coupon model · comment answers · KYC UI (keep API) · Saarika second ASR call · fal cutout (ship `studio_lite`) · Voyage (ship Jaccard) · `PATCH /me` · extra product filters. **Never cut** the voice cataloguer, the TTS read-back, or the fixture/record switch.

## Verification
- **pytest** (`backend/tests`, test DB `kalasutra_test`, `AI_MODE=fixture`): auth incl. OTP attempts/expiry; bootstrap excludes synthetic; cart merge; order totals/shipping/price re-validation; artisan ownership (Meera → 404 on Priya's product); `composite_on_paper` output; `knn.query` ordering + category filter; each pipeline returns the documented keys and the `plan.md` assertions (`floor ≤ fair ≤ premium`, `floor ≥ costFloor`, ≥ 5 comparables, `nameHi` Devanagari, `categorySlug` valid, `retakeAdviceHi` non-empty).
- **`scripts/smoke.py --base URL [--live]`**: every route in order (health → bootstrap → register/login → products → wishlist → cart/merge → address → payment → order → reviews/comments → OTP → profile → uploads → enhance/catalog/price jobs polled to DONE → artisan product → shop shows it → enquiry → quote → order status); pass/fail table, exit 1 on failure.
- **Manual click-through** at 390 px, 1920, 3440: every screen and button from the prototype, plus job stage labels, refresh mid-job, artisan status change visible to the buyer, enquiry visible to the seller.
- **Rehearsal (acceptance)**: buyer browses → OTP login → photograph a real piece → enhance + Hindi retake advice → speak Hindi → hear it read back → accept fair price → publish → see it on another device → raise a bulk enquiry → artisan quotes. Under 4 minutes, once live and once in fixture mode.

## Risks → mitigations
- **Sarvam 1,000 credits**: fixture mode for all UI work; `ai_cache` dedupes; one TTS per catalog run; usage counter; log credits per phase; cut Saarika first.
- **Anthropic / Voyage / fal keys late**: every op has a `default.json`; auto-fallback with a log line; only `<PROVIDER>_MODE` changes when a key arrives.
- **Unverified Sarvam shapes**: `verify_sarvam.py` on day 1 of phase 4; WAV recording avoids format issues.
- **Venue wifi**: `AI_MODE=record` beforehand so the demo inputs replay instantly; laptop-hosted full stack as plan B; recorded video as plan C.
- **Heroku 10k-row cap / 512 MB**: prune `ai_cache`/`job` via an admin route; no local ML; single worker; images ≤ 2048 px.
- **Inline handlers + ES modules**: `window` bridge per module; click every button once in the checklist.
- **Synthetic data**: flagged, excluded from the shop, disclosed in README and in the comparables list.

## Critical files
- `backend/app/models/catalogue.py` (product/product_image/category — everything hangs off it; source: `pickindian/prisma/schema.prisma`)
- `backend/app/services/ai/provider.py` (mode, hashing, fixtures, cache — the credit and missing-key discipline)
- `backend/app/services/ai/pipelines.py` (the three demos)
- `web/js/state.js` + `web/js/api.js` (bootstrap-fed data, guest/merge state, JWT fetch — the seam that turns the prototype into a client)
- root `Procfile` + `web/config.js` + `CNAME` (the deployment contract between Pages, the domain and Heroku)
- Reuse: `pickindian/src/lib/contracts/artisan.ts` → Pydantic 1:1; `pickindian/src/app/api/artisan/**` ownership rules; `pickindian/src/lib/storage/index.ts` function set; `prototype/kalasutra-prototype.html` data shapes and screens.
