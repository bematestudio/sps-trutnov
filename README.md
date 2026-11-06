# SPŠ Trutnov — web

Nový web Střední průmyslové školy, Trutnov, Školní 101 (náhrada za www.spstrutnov.cz).

| Vrstva | Technologie |
| --- | --- |
| Framework | **Astro 7.4** (`output: "server"`) |
| Hosting / runtime | **Cloudflare Workers** (`@astrojs/cloudflare` 14.4, Wrangler 4.157) |
| CMS | **EmDash 1.4** — Astro-native CMS, data v **D1**, média v **R2**, administrace na `/_emdash/admin` |
| Písmo | Inter (jediné písmo webu, self-hosted, `@fontsource-variable/inter`) |
| Testy | Playwright 1.64 + axe-core, Impeccable 4.8 (design critique) |

## Rychlý start

```bash
pnpm install
pnpm dev                 # http://localhost:4321
```

Při prvním požadavku EmDash spustí migrace a založí schéma ze `seed/seed.json`.
Ukázkový obsah (novinky, obory, stránky, lidé…) se do lokální databáze nahraje přes
`http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`
(jen v dev režimu; na produkci jej nabídne průvodce nastavením v `/_emdash/admin`).

> Web nikdy nezobrazí prázdné stránky: dokud CMS není nastavené, `src/lib/cms.ts`
> čte stejný obsah přímo z přibaleného seedu.

## Architektura

```
seed/                 schéma + obsah pro EmDash (generuje scripts/build-seed.mjs)
src/lib/cms.ts        jediná datová vrstva: EmDash → normalizované view-modely (fallback na seed)
src/styles/tokens.css JEDINÉ místo se surovými hodnotami (barvy, typografie, mezery, pohyb)
src/styles/*.css      reset, layout primitives, komponenty, motion (vše přes tokeny)
src/layouts/          Base (head, téma, loader, header/footer), AdminLayout
src/components/       Header s mega-menu, Footer, karty, formuláře, SignalField (canvas)
src/pages/            veřejné stránky, /admin (UI bez backendu), /api/contact
tests/                Playwright e2e + a11y
scripts/              build-seed, check-tokens (lint), critique (Impeccable)
```

### Kolekce v EmDash

`posts` (Novinky, taxonomie `category` + `tag`), `pages` (obecné stránky sekcí O škole / Studium /
Kontakty / Více), `programs` (obory), `events`, `people`, `workplaces`, `faq`, `documents`, `partners`.
Menu `primary` řídí hlavní navigaci i patičku.

Obsah se upravuje v `/_emdash/admin`. Po změně schématu v `scripts/build-seed.mjs` spusťte
`node scripts/build-seed.mjs`.

## Design systém

Inspirace: technická, „švýcarská“ estetika (mřížka, hairline linky, čtvercové značky, křížky v rozích,
monospace štítky, obří wordmark v patičce) — převedená do světlého, čitelného školního webu.

* **Barvy:** primitivní paleta → sémantické tokeny (`--color-bg`, `--color-text`, `--color-accent`…).
  Tmavý režim jen přemapuje sémantické tokeny (`:root[data-theme="dark"]`).
* **Typografie:** jediné písmo Inter (štítky s tabulkovými číslicemi místo monospace); 6 kroků fluidní škály (`--text-xs` … `--text-3xl`) + `--text-display` pro wordmark.
  Běžný text nikdy pod 16 px (ověřuje test).
* **Rytmus:** `--gutter`, `--section-space`, `--stack-space`, `--grid-gap` (vše `clamp()`).
* **Breakpointy:** pouze `48rem` a `75rem`; zbytek je fluidní / `auto-fit` mřížky.
* **Pohyb:** `--duration-*`, `--ease-*`, `--stagger`; `prefers-reduced-motion` je vynuluje.

`pnpm lint:tokens` selže, pokud se mimo `tokens.css` objeví hex/rgb barva, `px`, doslovná délka
animace, `font-size` bez tokenu nebo jiný breakpoint.

### Interakce

* Nativní **cross-document View Transitions** (přechody stránek bez JS frameworku), prefetch na hover.
* Úvodní **loader** jen při první návštěvě v relaci; navigační progress bar.
* **Přepínač světlý/tmavý režim** s kruhovým odhalením z tlačítka; pamatuje si volbu, respektuje OS;
  `?theme=dark|light` v URL.
* Reveal animace při scrollu, rozdělení nadpisů na řádky, počítadla čísel, posuvné šipky v tlačítkách,
  hover stavy karet, marquee partnerů, lightbox galerie, kopírování kontaktů do schránky, toasty.

## Administrace (`/prihlaseni`, `/admin`)

Frontendové rozhraní pro zaměstnance — přehled, novinky + editor, akce, dokumenty, lidé, nastavení.
`/admin/*` je dostupné jen po přihlášení do EmDash CMS (`/prihlaseni` → přihlášení passkey/e-mailem).
Seznamy čtou živý obsah z EmDash; úpravy v tomto rozhraní se zatím ukládají jen do prohlížeče
(rozhraní to uvádí) — skutečná správa obsahu běží v `/_emdash/admin`.
Kontaktní formulář nic neposílá na server: po validaci otevře e-mail s předvyplněnou zprávou na
skola@spstrutnov.cz (až škola zvolí e-mailovou službu, lze přepnout na odesílání z webu).

## Zabezpečení a SEO (`src/middleware.ts`)

HTTPS + `www` přesměrování, 301 mapa starých URL, CSP s hashi inline skriptů, HSTS, COOP, `nosniff`,
`X-Robots-Tag: noindex` na všech hostech kromě www.spstrutnov.cz, vlastní `robots.txt` a `sitemap.xml`,
`/.well-known/security.txt`. Dokumenty starého webu jsou zrcadlené v R2 a dostupné na původních adresách
`/phocadownloadpap/…` (`scripts/mirror-legacy-files.mjs`).

## Výkon

* **Cache HTML** (`src/lib/html-cache.ts`): anonymní návštěvy dostanou stránku z cache (paměť izolátu +
  Cache API); po 60 s se stránka obnoví na pozadí, nejstarší podávaná kopie má 10 min. Kontrola cache
  běží v `src/worker.ts` ještě před načtením Astro/EmDash. Klíč obsahuje ID buildu, takže po nasazení
  se nikdy nepodá HTML odkazující na staré soubory. Přihlášení (jakákoli cookie) cache obcházejí.
* **Cache dat CMS** v paměti izolátu (60 s) — `src/lib/cms.ts`.
* **Smart Placement** (`wrangler.jsonc`): Worker běží u databáze (jeden Durable Object), takže
  ~10 dotazů na stránku nejde přes oceán.
* Změny v CMS se tak na webu projeví do ~1–2 minut.
* **Vše běží v Evropě:** databáze CMS je instance Durable Objectu `emdash-eu` založená
  s `locationHint: "weur"` (západní/střední Evropa), média, dokumenty a session jsou v R2 bucketech
  v **jurisdikci EU** (`sps-trutnov-media-eu`, `sps-trutnov-sessions-eu`, umístění EEUR) a Worker díky
  Smart Placement běží u databáze. Původní instance `emdash` (USA) byla po ověřeném přesunu
  vyprázdněna a buckety v USA smazány (6. 11. 2026). Kopírování mezi buckety: `scripts/copy-r2-bucket.mjs`.

## Fotky (AVIF / WebP)

* **Fotky přibalené k webu** (`public/images/foto`, z původního webu) jsou v AVIF + WebP ve více šířkách,
  komponenta `<Photo>` je servíruje přes `<picture>` se `srcset`.
* **Fotky nahrané do CMS** (R2 bucket `sps-trutnov-media`) převádí `pnpm optimize:media` na AVIF + WebP
  v šířkách 480/720/960/1600 px do `opt/…`. Web je servíruje přes `/media/opt/…` (`<CmsImage>`);
  dokud fotka převedená není, automaticky se použije originál. Po nahrání nových fotek spusťte:

```bash
CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… pnpm optimize:media
```

## Migrace obsahu v živém CMS

EmDash aplikuje seed jen na prázdnou databázi. Nové části schématu/obsahu pro už nastavený web jsou
číslované idempotentní migrace v `src/lib/migrations.ts`. Po nasazení se spustí **automaticky** (po první
obsloužené žádosti, stav v tabulce `options` EmDash); stav a ruční spuštění najdete v `/admin/nastaveni`
(role administrátor), pro skripty `POST /api/maintenance/migrate` s Worker secretem `MAINTENANCE_TOKEN`.

## Kontrola kvality

```bash
pnpm typecheck           # astro check
pnpm lint:tokens         # žádné natvrdo zadané hodnoty
pnpm build && pnpm preview --port 4322 --host 127.0.0.1
pnpm test:e2e            # Playwright: všechny stránky, overflow, 16px text, téma, navigace, formuláře, axe WCAG 2.2 AA
pnpm critique            # Impeccable: 18 stránek × (světlý, tmavý, mobil) → reports/critique.json
```

Stav při odevzdání: `astro check` 0 chyb, token lint OK, `pnpm audit --prod` 0 zranitelností,
**128/128 Playwright testů** na živém webu (desktop + Pixel 7). CI: `docs/ci-workflow.yml` (zkopírovat do `.github/workflows/`).
Audit a stav oprav: `docs/audit-report-2026-11-05.md`.

## Nasazení na Cloudflare

Dev nasazení: **https://sps-trutnov.marketing-830.workers.dev**

Databáze CMS běží v **Durable Objectu se SQLite** (`EmDashDB`, binding `EMDASH_DB`, instance
`emdash-eu` v Evropě), média v R2 (`sps-trutnov-media-eu`, jurisdikce EU), Astro session pro
přihlášení do EmDash v R2 (`sps-trutnov-sessions-eu`, jurisdikce EU, mazání po 30 dnech).
Stačí tedy API token s právy *Workers Scripts* a *R2* — D1 ani KV potřeba nejsou.
(Až bude token mít práva na D1, lze v `astro.config.mjs` přepnout na `d1({ binding: "DB" })`.)

```bash
npx wrangler r2 bucket create sps-trutnov-media-eu --jurisdiction eu
npx wrangler r2 bucket create sps-trutnov-sessions-eu --jurisdiction eu
pnpm deploy                                 # astro build && wrangler deploy
```

Po nasazení otevřete `/_emdash/admin`, dokončete průvodce (vč. „ukázkového obsahu“) a vytvořte účty
editorů. Dokud průvodce není dokončen, web zobrazuje obsah z přibaleného seedu.
Typy prostředí: `npx wrangler types --include-runtime=false`.
