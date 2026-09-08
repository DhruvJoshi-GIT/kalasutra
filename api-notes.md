# API notes — verified shapes only

Anything here marked **UNVERIFIED** is from memory / docs and must be confirmed against a real call before relying on it. Update this file when a call is confirmed.

## Anthropic (TypeScript SDK `@anthropic-ai/sdk`) — verified from bundled SDK reference 2026-09-04

- Model: `claude-opus-5`. Thinking: `thinking: { type: "adaptive" }`. Do **not** pass `budget_tokens` (400 on Opus 5).
- Structured output: `client.messages.parse({ model, max_tokens, messages, output_config: { format: zodOutputFormat(Schema) } })` → `response.parsed_output` (null on parse failure — guard). Import `zodOutputFormat` from `@anthropic-ai/sdk/helpers/zod`. **Check compatibility with the repo's zod ^4** on first use.
- Vision: content block `{ type: "image", source: { type: "base64", media_type: "image/jpeg", data } }` placed before the text block.
- `max_tokens`: ~16000 non-streaming default; don't lowball.
- Client picks up `ANTHROPIC_API_KEY` from env. Not set on this machine yet.
- Effort: `output_config: { effort: "low" | "medium" | "high" | "xhigh" | "max" }` — use `low`/`medium` for the cataloguer, `high` for pricing.

## Sarvam AI — UNVERIFIED until first real call

Base URL `https://api.sarvam.ai`. Auth header `api-subscription-key: <SARVAM_API_KEY>`.

| Product | Endpoint (expected) | Purpose |
|---|---|---|
| Saarika | `POST /speech-to-text` (multipart: `file`, `language_code`, `model: saarika:v2`) | Native-script transcript |
| Saaras | `POST /speech-to-text-translate` (multipart: `file`, `model: saaras:v2`) | Indic speech → English text |
| Bulbul | `POST /text-to-speech` (JSON: `inputs[]`, `target_language_code`, `speaker`, `model: bulbul:v2`) → base64 wav `audios[]` | Read listing back |
| Mayura | `POST /translate` (JSON: `input`, `source_language_code`, `target_language_code`, `model: mayura:v1`) | EN ↔ HI |

Language codes are BCP-47 style: `hi-IN`, `bn-IN`, `ta-IN`, `te-IN`, `mr-IN`, `gu-IN`, `kn-IN`, `ml-IN`, `pa-IN`, `od-IN`, `en-IN`.
Credit budget: 1,000 free. Record remaining credits here after each phase.

## Voyage AI embeddings — UNVERIFIED

`POST https://api.voyageai.com/v1/multimodalembeddings`, header `Authorization: Bearer <VOYAGE_API_KEY>`, model `voyage-multimodal-3`, 1024 dims. Inputs are `[{ content: [{type:"text", text}, {type:"image_base64", image_base64}] }]`. Fallback if no key: text-only `voyage-3` or a local `@xenova/transformers` model.

## Background matting — UNVERIFIED

fal.ai `fal-ai/birefnet` or Replicate `briaai/RMBG-2.0`. Input image URL or base64; output PNG with alpha. Compose with `sharp`.

## KalaSutra API (our own FastAPI backend, `backend/`) — verified by tests 2026-09-05

Base `/api`. Envelope `{data}` on success; errors `{detail}` (HTTPException) or `{error:"Invalid input", details:[{loc,msg,type}]}` (422). Auth: `Authorization: Bearer <JWT>` (30 days; claims `sub`, `role`).

| Route | Notes |
|---|---|
| `GET /health` | `{ok, version, aiMode}` |
| `GET /catalogue/bootstrap` | `{categories, makers{slug:MakerCard}, products:[ProductCard], generatedAt}` — ProductCard = `{id, slug, n, hi, mk, price, was, img, cat, craft, d:{technique,materials,size,care}, stock, isFeatured, aiStatus}`; excludes synthetic + inactive |
| `GET /products?page&limit&category&search&sort&artisan&minPrice&maxPrice` | sort in newest, price-asc, price-desc, sale, name; search hits name, Hindi name, craft, technique, brand, origin, description |
| `GET /products/{id or slug}` · `/categories` · `/makers` · `/makers/{slug}` | detail adds description, images[], materialsList, bullets, tags, maker, rating, reviewCount |
| `POST /auth/register {email,password,name?,phone?}` · `POST /auth/login` | -> `{token, user, needsProfile}` |
| `POST /auth/otp/request {phone}` -> `{sent, expiresIn, devCode?}` · `POST /auth/otp/verify {phone, code}` | phone normalised to +91; dev code 123456; 5 attempts; 5-min expiry; challenge consumed on success |
| `GET/PATCH /me` | |
| `GET/PUT/DELETE /cart` · `POST /cart/merge` | items `[{id, qty}]`; merge = union with max qty |
| `GET /wishlist` · `POST/DELETE /wishlist/{productId}` · `POST /wishlist/merge {productIds}` | |
| `GET/POST /addresses` · `DELETE /addresses/{id}` | body uses the prototype's field names: name, phone, line, city, state, pin (6 digits) |
| `GET/POST /payment-methods` · `DELETE /payment-methods/{id}` | body `{type:'upi' or 'card', upi?, card?, cname?}`; only a label is stored |
| `POST /orders {addressId, paymentMethodId, items}` · `GET /orders` · `GET /orders/{no}` | prices re-read from DB; shipping 0 if subtotal >= 999 else 79; payment simulated PAID; order no `KS<base36 ms>`; server cart cleared |
| `GET/POST /products/{id}/reviews {stars,text,name?}` | one review per user (upsert) |
| `GET/POST /products/{id}/comments {text,name?}` · `POST /artisan/comments/{id}/answer` | |
| `POST /enquiries {productId, quantity, targetPrice?, message?}` · `GET /enquiries` · `GET /artisan/enquiries` · `PATCH /artisan/enquiries/{id} {status, quotedPrice?}` | |

Frontend contract: `web/config.js` sets `window.KS_CONFIG.API_URL` (`kalasutra.live` → `https://api.kalasutra.live/api`; `github.io` → `https://kalasutra-api.onrender.com/api`; else same origin; `?api=` overrides, stored in `ks-api`). Local storage keys: `ks-session` `{token,user}`, `ks-cart`, `ks-wish`, `ks-user`, `ks-catalogue` (bootstrap cache), `ks-demo` (demo-mode store), `ks-side`, `ks-theme`, `ks-api`.

**Demo mode (2026-09-08)** — if `GET /catalogue/bootstrap` fails, `window.KS_OFFLINE=true`, the catalogue comes from the cache or `web/catalogue.json` (a committed snapshot of the bootstrap `data`; regenerate after seed changes), and `api()` routes every call to `demoApi()` in `web/js/demo.js`, which mirrors the shapes above for: `/auth/otp/request` (`devCode` 123456), `/auth/otp/verify` (`98110000NN` → Nth maker in the snapshot, else `needsProfile:true`), `/auth/login|register` (demo buyer `demo@kalasutra.in` / `password123`), `/me`, `/cart*`, `/wishlist*`, `/addresses`, `/payment-methods`, `/orders`, `/products/{id}/reviews|comments`, `POST /enquiries`. Unknown routes throw "Not available in demo mode". A non-demo token is cleared when demo mode engages. Order shape used by the screens: `{no, date, status, items:[{id,n,qty,price}], subtotal, shipping, total, addr:{name,phone,line,city,state,pin}, pay:{type:'upi'|'card', label}}`.

## Sarvam — key available since 2026-09-05 (in backend/.env)

The endpoint shapes above are still UNVERIFIED; `scripts/verify_sarvam.py` (to be written in the AI phase) must run before relying on them.
