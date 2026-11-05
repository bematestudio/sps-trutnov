// @ts-check
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { durableObjects, r2 } from "@emdash-cms/cloudflare";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";

/**
 * Storage choices (all bound in wrangler.jsonc):
 * - CMS database: a SQLite-backed Durable Object (`EmDashDB`, binding EMDASH_DB).
 *   Swap to `d1({ binding: "DB", session: "auto" })` once the API token has D1 rights.
 * - Media: R2 bucket (binding MEDIA).
 * - Astro sessions (EmDash admin auth): R2 bucket (binding SESSIONS) instead of KV.
 */
export default defineConfig({
	site: "https://www.spstrutnov.cz",
	output: "server",
	adapter: cloudflare({ imageService: "passthrough" }),
	session: {
		// Custom driver: reads the R2 binding via `cloudflare:workers` (see file header).
		driver: {
			entrypoint: new URL("./src/lib/session-r2-driver.ts", import.meta.url),
			config: { binding: "SESSIONS", base: "astro-sessions" },
		},
	},
	prefetch: { prefetchAll: true, defaultStrategy: "hover" },
	image: {
		layout: "constrained",
		responsiveStyles: true,
		domains: ["www.spstrutnov.cz"],
	},
	integrations: [
		react(),
		emdash({
			database: durableObjects({ binding: "EMDASH_DB" }),
			storage: r2({ binding: "MEDIA" }),
		}),
	],
	devToolbar: { enabled: false },
	vite: {
		// Unique per build: part of the HTML cache key (src/middleware.ts), so a new
		// deploy never serves cached HTML that points at the previous build's assets.
		define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
	},
});
