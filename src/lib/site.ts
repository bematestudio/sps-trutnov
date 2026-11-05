/** The school's production domain (canonical URLs, sitemap, robots). */
export const PRODUCTION_HOST = "www.spstrutnov.cz";
export const PRODUCTION_ORIGIN = `https://${PRODUCTION_HOST}`;
export const SCHOOL_EMAIL = "skola@spstrutnov.cz";

/** Only the production domain may be indexed; every preview/dev host is noindex. */
export const isProductionHost = (host: string) => host === PRODUCTION_HOST;
