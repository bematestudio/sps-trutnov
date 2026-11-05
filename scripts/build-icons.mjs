#!/usr/bin/env node
/**
 * Generates favicons, PWA icons and the default social-share image from the
 * official logo (public/images/logo-spstrutnov.svg, public/favicon.svg).
 *
 *   node scripts/build-icons.mjs
 *
 * Writes: public/favicon.ico (16/32/48), apple-touch-icon.png (180),
 * icon-192.png, icon-512.png, icon-maskable-512.png, og-default.png (1200×630).
 * Brand colours are the logo's own (tokens.css: --brand-logo-*).
 */
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { chromium } from "@playwright/test";

const pub = (p) => new URL(`../public/${p}`, import.meta.url);
const NAVY = "#2f2483";
const favicon = readFileSync(pub("favicon.svg"));

const png = (size, pad = 0, bg = { r: 0, g: 0, b: 0, alpha: 0 }) =>
	sharp(favicon, { density: 600 })
		.resize(size - pad * 2, size - pad * 2)
		.extend({ top: pad, bottom: pad, left: pad, right: pad, background: bg })
		.png()
		.toBuffer();

const white = { r: 255, g: 255, b: 255, alpha: 1 };
writeFileSync(pub("apple-touch-icon.png"), await png(180, 18, white));
writeFileSync(pub("icon-192.png"), await png(192, 8));
writeFileSync(pub("icon-512.png"), await png(512, 20));
// Maskable: logo inside the 80 % safe zone on the brand navy.
writeFileSync(pub("icon-maskable-512.png"), await png(512, 72, { r: 0x2f, g: 0x24, b: 0x83, alpha: 1 }));

// ICO with embedded PNGs (16, 32, 48).
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((s) => png(s)));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
	const e = 6 + 16 * i;
	header.writeUInt8(s, e);
	header.writeUInt8(s, e + 1);
	header.writeUInt8(0, e + 2);
	header.writeUInt8(0, e + 3);
	header.writeUInt16LE(1, e + 4);
	header.writeUInt16LE(32, e + 6);
	header.writeUInt32LE(images[i].length, e + 8);
	header.writeUInt32LE(offset, e + 12);
	offset += images[i].length;
});
writeFileSync(pub("favicon.ico"), Buffer.concat([header, ...images]));

// Social-share image, rendered with the site's own font.
const font = new URL("../node_modules/@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2", import.meta.url);
const fontLatin = new URL("../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2", import.meta.url);
// Logo for a dark background: the mark in brand colours, the wordmark in white
// (same markup as src/components/Logo.astro).
const logoSrc = readFileSync(new URL("../src/components/Logo.astro", import.meta.url), "utf8");
const pathsOf = (cls) => [...logoSrc.matchAll(new RegExp(`class="${cls}" d="([^"]+)"`, "g"))].map((m) => m[1]);
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 115.68 28.8" fill-rule="evenodd">${[
	["logo__disc", "#fff"],
	["logo__navy", NAVY],
	["logo__blue", "#008acc"],
	["logo__word", "#fff"],
]
	.flatMap(([cls, fill]) => pathsOf(cls).map((d) => `<path fill="${fill}" d="${d}"/>`))
	.join("")}</svg>`;
const b64 = (u) => readFileSync(u).toString("base64");
const photo = readFileSync(pub("images/foto/bg-ele-1600.webp")).toString("base64");
const html = `<!doctype html><html><head><style>
@font-face{font-family:Inter;src:url(data:font/woff2;base64,${b64(fontLatin)}) format("woff2");font-weight:100 900;unicode-range:U+0000-00FF}
@font-face{font-family:Inter;src:url(data:font/woff2;base64,${b64(font)}) format("woff2");font-weight:100 900}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;font-family:Inter;color:#fff;background:${NAVY};position:relative;overflow:hidden}
.bg{position:absolute;inset:0;background:url(data:image/webp;base64,${photo}) center/cover;opacity:.28;mix-blend-mode:luminosity}
.grad{position:absolute;inset:0;background:linear-gradient(100deg,${NAVY} 30%,rgba(47,36,131,.55) 100%)}
.in{position:absolute;inset:64px 72px;display:flex;flex-direction:column;justify-content:space-between}
.logo{height:84px}.logo svg{height:84px;width:auto}
h1{font-size:76px;line-height:1.02;letter-spacing:-.035em;font-weight:600;max-width:15ch}
p{font-size:28px;opacity:.85;margin-top:22px;letter-spacing:-.01em}
.pill{display:inline-block;border:2px solid rgba(255,255,255,.5);border-radius:999px;padding:8px 22px;font-size:22px;letter-spacing:.04em}
</style></head><body><div class="bg"></div><div class="grad"></div><div class="in">
<div class="logo">${logo}</div>
<div><h1>Střední průmyslová škola Trutnov</h1><p>Elektrotechnika · Informační technologie · Strojírenství</p></div>
<span class="pill" style="align-self:flex-start">www.spstrutnov.cz</span>
</div></body></html>`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
writeFileSync(pub("og-default.png"), await sharp(await page.screenshot({ type: "png" })).png({ compressionLevel: 9, palette: false }).toBuffer());
await browser.close();
console.log("icons + og-default.png written");
