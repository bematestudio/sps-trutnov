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
const lines = (v: unknown) =>
	str(v)
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

/** Query EmDash; return null (→ seed fallback) when empty or failing. */
async function live(collection: string, options: Raw = {}) {
	try {
		const result = await getEmDashCollection(collection as never, options as never);
		if (result.error || !result.entries?.length) return null;
		return result as { entries: Array<{ id: string; data: Raw }>; nextCursor?: string };
	} catch {
		return null;
	}
}

/* ------------------------------------------------------------- normalizers */

const toPost = (slug: string, d: Raw, r?: MediaResolver, e?: SeedEntry): Post => {
	const terms = termsOf(d, e, "category");
	return {
		slug,
		title: str(d.title),
		excerpt: str(d.excerpt),
		image: image(d.featured_image, r, str(d.title)),
		author: str(d.author),
		date: toDate(d.published_on ?? d.publishedAt),
		featured: Boolean(d.featured),
		category: terms[0],
		tags: termsOf(d, e, "tag"),
		content: (d.content as PortableText) ?? [],
	};
};
const toProgram = (slug: string, d: Raw): Program => ({
	slug,
	title: str(d.title),
	shortTitle: str(d.short_title),
	type: d.type === "vyucni-list" ? "vyucni-list" : "maturita",
	code: str(d.code),
	svp: str(d.svp),
	duration: str(d.duration),
	capacity: Number(d.capacity ?? 0),
	entranceExam: Boolean(d.entrance_exam),
	healthRequired: Boolean(d.health_required),
	color: (str(d.color, "eps") as ProgramColor) || "eps",
	workplace: str(d.workplace),
	summary: str(d.summary),
	highlights: lines(d.highlights),
	careers: lines(d.careers),
	content: (d.content as PortableText) ?? [],
});
const toPage = (slug: string, d: Raw): Page => ({
	slug,
	title: str(d.title),
	section: str(d.section, "o-skole") as Section,
	lead: str(d.lead),
	content: (d.content as PortableText) ?? [],
	order: Number(d.order ?? 0),
});
const toEvent = (slug: string, d: Raw): SchoolEvent => ({
	slug,
	title: str(d.title),
	start: toDate(d.starts_at),
	end: d.ends_at ? toDate(d.ends_at) : undefined,
	location: str(d.location),
	kind: (str(d.kind, "skola") as SchoolEvent["kind"]) || "skola",
	description: str(d.description),
});
const toPerson = (slug: string, d: Raw): Person => ({
	slug,
	name: str(d.name),
	role: str(d.role),
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
	manager: str(d.manager),
	image: str(d.image),
	programs: lines(d.programs),
	description: str(d.description),
	mapUrl: str(d.map_url),
});
const toFaq = (slug: string, d: Raw): Faq => ({
	slug,
	question: str(d.question),
	answer: str(d.answer),
	group: d.group === "prijimaci-rizeni" ? "prijimaci-rizeni" : "studium",
});
const toDoc = (slug: string, d: Raw, r?: MediaResolver): Doc => {
	const key = d.file?.meta?.storageKey;
	return {
		slug,
		title: str(d.title),
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
	title: str(d.title),
	youtubeId: str(d.youtube_id),
	description: str(d.description),
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

	return {
		async settings() {
			try {
				const s = (await getSiteSettings()) as Raw;
				if (s?.title) return { title: str(s.title), tagline: str(s.tagline) };
			} catch {}
			return { title: (seed as any).settings.title as string, tagline: (seed as any).settings.tagline as string };
		},

		async menu(name = "primary"): Promise<MenuItem[]> {
			const norm = (items: any[]): MenuItem[] =>
				(items ?? []).map((i) => ({ label: str(i.label), url: str(i.url, "/"), children: norm(i.children ?? []) }));
			try {
				const m = (await getMenu(name)) as Raw | null;
				if (m?.items?.length) return norm(m.items);
			} catch {}
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
			} catch {}
			const e = seedContent.posts?.find((x) => x.slug === slug);
			return e ? toPost(e.slug, e.data, resolve, e) : null;
		},

		async categories(): Promise<Term[]> {
			try {
				const terms = (await getTaxonomyTerms("category")) as Raw[];
				if (terms?.length) return terms.map((t) => ({ slug: t.slug, label: t.label }));
			} catch {}
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
			try {
				const res = (await emSearch(q, { collections: ["posts", "pages", "programs"] } as never)) as Raw;
				const items = (res?.items ?? res?.results ?? res) as Raw[];
				if (Array.isArray(items) && items.length) {
					return items.map((i) => ({
						title: str(i.title ?? i.data?.title),
						excerpt: str(i.snippet ?? i.excerpt ?? i.data?.excerpt),
						url: str(i.url) || urlFor(str(i.collection), str(i.slug ?? i.id)),
						type: str(i.collection),
					}));
				}
			} catch {}
			// Fallback: simple diacritics-insensitive match over seed + live data.
			const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
			const needle = norm(q);
			const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
			const [posts, pages, programs] = await Promise.all([this.posts({ limit: 500 }), this.pages(), this.programs()]);
			const hits = [
				...programs.map((p) => ({ title: p.title, excerpt: p.summary, url: urlFor("programs", p.slug), type: "programs" })),
				...pages.map((p) => ({ title: p.title, excerpt: p.lead, url: `/${p.section}/${p.slug}`, type: "pages" })),
				...posts.items.map((p) => ({ title: p.title, excerpt: p.excerpt, url: urlFor("posts", p.slug), type: "posts" })),
			];
			return hits
				.filter((h) => norm(`${h.title} ${h.excerpt}`).includes(needle))
				.slice(0, 30)
				.map((h) => ({ ...h, excerpt: esc(h.excerpt) }));
		},
	};
}

export function urlFor(collection: string, slug: string) {
	if (collection === "posts") return `/novinky/${slug}`;
	if (collection === "programs") return `/studium/obory-vzdelani/${slug}`;
	return `/${slug}`;
}

export type Cms = ReturnType<typeof createCms>;
