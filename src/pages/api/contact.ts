import type { APIRoute } from "astro";

export const prerender = false;

/**
 * Contact form endpoint. Validates input and acknowledges it.
 * Delivery (e-mail / D1 storage / ticketing) is intentionally not wired yet —
 * hook it up here, e.g. via Cloudflare Email Routing `send_email` binding or
 * by writing into an EmDash collection.
 */
export const POST: APIRoute = async ({ request }) => {
	const form = await request.formData();
	const name = String(form.get("name") ?? "").trim();
	const email = String(form.get("email") ?? "").trim();
	const message = String(form.get("message") ?? "").trim();
	const consent = form.get("consent");

	const errors: string[] = [];
	if (name.length < 3) errors.push("Zadejte jméno.");
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Zadejte platný e-mail.");
	if (message.length < 10) errors.push("Zpráva je příliš krátká.");
	if (!consent) errors.push("Potvrďte souhlas se zpracováním osobních údajů.");

	if (errors.length) return Response.json({ ok: false, error: errors.join(" ") }, { status: 422 });
	return Response.json({ ok: true }, { status: 202 });
};
