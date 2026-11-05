#!/usr/bin/env node
/**
 * Design critique: runs the Impeccable detector against the running site
 * (default http://127.0.0.1:4322 — start it with `pnpm preview`) for key
 * pages in light + dark theme, at desktop and mobile width.
 *
 *   BASE_URL=http://127.0.0.1:4322 pnpm critique
 *
 * Writes reports/critique.json and exits non-zero when findings remain.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:4322";
const PAGES = [
	"/",
	"/novinky",
	"/novinky/sps-trutnov-brana-do-sveta-modernich-technologii",
	"/studium",
	"/studium/obory-vzdelani",
	"/studium/obory-vzdelani/strojirenstvi-robotika-a-3d-modelovani",
	"/studium/prijimaci-rizeni",
	"/studium/den-otevrenych-dveri",
	"/studium/casto-kladene-dotazy",
	"/o-skole",
	"/o-skole/charakteristika-a-historie",
	"/kontakty",
	"/kontakty/lide",
	"/galerie",
	"/ke-stazeni",
	"/prihlaseni",
	"/admin",
	"/admin/novinky/upravit",
];
const RUNS = [
	{ theme: "light", viewport: "1280x800" },
	{ theme: "dark", viewport: "1280x800" },
	{ theme: "light", viewport: "390x844" },
];

process.env.CHROME_PATH ??= "/opt/pw-browsers/chromium";
const findings = [];
for (const run of RUNS) {
	for (const path of PAGES) {
		const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}theme=${run.theme}`;
		let out = "[]";
		try {
			out = execFileSync("npx", ["impeccable", "detect", "--json", "--no-advisory", "--viewport", run.viewport, url], {
				encoding: "utf8",
				stdio: ["ignore", "pipe", "ignore"],
			});
		} catch (e) {
			out = e.stdout || "[]"; // exit code 2 = findings present
		}
		const items = JSON.parse(out || "[]");
		for (const f of items) findings.push({ ...run, path, rule: f.antipattern, detail: f.snippet, selector: f.selector });
		console.log(`${items.length ? "✗" : "✓"} ${run.theme.padEnd(5)} ${run.viewport.padEnd(8)} ${path} ${items.length ? `(${items.length})` : ""}`);
	}
}
mkdirSync("reports", { recursive: true });
writeFileSync("reports/critique.json", JSON.stringify(findings, null, 2));
const byRule = Object.entries(Object.groupBy(findings, (f) => f.rule)).map(([rule, list]) => `${rule}: ${list.length}`);
console.log(findings.length ? `\n${findings.length} finding(s)\n${byRule.join("\n")}` : "\nNo Impeccable findings.");
process.exit(findings.length ? 2 : 0);
