/**
 * Contexte serveur d'un textarea (objet, id, champ) pour les hôtes qui ne passent pas par
 * formulaire_fond (spec 02 §6, « Résolution du contexte serveur ») :
 * 1. attributs data-tts-objet, data-tts-id-objet, data-tts-champ posés par le squelette ;
 * 2. formulaire d'un crayon (plugin Crayons) : son nom « objet-champ-id » est dans le champ caché
 *    name_<clé>, le champ édité dans le name du textarea (content_<clé>_<champ>) ;
 * 3. sinon : mode sans objet, champ = name du textarea.
 *
 * @param {HTMLTextAreaElement} textarea
 * @returns {{ objet: string, id: number, champ: string }}
 */
export function contexte(textarea) {
	const { ttsObjet, ttsIdObjet, ttsChamp } = textarea.dataset;
	if (ttsObjet !== undefined) {
		return { objet: ttsObjet, id: Number(ttsIdObjet) || 0, champ: ttsChamp || textarea.name };
	}
	const form = textarea.form;
	if (form?.classList.contains('formulaire_crayon')) {
		for (const input of form.querySelectorAll('input.crayon-id')) {
			const cle = input.value;
			const prefixe = `content_${cle}_`;
			if (!textarea.name.startsWith(prefixe)) continue;
			const nom = form.querySelector(`input[name="name_${CSS.escape(cle)}"]`)?.value ?? '';
			const m = nom.match(/^([a-z_]+)-.*-(\d+)$/);
			if (m) return { objet: m[1], id: Number(m[2]), champ: textarea.name.slice(prefixe.length) };
		}
	}
	return { objet: '', id: 0, champ: textarea.name };
}
