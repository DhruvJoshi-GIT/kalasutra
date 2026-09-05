# KalaSutra — AI Market Linkage & Smart Cataloguing, built on the PickIndian stack

## Context

You are entering a hackathon whose problem statement asks for an **AI-driven,
cross-platform mobile app** that acts as a "virtual business manager" for
marginalised artisans and weavers — one that digitises inventory, optimises
listings with AI, and links artisans to B2B buyers / government e-marketplaces,
for users with low digital literacy and regional-language-only comfort.

You already own `InfinitelyAsymptotic/pickindian` (branch `develop`), built from
the Project Swadeshi PRD. The instruction is to reuse its stack and data rather
than start over. I read the repo. The honest position:

**What genuinely exists and is worth keeping (~6,800 LOC, all reusable):**

| Layer | What's there |
|---|---|
| Framework | Next.js 16.1.6 (App Router) + React 19.2 + TypeScript 5 + Tailwind v4 |
| Data | Prisma 5.22 + PostgreSQL — `prisma/schema.prisma`: User/Account/Session, Address, Category, Product, ProductImage, ProductVariant, Review, Cart/CartItem, WishlistItem, Order/OrderItem, Coupon |
| Auth | NextAuth v5 beta — `src/lib/auth/config.ts` (Credentials + Google, bcrypt), route protection in `src/middleware.ts` |
| API | `src/app/api/products/route.ts` (filter/search/sort/paginate — solid), `api/categories/route.ts`, `api/auth/signup/route.ts` |
| State/forms | Zustand `src/store/cart-store.ts`, TanStack Query, react-hook-form + zod v4, framer-motion |
| Design system | `src/app/globals.css` — a warm sand/terracotta token set (`--background #FAF7F2`, `--primary #B45309`, `--accent #7C2D12`, `--border #E5DDD3`) that is already exactly right for a craft product |
| UI kit | `src/components/ui/*` — button, card, input, select, textarea, badge, avatar, drawer, modal, skeleton, quantity-selector |
| Utils | `src/lib/utils/index.ts` — `formatPrice` (INR/en-IN), `slugify`, `generateOrderNumber`, `calculateDiscount`, `debounce` |
| Buyer storefront | Products list + PDP, cart, 3-step checkout, account/orders/addresses — all built |
| **Dataset** | `prisma/seed.ts` — 6 categories + ~20 products, of which **~12 are real craft SKUs with price, compareAt, `origin` as "City, State", tags and images**: Madhubani (Madhubani, Bihar), Warli (Palghar), brass diya (Moradabad), jute rug (Kolkata), blue pottery dinner set (Jaipur), Pashmina (Srinagar), Bagru block-print saree, Kolhapuri chappals, Channapatna ludo, sheesham chess (Jaipur), terracotta (Khurja), copper (Moradabad) |

**What the PRD promised but the repo never built** — these are your real gaps:

1. **No mobile app at all.** Web only. The statement demands cross-platform mobile with a camera module. This is gap #1.
2. **No seller side whatsoever.** `Role` enum is `USER | ADMIN` only. There is no Seller/Artisan model, no KYC, no listing flow, no seller order management. PRD Epic 1 was never implemented — the "multi-vendor marketplace" is single-vendor.
3. **No AI anything.**
4. **No image upload.** `ProductImage.url` points at Unsplash. There is no storage layer.
5. **No i18n, no voice, no audio.**
6. **No B2B / RFQ / GeM path.**
7. `razorpay` and `stripe` are in `package.json` but wired nowhere — checkout is simulated.
8. No `docker-compose.yml` despite the PRD's containerisation requirement.

So the reuse is real but asymmetric: **you inherit the entire buyer-side
marketplace and the data model, and you build the artisan-side mobile app the
PRD skipped.** That is actually the strongest possible pitch — "the marketplace
exists; we are building the on-ramp that lets a weaver in Bagru reach it from a
₹6,000 phone, in Hindi, by talking to it."

**Decisions already taken (from your answers):** cloud AI APIs are allowed;
**Sarvam AI is the language provider** (1,000 free credits, Indian model, covers
essentially every mainstream Indian language); mobile app + all three AI features
must genuinely work at the demo; the B2B half stays thin; there is no dataset
yet, so we bootstrap one.

---

## Working agreement (how this project is documented)

**`D:\swadesh` is the durable knowledge base for this project. Nothing about
this work is written to agent memory** — everything lives on disk so any future
Claude Code session is current the moment you hand it `progress.md`.

```
D:\swadesh\
  progress.md          ← THE handoff file. Share this and any agent is up to date.
  findings.md          ← everything read out of the pickindian repo (below)
  plan.md              ← this plan, kept in sync
  decisions.md         ← append-only log: decision, date, why, what it rules out
  api-notes.md         ← Sarvam / Anthropic / Voyage endpoint shapes as verified
```

`progress.md` structure: current phase and status · what works end-to-end today ·
what is half-built and where it stops · exact next action · env vars needed ·
commands to run it · open questions · changelog with dates.

**Rule: `progress.md` is updated after every significant execution** — a phase
completed, a service wired, a schema migration applied, a decision reversed, a
blocker hit. Not after every file edit; after every unit of work that would
change what a fresh agent should do next.

---

## Target architecture

```
pickindian/                     ← repo root stays the Next.js app (do not restructure)
  src/app/…                     ← existing buyer storefront (keep as-is)
  src/app/api/…                 ← existing + NEW /api/mobile/* and /api/ai/*
  src/lib/ai/                   ← NEW: enhance.ts, catalog.ts, pricing.ts, embed.ts
  src/lib/storage/              ← NEW: S3 client (MinIO local → R2 later)
  prisma/schema.prisma          ← EXTENDED (additive; nothing removed)
  prisma/seed.ts                ← EXTENDED to ~500 craft SKUs
  docker-compose.yml            ← NEW: postgres+pgvector, minio
  shared/contracts.ts           ← NEW: zod schemas, single source of truth
  mobile/                       ← NEW standalone Expo app (own package.json)
```

**Why `mobile/` is standalone, not a workspace.** Expo monorepos need
`metro.config.js` `watchFolders` + symlink handling, and that config is exactly
the kind of thing that eats four hours at 2am. Keep the web app at root
untouched. Share types by *copying*: `shared/contracts.ts` holds every zod
schema for the mobile↔server API, and an `npm run sync:contracts` script copies
it to `mobile/src/contracts.ts`. Dumb, zero build risk, one command.

**Mobile talks to the server over plain HTTP only.** No Prisma in the app.

### Auth: do not put NextAuth on React Native

NextAuth v5 is cookie/session-based and fights React Native. Also, Priya has a
phone, not an email — the PRD's own persona says so. Add a separate path:

- `POST /api/mobile/auth/request-otp` → `{ phone }`, creates an `OtpChallenge`
- `POST /api/mobile/auth/verify-otp` → returns a signed JWT (`jose`), 30-day
- Dev mode: `OTP_DEV_CODE=123456` always passes. Real: MSG91 or Twilio.
- `src/lib/auth/mobile-jwt.ts` — `requireArtisan(req)` helper used by every
  `/api/mobile/*` and `/api/ai/*` route.

Existing web NextAuth is untouched. Two auth systems, cleanly separated by
route prefix.

---

## Data model changes (all additive to `prisma/schema.prisma`)

```prisma
enum Role { USER ADMIN ARTISAN BUYER }   // extend existing enum

model ArtisanProfile {
  id            String   @id @default(cuid())
  userId        String   @unique
  displayName   String
  craftType     String              // "Madhubani painting", "Pashmina weaving"
  clusterName   String?             // "Bagru", "Channapatna"
  district      String
  state         String
  languages     String[]            // ["hi","mai"] — drives ASR + TTS
  story         String?  @db.Text   // the artisan's own story, in their words
  storyHi       String?  @db.Text
  bankAccount   String?
  ifsc          String?
  kycStatus     KycStatus @default(PENDING)
  kycDocs       Json?               // {pan: key, gst: key, aadhaar: key}
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  products      Product[]
  enquiries     Enquiry[]
}
enum KycStatus { PENDING SUBMITTED VERIFIED REJECTED }

// Product — add:
//   artisanId String?  + relation, @@index([artisanId])
//   nameHi, descriptionHi, shortDescHi   String?
//   materials String[]   craftTechnique String?   isHandmade Boolean @default(true)
//   giTag String?        hsnCode String?
//   aiStatus  AiStatus @default(NONE)
//   embedding Unsupported("vector(1024)")?   // pgvector
enum AiStatus { NONE DRAFT AI_ENHANCED PUBLISHED }

// ProductImage — add: originalKey String?  enhancedKey String?
//                     enhanceStatus EnhanceStatus @default(NONE)  qcNotes Json?
enum EnhanceStatus { NONE QUEUED DONE FAILED }

model VoiceNote {
  id String @id @default(cuid())
  artisanId String
  productId String?
  audioKey  String
  language  String
  transcript String? @db.Text
  transcriptEn String? @db.Text
  status    JobStatus @default(QUEUED)
  createdAt DateTime @default(now())
}

model PriceSuggestion {
  id String @id @default(cuid())
  productId String
  floor Decimal @db.Decimal(10,2)
  fair  Decimal @db.Decimal(10,2)
  premium Decimal @db.Decimal(10,2)
  rationale   String @db.Text
  rationaleHi String @db.Text
  comparables Json          // the retrieved kNN rows — this is the receipts
  costInputs  Json          // {materialCost, hours, wageFloor}
  createdAt DateTime @default(now())
}

model Enquiry {                 // thin B2B / RFQ
  id String @id @default(cuid())
  buyerId String
  artisanId String
  productId String
  quantity Int
  targetPrice Decimal? @db.Decimal(10,2)
  message String? @db.Text
  status EnquiryStatus @default(OPEN)
}
enum EnquiryStatus { OPEN QUOTED ACCEPTED DECLINED CLOSED }

model OtpChallenge { id String @id @default(cuid()) phone String  codeHash String
                     expiresAt DateTime  attempts Int @default(0)  @@index([phone]) }
model JobStatus_placeholder {}   // enum JobStatus { QUEUED RUNNING DONE FAILED }
```

`docker-compose.yml` runs `pgvector/pgvector:pg16` so `vector(1024)` works; add
`CREATE EXTENSION IF NOT EXISTS vector;` as a first migration.

---

## The three AI services

All three live in `src/lib/ai/`, exposed as `/api/ai/*` routes guarded by
`requireArtisan`.

**Provider split — Sarvam owns language, Claude owns structure and vision.**

| Job | Provider | Why |
|---|---|---|
| Speech → text (Indic) | **Sarvam Saarika** | Purpose-built for Indian languages; free credits; Indian vendor reads well for a government-themed statement |
| Speech → English directly | **Sarvam Saaras** | One call gets you the English gloss *and* skips a translation hop |
| Text → speech (Indic) | **Sarvam Bulbul** | Reads the listing back so a low-literacy artisan can confirm without reading |
| EN ↔ HI translation | **Sarvam Mayura** | Better Indic register than a general model; keeps credits doing what they're best at |
| Structured listing JSON | **`claude-opus-5`** | Schema-constrained output via `messages.parse()`; 14 fields that must all be present and typed |
| Photo QC / retake coaching | **`claude-opus-5`** vision | Sarvam has no vision endpoint |
| Pricing reasoning over comparables | **`claude-opus-5`** | Multi-input reasoning with a justification the artisan hears |

Claude calls use `thinking: {type: "adaptive"}` and `client.messages.parse()`
with `zodOutputFormat(...)` from `@anthropic-ai/sdk/helpers/zod`. The repo is on
zod ^4.3.6 — **verify that helper against zod v4 on day 1**; if it breaks, pin
zod v3 for the AI module only.

**Credit discipline — 1,000 Sarvam credits is a real budget.** Wrap every Sarvam
call in `src/lib/ai/sarvam.ts` with (a) a `SARVAM_FIXTURES=1` mode that replays
canned responses from `fixtures/` so development and UI iteration burn zero
credits, (b) a content-hash cache table so the same audio or the same TTS string
is never billed twice, and (c) a call counter logged to `progress.md` at each
phase boundary. Do all UI work against fixtures; spend credits only on real
end-to-end passes and the rehearsal.

### 1. AI Image Enhancer & Studio → `POST /api/ai/enhance`

Deterministic pipeline, *not* a generative one — generative "studio shots"
invent product details and will get you caught in Q&A.

1. Mobile uploads original → S3 (`originalKey`).
2. **Cutout**: hosted matting model (BiRefNet / RMBG-2.0 on fal.ai or Replicate)
   → alpha matte. One HTTP call, ~1.5s.
3. **Composite** with `sharp` server-side: subject onto a clean off-white
   (`#FAF7F2` — your own token) gradient backdrop, add a soft contact shadow,
   auto-level, centre with 8% padding, output 2048×2048 WebP + 400px thumb.
4. **QC / coaching pass**: send the *original* to `claude-opus-5` vision with a
   zod-constrained output → `{ inFocus, productFullyVisible, lightingScore,
   clutterScore, retakeAdvice, retakeAdviceHi }`. This is the piece judges
   remember: the app says, in Hindi, *"थोड़ा पीछे हटकर पूरी साड़ी दिखाएँ"* — it
   coaches a low-literacy user to a better photo instead of silently failing.
5. Store `enhancedKey`, `qcNotes`. Before/after slider in the app.

### 2. Multilingual Auto-Cataloguer → `POST /api/ai/catalog`

1. Mobile records with `expo-audio` → uploads m4a.
2. **ASR**: Sarvam **Saarika** for the native-script transcript, **Saaras** for
   the English gloss in the same pass. Store both in `VoiceNote`
   (`transcript`, `transcriptEn`). No Whisper fallback in the plan — Sarvam is
   the decision; keep the interface in `sarvam.ts` narrow enough that a fallback
   is a one-file change if credits run dry.
3. **Generation (English)**: one `claude-opus-5` call — transcript + the enhanced
   image + the artisan's `craftType`/`clusterName`/`district` as context — parsed
   against a single-language schema:

```ts
const ListingSchema = z.object({
  name: z.string(), shortDesc: z.string(), description: z.string(),
  bullets: z.array(z.string()),
  materials: z.array(z.string()), craftTechnique: z.string(),
  dimensions: z.string().nullable(), careInstructions: z.string(),
  categorySlug: z.string(), tags: z.array(z.string()),
  seoKeywords: z.array(z.string()),
  giTagCandidate: z.string().nullable(), hsnCode: z.string().nullable(),
});
```

3b. **Translation**: pass the generated copy fields through Sarvam **Mayura** to
   get the Hindi (and, later, any other listed language) versions into
   `nameHi` / `shortDescHi` / `descriptionHi`. One schema instead of two halves
   Claude's output tokens and puts Indic register where it belongs.

4. **Read it back aloud** via Sarvam **Bulbul** TTS in the artisan's language and
   ask "क्या यह सही है?" — confirmation without reading. This closes the
   low-literacy loop and is the single most defensible UX decision in the build.
5. On confirm → create `Product` with `aiStatus: AI_ENHANCED`.

### 3. Dynamic Pricing Assistant → `POST /api/ai/price`

Retrieval + cost model + reasoning. Three grounded legs, no invented number:

1. **Comparables (kNN)**: embed the listing text + enhanced image with
   **Voyage `voyage-multimodal-3`** (1024-dim; Anthropic has no embeddings
   endpoint). Query pgvector for the 12 nearest catalogue products, filtered by
   category. Raw SQL via `prisma.$queryRaw` with `<=>` cosine distance.
2. **Cost floor**: artisan enters material cost + hours on two big sliders (or
   says them in the voice note and Claude extracts them).
   `floor = materials + hours × wageFloor(state) + packaging + platformFee`.
   Wage floor from a small hardcoded state-wise minimum-wage table — cite the
   source in the README; that citation wins points.
3. **Reasoning**: `claude-opus-5` gets the comparables table + cost floor →
   `{ floor, fair, premium, rationale, rationaleHi }`. Persist the comparables
   **and** cost inputs in `PriceSuggestion` — the UI shows "similar Bagru sarees
   sell for ₹1,850–₹2,400" so the artisan sees *why*, and so do the judges.

The pricing screen shows a three-stop band with the fair price pre-selected;
never a single opaque number.

---

## Bootstrapping the dataset (there is none today)

You need a comparable-set corpus or the pricing feature is a demo of nothing.

- **Keep** the 12 genuine craft SKUs in `prisma/seed.ts` — they are your ground truth.
- **Generate** ~500 more via a one-off offline script
  `scripts/generate-catalogue.ts`: `claude-opus-5`, batched, producing realistic
  craft SKUs across ~25 craft clusters (Madhubani, Warli, Pattachitra,
  Channapatna, Bidri, Kanjeevaram, Phulkari, Blue Pottery, Dhokra, Chikankari,
  Ajrakh, Bandhani, Kalamkari, Pashmina, Kolhapuri, Terracotta, Brassware,
  Jute…) × material/size tiers, each with name, description, materials,
  district/state, and a **price band anchored to the real seeded SKUs** so the
  distribution isn't fantasy.
- **Label them.** Add `isSynthetic Boolean @default(false)` to `Product` and set
  it on generated rows. Say so in the README and the pitch. A judge who finds
  undisclosed synthetic data will end your run; a team that discloses it and
  explains the anchoring looks rigorous.
- Product photos: reuse the existing Unsplash URL pattern for synthetic rows.
- `scripts/embed-catalogue.ts` precomputes every embedding once, post-seed.

---

## Mobile app (`mobile/`) — Expo

`npx create-expo-app` (SDK 54+, expo-router, TypeScript). Packages:
`expo-camera`, `expo-audio`, `expo-image-manipulator`, `expo-file-system`,
`expo-sqlite`, `expo-localization`, `expo-secure-store`, `i18n-js`,
`@tanstack/react-query`, `zustand`, `nativewind` (so the `globals.css` tokens
carry over verbatim).

**Screens** (artisan-facing, the whole app is the seller portal the PRD skipped):

| Screen | Notes |
|---|---|
| Phone OTP login | Numeric only; language picker *before* login |
| Home | 3 huge tiles: **नया प्रोडक्ट**, **मेरे ऑर्डर**, **मेरी दुकान**. Icon-first. |
| Camera studio | Live guide overlay, capture, before/after slider, retake coaching from the QC pass |
| Voice cataloguer | One big mic button, waveform, transcript, TTS playback, ✓ / ✗ |
| Price assistant | Comparables list + 3-stop band + spoken rationale |
| Review & publish | The generated listing in EN/HI toggle |
| Orders | Status dropdown (PRD US 1.4), read aloud |
| Profile / KYC | Document capture, `kycStatus` badge |

**Accessibility rules, non-negotiable** (the statement scores this explicitly):
44px minimum touch targets, ≤2 primary actions per screen, every screen has a
🔊 button that reads it aloud, icon + text always paired, no jargon in Hindi
strings (translate *meaning*, not words).

**Offline-first**: `expo-sqlite` outbox table; captures and voice notes queue
locally and sync when connectivity returns. Demo this by flipping airplane mode
on stage — it lands harder than any slide.

---

## Build order

| Phase | Work | Done when |
|---|---|---|
| **0 — Docs** | Write `D:\swadesh\` — `findings.md` (full repo audit), `plan.md`, `decisions.md`, `api-notes.md`, and `progress.md` | A fresh agent given `progress.md` alone can continue |
| **0b — Foundation** | `docker-compose.yml` (pgvector + MinIO); extend `schema.prisma`; `db:push`; S3 client in `src/lib/storage/`; `shared/contracts.ts` | `npm run db:push && npm run db:seed` green, MinIO console reachable |
| **1 — Mobile shell + auth** | Expo scaffold, OTP endpoints + JWT, `requireArtisan`, i18n scaffold, home screen | Real phone logs in, hits an authed endpoint |
| **2 — Studio** | Upload route, matting call, `sharp` composite, Claude QC pass, before/after UI | Photo of a real object → clean e-commerce cutout |
| **3 — Cataloguer** | Audio upload, Sarvam ASR, `messages.parse()` listing, Bulbul TTS, product create | Speak Hindi → bilingual listing saved |
| **4 — Dataset + pricing** | Generate + embed 500 SKUs, pgvector kNN, cost model, price route + UI | Band with visible comparables |
| **5 — Linkage + orders** | BUYER role, `Enquiry` RFQ, GeM-format CSV export, seller order status | Buyer raises RFQ on web, artisan sees it on phone |
| **6 — Polish + demo** | Offline queue, empty/error states, seed a scripted demo artisan, rehearse | 4-minute run-through with no dead air |

Phases 2–4 are the score. If you run out of time, cut phase 5 to the CSV export
alone — never cut the voice cataloguer.

---

## Environment

```
DATABASE_URL, NEXTAUTH_SECRET                 # existing
ANTHROPIC_API_KEY
SARVAM_API_KEY                                # Saarika + Saaras + Bulbul + Mayura
SARVAM_FIXTURES=1                             # replay canned responses, spend 0 credits
VOYAGE_API_KEY                                # embeddings
FAL_KEY  (or REPLICATE_API_TOKEN)             # background matting
S3_ENDPOINT / S3_KEY / S3_SECRET / S3_BUCKET  # MinIO locally
MOBILE_JWT_SECRET, OTP_DEV_CODE=123456
EXPO_PUBLIC_API_URL                           # mobile/.env
```

Add `.env.example`. **Never ship keys in the Expo bundle** — every AI call goes
through your Next.js routes, never direct from the app. Say this out loud in the
pitch; it is a real architecture point and teams routinely get it wrong.

---

## Verification

**Per phase, before moving on:**

```bash
docker compose up -d
npm run db:push && npm run db:seed
npm run dev                     # http://localhost:3000 — existing storefront must still work
npx tsc --noEmit && npm run lint
cd mobile && npx expo start     # Expo Go on a real Android phone, same LAN
```

**AI routes, independently of the app** (`scripts/smoke-ai.ts`, run with `tsx`):

1. `POST /api/ai/enhance` with a deliberately bad photo (cluttered, dim) → assert
   an `enhancedKey` comes back *and* `qcNotes.retakeAdviceHi` is non-empty.
2. `POST /api/ai/catalog` with a 20s Hindi m4a → assert all 14 schema fields
   present, `nameHi` is Devanagari, `categorySlug` matches a real category.
3. `POST /api/ai/price` for a Bagru saree → assert `floor ≤ fair ≤ premium`,
   `floor ≥` computed cost floor, and `comparables.length ≥ 5`.

**Regression guard:** `GET /api/products?category=fashion&search=saree` must
return the same shape as today — the artisan work must not break the storefront.

**End-to-end demo rehearsal** (this *is* the acceptance test): login by OTP →
photograph a real handicraft → enhance → speak a Hindi description → hear it read
back → accept the suggested price → publish → open the web storefront and see
the listing live → raise a B2B enquiry → see it on the phone. Time it. Under 4
minutes, with airplane mode toggled once.

---

## Risks worth naming now

- **Venue wifi.** Every AI call is a cloud round-trip. Pre-record a fallback
  demo video *and* cache one fully-processed product so the flow can be shown
  from local state if the network dies. Build this in phase 6, not at 3am.
- **`zodOutputFormat` vs zod v4.** The repo is on zod ^4.3.6. Verify on day 1.
- **1,000 Sarvam credits is the hard constraint.** Fixtures mode and the
  content-hash cache are phase-0b work, not polish. Log remaining credits in
  `progress.md` at every phase boundary; if the counter drops faster than
  expected, cut TTS to the confirmation step only.
- **Scope.** The B2B half and the payment gateway are the designated sacrifices.
  Razorpay stays unwired; keep checkout simulated exactly as the PRD specified.
- **Naming.** `KalaSutra` ("craft bridge") is a placeholder — swap it for whatever
  you register, but do it in phase 0 while it's a single find-and-replace.
