import type { APIRoute } from "astro";
import { PRODUCTION_ORIGIN, isProductionHost } from "../lib/site";

export const prerender = false;

/**
 * Production: search engines + AI search/user fetchers allowed; AI model
 * training crawlers disallowed until the school decides otherwise (audit §12.2).
 * Every other host (workers.dev, previews): nothing may be crawled.
 */
const PRODUCTION = `# robots.txt for www.spstrutnov.cz
# AI crawler policy: search + user-triggered fetchers allowed, model training disallowed
# (default chosen 2026-11-05 pending the school's decision — see docs/audit-report-2026-11-05.md)

User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /prihlaseni
Disallow: /_emdash/
Content-Signal: search=yes, ai-train=no

User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: Claude-SearchBot
User-agent: Claude-User
User-agent: PerplexityBot
User-agent: Perplexity-User
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /prihlaseni
Disallow: /_emdash/

User-agent: GPTBot
User-agent: ClaudeBot
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: CCBot
User-agent: Meta-ExternalAgent
Disallow: /

Sitemap: ${PRODUCTION_ORIGIN}/sitemap.xml
`;

const PREVIEW = `# Preview/development host — not for indexing. Production: ${PRODUCTION_ORIGIN}
User-agent: *
Disallow: /
`;

export const GET: APIRoute = ({ url }) =>
	new Response(isProductionHost(url.hostname) ? PRODUCTION : PREVIEW, {
		headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
	});
