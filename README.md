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
| `plan.md` | The build plan: scope, phases, architecture, AI pipeline. |
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

Direction **B — "Karkhana", ink on paper**: paper `#F6F5F0`, ink `#111`, one marigold accent `#E2A100` reserved for the next action; rounded corners; hard offset shadows that lift on hover and press flat on click. Type: Archivo (display + body), IBM Plex Mono (labels), Noto Sans Devanagari (Hindi).

## Planned architecture (see `plan.md`)

- **Web**: Next.js 16, Prisma 5, PostgreSQL — buyer storefront + artisan portal (dashboard, products, orders, profile/KYC).
- **AI**: Sarvam AI for Indian-language speech-to-text, translation and text-to-speech; Claude for structured listing JSON, photo quality checks and price reasoning. Fixtures mode during UI work, content-hash cache so nothing is billed twice.
- **Mobile**: Expo (Android first) with phone-OTP login, after the web app and AI features are in place.

## Status

See the status board and changelog in [`progress.md`](progress.md).
