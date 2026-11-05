#!/usr/bin/env node
/**
 * Converts CMS media in R2 to responsive AVIF + WebP variants.
 *
 *   CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… pnpm optimize:media [--force] [--dry-run]
 *
 * For every image in the MEDIA bucket (see wrangler.jsonc) it writes
 *   opt/<storageKey>/<480|720|960|1600>.<avif|webp>
 * (never upscaled; only widths up to the original). The site serves them via
 * /media/opt/… and <CmsImage>, falling back to the original for media that
 * hasn't been processed yet — so run this after uploading new photos.
 * Already-optimised images are skipped unless --force.
 */
import { readFileSync } from "node:fs";
import sharp from "sharp";

const WIDTHS = [480, 720, 960, 1600];
const FORMATS = {
	avif: (img) => img.avif({ quality: 52, effort: 5 }),
	webp: (img) => img.webp({ quality: 74, effort: 5 }),
};
const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const DRY = args.has("--dry-run");

const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) throw new Error("Set CLOUDFLARE_API_TOKEN (needs R2 read/write).");
const api = "https://api.cloudflare.com/client/v4";
const headers = { Authorization: `Bearer ${token}` };

async function cf(path, init = {}) {
	const res = await fetch(`${api}${path}`, { ...init, headers: { ...headers, ...init.headers } });
	if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status} ${await res.text()}`);
	return res;
}

const account =
	process.env.CLOUDFLARE_ACCOUNT_ID ?? (await (await cf("/accounts")).json()).result?.[0]?.id;
const wrangler = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, "");
const bucket =
	process.env.MEDIA_BUCKET ??
	JSON.parse(wrangler).r2_buckets.find((b) => b.binding === "MEDIA").bucket_name;
const base = `/accounts/${account}/r2/buckets/${bucket}/objects`;

async function list(prefix = "") {
	const out = [];
	let cursor;
	do {
		const q = new URLSearchParams({ per_page: "1000", ...(prefix && { prefix }), ...(cursor && { cursor }) });
		const json = await (await cf(`${base}?${q}`)).json();
		out.push(...json.result);
		cursor = json.result_info?.is_truncated ? json.result_info.cursor : undefined;
	} while (cursor);
	return out;
}

const all = await list();
const existing = new Set(all.filter((o) => o.key.startsWith("opt/")).map((o) => o.key));
const originals = all.filter(
	(o) => !o.key.startsWith("opt/") && /\.(jpe?g|png|webp)$/i.test(o.key) && !o.key.includes("/"),
);
console.log(`Bucket ${bucket}: ${originals.length} images, ${existing.size} existing variants`);

let before = 0;
let after = 0;
let done = 0;
for (const obj of originals) {
	const input = Buffer.from(await (await cf(`${base}/${encodeURIComponent(obj.key)}`)).arrayBuffer());
	const meta = await sharp(input).metadata();
	const orig = meta.width ?? 1600;
	const widths = [];
	for (const w of WIDTHS) {
		widths.push(w);
		if (w >= orig) break;
	}
	const wanted = widths.flatMap((w) => Object.keys(FORMATS).map((f) => `opt/${obj.key}/${w}.${f}`));
	if (!FORCE && wanted.every((k) => existing.has(k))) continue;

	before += input.length;
	for (const w of widths) {
		for (const [fmt, encode] of Object.entries(FORMATS)) {
			const key = `opt/${obj.key}/${w}.${fmt}`;
			const buf = await encode(sharp(input).rotate().resize({ width: Math.min(w, orig), withoutEnlargement: true })).toBuffer();
			if (w === widths[widths.length - 1] && fmt === "avif") after += buf.length;
			if (!DRY)
				await cf(`${base}/${key.split("/").map(encodeURIComponent).join("/")}`, {
					method: "PUT",
					body: buf,
					headers: { "Content-Type": `image/${fmt}` },
				});
		}
	}
	done++;
	console.log(`✓ ${obj.key} (${orig}px, ${Math.round(input.length / 1024)} kB) → ${widths.join("/")}px avif+webp`);
}
console.log(
	done
		? `\n${done} image(s) optimised. Largest AVIF vs original: ${Math.round(after / 1024)} kB vs ${Math.round(before / 1024)} kB (−${Math.round((1 - after / before) * 100)} %)${DRY ? " [dry run]" : ""}`
		: "\nEverything already optimised.",
);
