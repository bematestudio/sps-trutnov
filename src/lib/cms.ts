/**
 * Content access layer.
 *
 * EmDash is the source of truth. Every query goes through EmDash first; if the
 * CMS hasn't been set up yet (fresh D1 database, setup wizard not finished)
 * or a query fails, we fall back to the bundled seed so the public site never
 * renders empty. Pages only ever see the normalized view-models below.
 */
import {
	getEmDashCollection,
	getEmDashEntry,
	getMenu,
	getSiteSettings,
	getTaxonomyTerms,
	search as emSearch,
} from "emdash";
import seed from "../../seed/seed.json";
import { czTypo, czTypoBlocks, searchNorm } from "./typo";

/* ------------------------------------------------------------------ types */

export type PortableText = Array<Record<string, unknown>>;

export interface Img {
	src: string;
	alt: string;
	/** R2 storage key — present for CMS media (enables AVIF/WebP variants). */
	key?: string;
	width?: number;
	height?: number;
}
export interface Term {
	slug: string;
	label: string;
}
export interface Post {
	slug: string;
	title: string;
	excerpt: string;
	image?: Img;
	author: string;
	date: Date;
	featured: boolean;
	category?: Term;
	tags: Term[];
	content: PortableText;
}
export type ProgramColor = "eps" | "it" | "sle" | "str" | "el" | "na";
export interface Program {
	slug: string;
	title: string;
	shortTitle: string;
	type: "maturita" | "vyucni-list";
	code: string;
	svp: string;
	duration: string;
	capacity: number;
	entranceExam: boolean;
	healthRequired: boolean;
	color: ProgramColor;
	workplace: string;
	summary: string;
	highlights: string[];
	careers: string[];
	content: PortableText;
}
export type Section = "o-skole" | "studium" | "kontakty" | "vice";
export interface Page {
	slug: string;
	title: string;
	section: Section;
	lead: string;
	content: PortableText;
	order: number;
}
export interface SchoolEvent {
	slug: string;
	title: string;
	start: Date;
	end?: Date;
	location: string;
	kind: "dod" | "prijimacky" | "skola" | "sport";
	description: string;
}
export interface Person {
	slug: string;
	name: string;
	role: string;
	department: string;
	workplace: string;
	phone: string;
	email: string;
}
export interface Workplace {
	slug: string;
	title: string;
	kind: string;
	address: string;
	phone: string;
	email: string;
	manager: string;
	image: string;
	programs: string[];
	description: string;
	mapUrl: string;
}
export interface Faq {
	slug: string;
	question: string;
	answer: string;
	group: "studium" | "prijimaci-rizeni";
}
export interface Doc {
	slug: string;
	title: string;
	category: string;
	url: string;
	fileType: string;
	size: string;
	year: string;
}
export interface Partner {
	slug: string;
	name: string;
	logo?: Img;
	url?: string;
}
export interface Video {
	slug: string;
	title: string;
	youtubeId: string;
	description: string;
}
export interface MenuItem {
	label: string;
	url: string;
	children: MenuItem[];
}

/* ---------------------------------------------------------------- helpers */

type Raw = Record<string, any>;
type MediaResolver = (key: string) => string;
type SeedEntry = { slug: string; data: Raw; taxonomies?: Record<string, string[]> };

const seedContent = (seed as any).content as Record<string, SeedEntry[]>;
const seedTerms: Record<string, Term[]> = Object.fromEntries(
	((seed as any).taxonomies as Array<{ name: string; terms: Term[] }>).map((t) => [t.name, t.terms]),
);

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
/** Display text from the CMS, with Czech typography applied. */
const txt = (v: unknown, fallback = "") => czTypo(str(v, fallback));
const blocks = (v: unknown) => czTypoBlocks((v as PortableText) ?? []);

/** Log why we fell back to the bundled seed (once per isolate and reason). */
const logged = new Set<string>();
function logFallback(where: string, error?: unknown) {
	const key = `${where}:${error instanceof Error ? error.message : String(error ?? "empty")}`;
	if (logged.has(key)) return;
	logged.add(key);
	console.warn(JSON.stringify({ msg: "cms fallback to seed", where, error: error instanceof Error ? error.message : error ? String(error) : "empty" }));
}
const lines = (v: unknown) =>
	txt(v)
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
const toDate = (v: unknown) => (v instanceof Date ? v : new Date(str(v) || Date.now()));

function image(raw: any, resolve: MediaResolver | undefined, alt = ""): Img | undefined {
	if (!raw) return undefined;
	if (typeof raw === "string") return { src: raw, alt };
	if (raw.$media) return { src: raw.$media.url, alt: raw.$media.alt ?? alt };
	const key = raw.meta?.storageKey;
	const src = key ? (resolve?.(key) ?? `/_emdash/api/media/file/${key}`) : raw.src || raw.url;
	if (!src) return undefined;
	return { src, alt: raw.alt || alt, width: raw.width, height: raw.height, key: key || undefined };
}

function termsOf(raw: Raw, entry: SeedEntry | undefined, name: string): Term[] {
	const live = raw.terms?.[name] as Term[] | undefined;
	if (live?.length) return live.map((t) => ({ slug: t.slug, label: t.label }));
	const slugs = entry?.taxonomies?.[name] ?? [];
	return slugs.map((s) => seedTerms[name]?.find((t) => t.slug === s) ?? { slug: s, label: s });
}

/**
 * Per-isolate memo for CMS reads (TTL 60 s). The CMS database is a single
 * Durable Object, so every query is a network round trip; the same lists
 * (menu, settings, events, partners…) are read on every page. Editors in
 * visual-edit mode bypass it (see createCms).
 */
const MEMO_TTL_MS = 60_000;
const memo = new Map<string, { at: number; value: Promise<unknown> }>();
function memoize<T>(key: string, load: () => Promise<T>, enabled = true): Promise<T> {
	if (!enabled) return load();
	const now = Date.now();
	const hit = memo.get(key);
	if (hit && now - hit.at < MEMO_TTL_MS) return hit.value as Promise<T>;
	const value = load().catch((e) => {
		memo.delete(key);
		throw e;
	});
	memo.set(key, { at: now, value });
	if (memo.size > 200) memo.delete(memo.keys().next().value!);
	return value;
}
let memoEnabled = true;

/** Query EmDash; return null (→ seed fallback) when empty or failing. */
function live(collection: string, options: Raw = {}) {
	return memoize(`live:${collection}:${JSON.stringify(options)}`, () => liveUncached(collection, options), memoEnabled);
}
async function liveUncached(collection: string, options: Raw = {}) {
	try {
		const result = await getEmDashCollection(collection as never, options as never);
		if (result.error || !result.entries?.length) {
			logFallback(collection, result.error);
			return null;
		}
		return result as { entries: Array<{ id: string; data: Raw }>; nextCursor?: string };
	} catch (e) {
		logFallback(collection, e);
		return null;
	}
}

/* ------------------------------------------------------------- normalizers */

const toPost = (slug: string, d: Raw, r?: MediaResolver, e?: SeedEntry): Post => {
	const terms = termsOf(d, e, "category");
	return {
		slug,
		title: txt(d.title),
		excerpt: txt(d.excerpt),
		image: image(d.featured_image, r, str(d.title)),
		author: str(d.author),
		date: toDate(d.published_on ?? d.publishedAt),
		featured: Boolean(d.featured),
		category: terms[0],
		tags: termsOf(d, e, "tag"),
		content: blocks(d.content),
	};
};
const toProgram = (slug: string, d: Raw): Program => ({
	slug,
	title: txt(d.title),
	shortTitle: txt(d.short_title),
	type: d.type === "vyucni-list" ? "vyucni-list" : "maturita",
	code: str(d.code),
	svp: str(d.svp),
	duration: str(d.duration),
	capacity: Number(d.capacity ?? 0),
	entranceExam: Boolean(d.entrance_exam),
	healthRequired: Boolean(d.health_required),
	color: (str(d.color, "eps") as ProgramColor) || "eps",
	workplace: str(d.workplace),
	summary: txt(d.summary),
	highlights: lines(d.highlights),
	careers: lines(d.careers),
	content: blocks(d.content),
});
const toPage = (slug: string, d: Raw): Page => ({
	slug,
	title: txt(d.title),
	section: str(d.section, "o-skole") as Section,
	lead: txt(d.lead),
	content: blocks(d.content),
	order: Number(d.order ?? 0),
});
const toEvent = (slug: string, d: Raw): SchoolEvent => ({
	slug,
	title: txt(d.title),
	start: toDate(d.starts_at),
	end: d.ends_at ? toDate(d.ends_at) : undefined,
	location: txt(d.location),
	kind: (str(d.kind, "skola") as SchoolEvent["kind"]) || "skola",
	description: txt(d.description),
});
const toPerson = (slug: string, d: Raw): Person => ({
	slug,
	name: str(d.name),
	role: txt(d.role),
	department: str(d.department),
	workplace: str(d.workplace),
	phone: str(d.phone),
	email: str(d.email),
});
const toWorkplace = (slug: string, d: Raw): Workplace => ({
	slug,
	title: str(d.title),
	kind: str(d.kind),
	address: str(d.address),
	phone: str(d.phone),
	email: str(d.email),
	manager: txt(d.manager),
	image: str(d.image),
	programs: lines(d.programs),
	description: txt(d.description),
	mapUrl: str(d.map_url),
});
const toFaq = (slug: string, d: Raw): Faq => ({
	slug,
	question: txt(d.question),
	answer: txt(d.answer),
	group: d.group === "prijimaci-rizeni" ? "prijimaci-rizeni" : "studium",
});
const toDoc = (slug: string, d: Raw, r?: MediaResolver): Doc => {
	const key = d.file?.meta?.storageKey;
	return {
		slug,
		title: txt(d.title),
		category: str(d.category),
		url: key ? (r?.(key) ?? `/_emdash/api/media/file/${key}`) : str(d.file_url) || str(d.file?.src),
		fileType: str(d.file_type, "PDF"),
		size: str(d.size),
		year: str(d.year),
	};
};
/** Bundled partner logos — used when the CMS entry has no uploaded logo. */
const PARTNER_LOGOS: Record<string, string> = {
	"hitachi energy": "hitachi-energy",
	kasper: "kasper",
	"pepperl+fuchs": "pepperl-fuchs",
	schaeffler: "schaeffler",
	siemens: "siemens",
	"škoda": "skoda",
	"škoda auto": "skoda",
	"te connectivity": "te",
	"zpa smart energy": "zpa",
};
const toPartner = (slug: string, d: Raw, r?: MediaResolver): Partner => {
	const name = str(d.name);
	const local = PARTNER_LOGOS[name.toLowerCase()];
	const cmsLogo = d.logo && !d.logo.$media ? image(d.logo, r, name) : undefined;
	return {
		slug,
		name,
		logo: cmsLogo ?? (local ? { src: `/images/partneri/${local}.png`, alt: name, width: 270, height: 90 } : undefined),
		url: str(d.url) || undefined,
	};
};
const toVideo = (slug: string, d: Raw): Video => ({
	slug,
	title: txt(d.title),
	youtubeId: str(d.youtube_id),
	description: txt(d.description),
});

const byOrder = (a: { data: Raw }, b: { data: Raw }) => Number(a.data.order ?? 0) - Number(b.data.order ?? 0);

async function list<T>(
	collection: string,
	map: (slug: string, d: Raw, r?: MediaResolver, e?: SeedEntry) => T,
	resolve?: MediaResolver,
	options: Raw = {},
): Promise<T[]> {
	const result = await live(collection, { limit: 200, ...options });
	if (result) {
		const entries = options.orderBy ? result.entries : [...result.entries].sort(byOrder);
		return entries.map((e) => map(e.id, e.data, resolve));
	}
	return [...(seedContent[collection] ?? [])].sort(byOrder).map((e) => map(e.slug, e.data, resolve, e));
}

/* ------------------------------------------------------------------ public */

export function createCms(locals?: App.Locals) {
	const resolve: MediaResolver | undefined = (locals as any)?.emdash?.getPublicMediaUrl;
	// Logged-in editors (visual editing) always see fresh data.
	memoEnabled = !(locals as any)?.user;

	return {
		settings() {
			return memoize("settings", () => this.settingsUncached(), memoEnabled);
		},
		async settingsUncached() {
			try {
				const s = (await getSiteSettings()) as Raw;
				if (s?.title) return { title: str(s.title), tagline: str(s.tagline) };
			} catch (e) {
				logFallback("settings", e);
			}
			return { title: (seed as any).settings.title as string, tagline: (seed as any).settings.tagline as string };
		},

		menu(name = "primary"): Promise<MenuItem[]> {
			return memoize(`menu:${name}`, () => this.menuUncached(name), memoEnabled);
		},
		async menuUncached(name = "primary"): Promise<MenuItem[]> {
			const norm = (items: any[]): MenuItem[] =>
				(items ?? []).map((i) => ({ label: str(i.label), url: str(i.url, "/"), children: norm(i.children ?? []) }));
			try {
				const m = (await getMenu(name)) as Raw | null;
				if (m?.items?.length) return norm(m.items);
			} catch (e) {
				logFallback(`menu:${name}`, e);
			}
			return norm((seed as any).menus.find((m: Raw) => m.name === name)?.items ?? []);
		},

		async posts(opts: { category?: string; tag?: string; limit?: number; offset?: number } = {}) {
			const { category, tag, limit = 12, offset = 0 } = opts;
			const where: Raw = {};
			if (category) where.category = category;
			if (tag) where.tag = tag;
			const result = await live("posts", {
				limit: 500,
				orderBy: { published_on: "desc" },
				...(Object.keys(where).length ? { where } : {}),
			});
			let all: Post[];
			if (result) all = result.entries.map((e) => toPost(e.id, e.data, resolve));
			else
				all = (seedContent.posts ?? [])
					.filter(
						(e) =>
							(!category || e.taxonomies?.category?.includes(category)) &&
							(!tag || e.taxonomies?.tag?.includes(tag)),
					)
					.map((e) => toPost(e.slug, e.data, resolve, e));
			all.sort((a, b) => b.date.getTime() - a.date.getTime());
			return { items: all.slice(offset, offset + limit), total: all.length };
		},

		async post(slug: string): Promise<Post | null> {
			try {
				const { entry } = await getEmDashEntry("posts" as never, slug);
				if (entry) return toPost((entry as any).id, (entry as any).data, resolve);
			} catch (e) {
				logFallback("post", e);
			}
			const e = seedContent.posts?.find((x) => x.slug === slug);
			return e ? toPost(e.slug, e.data, resolve, e) : null;
		},

		categories(): Promise<Term[]> {
			return memoize("categories", () => this.categoriesUncached(), memoEnabled);
		},
		async categoriesUncached(): Promise<Term[]> {
			try {
				const terms = (await getTaxonomyTerms("category")) as Raw[];
				if (terms?.length) return terms.map((t) => ({ slug: t.slug, label: t.label }));
			} catch (e) {
				logFallback("categories", e);
			}
			return seedTerms.category ?? [];
		},

		programs: () => list("programs", (s, d) => toProgram(s, d)),
		async program(slug: string) {
			return (await this.programs()).find((p) => p.slug === slug) ?? null;
		},

		pages: (section?: Section) =>
			list("pages", (s, d) => toPage(s, d)).then((all) => (section ? all.filter((p) => p.section === section) : all)),
		async page(section: Section, slug: string) {
			return (await this.pages(section)).find((p) => p.slug === slug) ?? null;
		},

		async events(opts: { upcoming?: boolean } = {}) {
			const all = (await list("events", (s, d) => toEvent(s, d))).sort((a, b) => a.start.getTime() - b.start.getTime());
			if (!opts.upcoming) return all;
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			return all.filter((e) => (e.end ?? e.start) >= today);
		},

		people: () => list("people", (s, d) => toPerson(s, d)),
		workplaces: () => list("workplaces", (s, d) => toWorkplace(s, d)),
		faq: () => list("faq", (s, d) => toFaq(s, d)),
		documents: () => list("documents", (s, d, r) => toDoc(s, d, r), resolve),
		partners: () => list("partners", (s, d, r) => toPartner(s, d, r), resolve),
		videos: () => list("videos", (s, d) => toVideo(s, d)).then((v) => v.filter((x) => x.youtubeId)),

		async search(query: string) {
			const q = query.trim();
			if (!q) return [];
			const pages = await this.pages();
			const pageUrl = new Map(pages.map((p) => [p.slug, `/${p.section}/${p.slug}`]));
			const linkFor = (collection: string, slug: string) =>
				collection === "pages" ? (pageUrl.get(slug) ?? "/vyhledavani") : urlFor(collection, slug);
			try {
				const res = (await emSearch(q, { collections: ["posts", "pages", "programs"] } as never)) as Raw;
				const items = (res?.items ?? res?.results ?? res) as Raw[];
				if (Array.isArray(items) && items.length) {
					return items.map((i) => {
						const collection = str(i.collection);
						return {
							title: txt(i.title ?? i.data?.title),
							excerpt: safeSnippet(str(i.snippet ?? i.excerpt ?? i.data?.excerpt)),
							url: linkFor(collection, str(i.slug ?? i.id)),
							type: collection,
						};
					});
				}
			} catch (e) {
				logFallback("search", e);
			}
			// Fallback: simple diacritics-insensitive match over the same content.
			const needle = searchNorm(q);
			const [posts, programs] = await Promise.all([this.posts({ limit: 500 }), this.programs()]);
			const hits = [
				...programs.map((p) => ({ title: p.title, excerpt: p.summary, url: urlFor("programs", p.slug), type: "programs" })),
				...pages.map((p) => ({ title: p.title, excerpt: p.lead, url: `/${p.section}/${p.slug}`, type: "pages" })),
				...posts.items.map((p) => ({ title: p.title, excerpt: p.excerpt, url: urlFor("posts", p.slug), type: "posts" })),
			];
			return hits
				.filter((h) => searchNorm(`${h.title} ${h.excerpt}`).includes(needle))
				.slice(0, 30)
				.map((h) => ({ ...h, excerpt: escapeHtml(h.excerpt) }));
		},
	};
}

const escapeHtml = (s: string) =>
	s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Search snippets are rendered as HTML: escape everything, then allow only <mark>. */
export const safeSnippet = (s: string) => escapeHtml(s).replace(/&lt;(\/?)mark&gt;/g, "<$1mark>");

/** Public URL of an entry. Pages need their section — use `/${page.section}/${page.slug}`. */
export function urlFor(collection: string, slug: string) {
	if (collection === "posts") return `/novinky/${slug}`;
	if (collection === "programs") return `/studium/obory-vzdelani/${slug}`;
	return `/${slug}`;
}

export type Cms = ReturnType<typeof createCms>;
