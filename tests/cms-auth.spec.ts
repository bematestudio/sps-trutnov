import { expect, test } from "@playwright/test";

/**
 * EmDash setup + passkey login against a FRESH database (it completes setup).
 * Opt-in:  rm -rf .wrangler/state && pnpm preview --port 4322 --host localhost
 *          CMS_AUTH_TEST=1 BASE_URL=http://localhost:4322 pnpm test:e2e tests/cms-auth.spec.ts --project=desktop
 * Guards the session store: a broken driver lets setup create the admin, then
 * fails every login with a 500.
 */
test.skip(!process.env.CMS_AUTH_TEST, "set CMS_AUTH_TEST=1 against a fresh database");

test("setup wizard, passkey registration and passkey login", async ({ page, context }) => {
	const cdp = await context.newCDPSession(page);
	await cdp.send("WebAuthn.enable");
	await cdp.send("WebAuthn.addVirtualAuthenticator", {
		options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
	});

	await page.goto("/_emdash/admin");
	await page.getByLabel("Site Title").fill("SPŠ Trutnov");
	await page.getByRole("button", { name: /Continue/ }).click();
	await page.locator("input[type=email]").fill("admin@spstrutnov.cz", { timeout: 60_000 });
	await page.locator("input[type=text]").first().fill("Admin");
	await page.getByRole("button", { name: /Continue/ }).click();
	const verify = page.waitForResponse((r) => r.url().includes("/setup/admin/verify"));
	await page.getByRole("button", { name: "Create passkey" }).click();
	expect((await verify).status()).toBe(200);
	expect(await page.evaluate(() => fetch("/_emdash/api/auth/me").then((r) => r.status))).toBe(200);

	await context.clearCookies();
	await page.goto("/_emdash/admin");
	const login = page.waitForResponse((r) => r.url().includes("/auth/passkey/verify"));
	await page.getByRole("button", { name: /passkey/i }).first().click();
	expect((await login).status()).toBe(200);
	await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
	expect(await page.evaluate(() => fetch("/_emdash/api/auth/me").then((r) => r.status))).toBe(200);
});
