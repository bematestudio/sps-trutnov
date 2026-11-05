import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const TYPES: Record<string, string> = {
	pdf: "application/pdf",
	doc: "application/msword",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	xls: "application/vnd.ms-excel",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	ppt: "application/vnd.ms-powerpoint",
	pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	zip: "application/zip",
	jpg: "image/jpeg",
	png: "image/png",
};

/**
 * Documents of the old site (Phoca Download), mirrored into R2 under
 * `legacy/phocadownloadpap/…` by scripts/mirror-legacy-files.mjs. Keeps the
 * same URLs, so links from other sites and old e-mails keep working.
 */
export const GET: APIRoute = async ({ params, request }) => {
	const path = params.path ?? "";
	if (!path || path.includes("..") || path.length > 400) return new Response("Not found", { status: 404 });
	const bucket = (env as Record<string, unknown>).MEDIA as
		| {
				get(
					k: string,
				): Promise<{ body: ReadableStream; httpEtag: string; size: number; httpMetadata?: { contentType?: string } } | null>;
		  }
		| undefined;
	const obj = await bucket?.get(`legacy/phocadownloadpap/${path}`);
	if (!obj) return new Response("Soubor nenalezen", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
	if (request.headers.get("if-none-match") === obj.httpEtag) return new Response(null, { status: 304 });
	const ext = path.split(".").pop()?.toLowerCase() ?? "";
	const name = path.split("/").pop() ?? "soubor";
	return new Response(obj.body, {
		headers: {
			"content-type": TYPES[ext] ?? obj.httpMetadata?.contentType ?? "application/octet-stream",
			"content-length": String(obj.size),
			"content-disposition": `inline; filename="${name.replace(/[^\w.-]/g, "_")}"`,
			"cache-control": "public, max-age=86400",
			"x-content-type-options": "nosniff",
			etag: obj.httpEtag,
		},
	});
};
