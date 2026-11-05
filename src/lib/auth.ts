import type { AstroCookies } from "astro";
import { getDb } from "emdash/runtime";

/** EmDash roles: 10 subscriber … 30 author, 40 editor, 50 admin. */
export const ROLE_CONTRIBUTOR = 20;
export const ROLE_ADMIN = 50;

type SessionLike = { get(key: string): Promise<unknown> } | undefined;

/**
 * The EmDash CMS user behind the current Astro session (the same session the
 * CMS login at /_emdash/admin creates), or null.
 */
export async function cmsUser(session: SessionLike, _cookies?: AstroCookies) {
	const sessionUser = (await session?.get("user").catch(() => undefined)) as { id?: string } | undefined;
	if (!sessionUser?.id) return null;
	const row = (await (await getDb())
		.selectFrom("users" as never)
		.select(["id" as never, "role" as never, "disabled" as never, "name" as never, "email" as never])
		.where("id" as never, "=", sessionUser.id as never)
		.executeTakeFirst()
		.catch(() => undefined)) as { id: string; role?: number; disabled?: number | boolean; name?: string; email?: string } | undefined;
	if (!row || row.disabled) return null;
	return { id: row.id, role: Number(row.role ?? 0), name: row.name ?? "", email: row.email ?? "" };
}

export const loginUrl = (returnTo: string) => `/_emdash/admin/login?redirect=${encodeURIComponent(returnTo)}`;
