/**
 * Short-lived cache for anonymous page views, shared by src/worker.ts (lookup
 * before Astro/EmDash even start — a hit costs no CMS initialisation) and
 * src/middleware.ts (store after render). The key contains the build id so a
 * new deploy never serves HTML that points at the previous build's assets.
 */
/** After this a cached page is refreshed in the background (still served). */
export const HTML_TTL_S = 60;
/** Hard limit: older copies are never served. */
export const HTML_MAX_STALE_S = 600;
/** Header on internal background re-render requests (skip lookup, store result). */
export const REFRESH_HEADER = "x-sps-cache-refresh";
export const RENDERED_AT_HEADER = "x-rendered-at";
const NO_CACHE_PREFIXES = ["/_emdash", "/_astro", "/admin", "/api/", "/prihlaseni", "/media/", "/phocadownloadpap/", "/search-index.json"];
const BARE_HOST = "spstrutnov.cz";

export function isCacheableRequest(request: Request, url: URL) {
	if (request.method !== "GET") return false;
	const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
	if ((url.protocol !== "https:" && !local) || url.hostname === BARE_HOST) return false; // redirected by the middleware
	if (request.headers.has("cookie") || request.headers.has("authorization")) return false;
	if (NO_CACHE_PREFIXES.some((p) => url.pathname.startsWith(p))) return false;
	return !url.searchParams.has("theme") && !url.searchParams.has("_preview");
}

export const htmlCacheKey = (url: URL) => `${url.origin}/__html/${__BUILD_ID__}${url.pathname}${url.search}`;

export const edgeCache = () => (globalThis as { caches?: { default?: Cache } }).caches?.default;
