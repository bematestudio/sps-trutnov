// Durable Object class that hosts the EmDash SQLite database (binding EMDASH_DB).
export { EmDashDB } from "@emdash-cms/cloudflare/db/do-sql";
import { relocateDatabase } from "./lib/db-relocate";
import { edgeCache, HTML_TTL_S, htmlCacheKey, isCacheableRequest, REFRESH_HEADER, RENDERED_AT_HEADER } from "./lib/html-cache";

type Ctx = { waitUntil(p: Promise<unknown>): void };
type Handler = {
	fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response>;
};
type WorkerModule = typeof import("@emdash-cms/cloudflare/worker");

/**
 * The Astro/EmDash app is a large module graph; load it only when a request
 * actually has to be rendered. Cache hits (src/lib/html-cache.ts) are answered
 * without evaluating it, which keeps cold starts short.
 */
let app: Promise<WorkerModule> | undefined;
const loadApp = () => (app ??= import("@emdash-cms/cloudflare/worker"));

// PluginBridge (EmDash plugin sandbox) is not exported: no sandbox binding is
// configured, and importing it would pull most of the CMS into every cold start.

export default {
	async fetch(request: Request, env: unknown, ctx: unknown) {
		const url = new URL(request.url);
		if (isCacheableRequest(request, url) && !request.headers.has(REFRESH_HEADER)) {
			const hit = await edgeCache()?.match(htmlCacheKey(url)).catch(() => undefined);
			if (hit) {
				const res = new Response(hit.body, hit);
				const age = (Date.now() - Number(hit.headers.get(RENDERED_AT_HEADER) ?? 0)) / 1000;
				res.headers.set("x-cache", age > HTML_TTL_S ? "STALE-edge" : "HIT-edge");
				if (age > HTML_TTL_S) {
					// Stale-while-revalidate: re-render in the background; the middleware stores it.
					const headers = new Headers(request.headers);
					headers.set(REFRESH_HEADER, "1");
					const refresh = new Request(request.url, { method: "GET", headers });
					(ctx as Ctx).waitUntil(
						loadApp()
							.then((mod) => (mod.default as unknown as Handler).fetch(refresh, env, ctx))
							.then((r) => r.body?.cancel())
							.catch(() => {}),
					);
				}
				return res;
			}
		}
		const mod = await loadApp();
		return (mod.default as unknown as Handler).fetch(request, env, ctx);
	},
	async scheduled(controller: unknown, env: unknown, ctx: unknown) {
		// One-off: copy the CMS database to its new European instance (no-op once done).
		try {
			const result = await relocateDatabase((env as { EMDASH_DB: Parameters<typeof relocateDatabase>[0] }).EMDASH_DB);
			if (result.status !== "already-done") console.log(JSON.stringify({ msg: "db relocation", ...result }));
		} catch (error) {
			console.error(JSON.stringify({ msg: "db relocation failed", error: error instanceof Error ? error.message : String(error) }));
		}
		const mod = await loadApp();
		return (mod.createScheduledHandler() as (c: unknown, e: unknown, x: unknown) => Promise<void>)(controller, env, ctx);
	},
};
