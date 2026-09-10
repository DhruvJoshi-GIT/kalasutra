<p align="center">
  <img src="web/img/logo-mark.png" width="72" alt="">
</p>
<h1 align="center">कलाSutra</h1>
<p align="center"><b>An AI-driven marketplace and smart-cataloguing app for marginalised Indian artisans.</b><br>
A maker photographs a piece, describes it by voice in their own language, gets a fair price, and lists it. Buyers, retail and bulk, shop a catalogue that puts the maker and the craft first.</p>

<p align="center">
  <a href="https://kalasutra.live"><b>🌐 Live site</b></a> &nbsp;·&nbsp;
  <a href="https://github.com/DhruvJoshi-GIT/kalasutra/releases/latest"><b>🤖 Android beta APK</b></a> &nbsp;·&nbsp;
  <a href="docs/progress.md"><b>📋 Build status</b></a>
</p>

> Hackathon entry for *AI-Driven Market Linkage and Smart Cataloging Mobile Application for Marginalized Artisans*.

---

## The flow

What a maker and a buyer actually do, and which part of the stack answers each step. Solid arrows are built and working today; dashed arrows are the next build step (they already run in fixture mode).

```mermaid
flowchart TD
    subgraph MAKER["🧵 Maker (phone, low literacy, own language)"]
        M1([Open the app or kalasutra.live]) --> M2[Sign in with phone + OTP]
        M2 --> M3[📷 Photograph the piece<br/>camera or gallery]
        M3 --> M4["✨ Photo studio<br/>on-device cutout · 8 backdrops · contact shadow"]
        M4 -.-> M5["🎤 Describe by voice<br/>~20 s in Hindi, Bengali, Tamil…"]
        M5 -.-> M6["🔊 Hear the listing read back<br/>क्या यह सही है?"]
        M6 -.-> M7["₹ Price band<br/>floor · fair · premium, with comparables"]
        M4 --> M8[Category + description + price]
        M7 -.-> M8
        M8 --> M9([Publish → live in the catalogue])
        M9 --> M10[My shop · orders · bulk enquiries → quote]
    end

    subgraph BUYER["🛍️ Buyer (retail or bulk)"]
        B1([Browse 82 pieces · 7 categories · 14 makers]) --> B2[Search · sort · wishlist]
        B2 --> B3[Product popup<br/>photo · details · reviews · questions]
        B3 --> B4[Cart → sign in → address → UPI / card]
        B4 --> B5([Order confirmed · Your orders])
        B3 --> B6[Meet the maker · story in EN / हिन्दी]
        B6 --> B7[Request a bulk quote]
        B7 --> M10
    end

    subgraph ENGINE["⚙️ What answers each step"]
        E1["web/ · plain JS · runs offline<br/>demo mode when the API is away"]
        E2["backend/ · FastAPI + PostgreSQL<br/>JWT · OTP · catalogue · orders · uploads"]
        E3["Studio model · @imgly/background-removal<br/>isnet_quint8 on ONNX-wasm · served from the site / bundled in the APK"]
        E4["Sarvam AI · Saarika + Saaras ASR<br/>Mayura translate · Bulbul TTS"]
        E5["Claude · 14-field listing JSON<br/>photo QC · pricing reasoning"]
        E6["Voyage embeddings → kNN comparables<br/>+ state wage-floor cost model"]
    end

    M4 --- E3
    M5 -.- E4
    M6 -.- E4
    M5 -.- E5
    M7 -.- E5
    M7 -.- E6
    M2 --- E2
    M9 --- E2
    B4 --- E2
    M1 --- E1
    B1 --- E1
```

## The system in one minute

Every box is a folder or a service you can point at. The site is the app: the same `web/` folder is served by GitHub Pages **and** packed into the Android APK, model included, so the studio works with no network and nothing to download.

```mermaid
flowchart LR
    subgraph CLIENTS["Clients"]
        WEB["🌐 <b>web/</b><br/>HTML · CSS · plain script modules<br/>hash router · guest cart · theme<br/><i>GitHub Pages → kalasutra.live</i>"]
        APK["🤖 <b>android/</b><br/>Java WebView shell (AGP 8.7, minSdk 24)<br/>web/ + model copied into the APK at build<br/>camera + gallery picker · offline"]
        DEMO["🧪 <b>web/js/demo.js</b><br/>demo mode: OTP, cart, orders, reviews,<br/>listings simulated in localStorage<br/>+ <b>catalogue.json</b> snapshot"]
        STUDIO["✨ <b>web/js/studio.js + web/vendor/bg/</b><br/>@imgly/background-removal 1.7 bundle<br/>isnet_quint8 · onnxruntime-web wasm<br/>canvas backdrops + shadow"]
    end

    subgraph API["backend/ · Python FastAPI · SQLAlchemy 2 · Alembic"]
        AUTH["auth<br/>JWT HS256 · email login<br/>phone OTP (dev code 123456)"]
        CAT["catalogue<br/>/catalogue/bootstrap · /products<br/>/makers · search incl. Hindi"]
        SHOP["commerce<br/>cart · wishlist · addresses<br/>orders · reviews · comments · enquiries"]
        SELL["seller<br/>/uploads · /files/{key}<br/>/artisan/products"]
        AIGW["AI gateway<br/>/ai/studio · /ai/cutout · /ai/enhance<br/>fixture / record / live per provider"]
    end

    DB[("🐘 PostgreSQL<br/>Neon (prod) · portable PG 17 (dev)<br/>uploads as bytea · 82 listings · 14 makers")]

    subgraph AI["AI providers (behind the gateway, fixture-first)"]
        SARVAM["Sarvam AI<br/>Saarika / Saaras ASR<br/>Mayura EN⇄HI · Bulbul TTS"]
        CLAUDE["Claude<br/>listing JSON · photo QC<br/>price reasoning"]
        VOYAGE["Voyage<br/>multimodal embeddings<br/>→ kNN comparables"]
        FAL["fal.ai BiRefNet<br/>optional server cutout"]
    end

    WEB -- "fetch + Bearer JWT" --> API
    APK -- "same web/, same API" --> API
    WEB -. "API unreachable" .-> DEMO
    APK -. "API unreachable" .-> DEMO
    WEB --- STUDIO
    APK --- STUDIO
    AUTH & CAT & SHOP & SELL --> DB
    AIGW -.-> SARVAM
    AIGW -.-> CLAUDE
    AIGW -.-> VOYAGE
    AIGW -.-> FAL
    HOST["☁️ Render (API) · Neon (DB) · GitHub Pages (site) · Name.com domain"]
    API --- HOST
```

### Tech stack at a glance

| Layer | Built with | What it does |
|---|---|---|
| Site `web/` | HTML, CSS, plain JavaScript (no build step) | Storefront, seller flow, photo studio, offline demo mode |
| Android `android/` | Java, WebView + `WebViewAssetLoader`, Gradle 8.11, AGP 8.7 | Installable app with the whole site and the studio model inside the APK |
| Photo studio | `@imgly/background-removal`, ONNX Runtime Web, Canvas | On-device cutout, backdrops, shadow: free, nothing uploaded |
| API `backend/` | Python 3.13, FastAPI, SQLAlchemy 2, Alembic, PyJWT, Pillow | Auth, catalogue, orders, uploads, seller listings, AI gateway |
| Database | PostgreSQL 17 (Neon in production, portable locally) | Everything including uploaded files (bytea) |
| Language AI | Sarvam AI (Saarika, Saaras, Mayura, Bulbul) | Indic speech to text, translation, read-back |
| Structure AI | Claude | Schema-constrained listing, photo QC, pricing rationale |
| Retrieval | Voyage embeddings, numpy kNN | Comparable pieces for the price band |
| Hosting | GitHub Pages, Render, Neon, Name.com | kalasutra.live, api.kalasutra.live |
| Testing | pytest, Playwright on Edge | 16 API tests; 140 screenshots across 7 viewports; real-click flows |

## Run it

```bash
# Site only: open web/index.html, or serve the repo root with any static server.

# API + site on http://127.0.0.1:8000 (PostgreSQL required; see docs/progress.md → How to run)
cd backend && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
.venv/Scripts/alembic upgrade head && .venv/Scripts/python scripts/seed.py
.venv/Scripts/python -m uvicorn app.main:app --port 8000

# Android beta APK (needs JDK 17 + Android SDK platform 35 / build-tools 35; set sdk.dir in android/local.properties)
cd android && ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

Demo logins: maker `9811000001` with code `123456` · buyer `demo@kalasutra.in` / `password123`.

## Status

The site is live with HTTPS, 82 listings, phone layouts down to 280 px, and the free on-device photo studio. The Android beta wraps the same site with the model bundled. The API runs locally with tests green and deploys to Render + Neon via `render.yaml`; until it is deployed the public site and the app run in demo mode. Next: the voice cataloguer and the pricing assistant in fixture mode. Details and the changelog live in `docs/progress.md`.

<br><br>

<p align="right"><sub>
<details>
<summary>📄 docs/</summary>
<sub>
<a href="docs/progress.md">progress.md</a> — the running build log and hand-off &nbsp;·&nbsp;
<a href="docs/plan.md">plan.md</a> — the build plan (v2: FastAPI + web/ + AI pipelines) &nbsp;·&nbsp;
<a href="docs/decisions.md">decisions.md</a> — append-only log of every decision and why &nbsp;·&nbsp;
<a href="docs/api-notes.md">api-notes.md</a> — verified endpoint shapes &nbsp;·&nbsp;
<a href="docs/findings.md">findings.md</a> — audit of the original Next.js base &nbsp;·&nbsp;
<a href="docs/plan-v1-nextjs.md">plan-v1-nextjs.md</a> — the earlier Next.js plan
</sub>
</details>
</sub></p>
