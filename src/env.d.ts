/// <reference types="astro/client" />

// Minimal declaration for the Workers runtime module (runtime types are not
// generated — see README: `wrangler types --include-runtime=false`).
declare module "cloudflare:workers" {
	export const env: Record<string, unknown>;
}
