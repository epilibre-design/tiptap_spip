import { config } from '../config.js';
import { parseModel } from '../spip/models.js';
import { poserModele } from './ModelPopover.js';

/**
 * Catalogue des modèles (spec 05 §3, question Q3) : formulaires YAML du plugin Insérer modèles,
 * facultatif, ouverts dans sa modalbox.
 *
 * Contrat avec le plugin, sans le modifier :
 * - il pose dans le formulaire d'un textarea (après lui pour un crayon) un input
 *   `url_inserer_modeles` : l'URL de sa modalbox pour l'objet édité, si l'auteur peut insérer des
 *   modèles ;
 * - après « Insérer », son formulaire rechargé dans la modalbox affiche le raccourci produit dans
 *   `#code_modele_modalbox`. Il l'insère lui-même par le porte-plume, dans la zone markItUp qui a le
 *   focus : aucune ne l'a pendant que l'éditeur ouvre le catalogue.
 */

const CHAMP_URL = 'input[name=url_inserer_modeles]';

/** URL de la modalbox du plugin pour ce textarea, null sans le plugin ou sans droit. */
export function urlCatalogue(textarea) {
	const form = textarea.form;
	if (!form) return null;
	const input = form.querySelector(CHAMP_URL) ?? form.parentElement?.querySelector(`:scope > ${CHAMP_URL}`);
	return input?.value || null;
}

/**
 * Catalogue d'un textarea : { url, modeles }, ou null sans le plugin (modeles de la config nul),
 * sans droit d'insérer des modèles (pas d'URL) ou sans modèle proposé.
 */
export function catalogueDe(textarea) {
	const { modeles } = config();
	const url = urlCatalogue(textarea);
	return url && modeles && Object.keys(modeles).length ? { url, modeles } : null;
}

/**
 * Paramètres d'URL qui préremplissent le formulaire avec un modèle existant (`charger()` du plugin
 * lit chaque champ par _request()), ou null si un paramètre n'a pas de champ : le formulaire le
 * perdrait en réécrivant le raccourci, la saisie brute s'impose alors.
 *
 * @param {{ id: string, params: { key: ?string, value: string }[] }} model
 * @param {{ formulaire: string, id: ?string, champs: string[], valeurs: Record<string, string>, multiples: string[] }} description
 *        description du formulaire (tiptap_spip_catalogue_modeles())
 * @returns {?URLSearchParams}
 */
export function parametresFormulaire(model, description) {
	const { formulaire, id, champs, valeurs, multiples } = description;
	const params = new URLSearchParams({ formulaire_modele: formulaire });
	if (model.id) {
		if (!id) return null;
		params.set(id, model.id);
	}
	const poser = (champ, valeur) => {
		if (!champs.includes(champ) || params.has(champ) || params.has(`${champ}[]`)) return false;
		if (multiples.includes(champ)) {
			for (const v of valeur.split(',')) params.append(`${champ}[]`, v);
		} else {
			params.set(champ, valeur);
		}
		return true;
	};
	for (const { key, value } of model.params) {
		// valeur seule : align, variante ou classe (|left), ou champ=champ (|titre), comme l'écrit le plugin
		const champ = key ?? valeurs[value] ?? value;
		if (!poser(champ, value)) return null;
	}
	return params;
}

/**
 * Ouvre le catalogue dans la modalbox : liste des modèles, ou formulaire prérempli (`parametres`).
 * Le raccourci rendu par le plugin est posé dans l'éditeur (remplace le modèle à `pos`, sinon
 * inséré), puis la modalbox est fermée.
 *
 * @returns {boolean} false sans modalbox (plugin mediabox absent)
 */
export function ouvrirCatalogue({ editor, url, pos = null, parametres = null }) {
	const $ = globalThis.jQuery;
	if (typeof $?.modalbox !== 'function') return false;
	// le plugin insérerait aussi le raccourci dans la zone du porte-plume qui avait le focus
	if ($.markItUp) $.markItUp.focused = null;

	let observateur = null;
	const arreter = () => {
		observateur?.disconnect();
		observateur = null;
	};
	const lire = () => {
		const code = document.getElementById('code_modele_modalbox')?.value.trim();
		if (!code) return;
		arreter();
		const model = parseModel(code);
		if (model) poserModele(editor, model, pos);
		$.modalboxclose?.();
	};
	observateur = new MutationObserver(lire);
	observateur.observe(document.body, { childList: true, subtree: true });

	const cible = parametres ? `${url}${url.includes('?') ? '&' : '?'}${parametres}` : url;
	// comme le plugin (porte-plume) : contenu chargé en ajax, sans quoi mediabox devine une image
	$.modalbox(cible, { type: 'ajax', minHeight: '90%', className: 'tts-catalogue', onClose: arreter });
	return true;
}
