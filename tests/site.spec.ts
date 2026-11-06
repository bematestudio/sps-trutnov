import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const PAGES = [
	"/",
	"/novinky",
	"/novinky/sps-trutnov-brana-do-sveta-modernich-technologii",
	"/studium",
	"/studium/obory-vzdelani",
	"/studium/obory-vzdelani/elektronicke-pocitacove-systemy",
	"/studium/prijimaci-rizeni",
	"/studium/den-otevrenych-dveri",
	"/studium/casto-kladene-dotazy",
	"/studium/stipendium",
	"/o-skole",
	"/o-skole/pracoviste",
	"/o-skole/skolska-rada",
	"/kontakty",
	"/kontakty/lide",
	"/galerie",
	"/ke-stazeni",
	"/vyhledavani?q=robot",
	"/prihlaseni",
	"/ochrana-osobnich-udaju",
	"/pristupnost",
];

/** Skip the first-visit loader so tests see the page immediately. */
async function prime(page: Page) {
	await page.addInitScript(() => {
		try {
			sessionStorage.setItem("sps-loaded", "1");
		} catch {}
	});
}

test.beforeEach(async ({ page }) => prime(page));

test.describe("every page", () => {
	for (const path of PAGES) {
		test(`renders ${path} without errors or horizontal scroll`, async ({ page }) => {
			const errors: string[] = [];
			page.on("pageerror", (e) => errors.push(e.message));
			page.on("console", (m) => m.type() === "error" && !m.text().includes("favicon") && errors.push(m.text()));
			const res = await page.goto(path, { waitUntil: "networkidle" });
			expect(res?.status()).toBe(200);
			await expect(page.locator("h1").first()).toBeVisible();
			expect(errors, errors.join("\n")).toEqual([]);
			const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
			expect(overflow).toBeLessThanOrEqual(0);
			expect(await page.locator("html").getAttribute("lang")).toBe("cs");
		});
	}
});

test("unknown URL returns branded 404", async ({ page }) => {
	const res = await page.goto("/tato-stranka-neexistuje");
	expect(res?.status()).toBe(404);
	await expect(page.getByRole("heading", { level: 1 })).toContainText("Stránka nenalezena");
});

test("running text is never smaller than 16px", async ({ page, isMobile }) => {
	for (const path of ["/", "/novinky/sps-trutnov-brana-do-sveta-modernich-technologii", "/studium/prijimaci-rizeni", "/kontakty/lide"]) {
		await page.goto(path, { waitUntil: "networkidle" });
		const offenders = await page.evaluate((mobile) =>
			[...document.querySelectorAll<HTMLElement>("p, li, td, dd, label, input, textarea, button, a")]
				.filter((el) => el.offsetParent && el.textContent?.trim())
				// Small UI labels (dates, tags, codes, title-block captions) are not running text.
				.filter((el) => !el.closest(".meta, .tag, .titleblock dt, .breadcrumbs, th, .footer__heading, .logo__sub, .event__month, .doc__type, .program__code, .step__num, .toc"))
				// Desktop UI chrome (nav, buttons, tabs) is intentionally 15px; phones get 16px everywhere.
				.filter((el) => mobile || !el.closest(".btn, .nav, .bar__search, .i40__tab, .slide__cta, .tag"))
				.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
				.map((el) => `${el.tagName}.${el.className} ${getComputedStyle(el).fontSize} "${el.textContent!.trim().slice(0, 40)}"`),
		isMobile);
		expect(offenders, `${path}\n${offenders.join("\n")}`).toEqual([]);
	}
});

test("theme switcher toggles and persists dark mode", async ({ page }) => {
	await page.emulateMedia({ colorScheme: "light" });
	await page.goto("/");
	const html = page.locator("html");
	await expect(html).toHaveAttribute("data-theme", "light");
	const toggle = page.locator("[data-theme-toggle]").first();
	await toggle.click();
	await expect(html).toHaveAttribute("data-theme", "dark");
	await expect(toggle).toHaveAttribute("aria-pressed", "true");
	await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe("rgb(255, 255, 255)");
	await page.goto("/novinky");
	await expect(html).toHaveAttribute("data-theme", "dark");
	await page.locator("[data-theme-toggle]").first().click();
	await expect(html).toHaveAttribute("data-theme", "light");
});

test("respects OS dark preference on first visit", async ({ page }) => {
	await page.emulateMedia({ colorScheme: "dark" });
	await page.goto("/");
	await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("first visit shows the loader, which then gets out of the way", async ({ browser }) => {
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	// Record whether the loader class was ever applied (it may finish before we look).
	await page.addInitScript(() => {
		new MutationObserver(() => {
			if (document.documentElement?.classList.contains("is-loading")) (window as any).__sawLoader = true;
		}).observe(document, { subtree: true, attributes: true, attributeFilter: ["class"] });
	});
	await page.goto("/");
	expect(await page.evaluate(() => (window as any).__sawLoader === true)).toBe(true);
	await expect(page.locator("html")).not.toHaveClass(/is-loading/, { timeout: 5000 });
	await expect(page.locator(".loader")).toBeHidden();
	await ctx.close();
});

test("navigation: desktop dropdown or mobile drawer", async ({ page, isMobile }) => {
	await page.goto("/");
	if (isMobile) {
		const burger = page.locator("[data-burger]");
		await burger.click();
		await expect(burger).toHaveAttribute("aria-expanded", "true");
		const drawer = page.locator("#mobile-nav");
		await expect(drawer).toBeVisible();
		await drawer.getByText("Studium", { exact: true }).click();
		await drawer.getByRole("link", { name: "Obory vzdělání" }).click();
		await expect(page).toHaveURL(/obory-vzdelani/);
	} else {
		const trigger = page.locator("[data-dropdown-trigger]", { hasText: "Studium" });
		await trigger.click();
		await expect(trigger).toHaveAttribute("aria-expanded", "true");
		await page.keyboard.press("Escape");
		await expect(trigger).toHaveAttribute("aria-expanded", "false");
		await trigger.click();
		await page.locator(".nav__panel").getByRole("link", { name: "Přijímací řízení" }).click();
		await expect(page).toHaveURL(/prijimaci-rizeni/);
	}
});

test("news category filter narrows the list", async ({ page }) => {
	await page.goto("/novinky?kategorie=sport");
	const tags = page.locator(".post .tag");
	expect(await tags.count()).toBeGreaterThan(0);
	for (const t of await tags.allTextContents()) expect(t.trim()).toBe("Sport");
});

test("people directory search filters contacts", async ({ page }) => {
	await page.goto("/kontakty/lide");
	await page.locator("[data-directory-search]").fill("sauer");
	await expect(page.locator("[data-person]:visible")).toHaveCount(1);
	await page.locator("[data-directory-search]").fill("zzzz");
	await expect(page.locator("[data-directory-empty]")).toBeVisible();
});

test("contact form validates and prepares an e-mail to the school", async ({ page }) => {
	await page.goto("/kontakty");
	const form = page.locator("[data-contact-form]").first();
	await expect(form).toHaveAttribute("action", "mailto:skola@spstrutnov.cz");
	await form.getByRole("button", { name: /Připravit e-mail/ }).click();
	await expect(form.locator("[data-error]")).toBeVisible();
	await form.getByLabel("Jméno a příjmení").fill("Jan Novák");
	await form.getByLabel("E-mail").fill("jan@example.com");
	await form.getByLabel("Zpráva").fill("Dobrý den, mám dotaz k přijímacímu řízení.");
	await form.getByRole("checkbox").check();
	await form.getByRole("button", { name: /Připravit e-mail/ }).click();
	await expect(form).toHaveAttribute("data-state", "sent");
});

test("staff admin requires an EmDash CMS login", async ({ page }) => {
	for (const path of ["/admin", "/admin/novinky", "/admin/nastaveni"]) {
		await page.goto(path);
		await expect(page).toHaveURL(new RegExp(`/_emdash/admin/login\\?redirect=${encodeURIComponent(path)}$`));
	}
	await page.goto("/prihlaseni");
	await expect(page.getByRole("link", { name: "Přihlásit se" })).toHaveAttribute("href", "/_emdash/admin/login?redirect=%2Fadmin");
	await expect(page.locator("input[type=password]")).toHaveCount(0);
});

test("security headers, CSP and noindex outside production", async ({ request }) => {
	const res = await request.get("/");
	const h = res.headers();
	expect(h["content-security-policy"]).toMatch(/default-src 'self'/);
	expect(h["content-security-policy"]).toMatch(/script-src 'self'( 'sha256-[^']+')+/);
	expect(h["content-security-policy"]).toContain("frame-ancestors 'self'");
	expect(h["x-content-type-options"]).toBe("nosniff");
	expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
	expect(h["cross-origin-opener-policy"]).toBe("same-origin");
	expect(h["x-robots-tag"]).toContain("noindex");
	const robots = await (await request.get("/robots.txt")).text();
	expect(robots).toContain("Disallow: /");
});

test("no CSP violations on interactive pages", async ({ page }) => {
	const violations: string[] = [];
	page.on("console", (m) => /Content Security Policy/i.test(m.text()) && violations.push(m.text()));
	for (const path of ["/", "/novinky/sps-trutnov-brana-do-sveta-modernich-technologii", "/kontakty", "/ke-stazeni", "/studium/casto-kladene-dotazy"]) {
		await page.goto(path, { waitUntil: "networkidle" });
	}
	await page.keyboard.press("Control+k");
	await page.waitForTimeout(300);
	expect(violations).toEqual([]);
});

test("old site URLs redirect permanently", async ({ request }) => {
	const cases: Array<[string, string]> = [
		["/novinky/sport/jsme-opet-mistry-okresu-v-atletice", "/novinky/jsme-opet-mistry-okresu-v-atletice"],
		["/novinky/souteze", "/novinky?kategorie=souteze"],
		["/kontakty/sidlo-a-pracoviste", "/kontakty"],
		["/component/contact/contact/86-arnost-jager", "/kontakty/lide"],
		["/ke-stazeni/formulare", "/ke-stazeni?kategorie=formulare"],
		["/index.php/o-skole", "/"],
	];
	for (const [from, to] of cases) {
		const res = await request.get(from, { maxRedirects: 0 });
		expect(res.status(), from).toBe(301);
		expect(res.headers().location, from).toBe(to);
	}
});

test("sitemap lists production URLs that exist", async ({ request }) => {
	const xml = await (await request.get("/sitemap.xml")).text();
	expect(xml).toContain("<loc>https://www.spstrutnov.cz/</loc>");
	expect(xml).toContain("<loc>https://www.spstrutnov.cz/o-skole/charakteristika-a-historie</loc>");
	expect(xml).toContain("<loc>https://www.spstrutnov.cz/studium/obory-vzdelani/elektrikar</loc>");
	const sample = [...xml.matchAll(/<loc>https:\/\/www\.spstrutnov\.cz([^<]*)<\/loc>/g)].map((m) => m[1]).slice(0, 25);
	for (const path of sample) expect((await request.get(path || "/", { maxRedirects: 0 })).status(), path).toBe(200);
	expect((await request.get("/sitemap-pages.xml", { maxRedirects: 0 })).status()).toBe(301);
});

test("icons, manifest, security.txt and default share image", async ({ page, request }) => {
	for (const path of ["/favicon.ico", "/apple-touch-icon.png", "/icon-192.png", "/icon-512.png", "/manifest.webmanifest", "/.well-known/security.txt", "/og-default.png"]) {
		expect((await request.get(path)).status(), path).toBe(200);
	}
	await page.goto("/kontakty");
	await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", "https://www.spstrutnov.cz/og-default.png");
	await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
	await expect(page.locator('meta[name="description"]')).toHaveCount(1);
	await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
	await page.goto("/");
	const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
	expect(ld.some((t) => t.includes("EducationalOrganization"))).toBe(true);
});

test("site-wide pause stops moving content and persists", async ({ page }) => {
	await page.goto("/", { waitUntil: "networkidle" });
	const toggle = page.locator(".site-footer [data-motion-toggle]");
	await toggle.click();
	await expect(page.locator("html")).toHaveAttribute("data-motion", "paused");
	await expect(toggle).toHaveAttribute("aria-pressed", "true");
	const state = await page.locator(".marquee__track").first().evaluate((el) => getComputedStyle(el).animationPlayState);
	expect(state).toBe("paused");
	await expect(page.locator("[data-carousel-pause]").first()).toHaveAttribute("aria-pressed", "true");
	await page.reload();
	await expect(page.locator("html")).toHaveAttribute("data-motion", "paused");
	await page.locator(".site-footer [data-motion-toggle]").click();
	await expect(page.locator("html")).not.toHaveAttribute("data-motion", "paused");
});

test("no horizontal scroll at 320 px", async ({ browser }) => {
	const page = await browser.newPage({ viewport: { width: 320, height: 800 } });
	await prime(page);
	for (const path of ["/", "/novinky/sps-trutnov-brana-do-sveta-modernich-technologii", "/studium/prijimaci-rizeni", "/kontakty", "/ke-stazeni"]) {
		await page.goto(path, { waitUntil: "networkidle" });
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
		expect(overflow, path).toBeLessThanOrEqual(0);
	}
	await page.close();
});

test("downloads can be filtered by text", async ({ page }) => {
	await page.goto("/ke-stazeni");
	const all = await page.locator("[data-doc]:visible").count();
	await page.locator("[data-doc-q]").fill("prihlaska");
	const some = await page.locator("[data-doc]:visible").count();
	expect(some).toBeGreaterThan(0);
	expect(some).toBeLessThan(all);
});

test.describe("accessibility (axe, WCAG 2.2 AA)", () => {
	for (const theme of ["light", "dark"] as const) {
		for (const path of ["/", "/novinky", "/studium/obory-vzdelani/slaboprouda-elektrotechnika", "/studium/prijimaci-rizeni", "/kontakty", "/kontakty/lide", "/prihlaseni", "/ke-stazeni", "/pristupnost"]) {
			test(`${theme}: ${path}`, async ({ page }) => {
				await page.goto(`${path}?theme=${theme}`, { waitUntil: "networkidle" });
				// Let reveal animations settle so axe measures final colours.
				await page.evaluate(() => document.querySelectorAll("[data-reveal],[data-split]").forEach((el) => el.classList.add("is-revealed")));
				await page.waitForTimeout(800);
				const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).exclude("canvas").analyze();
				const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
				expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
			});
		}
	}
});

test("⌘K palette loads lazily, finds programs and navigates", async ({ page }) => {
	const requested: string[] = [];
	page.on("request", (r) => requested.push(r.url()));
	await page.goto("/", { waitUntil: "networkidle" });
	expect(requested.some((u) => u.includes("search-index.json"))).toBe(false);
	await page.keyboard.press("Control+k");
	const input = page.locator(".cmdk__input");
	await expect(input).toBeFocused();
	await input.fill("strojirenstvi");
	await expect(page.locator(".cmdk__item").first()).toContainText("Strojírenství");
	await page.keyboard.press("Enter");
	await expect(page).toHaveURL(/strojirenstvi-robotika/);
});

test("palette tolerates missing diacritics and supports arrows + Escape", async ({ page }) => {
	await page.goto("/");
	await page.locator("[data-cmdk]").first().click();
	await page.locator(".cmdk__input").fill("prijimaci");
	await expect(page.locator(".cmdk__item").first()).toContainText("Přijímací");
	await page.keyboard.press("ArrowDown");
	await expect(page.locator('.cmdk__item[aria-selected="true"]')).toHaveCount(1);
	await page.keyboard.press("Escape");
	await expect(page.locator(".cmdk")).not.toBeVisible();
});

test("news carousel scrolls with its controls", async ({ page }) => {
	await page.goto("/");
	const carousel = page.locator("[data-carousel]", { has: page.locator(".post") }).first();
	await carousel.scrollIntoViewIfNeeded();
	const track = carousel.locator(".carousel__track");
	const prev = carousel.locator("[data-carousel-prev]");
	await expect(prev).toBeDisabled();
	await carousel.locator("[data-carousel-next]").click();
	await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
	await expect(prev).toBeEnabled();
});

test("Průmysl 4.0 tabs switch the highlighted technology", async ({ page }) => {
	await page.goto("/");
	const section = page.locator("[data-i40]");
	await section.scrollIntoViewIfNeeded();
	await page.getByRole("tab", { name: /CNC obrábění/ }).click();
	await expect(section).toHaveAttribute("data-active", "cnc");
	await expect(section.locator('[data-card="cnc"]')).toBeVisible();
	await page.keyboard.press("ArrowRight");
	await expect(section).toHaveAttribute("data-active", "iot");
});

test("video facade loads YouTube only after click", async ({ page }) => {
	await page.goto("/", { waitUntil: "networkidle" });
	await expect(page.locator(".videos__player iframe")).toHaveCount(0);
	await expect(page.locator(".videos__player img").first()).toHaveAttribute("src", /^\/media\/yt\//);
	await page.locator("[data-play]").click();
	await expect(page.locator(".videos__player iframe")).toHaveAttribute("src", /youtube-nocookie\.com\/embed\//);
});

test("photos are served as AVIF/WebP via <picture>", async ({ page }) => {
	await page.goto("/novinky", { waitUntil: "networkidle" });
	const avif = page.locator('.post picture source[type="image/avif"]').first();
	await expect(avif).toHaveAttribute("srcset", /\/media\/opt\/.+\/480\.avif 480w/);
	await expect(page.locator('.post picture source[type="image/webp"]').first()).toHaveAttribute("srcset", /\.webp/);
	// The rendered image must actually load (variant or fallback to the original).
	const loaded = await page.locator(".post picture img").first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
	expect(loaded).toBe(true);
	await page.goto("/studium/obory-vzdelani");
	await expect(page.locator('picture source[type="image/avif"]').first()).toHaveAttribute("srcset", /\/images\/foto\/.+\.avif/);
});

test("CMS maintenance endpoint rejects anonymous calls", async ({ request }) => {
	const res = await request.post("/api/maintenance/migrate");
	expect(res.status()).toBe(401);
});

test("landing hero is built from the original homepage slider (photos + Adobe apps)", async ({ page }) => {
	await page.goto("/");
	const html = await page.locator(".hero .carousel").innerHTML();
	for (const name of ["spstrutnov-dod-2026", "roboticke-pracoviste-wide", "studentka-klik"]) expect(html, name).toContain(`/images/foto/${name}-`);
	await expect(page.locator(".hero .app__tile")).toHaveText(["Ps", "Ai", "Id", "Pr", "Ac", "Br"]);
	await expect(page.locator(".hero h1")).toHaveText("Střední průmyslová škola Trutnov");
	await expect(page.locator(".hero .slide__img").first()).toHaveAttribute("fetchpriority", "high");
});

test("anonymous HTML is cached briefly, logged-in requests are not", async ({ request }) => {
	// Requests may land on different isolates/colos, so allow a few tries.
	let hit: Awaited<ReturnType<typeof request.get>> | undefined;
	for (let i = 0; i < 5 && !hit; i++) {
		const res = await request.get("/o-skole");
		if (/HIT/.test(res.headers()["x-cache"] ?? "")) hit = res;
	}
	expect(hit, "one of five requests is served from cache").toBeTruthy();
	expect(hit!.headers()["content-security-policy"]).toContain("default-src 'self'");
	const withCookie = await request.get("/o-skole", { headers: { cookie: "astro-session=x" } });
	expect(withCookie.headers()["x-cache"] ?? "").not.toMatch(/HIT/);
});
