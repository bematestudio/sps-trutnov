/// <reference types="astro/client" />

// Minimal declaration for the Workers runtime module (runtime types are not
// generated — see README: `wrangler types --include-runtime=false`).
declare module "cloudflare:workers" {
	export const env: Record<string, unknown>;
}

interface Window {
	/** Global toast helper (src/scripts/site.ts). */
	spsToast?: (message: string) => void;
}

declare namespace App {
	interface Locals {
		/** Set by src/middleware.ts on /admin/* routes. */
		cmsUser?: { id: string; role: number; name: string; email: string };
	}
}

/** Build identifier injected by Vite (astro.config.mjs). */
declare const __BUILD_ID__: string;
