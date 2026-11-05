import handler, { createScheduledHandler, PluginBridge } from "@emdash-cms/cloudflare/worker";

// Durable Object class that hosts the EmDash SQLite database (binding EMDASH_DB).
export { EmDashDB } from "@emdash-cms/cloudflare/db/do-sql";
export { PluginBridge };

/** Cloudflare Worker entry: Astro/EmDash request handler + scheduled publishing. */
export default {
	...handler,
	scheduled: createScheduledHandler(),
};
