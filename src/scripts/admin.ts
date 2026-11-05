/** Shared behaviour for admin list screens (demo, client-only). */
export function initAdminTable() {
	const root = document.querySelector<HTMLElement>("[data-admin-table]");
	if (!root) return;
	const search = root.querySelector<HTMLInputElement>("[data-table-search]");
	const filter = root.querySelector<HTMLSelectElement>("[data-table-filter]");
	const empty = root.querySelector<HTMLElement>("[data-table-empty]");
	const apply = () => {
		const q = (search?.value ?? "").toLowerCase().trim();
		const f = filter?.value ?? "";
		let visible = 0;
		root.querySelectorAll<HTMLElement>("[data-row]").forEach((row) => {
			const show = (!q || (row.dataset.search ?? "").includes(q)) && (!f || row.dataset.filter === f);
			row.hidden = !show;
			if (show) visible++;
		});
		if (empty) empty.hidden = visible > 0;
	};
	search?.addEventListener("input", apply);
	filter?.addEventListener("change", apply);

	root.addEventListener("click", (e) => {
		const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-delete]");
		if (!btn) return;
		const row = btn.closest<HTMLElement>("tr");
		if (!row) return;
		row.style.opacity = "0.4";
		row.hidden = true;
		const toast = window.spsToast as ((m: string) => void) | undefined;
		toast?.("Položka skryta (ukázkový režim — nic nebylo smazáno).");
	});
}
