// @ts-check
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2 } from "@emdash-cms/cloudflare";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";

export default defineConfig({
	site: "https://www.spstrutnov.cz",
	output: "server",
	adapter: cloudflare(),
	prefetch: { prefetchAll: true, defaultStrategy: "hover" },
	image: {
		layout: "constrained",
		responsiveStyles: true,
		domains: ["www.spstrutnov.cz"],
	},
	integrations: [
		react(),
		emdash({
			database: d1({ binding: "DB", session: "auto", coalesce: true }),
			storage: r2({ binding: "MEDIA" }),
		}),
	],
	devToolbar: { enabled: false },
});
