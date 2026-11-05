import type { APIRoute } from "astro";

export const prerender = false;

const ID = /^[\w-]{11}$/;
const QUALITY = new Set(["mqdefault", "hqdefault", "sddefault", "maxresdefault"]);

/**
 * YouTube thumbnails served from our own origin (privacy: no request to Google
 * before the visitor clicks play; lets the CSP keep img-src to 'self').
 * Cached at the edge for a week.
 */
export const GET: APIRoute = async ({ params, request }) => {
	const id = params.id ?? "";
	const q = (params.q ?? "").replace(/\.jpg$/, "");
	if (!ID.test(id) || !QUALITY.has(q)) return new Response("Not found", { status: 404 });

	const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
	const key = new Request(new URL(`/media/yt/${id}/${q}.jpg`, request.url).href);
	const hit = await cache?.match(key);
	if (hit) return hit;

	const upstream = await fetch(`https://i.ytimg.com/vi/${id}/${q}.jpg`);
	if (!upstream.ok) return new Response("Not found", { status: 404 });
	const res = new Response(upstream.body, {
		headers: {
			"content-type": "image/jpeg",
			"cache-control": "public, max-age=604800, stale-while-revalidate=86400",
			"x-content-type-options": "nosniff",
		},
	});
	await cache?.put(key, res.clone()).catch(() => {});
	return res;
};
