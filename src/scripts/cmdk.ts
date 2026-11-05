/**
 * ⌘K command palette. Loaded on demand (dynamic import from site.ts) so it
 * costs nothing until a visitor actually searches. The index is fetched once
 * and cached by the browser + edge.
 */
type Item = [kind: string, title: string, url: string, desc: string, keywords: string];
interface Entry {
	kind: string;
	title: string;
	url: string;
	desc: string;
	nTitle: string;
	nAll: string;
}

const KIND_LABEL: Record<string, string> = {
	obor: "Obory",
	stranka: "Stránky",
	novinka: "Novinky",
	osoba: "Lidé",
	dokument: "Dokumenty",
	odkaz: "Rychlé odkazy",
};
const KIND_BOOST: Record<string, number> = { obor: 6, stranka: 4, odkaz: 4, osoba: 2, dokument: 1, novinka: 0 };
const QUICK: Item[] = [
	["odkaz", "Obory vzdělání", "/studium/obory-vzdelani", "Maturitní a učební obory", ""],
	["odkaz", "Přijímací řízení", "/studium/prijimaci-rizeni", "Termíny, kritéria a postup", ""],
	["odkaz", "Den otevřených dveří", "/studium/den-otevrenych-dveri", "Přijďte se podívat", ""],
	["odkaz", "Novinky", "/novinky", "Ze života školy", ""],
	["odkaz", "Kontakty", "/kontakty", "Pracoviště, telefon, e-mail", ""],
	["odkaz", "Studijní průkaz (Bakaláři)", "https://bakalari.spstrutnov.cz", "Klasifikace a rozvrh", ""],
];

const norm = (s: string) =>
	s
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase();
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const toEntry = ([kind, title, url, desc, kw]: Item): Entry => ({
	kind,
	title,
	url,
	desc,
	nTitle: norm(title),
	nAll: norm(`${title} ${desc} ${kw}`),
});

let index: Entry[] | null = null;
let loading: Promise<Entry[]> | null = null;
export function preload() {
	loading ??= fetch("/search-index.json")
		.then((r) => r.json())
		.then((d: { items: Item[] }) => (index = [...QUICK, ...d.items].map(toEntry)))
		.catch(() => (index = QUICK.map(toEntry)));
	return loading;
}

/** Diacritics-insensitive multi-token ranking with prefix + typo-tolerant fallback. */
function rank(query: string): Entry[] {
	const tokens = norm(query).split(/\s+/).filter(Boolean);
	if (!tokens.length || !index) return [];
	const scored: Array<[number, Entry]> = [];
	for (const e of index) {
		let score = KIND_BOOST[e.kind] ?? 0;
		let ok = true;
		for (const t of tokens) {
			if (e.nTitle.startsWith(t)) score += 14;
			else if (new RegExp(`(^|\\s)${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(e.nTitle)) score += 10;
			else if (e.nTitle.includes(t)) score += 6;
			else if (e.nAll.includes(t)) score += 2;
			else if (t.length > 3 && e.nAll.includes(t.slice(0, -1))) score += 1; // Czech inflection
			else {
				ok = false;
				break;
			}
		}
		if (ok) scored.push([score, e]);
	}
	return scored
		.sort((a, b) => b[0] - a[0])
		.slice(0, 14)
		.map(([, e]) => e);
}

function highlight(text: string, query: string) {
	const tokens = norm(query).split(/\s+/).filter((t) => t.length > 1);
	if (!tokens.length) return esc(text);
	const n = norm(text);
	const marks = new Array(text.length).fill(false);
	for (const t of tokens) {
		let i = n.indexOf(t);
		while (i !== -1) {
			for (let k = i; k < i + t.length; k++) marks[k] = true;
			i = n.indexOf(t, i + t.length);
		}
	}
	let out = "";
	let open = false;
	[...text].forEach((ch, i) => {
		if (marks[i] && !open) (out += "<mark>"), (open = true);
		if (!marks[i] && open) (out += "</mark>"), (open = false);
		out += esc(ch);
	});
	return open ? `${out}</mark>` : out;
}

let dialog: HTMLDialogElement | null = null;
let lastFocus: HTMLElement | null = null;

function build() {
	dialog = document.createElement("dialog");
	dialog.className = "cmdk";
	dialog.setAttribute("aria-label", "Vyhledávání na webu");
	dialog.innerHTML = `
		<div class="cmdk__box">
			<div class="cmdk__field">
				<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4"/></svg>
				<input class="cmdk__input" type="search" role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-autocomplete="list" placeholder="Hledat obory, novinky, lidi, dokumenty…" autocomplete="off" spellcheck="false" />
				<kbd class="cmdk__kbd">Esc</kbd>
			</div>
			<ul class="cmdk__list" id="cmdk-list" role="listbox" aria-label="Výsledky"></ul>
			<div class="cmdk__foot"><span><kbd>↑</kbd><kbd>↓</kbd> výběr</span><span><kbd>↵</kbd> otevřít</span><a href="/vyhledavani" class="cmdk__all">Celé vyhledávání</a></div>
		</div>`;
	document.body.append(dialog);
	const input = dialog.querySelector<HTMLInputElement>(".cmdk__input")!;
	const list = dialog.querySelector<HTMLUListElement>(".cmdk__list")!;
	const all = dialog.querySelector<HTMLAnchorElement>(".cmdk__all")!;
	let active = 0;
	let results: Entry[] = [];

	const render = () => {
		const q = input.value.trim();
		results = q ? rank(q) : QUICK.map(toEntry);
		all.href = `/vyhledavani${q ? `?q=${encodeURIComponent(q)}` : ""}`;
		active = 0;
		if (!results.length) {
			list.innerHTML = `<li class="cmdk__empty">${index ? `Pro „${esc(q)}“ nic nenalezeno.` : "Načítám…"}</li>`;
			return;
		}
		let html = "";
		let group = "";
		results.forEach((r, i) => {
			if (r.kind !== group) {
				group = r.kind;
				html += `<li class="cmdk__group" role="presentation">${KIND_LABEL[group] ?? group}</li>`;
			}
			html += `<li role="option" id="cmdk-o${i}" class="cmdk__item" data-i="${i}" aria-selected="${i === 0}">
				<a href="${esc(r.url)}" tabindex="-1"><span class="cmdk__title">${highlight(r.title, q)}</span>${r.desc ? `<span class="cmdk__desc">${highlight(r.desc, q)}</span>` : ""}</a></li>`;
		});
		list.innerHTML = html;
		input.setAttribute("aria-activedescendant", "cmdk-o0");
	};
	const move = (d: number) => {
		if (!results.length) return;
		active = (active + d + results.length) % results.length;
		list.querySelectorAll(".cmdk__item").forEach((el) => el.setAttribute("aria-selected", String(Number((el as HTMLElement).dataset.i) === active)));
		const el = list.querySelector<HTMLElement>(`#cmdk-o${active}`);
		el?.scrollIntoView({ block: "nearest" });
		input.setAttribute("aria-activedescendant", `cmdk-o${active}`);
	};
	let t = 0;
	input.addEventListener("input", () => {
		window.clearTimeout(t);
		t = window.setTimeout(render, 60);
	});
	input.addEventListener("keydown", (e) => {
		if (e.key === "ArrowDown") (e.preventDefault(), move(1));
		else if (e.key === "ArrowUp") (e.preventDefault(), move(-1));
		else if (e.key === "Escape") {
			e.preventDefault();
			dialog!.close();
		} else if (e.key === "Enter") {
			e.preventDefault();
			const r = results[active];
			if (r) location.href = r.url;
			else if (input.value.trim()) location.href = all.href;
		}
	});
	list.addEventListener("pointermove", (e) => {
		const li = (e.target as HTMLElement).closest<HTMLElement>(".cmdk__item");
		if (li && Number(li.dataset.i) !== active) move(Number(li.dataset.i) - active);
	});
	dialog.addEventListener("click", (e) => e.target === dialog && dialog!.close());
	dialog.addEventListener("close", () => {
		document.documentElement.classList.remove("cmdk-open");
		lastFocus?.focus();
	});
	return { input, render };
}

let ui: ReturnType<typeof build> | null = null;
export async function open() {
	lastFocus = document.activeElement as HTMLElement | null;
	ui ??= build();
	ui.input.value = "";
	ui.render();
	dialog!.showModal();
	document.documentElement.classList.add("cmdk-open");
	ui.input.focus();
	await preload();
	ui.render();
}
