import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const TYPES: Record<string, string> = { avif: "image/avif", webp: "image/webp" };
const SAFE = /^[A-Za-z0-9._-]+\/(480|720|960|1600)\.(avif|webp)$/;

/**
 * Serves pre-generated AVIF/WebP variants of CMS media from R2 (`opt/…`).
 * New uploads that haven't been optimised yet transparently fall back to the
 * original file, so <picture> sources never break.
 */
export const GET: APIRoute = async ({ params, redirect }) => {
	const path = params.path ?? "";
	if (!SAFE.test(path)) return new Response("Not found", { status: 404 });
	const bucket = (env as Record<string, unknown>).MEDIA as
		| { get(k: string): Promise<{ body: ReadableStream; httpEtag: string } | null> }
		| undefined;
	const obj = await bucket?.get(`opt/${path}`);
	if (!obj) {
		const original = path.split("/")[0];
		const res = redirect(`/_emdash/api/media/file/${original}`, 302);
		res.headers.set("cache-control", "public, max-age=300");
		return res;
	}
	return new Response(obj.body, {
		headers: {
			"content-type": TYPES[path.split(".").pop()!],
			"cache-control": "public, max-age=31536000, immutable",
			etag: obj.httpEtag,
		},
	});
};
