/**
 * Content/schema migrations for an already-initialised CMS.
 *
 * EmDash applies seed/seed.json only to an empty database. Everything the
 * seed gained afterwards is listed here as a numbered, idempotent migration.
 * They run automatically (deferred, after the response) on the first request
 * an isolate serves while any is pending, and can also be started from
 * /admin/nastaveni (POST /api/maintenance/migrate).
 *
 * Applied migrations are recorded in the EmDash `options` table under
 * `sps:migrations`; a short-lived lock (`sps:migrations-lock`) keeps two
 * isolates from running them at the same time. Every migration is safe to
 * re-run: entries are matched by slug, so an interrupted run just continues.
 */
import { applySeed, OptionsRepository } from "emdash";
import { getDb } from "emdash/runtime";
import seed from "../../seed/seed.json";

type SeedEntry = { id?: string; slug: string; status?: string; data: Record<string, unknown> };
type SeedFile = { collections: Array<{ slug: string }>; content: Record<string, SeedEntry[]> };
const s = seed as unknown as SeedFile;
type Db = Awaited<ReturnType<typeof getDb>>;

const pick = (slug: string) => {
	const c = s.collections.find((x) => x.slug === slug);
	if (!c) throw new Error(`seed has no collection "${slug}"`);
	return c;
};
const entries = (collection: string, slugs?: string[]) =>
	(s.content[collection] ?? []).filter((e) => !slugs || slugs.includes(e.slug));

async function apply(
	db: Db,
	storage: unknown,
	collections: string[],
	content: Record<string, SeedEntry[]>,
	onConflict: "skip" | "update",
	withSchema = true,
) {
	const result = await applySeed(
		db as never,
		{ version: "1", collections: withSchema ? collections.map(pick) : [], content } as never,
		{ includeContent: true, onConflict, storage } as never,
	);
	return (result as { content: unknown }).content;
}

interface Migration {
	id: string;
	label: string;
	run: (db: Db, storage: unknown) => Promise<unknown>;
}

export const MIGRATIONS: Migration[] = [
	{
		id: "2026-11-01-videos",
		label: "Kolekce Videa + čtyři školní videa",
		run: (db, storage) => apply(db, storage, ["videos"], { videos: entries("videos") }, "skip"),
	},
	{
		id: "2026-11-02-partners",
		label: "Partneři s logy; Hitachi a Argo-Hytos jako koncept",
		async run(db, storage) {
			const done = await (db as any)
				.selectFrom("ec_partners")
				.select("logo")
				.where("slug", "=", "partner-1")
				.executeTakeFirst()
				.catch(() => null);
			if (done?.logo) return "already applied";
			const retired = [
				{ id: "partner-9", slug: "partner-9", status: "draft", data: { name: "Hitachi", order: 9 } },
				{ id: "partner-10", slug: "partner-10", status: "draft", data: { name: "Argo-Hytos", order: 10 } },
			];
			return apply(db, storage, ["partners"], { partners: [...entries("partners"), ...retired] }, "update");
		},
	},
	{
		id: "2026-11-05-pages",
		label: "8 stránek z původního webu (certifikáty, nadační fond, projekty, média…)",
		run: (db, storage) => apply(db, storage, ["pages"], { pages: entries("pages") }, "skip", false),
	},
	{
		id: "2026-11-05-people",
		label: "Kompletní seznam zaměstnanců (66) z původního webu",
		run: (db, storage) => apply(db, storage, ["people"], { people: entries("people") }, "update", false),
	},
	{
		id: "2026-11-05-documents",
		label: "195 dokumentů z původního webu; ukázkové dokumenty jako koncept",
		async run(db, storage) {
			// The first seed had 16 placeholder documents (dokument-1…16).
			const old = (await (db as any)
				.selectFrom("ec_documents")
				.select(["slug", "title"])
				.where("slug", "like", "dokument-%")
				.execute()
				.catch(() => [])) as Array<{ slug: string; title: string }>;
			const retired = old.map((d) => ({ id: `retired-${d.slug}`, slug: d.slug, status: "draft", data: { title: d.title } }));
			const updated = retired.length
				? await apply(db, storage, ["documents"], { documents: retired }, "update")
				: await apply(db, storage, ["documents"], {}, "update");
			const created = await apply(db, storage, ["documents"], { documents: entries("documents") }, "skip", false);
			return { retired: updated, created };
		},
	},
	{
		id: "2026-11-05-copy-fixes",
		label: "Opravy textů (Nástrojař, odkaz ZPA)",
		run: async (db, storage) => ({
			programs: await apply(db, storage, ["programs"], { programs: entries("programs", ["nastrojar"]) }, "update", false),
			partners: await apply(db, storage, ["partners"], { partners: entries("partners", ["partner-8"]) }, "update", false),
		}),
	},
];

const APPLIED_KEY = "sps:migrations";
const LOCK_KEY = "sps:migrations-lock";
const LOCK_TTL_MS = 5 * 60_000;

export async function pendingMigrations(db?: Db) {
	const options = new OptionsRepository((db ?? (await getDb())) as never);
	const applied = ((await options.get(APPLIED_KEY)) as Record<string, string> | null) ?? {};
	return MIGRATIONS.filter((m) => !applied[m.id]);
}

export async function runMigrations(storage: unknown, opts: { force?: boolean } = {}) {
	const db = await getDb();
	const options = new OptionsRepository(db as never);
	const pending = await pendingMigrations(db);
	if (!pending.length) return { ran: [], pending: 0 };

	const now = Date.now();
	const lock = (await options.get(LOCK_KEY)) as number | null;
	if (!opts.force && lock && now - lock < LOCK_TTL_MS) return { ran: [], pending: pending.length, locked: true };
	await options.set(LOCK_KEY, now);

	const ran: Array<{ id: string; result?: unknown; error?: string }> = [];
	try {
		for (const m of pending) {
			try {
				const result = await m.run(db, storage);
				const applied = ((await options.get(APPLIED_KEY)) as Record<string, string> | null) ?? {};
				applied[m.id] = new Date().toISOString();
				await options.set(APPLIED_KEY, applied);
				ran.push({ id: m.id, result });
			} catch (e) {
				console.error(`[migrations] ${m.id} failed`, e);
				ran.push({ id: m.id, error: e instanceof Error ? e.message : String(e) });
				break; // keep order: later migrations may depend on this one
			}
		}
	} finally {
		await options.set(LOCK_KEY, 0);
	}
	return { ran, pending: (await pendingMigrations(db)).length };
}
