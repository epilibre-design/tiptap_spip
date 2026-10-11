import { Services } from '../services/cvt.js';

/**
 * Formulaire de services chargé à la demande (spec 02 §6) : page tiptap_spip_services, dont
 * charger() vérifie le contexte (autorisation, champ texte de l'objet) avant de rendre le
 * formulaire, qui le signe. Le conteneur est placé dans un bloc masqué à la fin de <body>, hors de
 * tout formulaire. Il appartient à l'éditeur qui l'a demandé : retiré à sa destruction (cf. main.js),
 * et jamais ajouté si l'éditeur est détruit pendant le chargement (signal annulé).
 *
 * @param {HTMLTextAreaElement} textarea
 * @param {{ objet: string, id: number, champ: string }} ctx
 * @param {{ fetch?: typeof fetch, url?: string, signal?: AbortSignal }} [options]  url : page de
 *        services (configuration) ; signal : annule le chargement (éditeur détruit)
 * @returns {Promise<Services|null>} null : pas de services (non autorisé, hors ligne, annulé…)
 */
export async function servicesALaDemande(textarea, ctx, { fetch = globalThis.fetch?.bind(globalThis), url = globalThis.spipConfig?.tiptap_spip?.services, signal } = {}) {
	if (!url || !fetch || signal?.aborted) return null;
	const adresse = new URL(url, document.baseURI);
	adresse.searchParams.set('objet', ctx.objet);
	adresse.searchParams.set('id_objet', String(ctx.id));
	adresse.searchParams.set('champ', ctx.champ);
	let html;
	try {
		const res = await fetch(adresse.href, { credentials: 'same-origin', signal });
		html = res.ok ? await res.text() : '';
	} catch {
		return null;
	}
	if (signal?.aborted) return null;
	const container = new DOMParser().parseFromString(html, 'text/html').querySelector('.tts-services');
	if (!container?.querySelector('form')) return null;
	let bloc = document.getElementById('tts-services');
	if (!bloc) {
		bloc = document.createElement('div');
		bloc.id = 'tts-services';
		bloc.hidden = true;
		document.body.append(bloc);
	}
	const importe = document.importNode(container, true);
	importe.hidden = true;
	bloc.append(importe);
	return new Services(importe);
}
