/**
 * Résultats des services mis en cache côté navigateur : prévisualisations de modèles et titres de
 * liens. Les appels passent par la file de Services (un à la fois, cf. cvt.js).
 */

/** Prévisualisation HTML d'un modèle, par source exacte du raccourci. */
export class ModelPreviews {
	/** @param {import('./cvt.js').Services} services */
	constructor(services) {
		this.services = services;
		this.cache = new Map();
	}

	/** @returns {Promise<string>} HTML calculé par SPIP (passé par safehtml) */
	get(source) {
		if (!this.cache.has(source)) {
			const promise = this.services.call('previsu_modele', { modele: source });
			this.cache.set(source, promise);
			// un échec n'est pas gardé : la prochaine demande repartira au serveur
			promise.catch(() => this.cache.delete(source));
		}
		return this.cache.get(source);
	}
}

/**
 * Titres des liens [->cible]. Les cibles demandées dans le même tour de boucle d'événements partent
 * ensemble, par lots de 50 (limite de verifier()).
 */
export class LinkTitles {
	/** @param {import('./cvt.js').Services} services */
	constructor(services, { batch = 50 } = {}) {
		this.services = services;
		this.batch = batch;
		this.cache = new Map();
		this.pending = new Map();
		this.scheduled = false;
	}

	/** @returns {Promise<{ cible: string, titre: ?string, url: ?string, objet: ?string, id: ?number }>} */
	get(cible) {
		if (this.cache.has(cible)) return this.cache.get(cible);
		const promise = new Promise((resolve, reject) => this.pending.set(cible, { resolve, reject }));
		this.cache.set(cible, promise);
		promise.catch(() => this.cache.delete(cible));
		if (!this.scheduled) {
			this.scheduled = true;
			queueMicrotask(() => this.flush());
		}
		return promise;
	}

	flush() {
		this.scheduled = false;
		const demandes = [...this.pending];
		this.pending.clear();
		for (let i = 0; i < demandes.length; i += this.batch) {
			const lot = demandes.slice(i, i + this.batch);
			this.services.call('titre_lien', { cibles: lot.map(([cible]) => cible) }).then(
				(resultats) => {
					const parCible = new Map(resultats.map((r) => [r.cible, r]));
					for (const [cible, { resolve }] of lot) resolve(parCible.get(cible) ?? { cible, titre: null, url: null });
				},
				(erreur) => lot.forEach(([, { reject }]) => reject(erreur)),
			);
		}
	}
}
