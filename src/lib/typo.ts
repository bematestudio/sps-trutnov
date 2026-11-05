/**
 * Czech typography (audit Appendix B.8): non-breaking spaces after one-letter
 * prepositions/conjunctions, titles and abbreviations, inside dates, between
 * numbers and units, in digit groups; spaced hyphen → en dash.
 * Text content only — never URLs, e-mails, attributes or code.
 */
const NBSP = " ";

export function czTypo(text: string): string {
	if (!text) return text;
	return (
		text
			// twice, so runs like "a v Praze" are both joined
			.replace(/(^|[\s(„‚])([ksvzouaiKSVZOUAI]) /g, `$1$2${NBSP}`)
			.replace(/(^|[\s(„‚ ])([ksvzouaiKSVZOUAI]) /g, `$1$2${NBSP}`)
			.replace(/(^|[\s(„])(např|tj|tzn|resp|apod|č|čp|tel|Ing|Mgr|Bc|MUDr|JUDr|PhDr|RNDr|PaedDr|doc|prof)\. /g, `$1$2.${NBSP}`)
			.replace(/(\d{1,2})\. (\d{1,2})\. (\d{4})/g, `$1.${NBSP}$2.${NBSP}$3`)
			.replace(/(\d) (%|Kč|€|EUR|CZK|kg|g|km|m|cm|mm|m²|l|ml|ks|h|min|°C)(?![\p{L}\d])/gu, `$1${NBSP}$2`)
			.replace(/(\d) (?=\d{3}(?!\d))/g, `$1${NBSP}`)
			.replace(/ - /g, " – ")
	);
}

/** Apply czTypo to the text spans of a Portable Text document. */
export function czTypoBlocks<T>(blocks: T): T {
	if (!Array.isArray(blocks)) return blocks;
	return blocks.map((b: any) =>
		b && b._type === "block" && Array.isArray(b.children)
			? { ...b, children: b.children.map((c: any) => (c && c._type === "span" && typeof c.text === "string" ? { ...c, text: czTypo(c.text) } : c)) }
			: b,
	) as T;
}

/** Normalise for matching: strip diacritics, NBSP → space, lowercase. */
export const searchNorm = (s: string) =>
	s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ /g, " ").toLowerCase();
