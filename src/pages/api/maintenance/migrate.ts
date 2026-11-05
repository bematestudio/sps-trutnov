import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { applySeed } from "emdash";
import { getDb } from "emdash/runtime";
import seed from "../../../../seed/seed.json";

export const prerender = false;

/**
 * Idempotent content/schema migrations for an already-initialised CMS.
 * (EmDash only applies the bundled seed on a fresh database.)
 *
 *   curl -X POST -H "Authorization: Bearer $MAINTENANCE_TOKEN" https://<site>/api/maintenance/migrate
 *
 * Authorised either by a logged-in EmDash administrator (session cookie,
 * same-origin request — use the button in /admin/nastaveni) or, for scripts,
 * by the optional MAINTENANCE_TOKEN Worker secret.
 *
 * 2026-11 #1  add the `videos` collection + the four school videos      (skip existing)
 * 2026-11 #2  partners: logos + URLs, retire the two entries without logo (update)
 */
type SeedFile = typeof seed & { collections: Array<{ slug: string }>; content: Record<string, Array<Record<string, unknown>>> };
const s = seed as unknown as SeedFile;

function timingSafeEqual(a: string, b: string) {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

const ROLE_ADMIN = 50;

export const POST: APIRoute = async ({ request, locals, session, url }) => {
	const secret = (env as Record<string, unknown>).MAINTENANCE_TOKEN;
	const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
	const byToken = typeof secret === "string" && secret.length > 0 && given.length > 0 && timingSafeEqual(given, secret);

	let byAdmin = false;
	if (!byToken) {
		// Same-origin only (the session cookie is SameSite, this is defence in depth).
		const origin = request.headers.get("origin");
		if (origin && origin !== url.origin) return new Response("Forbidden", { status: 403 });
		const sessionUser = (await session?.get("user").catch(() => undefined)) as { id?: string } | undefined;
		if (sessionUser?.id) {
			const row = await (await getDb())
				.selectFrom("users" as never)
				.select(["role" as never])
				.where("id" as never, "=", sessionUser.id as never)
				.executeTakeFirst()
				.catch(() => undefined);
			byAdmin = Number((row as { role?: number } | undefined)?.role ?? 0) >= ROLE_ADMIN;
		}
	}
	if (!byToken && !byAdmin) return Response.json({ ok: false, error: "Přihlaste se do EmDash CMS jako administrátor." }, { status: 401 });

	const db = await getDb();
	const storage = (locals as { emdash?: { storage?: unknown } }).emdash?.storage ?? undefined;
	const pick = (slug: string) => s.collections.find((c) => c.slug === slug)!;

	// #1 videos: create collection + entries, never overwrite editor changes.
	const videos = await applySeed(
		db,
		{ version: "1", collections: [pick("videos")], content: { videos: s.content.videos } } as never,
		{ includeContent: true, onConflict: "skip", storage } as never,
	);

	// #2 partners: the first deployment's seed had 10 text-only partners
	// (partner-1…partner-10). Rewrite them to the 8 partners with logos and
	// unpublish the remaining two.
	const retired = [
		{ id: "partner-9", slug: "partner-9", status: "draft", data: { name: "Hitachi", order: 9 } },
		{ id: "partner-10", slug: "partner-10", status: "draft", data: { name: "Argo-Hytos", order: 10 } },
	];
	const done = await (db as any)
		.selectFrom("ec_partners")
		.select("logo")
		.where("slug", "=", "partner-1")
		.executeTakeFirst()
		.catch(() => null);
	const partners = done?.logo
		? { content: { created: 0, skipped: 10, updated: 0 } }
		: await applySeed(
		db,
		{ version: "1", collections: [pick("partners")], content: { partners: [...s.content.partners, ...retired] } } as never,
		{ includeContent: true, onConflict: "update", storage } as never,
	);

	return Response.json({ ok: true, videos: (videos as { content: unknown }).content, partners: (partners as { content: unknown }).content });
};
