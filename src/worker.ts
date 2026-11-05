import handler, { createScheduledHandler, PluginBridge } from "@emdash-cms/cloudflare/worker";

export { PluginBridge };

/** Cloudflare Worker entry: Astro/EmDash request handler + scheduled publishing. */
export default {
	...handler,
	scheduled: createScheduledHandler(),
};
