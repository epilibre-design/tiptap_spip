/**
 * Appels au formulaire CVT de services de l'éditeur (spec 02 §5).
 *
 * Le formulaire `#FORMULAIRE_TIPTAP_SPIP{objet, id_objet, champ}` est rendu par SPIP dans un conteneur
 * masqué `.tts-services`, hors du formulaire d'édition. Un appel poste ce formulaire en AJAX
 * (var_ajax=form) avec l'opération et ses paramètres ; SPIP répond
 * `<br class='… ajax-form-is-ok'>` suivi du formulaire recalculé, qui porte le résultat
 * (script.tts-resultat) ou les erreurs de verifier() (script.tts-erreurs) en JSON.
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
	constructor(container, { fetch = globalThis.fetch?.bind(globalThis) } = {}) {
		this.container = container;
		this.fetch = fetch;
		this.available = true;
		this.queue = Promise.resolve();
	}

	/**
	 * Appelle une opération ; les appels sont sérialisés (chacun repart du formulaire renouvelé
	 * par la réponse précédente).
	 * @param {string} operation  previsu_modele, titre_lien, rechercher
	 * @param {object} params  valeurs non chaînes envoyées en JSON
	 * @returns {Promise<any>} résultat de l'opération
	 */
	call(operation, params = {}) {
		const run = () => this.send(operation, params);
		const promise = this.queue.then(run, run);
		this.queue = promise.catch(() => {});
		return promise;
	}

	async send(operation, params) {
		if (!this.available) throw new ServiceUnavailable();
		const form = this.container.querySelector('form');
		const body = new FormData(form);
		body.set('var_ajax', 'form');
		body.set('operation', operation);
		for (const [key, value] of Object.entries(params)) {
			body.set(key, typeof value === 'string' ? value : JSON.stringify(value));
		}
		let reponse;
		try {
			const res = await this.fetch(form.getAttribute('action'), { method: 'POST', body, credentials: 'same-origin' });
			reponse = parseResponse(await res.text());
		} catch {
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
}
