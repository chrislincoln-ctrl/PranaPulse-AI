# PranaPulse AI — Urban Air Quality & Winter Smog Assistant

> Built for **Hack2skill x Google for Developers — PromptWars Virtual Challenge 06 ("Urban Air Quality Assistant")** using **Google Antigravity**.  
> **Live Production App:** [https://pranapulseai.vercel.app/](https://pranapulseai.vercel.app/)

---

## Core Architecture Principle

**Deterministic atmospheric & exposure physics calculates; Gemini / Groq AI explains, personalizes, and translates natural human intent into live multi-channel control.**

Every numeric reading (CPCB NAQI, US-EPA 2024 AQI, WHO 2021 multiples, cigarette equivalents, Planetary Boundary Layer mixing height, indoor CADR mass balance, pulmonary inhaled dose, and RWA collective savings) is computed deterministically from verified live sensor/satellite APIs before AI ever touches a sentence.

---

## Verified Live Data Sources (Zero Static Mock Data)

1. **OpenAQ v3 & WAQI Ground Monitors** (`openaq.org`, `aqicn.org`): Live CPCB NAQI (6 statutory pollutants: PM2.5, PM10, NO2, O3, SO2, CO) and US-EPA 2024 AQI with conservative safety-ceiling cross-checks when physical monitors read higher than satellite grids (`> 35` AQI delta).
2. **Open-Meteo Atmospheric & Weather Grids** (`open-meteo.com`): 24-hour Planetary Boundary Layer (PBL) height, surface wind velocity, relative humidity, and solar inversion breakup windows.
3. **NASA FIRMS Orbital Fire Plumes** (`firms.modaps.eosdis.nasa.gov`): Live 500 km VIIRS/MODIS biomass-burning hotspot counts feeding early winter-smog transport alerts (with transparent seasonal baseline fallback when unconfigured).
4. **OpenStreetMap Nominatim GPS** (`openstreetmap.org`): Street-level reverse geocoding quantized to 2 decimal places (`~1.1 km`) for residential privacy.

---

## 6-Module Interactive Workbench & Multi-Channel Ecosystem

- **1. Dashboard (Live Atmospheric Telemetry):** Concentric CPCB/US-EPA radial gauge, 6-pollutant spectrum bar, 24h PM2.5 vs PBL inversion SVG chart + accessible data table, safest airing window brief, and 1-tap GPS detection.
- **2. Family Routine (1–6 Member Care Roster):** Per-member vulnerability profiles (child, senior/respiratory, adult commuter, caregiver), pulmonary inhaled dose budgets ($\mu\text{g/day}$ & cigarette equivalents), individualized daily schedules (with 1-tap **WhatsApp Brief** sharing & preview), and expandable **Customize daily habits** editor that auto-calculates `Outdoor hrs/day` from leave/return times.
- **3. Indoor & CADR Clearance:** 24-hour exponential infiltration & decay mass-balance ODE (`src/domain/indoorMassBalance.ts`) for 4.8 ACH HEPA purifier sizing, DIY MERV-13 Corsi-Rosenthal alternatives, cooking fuel impact, and evidence-backed warnings against ozone ionizers & houseplant myths (`PMC7749091`).
- **4. Commute & Route:** Pulmonary inhaled dose paradox across 7 transit modes (`src/domain/commutePareto.ts`, `PMC5679559` minute-ventilation scaling) + Dijkstra lowest-cumulative-PM2.5 corridor routing with Google Maps links.
- **5. Masks & Purifiers:** Evidence-ranked filtration efficiency comparisons matched to live room CADR & outdoor PM2.5 with direct Amazon.in & Flipkart buying links.
- **6. RWA Community Simulator:** Collective housing-society PM2.5 & $\text{CO}_2$ savings modeling (`src/domain/communityImpact.ts`) with 1-click printable/shareable multilingual RWA notices.
- **Always-On Family Daily Companion Chat:** Floating bottom-right per-member AI chat with GPS attachment, live telemetry grounding, and direct schedule updates.
- **Full 2-Way Telegram Remote Control (`Web <-> Telegram Live Sync`):** Operate the entire website directly inside Telegram — sticky `"Who is chatting?"` family member switcher (`Change User (<Name>)` below every reply), **Gemini Structured JSON + Groq JSON multi-intent parser** that updates multiple settings in one natural message (e.g., mask + outdoor hours + commute + RWA participating homes + shared transit shift), adding/removing family members, automatic `Outdoor hrs/day` calculation from leave/return times, live GPS pins, 06:30 IST daily briefs, and real-time Supabase Storage/Postgres sync back to the browser.
- **Accessibility, Localization & Design:** WCAG 2.2 AA verified (`axe-core`, keyboard-navigable tabs, skip link, `aria-live` alerts, `44px` touch targets, `prefers-reduced-motion`), 3 full languages (**English**, **हिन्दी**, **தமிழ்**), responsive desktop & mobile (`375×812`) layouts, and AQI-reactive WebGL + CSS winter smog visuals in both **Dark** and **Light** modes.

---

## Local Development

```bash
npm install
cp .env.example .env   # Optionally set API keys (degrades gracefully to deterministic physics when blank)
npm run dev            # Runs hardened Express 5 API on http://127.0.0.1:8080
npm run dev:client     # Runs Vite frontend dev server with /api proxy on http://127.0.0.1:5173
```

---

## Vercel Production Deployment

`vercel.json` and `api/index.ts` configure zero-config deployment on Vercel:
1. Import the `main` branch in Vercel (`Framework Preset: Vite`, `Build Command: npm run build`, `Output Directory: dist`).
2. Configure Environment Variables in Vercel Project Settings:
   - `GEMINI_API_KEY` / `GROQ_API_KEY`: Enables grounded Gemini / Groq synthesis & Telegram multi-intent AI parsing.
   - `WAQI_API_TOKEN`, `OPENAQ_API_KEY`, `NASA_FIRMS_MAP_KEY` *(optional)*: Enables live physical monitor cross-checks & orbital fire hotspot tracking.
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` *(optional)*: Enables cloud auth preferences & zero-SQL bidirectional `Web <-> Telegram` workspace persistence.
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET` *(optional)*: Enables 1-click Telegram pairing, full-site remote control, and daily 06:30 IST schedule briefs.
3. Deploy — `/api/(.*)` routes to serverless `api/index.ts` while all SPA routes serve strict CSP, HSTS, X-Frame-Options, and Permissions-Policy headers.

---

## Verification & Quality Gates

```bash
npm run format:check    # Prettier formatting check across src/server/api/tests
npm run typecheck       # Strict TypeScript compiler (0 errors)
npm run lint            # ESLint strictTypeChecked + jsx-a11y strict + complexity <= 8 (0 warnings)
npm run check:dup       # jscpd zero code duplication across src/server/api (0%)
npm run test:run        # Vitest + Testing Library + axe-core WCAG 2.2 AA + API security suites
npm run build           # Code-split Vite production build (all chunks < 230 kB, 0 warnings)
npm run build:server    # esbuild ESM server bundle
npm run check:repo-size # Verifies repository size stays safely under 10 MB competition cap
```
