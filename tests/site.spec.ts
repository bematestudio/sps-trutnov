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
	"/admin",
	"/admin/novinky",
	"/admin/novinky/upravit",
	"/admin/akce",
	"/admin/dokumenty",
	"/admin/lide",
	"/admin/nastaveni",
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
	await expect(page.getByRole("heading", { level: 1 })).toContainText("Tady nic není");
});

test("running text is never smaller than 16px", async ({ page, isMobile }) => {
	for (const path of ["/", "/novinky/sps-trutnov-brana-do-sveta-modernich-technologii", "/studium/prijimaci-rizeni", "/kontakty/lide"]) {
		await page.goto(path, { waitUntil: "networkidle" });
		const offenders = await page.evaluate((mobile) =>
			[...document.querySelectorAll<HTMLElement>("p, li, td, dd, label, input, textarea, button, a")]
				.filter((el) => el.offsetParent && el.textContent?.trim())
				// Mono UI labels (dates, tags, eyebrows, codes) are not running text.
				.filter((el) => !el.closest(".meta, .eyebrow, .tag, .breadcrumbs, th, .footer__heading, .logo__sub, .event__month, .doc__type, .program__code, .step__num, .toc"))
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

test("contact form validates and submits", async ({ page }) => {
	await page.goto("/kontakty");
	const form = page.locator("[data-contact-form]").first();
	await form.getByRole("button", { name: /Odeslat/ }).click();
	await expect(form.locator("[data-error]")).toBeVisible();
	await form.getByLabel("Jméno a příjmení").fill("Jan Novák");
	await form.getByLabel("E-mail").fill("jan@example.com");
	await form.getByLabel("Zpráva").fill("Dobrý den, mám dotaz k přijímacímu řízení.");
	await form.getByRole("checkbox").check();
	await form.getByRole("button", { name: /Odeslat/ }).click();
	await expect(form).toHaveAttribute("data-state", "sent");
});

test("admin demo: login leads to dashboard", async ({ page }) => {
	await page.goto("/prihlaseni");
	await page.getByLabel("Školní e-mail").fill("novak@spstrutnov.cz");
	await page.locator("#login-password").fill("tajne-heslo");
	await page.getByRole("button", { name: /Přihlásit se/ }).click();
	await expect(page).toHaveURL(/\/admin$/);
	await expect(page.locator("[data-admin-name]")).toHaveText("Novak");
	await expect(page.locator(".a-kpi")).toHaveCount(4);
});

test.describe("accessibility (axe, WCAG 2.2 AA)", () => {
	for (const theme of ["light", "dark"] as const) {
		for (const path of ["/", "/novinky", "/studium/obory-vzdelani/slaboprouda-elektrotechnika", "/studium/prijimaci-rizeni", "/kontakty", "/kontakty/lide", "/prihlaseni", "/admin"]) {
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
