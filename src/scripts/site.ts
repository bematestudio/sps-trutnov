/**
 * Site-wide progressive enhancement. Everything here is optional: the site is
 * fully usable without JavaScript.
 */
const root = document.documentElement;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------------------------------------------------------- loader */
function finishLoading() {
	if (!root.classList.contains("is-loading")) return;
	root.classList.add("is-loaded");
	window.setTimeout(() => root.classList.remove("is-loading", "is-loaded"), 400);
}
// Never wait for images: this module runs once the HTML is parsed, so the
// content is ready; the loader is only a short brand moment (first visit).
window.setTimeout(finishLoading, 350);

/* ----------------------------------------------------------------- theme */
function setTheme(theme: "light" | "dark") {
	root.dataset.theme = theme;
	try {
		localStorage.setItem("theme", theme);
	} catch {}
	document.querySelectorAll<HTMLButtonElement>("[data-theme-toggle]").forEach((btn) => {
		btn.setAttribute("aria-label", theme === "dark" ? "Přepnout na světlý režim" : "Přepnout na tmavý režim");
		btn.setAttribute("aria-pressed", String(theme === "dark"));
	});
	const bg = getComputedStyle(root).getPropertyValue("--color-bg").trim();
	if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
}
setTheme(root.dataset.theme === "dark" ? "dark" : "light");

document.addEventListener("click", (event) => {
	const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-theme-toggle]");
	if (!btn) return;
	const next = root.dataset.theme === "dark" ? "light" : "dark";
	const rect = btn.getBoundingClientRect();
	root.style.setProperty("--reveal-x", `${rect.left + rect.width / 2}px`);
	root.style.setProperty("--reveal-y", `${rect.top + rect.height / 2}px`);
	if (!document.startViewTransition || reducedMotion) return setTheme(next);
	root.setAttribute("data-theme-switching", "");
	const transition = document.startViewTransition(() => setTheme(next));
	transition.finished.finally(() => root.removeAttribute("data-theme-switching"));
});

// Follow OS changes until the visitor picks a theme explicitly.
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
	let stored: string | null = null;
	try {
		stored = localStorage.getItem("theme");
	} catch {}
	if (!stored) setTheme(e.matches ? "dark" : "light");
});

/* ------------------------------------------------- pause all animation */
// WCAG 2.2.2: anything that moves on its own (carousel autoplay, partner
// marquee, Průmysl 4.0 diagram, signal canvas) can be paused site-wide.
function setMotion(paused: boolean) {
	if (paused) root.dataset.motion = "paused";
	else delete root.dataset.motion;
	try {
		if (paused) localStorage.setItem("motion", "paused");
		else localStorage.removeItem("motion");
	} catch {}
	document.querySelectorAll<HTMLButtonElement>("[data-motion-toggle]").forEach((btn) => {
		btn.setAttribute("aria-pressed", String(paused));
		const label = btn.querySelector("[data-motion-label]");
		if (label) label.textContent = paused ? "Spustit animace" : "Pozastavit animace";
	});
	document.dispatchEvent(new CustomEvent("sps:motion", { detail: { paused } }));
}
setMotion(root.dataset.motion === "paused");
document.addEventListener("click", (event) => {
	if ((event.target as HTMLElement).closest("[data-motion-toggle]")) setMotion(root.dataset.motion !== "paused");
});

/* ------------------------------------------------------- split headlines */
function splitLines(el: HTMLElement) {
	if (el.dataset.splitDone) return;
	el.dataset.splitDone = "true";
	const words = (el.textContent ?? "").trim().split(/\s+/);
	el.setAttribute("aria-label", words.join(" "));
	el.textContent = "";
	const spans = words.map((w) => {
		const s = document.createElement("span");
		s.textContent = `${w} `;
		s.style.display = "inline-block";
		s.setAttribute("aria-hidden", "true");
		el.append(s);
		return s;
	});
	// Group words into visual lines by offsetTop
	const lines: HTMLSpanElement[][] = [];
	let top = Number.NaN;
	spans.forEach((s) => {
		if (s.offsetTop !== top) {
			lines.push([]);
			top = s.offsetTop;
		}
		lines[lines.length - 1].push(s);
	});
	el.textContent = "";
	lines.forEach((ws, i) => {
		const line = document.createElement("span");
		line.className = "line";
		line.setAttribute("aria-hidden", "true");
		line.style.setProperty("--line-index", String(i));
		const inner = document.createElement("span");
		inner.textContent = ws.map((w) => w.textContent).join("").trimEnd();
		line.append(inner);
		el.append(line);
	});
}

/* ---------------------------------------------------------------- reveal */
function countUp(el: HTMLElement) {
	const target = Number(el.dataset.count);
	if (!Number.isFinite(target) || reducedMotion) return;
	const suffix = el.dataset.suffix ?? "";
	const duration = 1400;
	const start = performance.now();
	const fmt = new Intl.NumberFormat("cs-CZ");
	const tick = (now: number) => {
		const t = Math.min(1, (now - start) / duration);
		const eased = 1 - (1 - t) ** 4;
		el.textContent = `${fmt.format(Math.round(target * eased))}${suffix}`;
		if (t < 1) requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);
}

function initReveal() {
	document.querySelectorAll<HTMLElement>("[data-split]").forEach(splitLines);
	document.querySelectorAll<HTMLElement>("[data-reveal-group]").forEach((group) => {
		[...group.querySelectorAll<HTMLElement>("[data-reveal]")].forEach((el, i) =>
			el.style.setProperty("--reveal-index", String(i % 8)),
		);
	});
	const targets = document.querySelectorAll<HTMLElement>("[data-reveal], [data-split], [data-count]");
	if (!("IntersectionObserver" in window)) {
		targets.forEach((t) => t.classList.add("is-revealed"));
		return;
	}
	const io = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				const el = entry.target as HTMLElement;
				el.classList.add("is-revealed");
				if (el.dataset.count) countUp(el);
				io.unobserve(el);
			}
		},
		{ rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
	);
	targets.forEach((t) => io.observe(t));
}
// Wait for fonts so line splitting measures final glyph widths.
(document.fonts?.ready ?? Promise.resolve()).then(initReveal);

/* ------------------------------------------------- navigation progress */
document.addEventListener("click", (e) => {
	const a = (e.target as HTMLElement).closest("a");
	if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === "_blank") return;
	const url = new URL(a.href, location.href);
	if (url.origin !== location.origin || url.pathname === location.pathname || a.hasAttribute("download")) return;
	root.classList.add("is-navigating");
});
window.addEventListener("pageshow", () => root.classList.remove("is-navigating"));

/* ------------------------------------------------------ copy to clipboard */
document.addEventListener("click", async (e) => {
	const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-copy]");
	if (!btn) return;
	try {
		await navigator.clipboard.writeText(btn.dataset.copy ?? "");
		btn.dataset.copied = "true";
		toast(`Zkopírováno: ${btn.dataset.copy}`);
		window.setTimeout(() => delete btn.dataset.copied, 1600);
	} catch {
		toast("Kopírování se nezdařilo");
	}
});

/* ------------------------------------------------------------------ toast */
export function toast(message: string) {
	let region = document.querySelector<HTMLElement>("[data-toast-region]");
	if (!region) return;
	const el = document.createElement("div");
	el.className = "toast";
	el.textContent = message;
	region.append(el);
	window.setTimeout(() => {
		el.classList.add("toast--out");
		el.addEventListener("animationend", () => el.remove(), { once: true });
		window.setTimeout(() => el.remove(), 800);
	}, 2600);
}
window.spsToast = toast;

/* ------------------------------------------------------- ⌘K search palette */
// The palette module + index are fetched only on intent (hover/focus) or use.
const loadCmdk = () => import("./cmdk");
const openCmdk = (e?: Event) => {
	e?.preventDefault();
	loadCmdk().then((m) => m.open());
};
document.addEventListener("keydown", (e) => {
	const target = e.target as HTMLElement;
	const typing = target.closest("input, textarea, select, [contenteditable]");
	if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") openCmdk(e);
	else if (e.key === "/" && !typing) openCmdk(e);
});
document.querySelectorAll<HTMLElement>("[data-cmdk]").forEach((el) => {
	el.addEventListener("click", openCmdk);
	const warm = () => loadCmdk().then((m) => m.preload());
	el.addEventListener("pointerenter", warm, { once: true });
	el.addEventListener("focus", warm, { once: true });
});
