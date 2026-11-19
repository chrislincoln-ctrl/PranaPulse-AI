# Security Architecture & Threat Controls

PranaPulse AI implements defense-in-depth controls aligned with OWASP Top 10 / CWE best practices for GenAI web applications:

1. **Strict Secret Isolation (`server/env.ts`)**:
   - `GEMINI_API_KEY`, `WAQI_API_TOKEN`, and `NASA_FIRMS_MAP_KEY` are read solely in backend server runtime and never exposed via `VITE_*` client variables or serialized into API payloads.
   - `.gitignore` excludes `.env`, `.env.*` (except template `.env.example`), local build caches, and diagnostic reports.
2. **HTTP Hardening & Strict Content Security Policy (`vercel.json`, `server/app.ts`)**:
   - Helmet configures `default-src 'self'`, `script-src 'self'`, `style-src 'self'`, `img-src 'self' data:`, `font-src 'self'`, `connect-src 'self'`, `frame-ancestors 'none'`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and scoped `Permissions-Policy`.
   - JSON request payloads are capped strictly at `16kb` (`413 Payload Too Large` on oversized bodies), with sanitized CWE-209 error responses (no stack traces or secrets returned).
   - Fixed upstream `fetch` calls enforce `6,000 ms` `AbortController` timeouts with hardcoded base URLs (preventing SSRF).
3. **Input Validation & Geolocation Privacy (`src/utils/inputSanitizer.ts`, `src/validators/schemas.ts`)**:
   - Every `/api/geocode`, `/api/telemetry`, `/api/plan`, and `/api/assistant/stream` request is validated through strict Zod v4 schemas.
   - Client and server quantize all latitude/longitude coordinates to 2 decimal places (`~1.1 km` resolution) before caching, logging, or sending upstream queries.
   - `sanitizeUserText` strips HTML/XML tags, ASCII control characters (`0x00-0x1F`, `0x7F`), and known prompt-injection directives before wrapping untrusted prompts in XML `<user_query>` tags separated from `<verified_physics_telemetry>`.
4. **Post-LLM Grounding & Rate Limiting (`server/services/geminiAdvisor.ts`, `server/services/cacheAndLimiter.ts`)**:
   - Gemini responses are constrained to strict JSON `responseSchema`, validated via `aiPlanOutputSchema`, and numerically checked (`verifyNumericGrounding`) to catch AQI figure hallucinations outside a +/-35 tolerance before falling back deterministically.
   - Bounded LRU caches (`250` entries max) and sliding-window rate limiters protect `/api/telemetry` (`60 req/min`) and AI endpoints (`10 req/min`).
5. **Supply Chain Hygiene**:
   - `npm audit --omit=dev` verified **0 vulnerabilities**.

