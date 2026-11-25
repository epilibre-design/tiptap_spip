/** Classement stable exact/préfixe/inclusion ; aucune traduction ni mutation des items. */
export function filtrerSuggestions(items, query) {
	const recherche = query.toLowerCase();
	if (!recherche) return [...items];
	return items.map((item, index) => {
		const champs = [item.title, item.subtext, ...(item.keywords ?? [])]
			.filter((s) => typeof s === 'string').map((s) => s.toLowerCase());
		const rang = Math.min(...champs.map((s) => s === recherche ? 0 : s.startsWith(recherche) ? 1 : s.includes(recherche) ? 2 : Infinity));
		return { item, index, rang };
	}).filter((r) => Number.isFinite(r.rang))
		.sort((a, b) => a.rang - b.rang || a.index - b.index).map((r) => r.item);
}
