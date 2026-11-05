#!/usr/bin/env node
/**
 * Copies the downloadable documents of the old site (www.spstrutnov.cz,
 * Phoca Download) into the MEDIA R2 bucket, so document links keep working
 * after the DNS switch, and rewrites seed/content/legacy-extra.json to the
 * site-relative URLs served by src/pages/phocadownloadpap/[...path].ts.
 *
 *   CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… node scripts/mirror-legacy-files.mjs
 *
 * Keys:  legacy/phocadownloadpap/<original path>          (direct links)
 *        legacy/phocadownloadpap/_download/<id>-<slug>.<ext> (?download=<id>:<slug> links)
 * Idempotent: objects already in the bucket are skipped.
 */
import { readFileSync, writeFileSync } from "node:fs";

const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) throw new Error("Set CLOUDFLARE_API_TOKEN (needs R2 read/write).");
const api = "https://api.cloudflare.com/client/v4";
const cf = async (path, init = {}) => {
	const res = await fetch(`${api}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } });
	if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status} ${await res.text()}`);
	return res;
};
const account = process.env.CLOUDFLARE_ACCOUNT_ID ?? (await (await cf("/accounts")).json()).result?.[0]?.id;
const wrangler = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, "");
const bucket = JSON.parse(wrangler).r2_buckets.find((b) => b.binding === "MEDIA").bucket_name;
const base = `/accounts/${account}/r2/buckets/${bucket}/objects`;

const existing = new Set();
let cursor;
do {
	const q = new URLSearchParams({ per_page: "1000", prefix: "legacy/", ...(cursor && { cursor }) });
	const json = await (await cf(`${base}?${q}`)).json();
	for (const o of json.result) existing.add(o.key);
	cursor = json.result_info?.is_truncated ? json.result_info.cursor : undefined;
} while (cursor);

const file = new URL("../seed/content/legacy-extra.json", import.meta.url);
const data = JSON.parse(readFileSync(file, "utf8"));
const TYPES = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", zip: "application/zip", jpg: "image/jpeg", png: "image/png" };

function target(url) {
	const u = new URL(url, "https://www.spstrutnov.cz");
	if (u.hostname !== "www.spstrutnov.cz") return null;
	if (u.pathname.startsWith("/phocadownloadpap/")) return decodeURIComponent(u.pathname.slice(1));
	const dl = u.searchParams.get("download");
	if (dl) {
		const [id, slug = "soubor"] = dl.split(":");
		return { pending: `phocadownloadpap/_download/${id}-${slug}` };
	}
	return null;
}

let copied = 0, skipped = 0, failed = 0, bytes = 0;
const queue = data.documents.filter((d) => /^https?:\/\/www\.spstrutnov\.cz\//.test(d.file_url));
async function work(doc) {
	const t = target(doc.file_url);
	if (!t) return;
	let path = typeof t === "string" ? t : null;
	if (path && existing.has(`legacy/${path}`)) {
		doc.file_url = `/${path}`;
		skipped++;
		return;
	}
	try {
		const res = await fetch(doc.file_url, { redirect: "follow" });
		if (!res.ok) throw new Error(String(res.status));
		const ctype = res.headers.get("content-type") ?? "";
		if (ctype.includes("text/html")) throw new Error("got HTML, not a file");
		if (!path) {
			const cd = res.headers.get("content-disposition") ?? "";
			const ext = (cd.match(/filename\*?=(?:UTF-8'')?"?[^";]*\.(\w{2,5})"?/i)?.[1] ?? doc.file_type ?? "pdf").toLowerCase();
			path = `${t.pending}.${ext}`;
		}
		const buf = Buffer.from(await res.arrayBuffer());
		const ext = path.split(".").pop().toLowerCase();
		if (!existing.has(`legacy/${path}`)) {
			await cf(`${base}/${encodeURIComponent(`legacy/${path}`)}`, {
				method: "PUT",
				headers: { "content-type": TYPES[ext] ?? (ctype || "application/octet-stream") },
				body: buf,
			});
			bytes += buf.length;
			copied++;
		} else skipped++;
		doc.file_url = `/${path}`;
	} catch (e) {
		failed++;
		console.warn(`✗ ${doc.title}: ${doc.file_url} (${e.message})`);
	}
}
const CONCURRENCY = 4;
for (let i = 0; i < queue.length; i += CONCURRENCY) await Promise.all(queue.slice(i, i + CONCURRENCY).map(work));

writeFileSync(file, JSON.stringify(data, null, "\t") + "\n");
console.log(`copied ${copied} (${(bytes / 1e6).toFixed(1)} MB), already there ${skipped}, failed ${failed}`);
