import { defineConfig, devices } from "@playwright/test";

/**
 * E2E against the production build running on workerd (`astro preview`).
 * Set BASE_URL to test a deployed site instead.
 */
const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:4322";
const executablePath = process.env.PW_CHROMIUM_PATH ?? (process.env.CI ? undefined : "/opt/pw-browsers/chromium");

export default defineConfig({
	testDir: "tests",
	timeout: 60_000,
	fullyParallel: true,
	workers: process.env.CI ? 2 : 4,
	retries: process.env.CI ? 1 : 0,
	reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
	use: {
		baseURL: BASE_URL,
		trace: "retain-on-failure",
		launchOptions: executablePath ? { executablePath } : {},
	},
	webServer: process.env.BASE_URL
		? undefined
		: {
				command: "pnpm build && pnpm preview --port 4322 --host 127.0.0.1",
				url: BASE_URL,
				reuseExistingServer: true,
				timeout: 300_000,
			},
	projects: [
		{ name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
		{ name: "mobile", use: { ...devices["Pixel 7"] } },
	],
});
