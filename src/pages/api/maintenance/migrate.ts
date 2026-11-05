import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { cmsUser, ROLE_ADMIN } from "../../../lib/auth";
import { MIGRATIONS, pendingMigrations, runMigrations } from "../../../lib/migrations";

export const prerender = false;

/**
 * Runs the pending CMS migrations from src/lib/migrations.ts now (they also run
 * automatically after the first request an isolate serves).
 *
 *   curl -X POST -H "Authorization: Bearer $MAINTENANCE_TOKEN" https://<site>/api/maintenance/migrate
 *
 * Authorised either by a logged-in EmDash administrator (session cookie,
 * same-origin request — the button in /admin/nastaveni) or, for scripts, by
 * the optional MAINTENANCE_TOKEN Worker secret. GET lists the migrations.
 */
function timingSafeEqual(a: string, b: string) {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

async function authorised(request: Request, session: Parameters<typeof cmsUser>[0], origin: string) {
	const secret = (env as Record<string, unknown>).MAINTENANCE_TOKEN;
	const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
	if (typeof secret === "string" && secret.length > 0 && given.length > 0 && timingSafeEqual(given, secret)) return true;
	const reqOrigin = request.headers.get("origin");
	if (reqOrigin && reqOrigin !== origin) return false;
	return ((await cmsUser(session))?.role ?? 0) >= ROLE_ADMIN;
}

const DENIED = () => Response.json({ ok: false, error: "Přihlaste se do EmDash CMS jako administrátor." }, { status: 401 });

export const GET: APIRoute = async ({ request, session, url }) => {
	if (!(await authorised(request, session, url.origin))) return DENIED();
	const pending = new Set((await pendingMigrations()).map((m) => m.id));
	return Response.json({ ok: true, migrations: MIGRATIONS.map((m) => ({ id: m.id, label: m.label, applied: !pending.has(m.id) })) });
};

export const POST: APIRoute = async ({ request, locals, session, url }) => {
	if (!(await authorised(request, session, url.origin))) return DENIED();
	const storage = (locals as { emdash?: { storage?: unknown } }).emdash?.storage;
	const result = await runMigrations(storage, { force: true });
	const failed = result.ran.some((r) => "error" in r && r.error);
	return Response.json({ ok: !failed, ...result }, { status: failed ? 500 : 200 });
};
