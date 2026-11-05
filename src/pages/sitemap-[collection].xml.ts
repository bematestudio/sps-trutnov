import type { APIRoute } from "astro";

export const prerender = false;

/** EmDash's per-collection sitemaps are replaced by the single /sitemap.xml. */
export const GET: APIRoute = () => new Response(null, { status: 301, headers: { location: "/sitemap.xml" } });
