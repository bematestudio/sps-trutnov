/**
 * One-off relocation of the EmDash database (a SQLite Durable Object) to a new
 * instance in Europe. Durable Objects stay where they were first created, and
 * ours was created from the US; a new instance created with
 * `locationHint: "weur"` lives in Europe, next to the visitors.
 *
 * Runs from the Worker's scheduled handler (src/worker.ts): copies schema and
 * rows from the source object to the target, verifies the row counts and
 * records a marker table in the target. Safe to re-run: a finished copy is
 * detected by the marker; an interrupted one is dropped and started again.
 * The site keeps using the source until astro.config.mjs points EmDash at the
 * target name.
 */
type Row = Record<string, unknown>;
interface Stub {
	query(sql: string, params?: unknown[]): Promise<{ rows: Row[] }>;
	batchQuery(statements: Array<{ sql: string; params?: unknown[] }>): Promise<Array<{ rows: Row[] }>>;
}
interface Namespace {
	idFromName(name: string): unknown;
	get(id: unknown, options?: { locationHint?: string }): Stub;
}

export const SOURCE_DB = "emdash";
export const TARGET_DB = "emdash-eu";
export const TARGET_LOCATION = "weur";
const MARKER = "_sps_relocated_from";
const FTS_SHADOW = ["_data", "_idx", "_content", "_docsize", "_config"];

const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

export async function relocateDatabase(ns: Namespace) {
	const source = ns.get(ns.idFromName(SOURCE_DB));
	const target = ns.get(ns.idFromName(TARGET_DB), { locationHint: TARGET_LOCATION });

	const done = await target.query(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, [MARKER]);
	if (done.rows.length) return { status: "already-done" as const };

	const master = (
		await source.query(
			`SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY rowid`,
		)
	).rows as Array<{ type: string; name: string; tbl_name: string; sql: string }>;
	if (!master.some((m) => m.name === "_emdash_migrations" || m.name.startsWith("ec_"))) {
		return { status: "source-empty" as const };
	}

	const virtual = master.filter((m) => m.type === "table" && /^CREATE VIRTUAL TABLE/i.test(m.sql));
	const shadow = new Set(virtual.flatMap((v) => FTS_SHADOW.map((s) => v.name + s)));
	const tables = master.filter((m) => m.type === "table" && !virtual.includes(m) && !shadow.has(m.name));
	const indexes = master.filter((m) => m.type === "index" && !shadow.has(m.tbl_name));
	const triggers = master.filter((m) => m.type === "trigger");
	const views = master.filter((m) => m.type === "view");

	// Start clean (an earlier attempt may have been interrupted).
	const existing = (
		await target.query(`SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND type IN ('table','view','trigger')`)
	).rows as Array<{ type: string; name: string }>;
	for (const t of existing.filter((e) => e.type === "trigger")) await target.query(`DROP TRIGGER IF EXISTS ${q(t.name)}`);
	for (const t of existing.filter((e) => e.type === "view")) await target.query(`DROP VIEW IF EXISTS ${q(t.name)}`);
	for (const t of existing.filter((e) => e.type === "table" && !shadow.has(e.name))) await target.query(`DROP TABLE IF EXISTS ${q(t.name)}`);
	await target.query(`PRAGMA foreign_keys = OFF`).catch(() => undefined);

	const counts: Record<string, number> = {};
	for (const t of tables) {
		await target.query(t.sql);
		const { rows } = await source.query(`SELECT * FROM ${q(t.name)}`);
		counts[t.name] = rows.length;
		if (!rows.length) continue;
		const cols = Object.keys(rows[0]);
		const sql = `INSERT INTO ${q(t.name)} (${cols.map(q).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
		for (let i = 0; i < rows.length; i += 100) {
			await target.batchQuery(rows.slice(i, i + 100).map((r) => ({ sql, params: cols.map((c) => r[c]) })));
		}
	}
	for (const i of indexes) await target.query(i.sql);
	for (const v of virtual) {
		await target.query(v.sql);
		if (/content\s*=/i.test(v.sql)) {
			await target.query(`INSERT INTO ${q(v.name)}(${q(v.name)}) VALUES ('rebuild')`);
		} else {
			const { rows } = await source.query(`SELECT rowid AS __rowid, * FROM ${q(v.name)}`);
			if (rows.length) {
				const cols = Object.keys(rows[0]).filter((c) => c !== "__rowid");
				const sql = `INSERT INTO ${q(v.name)} (rowid, ${cols.map(q).join(", ")}) VALUES (?, ${cols.map(() => "?").join(", ")})`;
				for (let i = 0; i < rows.length; i += 100) {
					await target.batchQuery(rows.slice(i, i + 100).map((r) => ({ sql, params: [r.__rowid, ...cols.map((c) => r[c])] })));
				}
			}
		}
	}
	for (const v of views) await target.query(v.sql);
	for (const t of triggers) await target.query(t.sql);
	await target.query(`PRAGMA foreign_keys = ON`).catch(() => undefined);

	// Verify, then mark as done.
	const mismatches: string[] = [];
	for (const [name, n] of Object.entries(counts)) {
		const got = Number((await target.query(`SELECT COUNT(*) AS n FROM ${q(name)}`)).rows[0]?.n ?? -1);
		if (got !== n) mismatches.push(`${name}: ${got}/${n}`);
	}
	if (mismatches.length) return { status: "mismatch" as const, mismatches };
	await target.query(`CREATE TABLE ${q(MARKER)} (source TEXT, copied_at TEXT, tables INTEGER, rows INTEGER)`);
	const total = Object.values(counts).reduce((a, b) => a + b, 0);
	await target.query(`INSERT INTO ${q(MARKER)} VALUES (?, ?, ?, ?)`, [SOURCE_DB, new Date().toISOString(), tables.length, total]);
	return { status: "copied" as const, tables: tables.length, rows: total, virtual: virtual.length, indexes: indexes.length, triggers: triggers.length };
}
