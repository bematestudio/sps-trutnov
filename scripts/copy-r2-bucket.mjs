#!/usr/bin/env node
/**
 * Copies every object from one R2 bucket to another (e.g. into an EU-jurisdiction
 * bucket). Idempotent: objects that already exist with the same size are skipped.
 *
 *   CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… \
 *     node scripts/copy-r2-bucket.mjs <source> <target> [--target-jurisdiction eu]
 */
const [, , SRC, DST, ...rest] = process.argv;
const dstJurisdiction = rest.includes("--target-jurisdiction") ? rest[rest.indexOf("--target-jurisdiction") + 1] : undefined;
const srcJurisdiction = rest.includes("--source-jurisdiction") ? rest[rest.indexOf("--source-jurisdiction") + 1] : undefined;
if (!SRC || !DST) throw new Error("usage: copy-r2-bucket.mjs <source> <target> [--target-jurisdiction eu]");
const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !account) throw new Error("Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.");
const api = `https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets`;

async function cf(path, init = {}, jurisdiction) {
	const headers = { Authorization: `Bearer ${token}`, ...(jurisdiction ? { "cf-r2-jurisdiction": jurisdiction } : {}), ...init.headers };
	for (let attempt = 1; ; attempt++) {
		const res = await fetch(`${api}${path}`, { ...init, headers });
		if (res.ok || res.status === 404 || attempt >= 4) return res;
		await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
	}
}
async function list(bucket, jurisdiction) {
	const out = [];
	let cursor;
	do {
		const q = new URLSearchParams({ per_page: "1000", ...(cursor && { cursor }) });
		const json = await (await cf(`/${bucket}/objects?${q}`, {}, jurisdiction)).json();
		if (!json.success) throw new Error(JSON.stringify(json.errors));
		out.push(...json.result);
		cursor = json.result_info?.is_truncated ? json.result_info.cursor : undefined;
	} while (cursor);
	return out;
}

const [source, target] = await Promise.all([list(SRC, srcJurisdiction), list(DST, dstJurisdiction)]);
const have = new Map(target.map((o) => [o.key, o.size]));
const todo = source.filter((o) => have.get(o.key) !== o.size);
console.log(`${SRC}: ${source.length} objects, ${todo.length} to copy → ${DST}${dstJurisdiction ? ` (${dstJurisdiction})` : ""}`);
let done = 0, bytes = 0, failed = 0;
async function copy(o) {
	const key = encodeURIComponent(o.key);
	const res = await cf(`/${SRC}/objects/${key}`, {}, srcJurisdiction);
	if (!res.ok) return void (failed++, console.warn(`✗ GET ${o.key} ${res.status}`));
	const body = Buffer.from(await res.arrayBuffer());
	const put = await cf(`/${DST}/objects/${key}`, { method: "PUT", body, headers: { "content-type": o.http_metadata?.contentType ?? res.headers.get("content-type") ?? "application/octet-stream" } }, dstJurisdiction);
	if (!put.ok) return void (failed++, console.warn(`✗ PUT ${o.key} ${put.status} ${await put.text()}`));
	done++;
	bytes += body.length;
	if (done % 50 === 0) console.log(`  ${done}/${todo.length}`);
}
for (let i = 0; i < todo.length; i += 6) await Promise.all(todo.slice(i, i + 6).map(copy));
console.log(`copied ${done} (${(bytes / 1e6).toFixed(1)} MB), failed ${failed}`);
if (failed) process.exitCode = 1;
