import type { APIRoute } from "astro";
import { createCms } from "../lib/cms";

export const prerender = false;

/**
 * Compact index for the ⌘K palette. Fetched lazily the first time the palette
 * opens (or on hover/focus of the search trigger) and cached at the edge.
 * Shape: { v, items: [type, title, url, description, keywords][] }
 */
export const GET: APIRoute = async ({ locals }) => {
	const cms = createCms(locals);
	const [{ items: posts }, pages, programs, people, docs] = await Promise.all([
		cms.posts({ limit: 500 }),
		cms.pages(),
		cms.programs(),
		cms.people(),
		cms.documents(),
	]);
	const cut = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…` : s);
	const items: Array<[string, string, string, string, string]> = [
		...programs.map((p) => ["obor", p.title, `/studium/obory-vzdelani/${p.slug}`, cut(p.summary), `${p.shortTitle} ${p.code} ${p.highlights.join(" ")} ${p.careers.join(" ")}`] as [string, string, string, string, string]),
		...pages.map((p) => ["stranka", p.title, `/${p.section}/${p.slug}`, cut(p.lead), p.section] as [string, string, string, string, string]),
		...posts.map((p) => ["novinka", p.title, `/novinky/${p.slug}`, cut(p.excerpt), `${p.category?.label ?? ""} ${p.tags.map((t) => t.label).join(" ")} ${p.author}`] as [string, string, string, string, string]),
		...people.map((p) => ["osoba", p.name, `/kontakty/lide?q=${encodeURIComponent(p.name)}`, `${p.role} · ${p.workplace}`, `${p.email} ${p.phone}`] as [string, string, string, string, string]),
		...docs.map((d) => ["dokument", d.title, d.url, `${d.fileType} · ${d.size}`, d.category] as [string, string, string, string, string]),
	];
	return new Response(JSON.stringify({ v: 1, items }), {
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
		},
	});
};
