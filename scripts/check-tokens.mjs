#!/usr/bin/env node
/**
 * Design-token lint: fails when raw design values leak outside tokens.css.
 *
 * Scans src/**\/*.css and <style> blocks of src/**\/*.astro for:
 *  - hex / rgb() / hsl() / oklch() colour literals
 *  - px units
 *  - literal ms/s durations in transition / animation
 *  - font-size not using a --text-* token (em/inherit allowed)
 *  - @media breakpoints other than the two sanctioned ones (48rem, 75rem)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const SRC = join(root, "src");
const ALLOWED_BREAKPOINTS = new Set(["48rem", "75rem"]);
const TOKENS_FILE = join(SRC, "styles/tokens.css");

const walk = (dir) =>
	readdirSync(dir).flatMap((name) => {
		const p = join(dir, name);
		return statSync(p).isDirectory() ? walk(p) : [p];
	});

const rules = [
	{ id: "color-literal", re: /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/g, msg: "raw colour — use a --color-* token" },
	{ id: "px-unit", re: /(?<![\w-])-?\d*\.?\d+px\b/g, msg: "px value — use rem tokens (--space-*, --border-width…)" },
	{
		id: "duration-literal",
		re: /(?:transition|animation)(?:-duration|-delay)?\s*:[^;]*?(?<![\w-])\d*\.?\d+m?s\b/g,
		msg: "literal duration — use --duration-* tokens",
	},
	{
		id: "font-size",
		re: /font-size\s*:(?!\s*(?:var\(--text-|inherit|[\d.]+em\b|calc\(var\(--text-))[^;]+/g,
		msg: "font-size must use a --text-* token",
	},
];

const violations = [];
for (const file of walk(SRC)) {
	if (file === TOKENS_FILE) continue;
	let css = "";
	if (file.endsWith(".css")) css = readFileSync(file, "utf8");
	else if (file.endsWith(".astro")) {
		const src = readFileSync(file, "utf8");
		css = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
	} else continue;
	if (!css) continue;
	const lines = css.split("\n");
	lines.forEach((line, i) => {
		const clean = line.replace(/\/\*.*?\*\//g, "");
		for (const rule of rules) {
			for (const m of clean.matchAll(rule.re)) {
				violations.push(`${relative(root, file)}:${i + 1}  [${rule.id}] ${m[0].trim()} — ${rule.msg}`);
			}
		}
		const media = clean.match(/@media[^{]*\(width\s*[<>]=?\s*([\d.]+\w+)\)/);
		if (media && !ALLOWED_BREAKPOINTS.has(media[1])) {
			violations.push(`${relative(root, file)}:${i + 1}  [breakpoint] ${media[1]} — use 48rem or 75rem`);
		}
	});
}

if (violations.length) {
	console.error(`✗ ${violations.length} design-token violation(s):\n${violations.join("\n")}`);
	process.exit(1);
}
console.log("✓ Design tokens: no hard-coded colours, px, durations, font sizes or stray breakpoints.");
