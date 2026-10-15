/**
 * Appels au formulaire CVT de services de l'éditeur (spec 02 §5).
 *
 * Le formulaire `#FORMULAIRE_TIPTAP_SPIP{objet, id_objet, champ}` est rendu par SPIP dans un conteneur
 * masqué `.tts-services`, hors du formulaire d'édition. Un appel poste ce formulaire en AJAX
 * (var_ajax=form) avec l'opération et ses paramètres ; SPIP répond
 * `<br class='… ajax-form-is-ok'>` suivi du formulaire recalculé, qui porte le résultat
 * (script.tts-resultat) ou les erreurs de verifier() (script.tts-erreurs) en JSON. Un appel qui
 * envoie un fichier (deposer_document) passe par XMLHttpRequest, pour la progression et l'abandon.
 */

/** Le service ne répond plus (session expirée, droit retiré, réseau) : mode dégradé. */
export class ServiceUnavailable extends Error {
	constructor(message = 'services de l\'éditeur indisponibles') {
		super(message);
		this.name = 'ServiceUnavailable';
	}
}

/** verifier() a refusé la demande : erreurs par paramètre, texte sans balises. */
export class ServiceError extends Error {
	constructor(erreurs) {
		super(erreurs.message_erreur || Object.values(erreurs).join(' '));
		this.name = 'ServiceError';
		this.erreurs = erreurs;
	}
}

/** Appel abandonné (éditeur détruit, « Enregistrer sans attendre ») : pas une panne du service. */
const abandon = () => new DOMException('envoi abandonné', 'AbortError');

const texte = (html) => new DOMParser().parseFromString(String(html), 'text/html').body.textContent.trim();

const lireJSON = (doc, selecteur) => {
	const script = doc.querySelector(selecteur);
	return script ? JSON.parse(script.textContent) : null;
};

/**
 * Lit la réponse AJAX d'un CVT.
 * @param {string} html
 * @returns {{ form: HTMLFormElement, operation?: string, resultat?: any, erreurs: object|null } | null}
 *          null si la réponse n'est pas celle d'un formulaire traité (session expirée…)
 */
export function parseResponse(html) {
	if (!html || !html.includes('ajax-form-is-ok')) return null;
	const doc = new DOMParser().parseFromString(html, 'text/html');
	const form = doc.querySelector('form');
	if (!form) return null;
	const ok = lireJSON(doc, 'script.tts-resultat');
	const brutes = lireJSON(doc, 'script.tts-erreurs');
	const erreurs = brutes ? Object.fromEntries(Object.entries(brutes).map(([k, v]) => [k, texte(v)])) : null;
	return { form, operation: ok?.operation, resultat: ok?.resultat, erreurs };
}

export class Services {
	/**
	 * Formulaire de services d'un textarea : conteneur dont l'identifiant d'instance est celui du
	 * formulaire d'édition du textarea, et le champ son name.
	 * @param {HTMLTextAreaElement} textarea
	 * @param {{ fetch?: typeof fetch }} [options]
	 * @returns {Services|null} null : pas de services (mode dégradé)
	 */
	static forTextarea(textarea, options) {
		const id = textarea.form?.dataset.ttsInstance;
		if (!id) return null;
		const container = [...document.querySelectorAll('.tts-services')]
			.find((c) => c.dataset.ttsInstance === id && c.dataset.ttsChamp === textarea.name);
		return container?.querySelector('form') ? new Services(container, options) : null;
	}

	/** @param {HTMLElement} container  élément .tts-services */
	constructor(container, { fetch = globalThis.fetch?.bind(globalThis), xhr = () => new XMLHttpRequest() } = {}) {
		this.container = container;
		this.fetch = fetch;
		this.xhr = xhr;
		this.available = true;
		this.queue = Promise.resolve();
	}

	/**
	 * Collage et dépôt de fichiers (spec 10 §6) : configuration annoncée par charger() sur le formulaire
	 * courant, null si deposer_document est indisponible.
	 * @returns {{ images: string[], extensions: Record<string, string>, taille_image: number,
	 *             documents: string[], documents_limite_image: string[], taille_document: number } | null}
	 */
	depot() {
		const brut = this.container.querySelector('form')?.dataset.ttsDepot;
		if (!brut) return null;
		try {
			return JSON.parse(brut);
		} catch {
			return null;
		}
	}

	/**
	 * Appelle une opération ; les appels sont sérialisés (chacun repart du formulaire renouvelé
	 * par la réponse précédente).
	 * @param {string} operation  previsu_modele, titre_lien, rechercher, deposer_document…
	 * @param {object} params  valeurs non chaînes envoyées en JSON
	 * @param {{ fichier?: File, progression?: (ratio: number|null) => void, signal?: AbortSignal }} [options]
	 *        fichier : envoyé dans le champ « fichier », par XMLHttpRequest (progression) ;
	 *        signal : abandon de l'appel, en attente ou en cours (AbortError)
	 * @returns {Promise<any>} résultat de l'opération
	 */
	call(operation, params = {}, options = {}) {
		const run = () => this.send(operation, params, options);
		const promise = this.queue.then(run, run);
		this.queue = promise.catch(() => {});
		return promise;
	}

	async send(operation, params, { fichier = null, progression = null, signal = null } = {}) {
		if (signal?.aborted) throw abandon();
		if (!this.available) throw new ServiceUnavailable();
		const form = this.container.querySelector('form');
		const body = new FormData(form);
		body.set('var_ajax', 'form');
		body.set('operation', operation);
		for (const [key, value] of Object.entries(params)) {
			body.set(key, typeof value === 'string' ? value : JSON.stringify(value));
		}
		if (fichier) body.set('fichier', fichier, fichier.name);
		const url = form.getAttribute('action');
		let reponse;
		try {
			const html = fichier
				? await this.envoyer(url, body, { progression, signal })
				: await (await this.fetch(url, { method: 'POST', body, credentials: 'same-origin' })).text();
			reponse = parseResponse(html);
		} catch (erreur) {
			if (erreur?.name === 'AbortError') throw erreur;
			reponse = null;
		}
		if (!reponse) {
			this.available = false;
			throw new ServiceUnavailable();
		}
		form.replaceWith(document.importNode(reponse.form, true));
		if (reponse.erreurs) throw new ServiceError(reponse.erreurs);
		return reponse.resultat;
	}

	/**
	 * POST par XMLHttpRequest, seule voie qui donne la progression d'un envoi (fetch ne la donne pas).
	 * @returns {Promise<string>} réponse ; rejet TypeError (réseau) ou AbortError
	 */
	envoyer(url, body, { progression, signal }) {
		return new Promise((resolve, reject) => {
			const xhr = this.xhr();
			const abandonner = () => xhr.abort();
			const fin = (suite) => {
				signal?.removeEventListener('abort', abandonner);
				suite();
			};
			xhr.open('POST', url);
			xhr.withCredentials = true;
			if (progression) xhr.upload.onprogress = (e) => progression(e.lengthComputable ? e.loaded / e.total : null);
			xhr.onload = () => fin(() => resolve(xhr.responseText));
			xhr.onerror = () => fin(() => reject(new TypeError('échec de l\'envoi')));
			xhr.onabort = () => fin(() => reject(abandon()));
			signal?.addEventListener('abort', abandonner, { once: true });
			xhr.send(body);
		});
	}
}
