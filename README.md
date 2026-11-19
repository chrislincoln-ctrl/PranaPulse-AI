# PranaPulse AI — Urban Air Quality & Winter Smog Assistant

> Built for **Hack2skill x Google for Developers — PromptWars Virtual Challenge 06 ("Urban Air Quality Assistant")** using **Google Antigravity**.

## Architecture Principle

**Deterministic code calculates; Gemini Flash explains and personalizes.**

1. **Multi-Standard Atmospheric Telemetry**: Computes India CPCB NAQI (6 statutory pollutants), tightened US-EPA 2024 AQI, WHO 2021 guideline multiples, and Berkeley Earth cigarette equivalents in `src/domain/aqiStandards.ts`. Cross-checks Open-Meteo telemetry against optional physical WAQI ground monitors (`> 50` AQI delta safety bias) and optional NASA FIRMS 500 km fire plumes (`Seasonal Baseline Model` fallback when unconfigured).
2. **Thermal Inversion & Safe Ventilation Windows**: Evaluates Planetary Boundary Layer (PBL) ventilation coefficient ($\text{PBL m} \times \text{Wind m/s}$) in `src/domain/inversionModel.ts` to separate radiative trapping hours from afternoon solar breakup cross-ventilation windows.
3. **24-Hour Indoor Mass-Balance & CADR Sizing**: Solves a 24-hour exponential infiltration + decay ODE (`src/domain/indoorMassBalance.ts`) for 4.8 ACH purifier CADR sizing, Corsi-Rosenthal MERV-13 DIY alternatives, and explicit warnings against ozone ionizers / houseplant filtration myths (`PMC7749091`).
4. **Inhaled Dose Paradox & Dijkstra Clean Corridors**: Compares pulmonary inhaled dose across 7 transit modes (`src/domain/commutePareto.ts`, `PMC5679559` minute-ventilation effect) and computes lowest-cumulative-PM2.5 routes vs direct arterial roads (`src/domain/cleanCorridorRouter.ts`).
5. **Multilingual Family & RWA Coordinator (`EN / HI / TA`)**: Supports 1-to-6 member family vulnerability rosters, neighborhood RWA collective savings simulations (`src/domain/communityImpact.ts`), 1-click RWA notice copy/print, and grounded SSE Q&A (`POST /api/assistant/stream`).

## Local Development

```bash
npm install
cp .env.example .env   # Optionally set GEMINI_API_KEY (falls back deterministically when blank)
npm run dev            # Runs Express 5 API + SSR/dev handler on http://127.0.0.1:8080
npm run dev:client     # Runs Vite frontend dev server with API proxy on http://127.0.0.1:5173
```

## Vercel Production Deployment

`vercel.json` and `api/index.ts` configure zero-config deployment on Vercel:
1. Import this single-branch (`main`) GitHub repository in Vercel (`Framework Preset: Vite`, `Build Command: npm run build`, `Output Directory: dist`).
2. Add Environment Variables in Vercel Project Settings:
   - `GEMINI_API_KEY`: Your Google AI Studio key (enables live Gemini Flash JSON synthesis & SSE streaming; app degrades seamlessly to localized deterministic guidance when omitted or rate-limited).
   - `WAQI_API_TOKEN` *(optional)*: Enables live physical monitoring station cross-checks.
   - `NASA_FIRMS_MAP_KEY` *(optional)*: Enables live VIIRS 500 km active fire plume detections.
3. Deploy — `/api/(.*)` routes to serverless `api/index.ts` while all SPA paths serve strict CSP headers.

## Quality & Security Verification

```bash
npm run format:check   # Prettier style compliance
npm run typecheck      # Strict TypeScript compiler (0 errors)
npm run lint           # ESLint strictTypeChecked + jsx-a11y strict + complexity <= 8
npm run check:dup      # jscpd zero code duplication across src/server/api
npm run test:coverage  # Vitest + Testing Library + axe-core + V8 coverage
npm run test:e2e       # Vite build + server bundle + Chromium E2E + @axe-core/playwright WCAG 2.2 AA
npm run test:mutation  # StrykerJS mutation testing over core atmospheric/exposure engines
npm run check:repo-size # Verifies single-branch repo size stays safely under 10 MB limit
```
