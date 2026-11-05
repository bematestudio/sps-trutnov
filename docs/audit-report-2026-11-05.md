# Audit report — SPŠ Trutnov web (2026-11-05)

Audit podle `docs/AUDIT.md` (Bemate Studio Web & App Quality Audit v1.0), postup dle Appendix C: **read-only** — kód
ani nastavení se v rámci auditu neměnily, opravy jsou navržené k samostatnému schválení.

* **Prostředí:** https://sps-trutnov.marketing-830.workers.dev (Cloudflare Workers, verze `5c00385a`), repo větev `claude/lucid-lamport-tr1rwe` @ `HEAD`.
* **Typ projektu:** [WEB] s CMS administrací (EmDash) — částečně [APP] (přihlášení editorů).
* **Stack:** Astro 7.4.5, @astrojs/cloudflare 14.4.4, EmDash 1.4.0 (Durable Object SQLite + R2), Wrangler 4.157, Node 22.23, pnpm 10.28.
* **Neaplikovatelné sekce:** §3 Supabase, §4 Vercel/Next.js (stack je Astro + Cloudflare), §6 e-mail (web zatím nic neodesílá), §7 AI funkce (žádné).

## Souhrn

| | Počet |
|---|---|
| 🔴 P0 otevřené | **7** |
| 🟠 P1 otevřené | **17** |
| 🟡 P2 otevřené | **6** |
| ✅ Ověřeno jako splněné (s důkazem) | 24 |
| ❔ NOT VERIFIED / manuální | viz checklist níže |

**Doporučení: NO-GO pro přepnutí DNS spstrutnov.cz.** Jako náhledový (preview) web je v pořádku. Blokující jsou hlavně
neověřený obsah a právní texty (§1.3), chybějící přesměrování ze starého webu (§20.1), indexovatelný staging (§11.1)
a kontaktní formulář, který potvrzuje odeslání, ale zprávu nikam nedoručí (§2.5).

## Stav po opravách (2026-11-05, nasazená verze `482eaec4`)

Opravy schválené zadavatelem („Yes made all fixes“) jsou nasazené na https://sps-trutnov.marketing-830.workers.dev a
ověřené: **128/128 Playwright testů na živém webu** (desktop + Pixel 7, vč. axe WCAG 2.2 AA, 320 px, hlaviček,
přesměrování a sitemapy), Impeccable 0 nálezů, Lighthouse mobil výkon 98 / přístupnost 100 / best practices 100 (SEO 69 jen kvůli záměrnému noindex na workers.dev), `astro check` 0 chyb, token lint OK, `pnpm audit --prod` 0 zranitelností.

| ID | Stav | Co se udělalo / co zbývá |
|---|---|---|
| F01 | 🟡 částečně | Lidé (66) a dokumenty (194) převzaty ze skutečného starého webu, soubory zrcadleny do R2 (`/phocadownloadpap/…`, staré odkazy fungují i po přepnutí DNS); „dobře placený“ a smyšlený trend v adminu odstraněny; ZPA bez neověřeného odkazu. **Zbývá škole:** zkontrolovat lidi, popisy videí a texty novinek v CMS. |
| F02 | 🟡 částečně | GDPR stránka přepsána podle školního dokumentu „Základní informace o zpracování osobních údajů“ (správce, pověřenec CIRI, práva) + skutečné chování webu (úložiště, YouTube, Cloudflare, formulář); prohlášení o přístupnosti ve struktuře zákona 99/2019 Sb. **Zbývá škole:** schválení pověřencem. |
| F03 | ✅ | `X-Robots-Tag: noindex, nofollow` na všech hostech kromě www.spstrutnov.cz; `robots.txt` mimo produkci `Disallow: /`. |
| F04 | ✅ | 301 mapa v `src/middleware.ts` (novinky/kategorie, kontakty, `component/contact`, `ke-stazeni/*`, `?download=` odkazy, galerie, `index.php`); 8 chybějících stránek doplněno do CMS. **Doporučeno:** po spuštění projít 404 v Search Console. |
| F05 | ✅ | Formulář už nic nepředstírá: otevře e-mail s předvyplněnou zprávou na skola@spstrutnov.cz; `/api/contact` odstraněno. **Zbývá škole:** rozhodnout o e-mailové službě, pokud chce odesílání přímo z webu. |
| F06 | 🟡 částečně | Strukturované logy chyb (5xx, výjimky, fallback CMS → seed, migrace) do Workers Observability. **Zbývá:** alerty (Cloudflare Notifications / Sentry) — vyžaduje účet a příjemce. |
| F07 | 🟡 částečně | Worker přesměruje `http→https` a `spstrutnov.cz→www` (301), posílá HSTS. **Zbývá:** na zóně spstrutnov.cz zapnout Always Use HTTPS (workers.dev to neumožňuje). |
| F08 | ✅ | CSP s hashi inline skriptů (bez `unsafe-inline` pro skripty), HSTS, COOP, frame-ancestors; test hlídá i konzoli na porušení CSP. |
| F09 | ✅ | `pnpm.overrides` zod → 4.6.7 (0 zranitelností), `minimumReleaseAge` 3 dny, Renovate. |
| F10 | ✅ | `safeSnippet()` (povolen jen `<mark>`), `jsonLd()` escapuje `<`, ⌘K povoluje jen relativní a http(s) odkazy. |
| F11 | ✅ | Vlastní `/sitemap.xml` (statické stránky + CMS ve správném tvaru, host www.spstrutnov.cz); `sitemap-*.xml` → 301. |
| F12 | ✅ | Jediný description/canonical (z EmDashHead); titulek úvodu „SPŠ Trutnov — Střední průmyslová škola: elektrotechnika, IT a strojírenství“. |
| F13 | ✅ | Výchozí OG obrázek 1200×630 (`/og-default.png`), `summary_large_image`. |
| F14 | ✅ | `favicon.ico`, `apple-touch-icon.png`, ikony 192/512 + maskable, `manifest.webmanifest`. |
| F15 | ✅ | `EducationalOrganization` JSON-LD na úvodu, `Event` na stránce Den otevřených dveří. |
| F16 | ✅ | Logo v liště se na nejužších displejích zmenší, dlouhé štítky se zalomí; test 320 px. |
| F17 | ✅ | Tlačítko „Pozastavit animace“ v patičce i u partnerů (pamatuje si volbu), pauza u autoplay slideru, canvas i diagram se zastaví. |
| F18 | ✅ | Náhledy videí přes vlastní `/media/yt/…` (cache na edge); Google dostane data až po kliknutí. |
| F19 | ✅ | `czTypo()` (příloha B.8) na všechny texty z CMS vč. Portable Text. |
| F20 | ✅ | `/admin/*` vyžaduje přihlášení do EmDash CMS (role ≥ přispěvatel); falešné přihlášení odstraněno, admin ukazuje skutečného uživatele a umí se odhlásit. |
| F21 | ✅ | `AGENTS.md`. |
| F22 | 🟡 částečně | `docs/ci-workflow.yml` → zkopírovat do `.github/workflows/ci.yml` (audit, typecheck, token lint, build, Playwright + axe; akce pinované na SHA). **Zbývá:** přidat soubor do `.github/workflows/` (push vyžaduje oprávnění „workflow“) a ochrana větve `main`. |
| F23 | ✅ | `<caption>` u všech tabulek. |
| F24 | ❔ | Rozsah tokenu nelze ověřit. **Doporučeno:** pro produkci vytvořit token jen na tento Worker + 3 buckety. |
| F25 | ✅ | `/.well-known/security.txt` (Expires 2027-11-05). |
| F26 | 🟡 | `robots.txt` pro produkci: vyhledávače a AI vyhledávání ano, trénovací crawleři ne (+ Content-Signal). **Zbývá škole:** potvrdit rozhodnutí a sladit s Cloudflare AI Crawl Control. |
| F27 | ✅ | Fallback na seed se loguje (jednou za izolát a důvod). |
| F28 | ✅ | `window.spsToast` typované, `as any` zbývá jen v datové vrstvě (typy EmDash). |
| F29 | ✅ | Cache hotového HTML pro anonymní návštěvy (paměť izolátu + Cache API, 60 s + obnova na pozadí, klíč obsahuje ID buildu), cache dat CMS v paměti, Smart Placement (Worker běží u databáze), líné načítání aplikace (studený start). Medián TTFB 0,3 s (dříve 1,3–1,7 s), Lighthouse mobil výkon 99. Změny v CMS se na webu projeví do ~1–2 minut. **Doporučeno:** produkční databázi založit s umístěním v Evropě (viz README). |
| F30 | ⏳ | Po přepnutí domény. |

**Aktualizované doporučení: GO pro přepnutí DNS po splnění 4 bodů školy** — kontrola obsahu v CMS (F01), schválení
GDPR a prohlášení o přístupnosti (F02), Always Use HTTPS na zóně (F07) a nastavení alertů (F06).

## Nálezy (nejzávažnější první)

| ID | Sev. | § | Nález | Důkaz | Navržená oprava |
|---|---|---|---|---|---|
| F01 | 🔴 P0 | 1.3, 13 | **Neověřená / AI doplněná fakta v obsahu.** E-maily zaměstnanců jsou odvozené vzorem `prijmeni@spstrutnov.cz` (starý web je skrývá), telefony pedagogů jsou čísla pracovišť, seznam dokumentů ke stažení má vymyšlené velikosti a všechny odkazy vedou na obecnou stránku `/ke-stazeni` starého webu, URL partnerů jsou odhadnuté, popisy videí a některá tvrzení napsala AI (např. „Náročný a dobře placený řemeslný obor“). V ukázkové administraci je smyšlený trend „+4 tento měsíc“. | `scripts/build-seed.mjs:561` (lidé), `:688–709` (dokumenty, `file_url: ${LEGACY}/ke-stazeni`), `:713` (partneři), `:730` (videa), `:281`; `src/pages/admin/index.astro:15` | Škola zkontroluje a opraví v CMS: lidé (e-maily, telefony), dokumenty (nahrát skutečné soubory), partneři, popisy. Smyšlený trend odstranit. |
| F02 | 🔴 P0 | 1.3, 8.2, 8.5 | **Právní texty vygenerované a nerevidované.** `/ochrana-osobnich-udaju` a `/pristupnost` napsala AI. Škola je veřejný subjekt → zákon 99/2019 Sb. vyžaduje prohlášení o přístupnosti v předepsané struktuře (vyhl. 515/2020 Sb.); GDPR informace musí popisovat skutečné zpracování (Cloudflare, YouTube, EmDash). | `src/pages/ochrana-osobnich-udaju.astro`, `src/pages/pristupnost.astro` | Texty dodá/schválí pověřenec pro ochranu osobních údajů školy; prohlášení o přístupnosti podle vzoru vyhlášky. |
| F03 | 🔴 P0 | 11.1 | **Staging je indexovatelný.** `*.workers.dev` nevrací `X-Robots-Tag: noindex`, `robots.txt` má `Allow: /` a sitemapu na workers.dev. (Kanonické URL míří na www.spstrutnov.cz, což riziko jen zmírňuje.) | `curl -sI …workers.dev/` → žádný `x-robots-tag`; `curl …/robots.txt` → `Allow: /` | Middleware: na jiném hostu než produkčním přidat `X-Robots-Tag: noindex, nofollow` a v robots `Disallow: /`. |
| F04 | 🔴 P0 | 20.1, 11.1 | **Chybí mapa přesměrování ze starého webu + část obsahu nemigrována.** 13 ze 17 testovaných starých URL vrací 404, např. `/novinky/sport/<slug>`, `/novinky/souteze`, `/kontakty/sidlo-a-pracoviste`, `/o-skole/nadacni-fond`, `/o-skole/fakultni-skola`, `/o-skole/liga-vyjimecnych`, `/o-skole/o-nas-v-mediich`, `/o-skole/o-skole-projekty`, `/o-skole/informacni-zpravodaje`, `/o-skole/certifikaty-akreditace-clenstvi-a-programy`, `/vice/odkazy`, `/ke-stazeni/formulare`. | `curl -w '%{http_code}'` na seznam URL (viz evidence níže) | 301 mapa (vzory: `/novinky/<kategorie>/<slug>` → `/novinky/<slug>`, `/novinky/<kategorie>` → `/novinky?kategorie=…`, `/kontakty/sidlo-a-pracoviste` → `/kontakty`); dopsat chybějící stránky do CMS. Mapu doplnit z Search Console (top stránky) a ze sitemapy starého webu. |
| F05 | 🔴 P0 | 2.5, 13 | **Kontaktní formulář neodesílá, ale tvrdí opak.** Endpoint data jen validuje a vrátí 202; uživatel vidí „Děkujeme! Vaši zprávu jsme přijali.“ Chybí Turnstile i rate limit (až se doručování zapojí, bude to otevřená cesta pro spam). | `src/pages/api/contact.ts:25`, `src/components/ContactForm.astro:96` | Do rozhodnutí o doručování formulář skrýt / nahradit `mailto:`. Pak: doručení na pevnou adresu školy (`reply_to` = návštěvník), Turnstile ověřený na serveru, honeypot, rate limit. |
| F06 | 🔴 P0 | 19.1 | **Chybí sledování chyb a alerty.** Workers Observability je zapnuté (logy), ale nikdo nedostane upozornění na 5xx ani na výpadek CMS. | `wrangler.jsonc` (`observability.enabled`), žádná integrace Sentry/alertů | Sentry (nebo Cloudflare Logpush + alert) se scrubbingem PII; uptime monitoring (§19.1 P1). |
| F07 | 🔴 P0 | 2.3, 20.2 | **HTTP se nepřesměrovává na HTTPS** (na workers.dev nejde nastavit). Pro produkční doménu NOT VERIFIED. | `curl -sI http://…workers.dev/` → `200 OK` | Na zóně spstrutnov.cz: Always Use HTTPS, min. TLS 1.2, HSTS; ověřit po přepnutí DNS. |
| F08 | 🟠 P1 | 2.3 | Chybí `Content-Security-Policy`, `Strict-Transport-Security`, `Cross-Origin-Opener-Policy`. (Přítomné: `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`.) | `docs` evidence: hlavičky `/` | Astro middleware s CSP (nejdřív Report-Only), HSTS, COOP. |
| F09 | 🟠 P1 | 2.2 | `pnpm audit --prod`: **1 high** — `zod <4.6.6` (GHSA-mrhx-c7xc-m3w5) přes `@emdash-cms/cloudflare > @cloudflare/kumo`. Chybí release-age cooldown (`minimumReleaseAge`) a Renovate/Dependabot. | výstup `pnpm audit --prod` | `pnpm.overrides` `zod@<4.6.6 → ^4.6.7` + otestovat; `minimumReleaseAge: 4320` v `pnpm-workspace.yaml`; Renovate s cooldownem. |
| F10 | 🟠 P1 | 1.1, 2.4 | **Nesanitizované HTML.** Úryvek z EmDash vyhledávání se vkládá přes `set:html`; JSON-LD se vkládá `set:html={JSON.stringify(...)}` bez escapování `<` (řetězec `</script>` z CMS by vyskočil ze skriptu); palette ⌘K skládá `href` z CMS URL bez kontroly schématu. Rizikem jsou editoři CMS / kompromitovaný účet. | `src/pages/vyhledavani.astro:39`; `src/components/Breadcrumbs.astro:28`, `Faq.astro:29`, `src/pages/novinky/[slug].astro:120`; `src/scripts/cmdk.ts:151` | Escapovat úryvek a povolit jen `<mark>`; v JSON-LD nahradit `<` → `<`; v palette povolit jen `/…` a `https:`. |
| F11 | 🟠 P1 | 11.1 | **Sitemapa je chybná.** `sitemap-pages.xml` uvádí URL `/<slug>`, které vrací 404 (kolekce `pages` má `urlPattern "/{slug}"`, routy jsou `/<sekce>/<slug>`); statické stránky (úvod, /novinky, /studium, /kontakty, /galerie, /ke-stazeni…) v sitemapě chybí; host sitemapy = workers.dev, kanonické URL = www.spstrutnov.cz. | `sitemap-pages.xml` → první URL 404; `scripts/build-seed.mjs:779` | Vlastní `sitemap.xml` (statické + CMS URL ve správném tvaru) nebo opravit `urlPattern`; host = produkční doména. |
| F12 | 🟠 P1 | 11.2 | Na každé stránce je **duplicitní `<meta name="description">` a `<link rel="canonical">`** (Base layout + EmDashHead). Titulek úvodní stránky „SPŠ Trutnov“ je moc krátký (11 znaků). | DOM audit: `#desc = 2`, `#canon = 2` na 23/23 stránkách; `src/layouts/Base.astro:55–56, 83` | Nechat meta jen z EmDashHead (nebo jen z layoutu); úvod: „SPŠ Trutnov — střední průmyslová škola v Trutnově“. |
| F13 | 🟠 P1 | 11.5 | `og:image` chybí na všech stránkách kromě článků; `twitter:card` je `summary`. | DOM audit sloupec og:image | Výchozí OG obrázek 1200×630 (logo + fotka školy), per-šablona; `summary_large_image`. |
| F14 | 🟠 P1 | 11.5 | Neúplná sada ikon: jen `favicon.svg`; chybí `favicon.ico`, `apple-touch-icon` (180 px), web manifest (192/512, maskable). | `/favicon.ico`, `/apple-touch-icon.png`, `/manifest.webmanifest` → 404 | Vygenerovat z oficiálního loga. |
| F15 | 🟠 P1 | 11.4, 12.3 | Chybí `EducationalOrganization` JSON-LD (název, IČ 69174415, adresa, telefon, logo, `sameAs` Facebook/YouTube/Instagram); akce nemají `Event` schema. Na úvodu je jen `WebSite`. | `curl /` → jen `"@type":"WebSite"` | Doplnit do layoutu a na stránky akcí/DOD. |
| F16 | 🟠 P1 | 9.3 (WCAG 1.4.10) | **Horizontální scroll při 320 px** na všech testovaných stránkách (+9 px, úvod +24 px). | Playwright 320×800: `/ +24`, článek/přijímačky/kontakty `+9` | Najít přetékající prvek (pravděpodobně min-šířky pillů/tlačítek v hlavičce) a povolit zalomení. |
| F17 | 🟠 P1 | 9.3 (WCAG 2.2.2) | **Automaticky se pohybující obsah >5 s bez tlačítka pauzy:** autoplay slider na úvodu (pauza jen při hover/focus), nekonečný pás partnerů (pauza jen hover), automatické přepínání Průmysl 4.0, animovaný canvas. (`prefers-reduced-motion` je respektováno ✓.) | `src/components/Carousel.astro` (autoplay), `src/pages/index.astro` (marquee), `src/components/home/Industry40.astro` | Viditelné tlačítko Pozastavit/Spustit u slideru, marquee a canvasu; auto-cyklus Průmyslu 4.0 zastavit po 1 kole. |
| F18 | 🟠 P1 | 8.3, 8.4 | Náhledy YouTube videí se načítají z `i.ytimg.com` (Google) při doscrollování k sekci, bez souhlasu → přenos IP adresy. (Samotný iframe je správně až po kliknutí a přes `youtube-nocookie` ✓.) | `src/components/home/Videos.astro` (`https://i.ytimg.com/vi/…`) | Náhledy stáhnout a servírovat z vlastní domény (R2/`public`). |
| F19 | 🟠 P1 | 14.3 | **Česká typografie se neaplikuje.** V obsahu je 321 jednopísmenných předložek/spojek s běžnou mezerou na konci řádku, 11× spojovník místo pomlčky (např. „SPŠ Trutnov - brána…“), 11× „Kč“ bez nezlomitelné mezery. | analýza `seed/seed.json` | Helper `czTypo` (Appendix B.8) v normalizérech `src/lib/cms.ts` (titulky, perexy, PortableText spany). |
| F20 | 🟠 P1 | 18.2, 1.3 | **Ukázková administrace `/admin` je veřejná** a přihlášení `/prihlaseni` přijme jakékoli údaje (je to demo bez backendu, označené bannerem; noindex ✓). Po spuštění může mást uživatele. Skutečná administrace je EmDash (ověřuje passkey na serveru ✓). | `src/pages/prihlaseni.astro` (signIn bez ověření) | Před spuštěním demo odstranit, nebo ho schovat za přihlášení do EmDash. |
| F21 | 🟠 P1 | 1.4 | Repo nemá soubor pravidel pro AI agenty (`CLAUDE.md` / `AGENTS.md`): stack, tokeny, „žádné natvrdo zadané hodnoty“, česká typografie, zákaz nových závislostí bez schválení. | `ls` kořene repa | Přidat `AGENTS.md`. |
| F22 | 🟠 P1 | 19.2, 1.4 | Chybí CI (typecheck, token lint, build, Playwright + axe) a ochrana větve `main`. | žádný `.github/workflows` | GitHub Actions (akce pinované na SHA, `permissions` minimální). |
| F23 | 🟠 P1 | 10, 9.6 | Tabulky bez `<caption>` (`/studium/prijimaci-rizeni`, `/admin`). | DOM audit `tableNoCaption` | Doplnit `<caption>` (může být vizuálně skrytý). |
| F24 | 🟠 P1 | 5.3, 2.1 | Cloudflare API token v prostředí má práva na celý účet (Workers + R2 pro všechny projekty) — rozsah nelze ověřit, NOT VERIFIED. | `wrangler whoami` (token bez čtení členství) | Token omezený na tento Worker a buckety, s expirací; samostatný pro CI. |
| F25 | 🟡 P2 | 2.3 | Chybí `/.well-known/security.txt`. | 404 | Přidat s kontaktem a `Expires`. |
| F26 | 🟡 P2 | 12.2 | Rozhodnutí o AI crawlerech není zapsané; `robots.txt` je výchozí z EmDash. | `curl /robots.txt` | S vedením školy rozhodnout (vyhledávací boti ano, trénovací dle volby), zapsat do robots + Cloudflare AI Crawl Control. |
| F27 | 🟡 P2 | 1.1, A10 | Datová vrstva při chybě CMS tiše přepne na přibalený seed (prázdné `catch {}`) — výpadek databáze se neprojeví v logu. | `src/lib/cms.ts:334, 344, 376, 385, 429` | Při fallbacku zalogovat (`console.warn` s throttlingem) → viditelné v Observability. |
| F28 | 🟡 P2 | 1.1 | 15× `as any` (hlavně `window.spsToast` a typování seedu). | `grep -rn "as any" src` | Typová deklarace `window.spsToast`, typ pro seed. |
| F29 | 🟡 P2 | 17.1 | HTML odpovědi se necachují (každý požadavek je SSR + dotazy do DB, viz `server-timing` ~110 ms). | hlavičky `/` | Astro route cache / `Cache-Control: s-maxage` + invalidace při publikaci v EmDash. |
| F30 | 🟡 P2 | 11.6, 12.5 | IndexNow, Seznam Webmaster, `llms.txt` zatím ne (po spuštění). | — | Po přepnutí domény. |

## Ověřeno jako splněné (důkazy)

| § | Kontrola | Důkaz |
|---|---|---|
| 17.5 | Lighthouse mobil ≥ 90 ve všech 4 kategoriích | úvod 98/100/100/100, novinky 97/100/100/100, článek 99/100/100/100 (živý web) |
| 9.1 | axe WCAG 2.2 AA — 0 serious/critical | Playwright `tests/site.spec.ts` (8 stránek × světlý/tmavý × desktop/mobil), 118/118 testů prošlo |
| 10 | 1× `<h1>`, žádné přeskočené úrovně nadpisů, žádná duplicitní `id`, všechny `<img>` mají `alt`, žádné prázdné `href` | DOM audit 23 stránek |
| 10 | `lang="cs"`, viewport bez `user-scalable=no`, skip link | `src/layouts/Base.astro` |
| 11.1 | Skutečné stavové kódy: neexistující stránka → 404 | `/neexistuje` → 404 |
| 11.1 | Obsah je v serverově renderovaném HTML (Astro SSR) | `curl` vrací plný obsah |
| 11.2 | Unikátní `<title>` na všech stránkách; slugy bez diakritiky | DOM audit (žádné duplicity titulků) |
| 14.1 | Běžný text ≥ 16 px na mobilu; typová škála v tokenech; `clamp()` s rem | test „running text ≥ 16px“, `pnpm lint:tokens` |
| 14.2 | Písma self-hosted, WOFF2, latin + latin-ext, preload | `src/layouts/Base.astro`, `@fontsource-variable/geist` |
| 15.1 | Jeden systém tokenů (barvy světlý/tmavý, mezery, radiusy, pohyb), žádné natvrdo zadané hodnoty | `src/styles/tokens.css`, `scripts/check-tokens.mjs` ✓ |
| 16 | Bez horizontálního scrollu 360–2560 px | Playwright (kromě 320 px → F16) |
| 9.3 | `prefers-reduced-motion` respektováno | `src/styles/tokens.css`, `motion.css` |
| 17.1 | AVIF/WebP, responzivní `srcset`, rozměry obrázků, lazy pod přehybem, LCP s `fetchpriority=high` | `<Photo>`, `<CmsImage>`, `/media/opt` |
| 17.1 | Statické assety `immutable` | `_headers` (`/_astro/*`), `/media/opt` `max-age=31536000, immutable` |
| 17.2 | Minimální JS; ⌘K palette se načítá až na požádání | `cmdk.*.js` samostatný chunk 4,8 kB |
| 8.3 | Žádné cookies ani požadavky třetích stran při prvním načtení | čistý profil: 0 cookies, localStorage jen `theme` (preference) |
| 8.3 | YouTube iframe až po kliknutí, `youtube-nocookie.com` | `src/components/home/Videos.astro` |
| 8.4 | Písma self-hosted (žádný Google Fonts CDN) | build výstup |
| 2.1 | `.env*`, `.dev.vars` v `.gitignore`; žádná tajemství v historii gitu | `.gitignore:5–7`; grep vzorů tokenů v `git log -p --all` → 0 |
| 5.3 | Žádná tajemství ve `vars` wrangleru; R2 buckety bez veřejného přístupu; `compatibility_date` 2026-10-01; Observability zapnuté | `wrangler.jsonc` |
| 2.2 | Lockfile v repu; build skripty závislostí povolené jen explicitně (`allowBuilds`) | `pnpm-lock.yaml`, `pnpm-workspace.yaml` |
| 1.1 | Autorizace na serveru: údržbový endpoint ověřuje admin session z DB + Origin (401/403 testy), nefunguje „fail open“ | `src/pages/api/maintenance/migrate.ts`, test „rejects anonymous calls“ |
| 2.4 | Žádné otevřené přesměrování v našich routách (`/media/opt` přesměrovává jen na interní cestu, regex allow-list) | `src/pages/media/opt/[...path].ts` |
| 12.1 | Rychlé načítání bez cookie zdí; obsah v HTML | Lighthouse, `curl` |
| 9.4 | Přístupné přihlášení do CMS (passkey, žádné kognitivní testy) | EmDash passkey flow, `tests/cms-auth.spec.ts` |

## Manuální checklist (pro člověka)

1. **Fakta (F01)** — projít v EmDash: Lidé (e-maily, telefony, funkce), Dokumenty (nahrát skutečné PDF), Partneři (URL), Videa (popisy), obory (tvrzení), akce (termíny 2027).
2. **Právní texty (F02)** — pověřenec GDPR schválí `/ochrana-osobnich-udaju`; prohlášení o přístupnosti dle vyhl. 515/2020 Sb.
3. **Reálná zařízení (§16)** — iPhone Safari + Android Chrome: menu, ⌘K/hledání (dotykem), carousel tažením, video, tmavý režim, klávesnice na formulářích.
4. **Čtečky obrazovky (§9.6)** — VoiceOver + NVDA: navigace nadpisy/landmarky, mobilní menu, palette ⌘K (oznamování výsledků), formulář (chyby, úspěch).
5. **Text-spacing bookmarklet + 200 % zoom (§9.3)**.
6. **Účty (§19.3)** — 2FA na Cloudflare, GitHubu, registrátorovi domény; vlastnictví zóny a účtu Cloudflare u školy; billing alerty.
7. **Cookies sezení EmDash (§2.3)** — po přihlášení v DevTools ověřit `astro-session`: `Secure`, `HttpOnly`, `SameSite`.
8. **Zálohy (§3.5 obdobně, §19.2)** — ověřit obnovu Durable Object databáze (point-in-time recovery) a zálohu R2; zkušební export obsahu z EmDash.
9. **Před přepnutím DNS (§20)** — Always Use HTTPS, HSTS, DNSSEC, CAA, TTL 300 s den předem, redirect mapa nasazená a otestovaná.
10. **Po spuštění (§11.6, §12.6)** — Search Console, Bing, Seznam Webmaster, odeslat sitemapu; +7 a +30 dní kontrola indexace a polních Core Web Vitals.

## ⏱ Položky k ověření online / co se nepodařilo potvrdit

* Konfigurace produkční zóny spstrutnov.cz (HTTPS, HSTS, TLS, CAA, DNSSEC, AI Crawl Control) — zatím neexistuje → NOT VERIFIED.
* Rozsah Cloudflare API tokenu (chybí oprávnění ke čtení členství) → NOT VERIFIED.
* Polní data Core Web Vitals (CrUX) — web ještě nemá provoz → po spuštění.
* Bezpečnostní vydání Astro / EmDash: použité verze jsou nejnovější dostupné na npm k 2026-11-05 (astro 7.4.5, emdash 1.4.0, @astrojs/cloudflare 14.4.4); kromě F09 bez známých zranitelností dle `pnpm audit`.

## Evidence (výpisy)

```
$ curl -sI https://sps-trutnov.marketing-830.workers.dev/
content-type: text/html
permissions-policy: camera=(), microphone=(), geolocation=(), payment=()
referrer-policy: strict-origin-when-cross-origin
x-content-type-options: nosniff
x-frame-options: SAMEORIGIN
(žádné: content-security-policy, strict-transport-security, x-robots-tag, cross-origin-opener-policy)

$ curl -sI http://sps-trutnov.marketing-830.workers.dev/   →  HTTP/1.1 200 OK (bez přesměrování)

$ curl …/robots.txt
User-agent: *
Allow: /
Disallow: /_emdash/
Sitemap: https://sps-trutnov.marketing-830.workers.dev/sitemap.xml

$ curl …/sitemap-pages.xml  →  https://…/charakteristika-a-historie  →  404

Staré URL (status): /o-skole/pracoviste 200 · /novinky/sport/jsme-opet-mistry-okresu-v-atletice 404 ·
/novinky/souteze 404 · /kontakty/sidlo-a-pracoviste 404 · /o-skole/certifikaty-akreditace-clenstvi-a-programy 404 ·
/o-skole/informacni-zpravodaje 404 · /o-skole/fakultni-skola 404 · /o-skole/nadacni-fond 404 ·
/o-skole/liga-vyjimecnych 404 · /o-skole/o-nas-v-mediich 404 · /o-skole/o-skole-projekty 404 · /vice/odkazy 404 ·
/ke-stazeni/formulare 404 · /prihlaseni 200 · /ochrana-osobnich-udaju 200 · /studium/obory-vzdelani/elektrikar 200 ·
/component/contact/contact/86-arnost-jager 404

$ pnpm audit --prod
high  zod <4.6.6 (GHSA-mrhx-c7xc-m3w5)  path: .>@emdash-cms/cloudflare>@cloudflare/kumo>zod   — 1 vulnerability

Playwright 320×800 overflow: "/ +24", "/novinky/<článek> +9", "/studium/prijimaci-rizeni +9", "/kontakty +9"
DOM audit: všech 23 stránek — #meta description = 2, #canonical = 2; og:image jen na článku
```
