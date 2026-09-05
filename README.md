# KalaSutra

**An AI-driven marketplace and smart-cataloguing app for marginalised Indian artisans.**
Hackathon build — problem statement: *AI-Driven Market Linkage and Smart Cataloging Mobile Application for Marginalized Artisans*.

KalaSutra lets a maker photograph a piece, describe it by voice in their own language, get a fair price suggestion, and list it — while buyers (retail and bulk) shop a catalogue that puts the maker and the craft first.

## What is in this repository

| Path | What it is |
|---|---|
| `prototype/kalasutra-prototype.html` | The **clickable prototype** of the whole site: one HTML file, no build step. Open it in a browser. |
| `prototype/img/` | Product photos used by the prototype (web-sized). |
| `prototype/archive/` | Earlier prototype versions, kept for reference. |
| `photo/` | Original product photos (`photo/files/`) and the source collages they came from. |
| `design/` | Design-direction working files (the three directions explored; direction B "Karkhana — ink on paper" was chosen). |
| `plan.md` | The build plan (v2): FastAPI backend, frontend wiring, AI pipelines, hosting, phases. `plan-v1-nextjs.md` is the earlier Next.js plan. |
| `decisions.md` | Append-only log of every decision and why. |
| `findings.md` | Audit of the base storefront code the web app is built on. |
| `api-notes.md` | Endpoint shapes for the artisan APIs. |
| `progress.md` | The running build log / hand-off file. Newest changes are at the top of its changelog. |

The web app itself (Next.js 16 + Prisma + PostgreSQL) currently lives in a separate private repository and is being restructured to match this prototype; it will be added here when that is done.

## Try the prototype

1. Clone or download this repo.
2. Open `prototype/kalasutra-prototype.html` in Chrome, Edge or Firefox. Nothing to install.
3. Everything you do — cart, wishlist, addresses, payment methods, orders, reviews, comments, seller listings — is stored in your browser, so it behaves like a logged-in account between refreshes. There is deliberately **no demo data**: the account pages fill up only with what you add or buy.

### The flow

- **Home** opens on a slider of pieces "from the workshop" (maker portrait, craft, place, a line of their story), then the full catalogue. The logo reads **KalaSutra** at the top of the page and collapses to a square **K** once you scroll.
- A **floating category capsule** on the left filters the grid (collapse it with ‹). The grid adapts its column count to the screen: phone, laptop, or ultrawide.
- **Search** matches product names, Hindi names, craft, maker and place. **Sort** by newest, price, discount or name.
- Click any tile → the **product popup**: photo, price, quantity, Add to cart / Buy now / Wishlist, then Details, Shipping & returns, Reviews (write one) and Comments & questions.
- **C** opens the cart (badge shows the count). Checkout is inline: choose or add an address and a UPI id / card, then *Place order* → order-confirmed page.
- **P** is your account: details, Address, Payment, Your orders.
- **W** is the wishlist bubble (click an item to open it). **S** is Sell & support → seller login → *My products* → *Add a product* (photo → AI description → price suggestion → submit, gated by a checklist).
- Maker pages (`#artist/priya`, `#artist/meera`, …) show the portfolio and the story in English / Hindi / the maker's own language.
- Theme toggle bottom-right (light "paper" / dark "ink") with a circle-reveal transition.

## Design system

Direction **B — "Karkhana", ink on paper**, in its minimal form: paper `#F6F5F0`, ink `#111`, one marigold accent `#E2A100` reserved for the next action; rounded corners; hairline rules; tiles are photo-first with a quiet three-line caption (name · craft and place · price); hard offset shadows that lift on hover and press flat on click. Phones get a bottom navigation bar and a categories sheet. Type: Archivo (display + body), IBM Plex Mono (labels), Noto Sans Devanagari (Hindi).

## The AI features (what the real build adds)

The prototype's seller flow already shows the shape of the three AI features; the backend in `plan.md` makes them real. Every one of them works in a **fixture mode** with no API keys, and can **record** real responses as fixtures for a demo without wifi.

| Feature | What the maker does | What happens behind it |
|---|---|---|
| **Image studio** | Uploads one phone photo | Background cutout (fal.ai), composite onto the paper backdrop with a contact shadow (Pillow), then a vision QC pass (Claude) that returns retake coaching **in Hindi** — "step back so the whole saree is visible" — instead of silently failing. |
| **Voice cataloguer** | Speaks for ~20 s in their own language | Sarvam Saarika (native transcript) + Saaras (English), Claude turns it into a 14-field listing (name, description, bullets, materials, technique, size, care, category, tags, SEO, GI tag, HSN), Sarvam Mayura translates the copy to Hindi, Sarvam Bulbul **reads it back** so a low-literacy maker can confirm without reading. |
| **Pricing assistant** | Enters material cost and hours | Voyage embeddings → 12 nearest comparable pieces (kNN in Python), a state-wise wage-floor cost model, then Claude reasons to a **floor / fair / premium** band with a spoken Hindi rationale. Comparables are shown, never a bare number. Synthetic catalogue rows used for comparables are flagged and disclosed. |

Provider split: **Sarvam AI** owns language (speech, translation, speech synthesis, Indian model, 1,000 free credits with a content-hash cache so nothing is billed twice), **Claude** owns structure, vision and reasoning, hosted models for cutout and embeddings.

## Architecture (see `plan.md`)

- **Frontend**: this prototype, split into ES modules under `web/`, served by GitHub Pages on a custom domain; guest cart and wishlist stay local and merge on login.
- **Backend**: Python **FastAPI + PostgreSQL** (SQLAlchemy 2, Alembic), JWT auth with buyer email login and artisan phone OTP, orders, reviews, comments, B2B enquiries, artisan portal, uploads stored in Postgres, background jobs for the AI pipelines.
- **Hosting**: Heroku (dyno + Postgres) for the API, GitHub Pages for the site.
- **Mobile**: Expo Android app later, on the same API.

Build order: backend skeleton → frontend wiring → artisan side → deploy → AI in fixture mode → go live per key → rehearsal.

## Status

See the status board and changelog in [`progress.md`](progress.md).
