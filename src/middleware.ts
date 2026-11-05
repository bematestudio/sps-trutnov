/**
 * Site-wide request handling (runs inside EmDash's own middleware):
 *
 *  1. http → https (everything but localhost)
 *  2. 301 map from the old Joomla site's URLs
 *  3. security headers on every response, a hash-based CSP on public HTML
 *  4. X-Robots-Tag: noindex on every host except the production domain
 *  5. structured error logging (Workers Observability picks up console.*)
 *  6. pending CMS migrations, run once per isolate after the response
 *  7. /admin/* only for logged-in EmDash CMS users
 */
import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { after } from "emdash";
import { cmsUser, loginUrl, ROLE_CONTRIBUTOR } from "./lib/auth";
import { PRODUCTION_HOST, isProductionHost } from "./lib/site";
import { edgeCache, HTML_MAX_STALE_S, HTML_TTL_S, htmlCacheKey, isCacheableRequest, REFRESH_HEADER, RENDERED_AT_HEADER } from "./lib/html-cache";
import { pendingMigrations, runMigrations } from "./lib/migrations";

/* --------------------------------------------------------------- redirects */

/** Old category slugs → current `/novinky?kategorie=` slugs (same names). */
const NEWS_CATEGORIES = new Set([
	"exkurze-a-vylety",
	"kulturni-akce",
	"partnerstvi-a-spoluprace",
	"prijimaci-rizeni",
	"souteze",
	"sport",
	"projekty",
	"ruzne",
	"volnocasove-aktivity",
]);

const EXACT: Record<string, string> = {
	"/index.php": "/",
	"/kontakty/sidlo-a-pracoviste": "/kontakty",
	"/kontakty/kontakty": "/kontakty",
	"/kontakty/zamestnanci": "/kontakty/lide",
	"/kontakty/kontaktni-formular": "/kontakty#formular",
	"/o-skole/pracoviste-skoly": "/o-skole/pracoviste",
	"/studium/obory": "/studium/obory-vzdelani",
	"/studium/obory-vzdelani": "/studium/obory-vzdelani",
	"/studium/caste-dotazy": "/studium/casto-kladene-dotazy",
	"/fotogalerie": "/galerie",
	"/galerie": "/galerie",
};

function docCategory(slug: string) {
	if (slug.includes("formular")) return "formulare";
	if (slug.includes("prijim")) return "prijimaci-rizeni";
	if (slug.includes("studium") || slug.includes("svp")) return "studium";
	if (slug.includes("zpravodaj") || slug.includes("propag")) return "propagace";
	if (slug.includes("skolska-rada")) return "skolska-rada";
	if (slug.includes("napsali") || slug.includes("media")) return "media";
	if (slug.includes("dokument") || slug.includes("vyrocni")) return "dokumenty";
	return "";
}

async function legacyRedirect(url: URL): Promise<string | null> {
	const path = url.pathname.replace(/\/+$/, "") || "/";

	// Phoca Download "?download=<id>:<slug>" links (mirrored to R2 where they existed).
	const dl = url.searchParams.get("download");
	if (dl && /^\d+:[\w-]+$/.test(dl)) {
		const [id, slug] = dl.split(":");
		const bucket = (env as Record<string, unknown>).MEDIA as { list(o: { prefix: string; limit: number }): Promise<{ objects: Array<{ key: string }> }> } | undefined;
		const hit = await bucket?.list({ prefix: `legacy/phocadownloadpap/_download/${id}-${slug}.`, limit: 1 }).catch(() => null);
		const key = hit?.objects[0]?.key;
		if (key) return `/${key.slice("legacy/".length)}`;
	}

	if (path.startsWith("/index.php")) return "/";
	if (EXACT[path] && EXACT[path] !== path) return EXACT[path];
	if (path.startsWith("/component/contact")) return "/kontakty/lide";
	if (path.startsWith("/component/")) return "/";

	// /novinky/<category>/<slug>, /novinky/<category>/<id>-<slug>, /novinky/<category>
	const news = path.match(/^\/novinky\/([\w-]+)(?:\/(?:\d+-)?([\w-]+))?$/);
	if (news) {
		const [, first, second] = news;
		if (second) return `/novinky/${second}`;
		if (NEWS_CATEGORIES.has(first)) return `/novinky?kategorie=${first}`;
	}
	// /<section>/<category>/<id>-<slug> → /novinky/<slug> (old blog-in-section URLs)
	const nested = path.match(/^\/(?:o-skole|studium|vice)\/[\w-]+\/\d+-([\w-]+)$/);
	if (nested) return `/novinky/${nested[1]}`;

	if (path.startsWith("/ke-stazeni/")) {
		const cat = docCategory(path.slice("/ke-stazeni/".length));
		return cat ? `/ke-stazeni?kategorie=${cat}` : "/ke-stazeni";
	}
	if (path.startsWith("/galerie/") || path.startsWith("/fotogalerie/")) return "/galerie";
	const cert = path.match(/^\/o-skole\/certifikaty-akreditace-clenstvi-a-programy\/.+$/);
	if (cert) return "/o-skole/certifikaty-akreditace-clenstvi-a-programy";
	if (/^\/o-skole\/(liga-vyjimecnych|o-skole-projekty)\/.+$/.test(path)) return path.replace(/\/[^/]+$/, "");
	return null;
}

/* ----------------------------------------------------------------- headers */

const BASE_HEADERS: Record<string, string> = {
	"x-content-type-options": "nosniff",
	"referrer-policy": "strict-origin-when-cross-origin",
	"permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
	"cross-origin-opener-policy": "same-origin",
	"x-frame-options": "SAMEORIGIN",
};

async function sha256(text: string) {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

const INLINE_SCRIPT = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

async function contentSecurityPolicy(html: string, upgrade: boolean) {
	const hashes = new Set<string>();
	for (const m of html.matchAll(INLINE_SCRIPT)) if (m[1].trim()) hashes.add(`'sha256-${await sha256(m[1])}'`);
	return [
		"default-src 'self'",
		`script-src 'self' ${[...hashes].join(" ")}`.trim(),
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob: https://www.spstrutnov.cz",
		"font-src 'self' data:",
		"connect-src 'self'",
		"media-src 'self'",
		"frame-src https://www.youtube-nocookie.com",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self' mailto:",
		"frame-ancestors 'self'",
		...(upgrade ? ["upgrade-insecure-requests"] : []),
	].join("; ");
}

/* -------------------------------------------------------------- HTML cache */

/**
 * Anonymous page views are served from cache for 60 s: first from this
 * isolate's memory, then from the colo's Cache API (custom domains only —
 * workers.dev has no Cache API). CMS changes therefore show up within a
 * minute; logged-in editors (any cookie) always get a fresh render.
 */
const htmlMemo = new Map<string, { at: number; body: string; status: number; headers: [string, string][] }>();

function fromMemo(key: string) {
	const hit = htmlMemo.get(key);
	if (!hit || Date.now() - hit.at > HTML_TTL_S * 1000) return null;
	const headers = new Headers(hit.headers);
	headers.set("x-cache", "HIT-memory");
	headers.set("age", String(Math.round((Date.now() - hit.at) / 1000)));
	return new Response(hit.body, { status: hit.status, headers });
}

function remember(key: string, body: string, status: number, headers: Headers) {
	htmlMemo.set(key, { at: Date.now(), body, status, headers: [...headers] });
	if (htmlMemo.size > 150) htmlMemo.delete(htmlMemo.keys().next().value!);
}


/* ------------------------------------------------------------- migrations */

let migrationsChecked = false;

function scheduleMigrations(locals: App.Locals) {
	if (migrationsChecked) return;
	migrationsChecked = true;
	const storage = (locals as { emdash?: { storage?: unknown } }).emdash?.storage;
	try {
		after(async () => {
			if (!(await pendingMigrations()).length) return;
			const result = await runMigrations(storage);
			console.log(JSON.stringify({ msg: "cms migrations", ...result }));
		});
	} catch (e) {
		migrationsChecked = false;
		console.error("[migrations] could not schedule", e);
	}
}

/* -------------------------------------------------------------- middleware */

const isLocal = (host: string) => host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");

export const onRequest = defineMiddleware(async (context, next) => {
	const { url, request } = context;
	const host = url.hostname;

	if (url.protocol === "http:" && !isLocal(host)) {
		url.protocol = "https:";
		return Response.redirect(url.href, 301);
	}
	// Bare domain → www (canonical host).
	if (host === PRODUCTION_HOST.replace(/^www\./, "")) {
		url.hostname = PRODUCTION_HOST;
		return Response.redirect(url.href, 301);
	}

	const isCms = url.pathname.startsWith("/_emdash");
	if (!isCms && (request.method === "GET" || request.method === "HEAD")) {
		const to = await legacyRedirect(url);
		if (to && to !== url.pathname + url.search) {
			return new Response(null, { status: 301, headers: { location: to, "cache-control": "public, max-age=86400" } });
		}
	}

	// The staff UI is only for logged-in CMS users (contributor and up).
	if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
		const user = await cmsUser(context.session);
		if (!user || user.role < ROLE_CONTRIBUTOR) {
			return new Response(null, { status: 302, headers: { location: loginUrl(url.pathname + url.search), "cache-control": "no-store" } });
		}
		context.locals.cmsUser = user;
	}

	if (!isCms && !url.pathname.startsWith("/_astro") && !url.pathname.startsWith("/api/")) scheduleMigrations(context.locals);

	const useCache = !isCms && isCacheableRequest(request, url);
	const cacheKey = htmlCacheKey(url);
	const refreshing = request.headers.has(REFRESH_HEADER);
	if (useCache && !refreshing) {
		const mem = fromMemo(cacheKey);
		if (mem) return mem;
		const edge = await edgeCache()?.match(cacheKey).catch(() => undefined);
		const fresh = edge && (Date.now() - Number(edge.headers.get(RENDERED_AT_HEADER) ?? 0)) / 1000 <= HTML_TTL_S;
		if (edge && fresh) {
			const headers = new Headers(edge.headers);
			const body = await edge.text();
			remember(cacheKey, body, edge.status, headers);
			headers.set("x-cache", "HIT-edge");
			return new Response(body, { status: edge.status, headers });
		}
	}

	let response: Response;
	try {
		response = await next();
	} catch (error) {
		console.error(
			JSON.stringify({
				msg: "unhandled error",
				path: url.pathname,
				method: request.method,
				error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
			}),
		);
		throw error;
	}
	if (response.status >= 500) console.error(JSON.stringify({ msg: "5xx response", path: url.pathname, status: response.status }));

	// Some responses (redirects from Response.redirect, cached assets) have immutable headers.
	const headers = new Headers(response.headers);
	for (const [k, v] of Object.entries(BASE_HEADERS)) if (!headers.has(k)) headers.set(k, v);
	if (!isLocal(host)) headers.set("strict-transport-security", "max-age=31536000");
	if (!isProductionHost(host)) headers.set("x-robots-tag", "noindex, nofollow");

	const isHtml = (headers.get("content-type") ?? "").includes("text/html");
	if (isHtml && !isCms && response.body) {
		const html = await response.text();
		headers.set("content-security-policy", await contentSecurityPolicy(html, !isLocal(host)));
		headers.delete("content-length");
		if (useCache && response.status === 200 && !headers.has("set-cookie")) {
			headers.set("cache-control", `public, max-age=0, s-maxage=${HTML_MAX_STALE_S}`);
			headers.set(RENDERED_AT_HEADER, String(Date.now()));
			remember(cacheKey, html, 200, headers);
			const toEdge = new Response(html, { status: 200, headers });
			try {
				after(() => edgeCache()?.put(cacheKey, toEdge).catch(() => {}));
			} catch {}
			headers.set("x-cache", "MISS");
		}
		return new Response(html, { status: response.status, statusText: response.statusText, headers });
	}
	return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
});
