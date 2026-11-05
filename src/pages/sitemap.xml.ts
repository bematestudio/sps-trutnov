import type { APIRoute } from "astro";
import { createCms, urlFor } from "../lib/cms";
import { PRODUCTION_ORIGIN } from "../lib/site";

export const prerender = false;

/** Static routes that exist as files in src/pages. */
const STATIC = [
	"/",
	"/novinky",
	"/o-skole",
	"/o-skole/pracoviste",
	"/studium",
	"/studium/obory-vzdelani",
	"/studium/prijimaci-rizeni",
	"/studium/den-otevrenych-dveri",
	"/studium/casto-kladene-dotazy",
	"/kontakty",
	"/kontakty/lide",
	"/vice",
	"/galerie",
	"/ke-stazeni",
	"/ochrana-osobnich-udaju",
	"/pristupnost",
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export const GET: APIRoute = async ({ locals }) => {
	const cms = createCms(locals);
	const [posts, pages, programs] = await Promise.all([cms.posts({ limit: 1000 }), cms.pages(), cms.programs()]);
	const urls: Array<{ loc: string; lastmod?: string }> = [
		...STATIC.map((p) => ({ loc: p })),
		...programs.map((p) => ({ loc: urlFor("programs", p.slug) })),
		...pages.map((p) => ({ loc: `/${p.section}/${p.slug}` })),
		...posts.items.map((p) => ({ loc: urlFor("posts", p.slug), lastmod: p.date.toISOString().slice(0, 10) })),
	];
	const seen = new Set<string>();
	const body = urls
		.filter((u) => !seen.has(u.loc) && seen.add(u.loc))
		.map((u) => `<url><loc>${esc(PRODUCTION_ORIGIN + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`)
		.join("\n");
	return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`, {
		headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
	});
};
