import { ServiceUnavailable } from './cvt.js';

/**
 * Résultats des services mis en cache côté navigateur : prévisualisations de modèles et titres de
 * liens. Les appels passent par la file de Services (un à la fois, cf. cvt.js).
 *
 * Les services peuvent arriver plus tard (formulaire chargé à la demande, spec 02 §6) : on accepte
 * une promesse de Services, ou null (pas de services : chaque demande est rejetée, et l'affichage
 * garde son repli).
 */

/** @param {import('./cvt.js').Services|Promise<?import('./cvt.js').Services>|null} services */
const disponibles = (services) => Promise.resolve(services).then((s) => {
	if (!s) throw new ServiceUnavailable();
	return s;
});

/** Prévisualisation HTML d'un modèle, par source exacte du raccourci. */
export class ModelPreviews {
	/** @param {import('./cvt.js').Services|Promise<?import('./cvt.js').Services>|null} services */
	constructor(services) {
		this.services = services;
		this.cache = new Map();
	}

	/** @returns {Promise<string>} HTML calculé par SPIP (passé par safehtml) */
	get(source) {
		if (!this.cache.has(source)) {
			const promise = disponibles(this.services).then((s) => s.call('previsu_modele', { modele: source }));
			this.cache.set(source, promise);
			// un échec n'est pas gardé : la prochaine demande repartira au serveur
			promise.catch(() => this.cache.delete(source));
		}
		return this.cache.get(source);
	}
}

/**
 * Résultats demandés un par un, envoyés au serveur par lots : les demandes faites dans le même tour
 * de boucle d'événements partent ensemble, par lots de `batch` (limite de verifier()).
 */
class CacheParLots {
	/**
	 * @param {import('./cvt.js').Services|Promise<?import('./cvt.js').Services>|null} services
	 * @param {{ operation: string, parametre: string, champ: string, vide: (cle: string) => object, batch?: number }} options
	 *        parametre : nom de la liste envoyée ; champ : clé de chaque résultat ; vide : résultat
	 *        d'une clé absente de la réponse
	 */
	constructor(services, { operation, parametre, champ, vide, batch = 50 }) {
		this.services = services;
		Object.assign(this, { operation, parametre, champ, vide, batch });
		this.cache = new Map();
		this.pending = new Map();
		this.scheduled = false;
	}

	get(cle) {
		if (this.cache.has(cle)) return this.cache.get(cle);
		const promise = new Promise((resolve, reject) => this.pending.set(cle, { resolve, reject }));
		this.cache.set(cle, promise);
		promise.catch(() => this.cache.delete(cle));
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
			disponibles(this.services).then((s) => s.call(this.operation, { [this.parametre]: lot.map(([cle]) => cle) })).then(
				(resultats) => {
					const parCle = new Map(resultats.map((r) => [r[this.champ], r]));
					for (const [cle, { resolve }] of lot) resolve(parCle.get(cle) ?? this.vide(cle));
				},
				(erreur) => lot.forEach(([, { reject }]) => reject(erreur)),
			);
		}
	}
}

/** Titres des liens [->cible] (opération titre_lien). */
export class LinkTitles extends CacheParLots {
	constructor(services, { batch = 50 } = {}) {
		super(services, { operation: 'titre_lien', parametre: 'cibles', champ: 'cible', vide: (cible) => ({ cible, titre: null, url: null }), batch });
	}
}

/** Traductions des idiomes <:module:cle:> (opération idiomes), par clé `module:cle` ou `cle`. */
export class IdiomTranslations extends CacheParLots {
	constructor(services, { batch = 50 } = {}) {
		super(services, { operation: 'idiomes', parametre: 'cles', champ: 'cle', vide: (cle) => ({ cle, texte: null }), batch });
	}
}
