# AGENTS.md — SPŠ Trutnov web

Instructions for AI coding agents (and humans) working in this repository.

## Stack

Astro 7 (`output: "server"`) on Cloudflare Workers, EmDash CMS (database in a SQLite Durable Object,
media in R2), pnpm 10, TypeScript. Czech-language site; code comments in English.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm dev                     # http://localhost:4321
pnpm typecheck               # astro check — must be 0 errors
pnpm lint:tokens             # no hard-coded design values outside src/styles/tokens.css
pnpm build
pnpm test:e2e                # Playwright + axe (builds and starts `astro preview` itself)
BASE_URL=https://… pnpm test:e2e   # against a deployed site
pnpm critique                # Impeccable design critique → reports/critique.json
```

Run `typecheck`, `lint:tokens` and the e2e suite before every commit that touches `src/`.

## Rules

- **Design tokens only.** Colours, sizes, spacing, durations and breakpoints come from
  `src/styles/tokens.css`. Breakpoints are only `48rem` and `75rem`. The token lint enforces this.
- **Body text ≥ 16 px** on every viewport; no horizontal scroll from 320 px up (tests check both).
- **All content goes through `src/lib/cms.ts`.** Pages never call EmDash directly; the layer falls back
  to `seed/seed.json` when the CMS is empty or failing (and logs why).
- **Schema/content changes:** edit `scripts/build-seed.mjs`, run `node scripts/build-seed.mjs`, and add a
  numbered, idempotent migration to `src/lib/migrations.ts` so the live CMS gets the change. Never edit
  `seed/seed.json` by hand.
- **Never render CMS strings as HTML.** Use Astro's escaping; JSON-LD goes through `jsonLd()` in
  `src/lib/json-ld.ts`; search snippets through `safeSnippet()`.
- **Security headers and CSP** are set in `src/middleware.ts`. Inline scripts are allowed by hash
  automatically; do not add inline event handlers (`onclick=`) or third-party scripts without updating
  the CSP.
- **Moving content** (autoplay, marquees, canvas) must stop with `prefers-reduced-motion` and with the
  site-wide `data-motion="paused"` toggle.
- **Secrets** live in Wrangler secrets / environment variables, never in the repo or in output.
- Legacy URLs of the old site are redirected in `src/middleware.ts`; old documents are served from R2
  under `/phocadownloadpap/…` (`scripts/mirror-legacy-files.mjs`).

## Layout

```
src/lib/cms.ts          data layer (EmDash → view models, seed fallback, Czech typography)
src/lib/migrations.ts   live-CMS migrations (auto-run, marker in EmDash `options`)
src/middleware.ts       https, redirects, security headers/CSP, noindex, /admin gate
src/pages/              routes; /admin/* requires an EmDash login
scripts/                build-seed, check-tokens, critique, optimize-media, mirror-legacy-files, build-icons
tests/                  Playwright e2e + axe
docs/                   audit checklist and audit report
```

## Deploy

`pnpm deploy` (= `astro build && wrangler deploy`) with `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` in the environment. Pending CMS migrations run automatically after deploy.
