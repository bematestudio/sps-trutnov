/**
 * Astro session storage on Cloudflare R2.
 *
 * unstorage's built-in `cloudflare-r2-binding` driver looks the bucket up on
 * `globalThis.__env__`, which @astrojs/cloudflare never populates, so every
 * session write failed (and EmDash login with it). This driver reads the
 * binding from `cloudflare:workers` instead. Expiry is handled by Astro
 * (expiry timestamps are stored inside the value); an R2 lifecycle rule on
 * the bucket cleans up abandoned objects.
 */
import { env } from "cloudflare:workers";
import { defineDriver } from "unstorage";

/** Subset of the Workers R2Bucket API used here (runtime types aren't generated). */
interface R2Bucket {
	head(key: string): Promise<unknown | null>;
	get(key: string): Promise<{ text(): Promise<string> } | null>;
	put(key: string, value: string): Promise<unknown>;
	delete(keys: string | string[]): Promise<void>;
	list(o: { prefix?: string; cursor?: string }): Promise<{ objects: Array<{ key: string }>; truncated: boolean; cursor?: string }>;
}

interface Options {
	binding: string;
	base?: string;
}

export default defineDriver((opts: Options) => {
	const prefix = opts.base ? `${opts.base.replace(/\/+$/, "")}/` : "";
	const key = (k: string) => `${prefix}${k.replace(/:/g, "/")}`;
	const bucket = () => {
		const b = (env as unknown as Record<string, R2Bucket | undefined>)[opts.binding];
		if (!b) throw new Error(`[session] R2 binding "${opts.binding}" is not configured`);
		return b;
	};

	return {
		name: "cloudflare-r2-workers-env",
		async hasItem(k) {
			return (await bucket().head(key(k))) !== null;
		},
		async getItem(k) {
			const obj = await bucket().get(key(k));
			return obj ? await obj.text() : null;
		},
		async setItem(k, value) {
			await bucket().put(key(k), value);
		},
		async removeItem(k) {
			await bucket().delete(key(k));
		},
		async getKeys(base) {
			const keys: string[] = [];
			let cursor: string | undefined;
			do {
				const res = await bucket().list({ prefix: key(base ?? ""), cursor });
				keys.push(...res.objects.map((o) => o.key.slice(prefix.length).replace(/\//g, ":")));
				cursor = res.truncated ? res.cursor : undefined;
			} while (cursor);
			return keys;
		},
		async clear(base) {
			const keys = await this.getKeys!(base ?? "", {});
			if (keys.length) await bucket().delete(keys.map(key));
		},
	};
});
