import { config } from '../config.js';

/**
 * Intertitres hiérarchiques des plugins Enluminures typographiques et Intertitres hiérarchiques :
 * `{{{…}}}` ou `{{{*…}}}` pour le premier niveau, `{{{**…}}}` … `{{{*****…}}}` pour les suivants.
 * Le serveur pose le niveau HTML que chaque nombre d'étoiles donne au rendu (config().intertitres,
 * clés 1 à 5, null pour un rendu qui n'est pas un titre h2 à h6, cf. tiptap_spip_intertitres()).
 * Sans eux, le core : `{{{…}}}` est un h2, les étoiles sont du texte.
 */

const RE_INTERTITRE = /^\{\{\{(?!\{)(.*?)\}\}\}[ \t\r]*$/;

/** Table étoiles → niveau du site, null sans plugin d'intertitres hiérarchiques. */
export function tableIntertitres() {
	const table = config().intertitres;
	return table && typeof table === 'object' ? table : null;
}

const niveauValide = (n) => (Number.isInteger(n) && n >= 2 && n <= 6 ? n : null);

/** Niveau du raccourci `{{{…}}}` sans étoile : celui de l'intertitre du site. */
export const niveauIntertitre = () => {
	const table = tableIntertitres();
	return table ? niveauValide(table[1]) : 2;
};

/**
 * Intertitre écrit en raccourci sur cette ligne : niveau (null si le rendu n'est pas un titre que
 * l'éditeur représente), position et longueur du contenu dans la ligne. null sans raccourci.
 *
 * @param {string} line
 * @returns {?{ level: ?number, offset: number, length: number }}
 */
export function lireIntertitre(line) {
	const m = line.match(RE_INTERTITRE);
	if (!m || /\{\{|\}\}/.test(m[1])) return null;
	const table = tableIntertitres();
	if (!table) return { level: 2, offset: 3, length: m[1].length };
	const etoiles = /^\**/.exec(m[1])[0].length;
	const apres = m[1].slice(etoiles);
	// six étoiles ou plus (contenu qui commence par une étoile), titre numéroté ({{{#…}}} ou
	// {{{**#…}}} d'Intertitres hiérarchiques) : pas un intertitre que l'éditeur sait écrire
	if (etoiles > 5 || apres.startsWith('#')) return { level: null, offset: 0, length: 0 };
	// blancs après les étoiles (le porte-plume d'Intertitres hiérarchiques écrit {{{** Titre}}})
	const debut = etoiles ? etoiles + /^[ \t]*/.exec(apres)[0].length : 0;
	return { level: niveauValide(table[Math.max(etoiles, 1)]), offset: 3 + debut, length: m[1].length - debut };
}

/** Niveaux de `<hN>` que le parseur lit : ceux que le core n'écrit pas en raccourci, tous avec un plugin. */
export const niveauHtmlLu = (level) => (tableIntertitres() ? level >= 2 : level >= 3) && level <= 6;

/**
 * Raccourci d'un intertitre de ce niveau, contenu déjà écrit (`html` : italique en HTML), ou null
 * s'il s'écrit en HTML (`<hN>`) : niveau sans raccourci, ou contenu que les étoiles happeraient.
 *
 * @param {number} level
 * @param {string} contenu
 * @returns {?string}
 */
export function ecrireIntertitre(level, contenu) {
	const table = tableIntertitres();
	if (!table) return level === 2 ? `{{{${contenu}}}}` : null;
	const etoiles = [1, 2, 3, 4, 5].find((k) => niveauValide(table[k]) === level);
	if (!etoiles) return null;
	if (etoiles === 1) return /^[*#]/.test(contenu) ? null : `{{{${contenu}}}}`;
	return /^[*#\s]/.test(contenu) ? null : `{{{${'*'.repeat(etoiles)}${contenu}}}}`;
}
