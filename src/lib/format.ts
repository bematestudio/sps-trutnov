const tz = "Europe/Prague";
export const formatDate = (d: Date) =>
	new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "long", year: "numeric", timeZone: tz }).format(d);
export const formatShortDate = (d: Date) =>
	new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", timeZone: tz }).format(d);
export const formatDay = (d: Date) => new Intl.DateTimeFormat("cs-CZ", { day: "numeric", timeZone: tz }).format(d).replace(".", "");
export const formatMonth = (d: Date) => new Intl.DateTimeFormat("cs-CZ", { month: "short", timeZone: tz }).format(d);
export const formatTime = (d: Date) =>
	new Intl.DateTimeFormat("cs-CZ", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(d);
export const isoDate = (d: Date) => d.toISOString();

/** Czech plural: plural(5, ["obor", "obory", "oborů"]) */
export function plural(n: number, forms: [string, string, string]) {
	if (n === 1) return forms[0];
	if (n >= 2 && n <= 4) return forms[1];
	return forms[2];
}

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

export const programTypeLabel = (t: "maturita" | "vyucni-list") => (t === "maturita" ? "Maturita" : "Výuční list");

export const eventKindLabel: Record<string, string> = {
	dod: "Den otevřených dveří",
	prijimacky: "Přijímací řízení",
	skola: "Škola",
	sport: "Sport",
};

export const sectionLabel: Record<string, string> = {
	"o-skole": "O škole",
	studium: "Studium",
	kontakty: "Kontakty",
	vice: "Více",
};

export const docCategoryLabel: Record<string, string> = {
	studium: "Studium",
	"prijimaci-rizeni": "Přijímací řízení",
	formulare: "Formuláře",
	dokumenty: "Dokumenty školy",
	propagace: "Propagační materiály",
	"skolska-rada": "Školská rada",
	media: "O nás v médiích",
};
