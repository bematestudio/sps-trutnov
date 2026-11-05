import type { SchoolEvent } from "./cms";
import { PRODUCTION_ORIGIN } from "./site";
/**
 * Serialise structured data for <script type="application/ld+json"> safely:
 * `<` is escaped so CMS text can never close the script element.
 */
export const jsonLd = (data: unknown) =>
	JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

/** schema.org Event for a school event (open days, entrance exams…). */
export const eventLd = (e: SchoolEvent, path: string) => ({
	"@type": "Event",
	name: e.title,
	startDate: e.start.toISOString(),
	...(e.end ? { endDate: e.end.toISOString() } : {}),
	eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
	eventStatus: "https://schema.org/EventScheduled",
	description: e.description,
	url: `${PRODUCTION_ORIGIN}${path}`,
	location: {
		"@type": "Place",
		name: e.location || "SPŠ Trutnov",
		address: { "@type": "PostalAddress", streetAddress: "Školní 101", addressLocality: "Trutnov", postalCode: "541 01", addressCountry: "CZ" },
	},
	organizer: { "@id": `${PRODUCTION_ORIGIN}/#organization`, "@type": "EducationalOrganization", name: "SPŠ Trutnov", url: `${PRODUCTION_ORIGIN}/` },
	isAccessibleForFree: true,
});
