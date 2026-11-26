// Aucun import DOM ou IndexedDB : le fournisseur utilise les mêmes octets JSON que le picker.
const catalogues = new Map();
const indexes = new WeakMap();

function indexer(emojis) {
	return emojis.map((emoji, position) => ({
		emoji, position,
		aliases: emoji.shortcodes.map((s) => s.toLowerCase()),
		champs: [emoji.annotation, ...emoji.tags].map((s) => s.toLowerCase()),
	}));
}

function figer(valeur) {
	if (valeur && typeof valeur === 'object') {
		Object.values(valeur).forEach(figer);
		Object.freeze(valeur);
	}
	return valeur;
}

/** Promesse partagée par URL ; les données et leur index sont partagés en lecture seule. */
export function chargerCatalogueEmojis({ url }) {
	if (typeof url !== 'string' || !url) return Promise.reject(new Error('URL du catalogue emoji indisponible'));
	if (!catalogues.has(url)) {
		const promise = Promise.resolve().then(() => fetch(url)).then((response) => {
			if (!response.ok) throw new Error(`Chargement du catalogue emoji : HTTP ${response.status}`);
			return response.json();
		}).then((emojis) => {
			const chaines = (liste) => Array.isArray(liste) && liste.every((s) => typeof s === 'string' && s.length > 0);
			if (!Array.isArray(emojis) || !emojis.every((e) => e && typeof e.emoji === 'string' && e.emoji
				&& chaines(e.shortcodes) && e.shortcodes.length > 0 && typeof e.annotation === 'string'
				&& chaines(e.tags) && Number.isFinite(e.order))) throw new Error('Catalogue emoji invalide');
			figer(emojis);
			indexes.set(emojis, indexer(emojis));
			return emojis;
		});
		catalogues.set(url, promise);
		// Un échec réseau, HTTP ou JSON permet un nouvel essai à l’appel suivant.
		promise.catch(() => { if (catalogues.get(url) === promise) catalogues.delete(url); });
	}
	return catalogues.get(url);
}

/** Filtre pur : alias anglais avant annotations/tags ; titres bruts, contexte Unicode intact. */
export function filtrerEmojis(emojis, query) {
	const recherche = query.toLowerCase();
	if (!recherche) return [];
	// Seuls les catalogues chargés et figés ont un index persistant. Un tableau ordinaire reste mutable.
	const index = indexes.get(emojis) ?? indexer(emojis);
	const trouves = [];
	for (const entree of index) {
		const { aliases, champs } = entree;
		const exact = aliases.findIndex((s) => s === recherche);
		const prefixe = aliases.findIndex((s) => s.startsWith(recherche));
		const inclusion = aliases.findIndex((s) => s.includes(recherche));
		const rang = exact >= 0 ? 0 : prefixe >= 0 ? 1 : champs.some((s) => s === recherche) ? 2
			: champs.some((s) => s.startsWith(recherche)) ? 3 : inclusion >= 0 || champs.some((s) => s.includes(recherche)) ? 4 : Infinity;
		if (Number.isFinite(rang)) trouves.push({ ...entree, rang, alias: exact >= 0 ? exact : prefixe >= 0 ? prefixe : inclusion >= 0 ? inclusion : 0 });
	}
	trouves.sort((a, b) => a.rang - b.rang || a.emoji.order - b.emoji.order || a.position - b.position);
	const vus = new Set();
	const items = [];
	for (const { emoji, alias } of trouves) {
		if (vus.has(emoji.emoji)) continue;
		vus.add(emoji.emoji);
		items.push({ id: emoji.emoji, title: emoji.shortcodes[alias],
			context: { unicode: emoji.emoji, annotation: emoji.annotation, tags: [...emoji.tags] } });
	}
	return items;
}
