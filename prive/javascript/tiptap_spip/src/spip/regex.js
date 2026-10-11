/**
 * Expressions régulières alignées sur le core SPIP 4.4.
 * Chaque constante cite son origine PHP : ne la modifier qu'en suivant le core.
 * Les modificateurs PHP sont traduits : U (ungreedy) → quantificateurs paresseux,
 * s → s, i → i, m → m. Toutes sont globales (g) : utiliser matchAll().
 */

// ecrire/src/Texte/Collecteur/Modeles.php — <modeleN|params>
export const RE_MODELE = /<([a-z_-]{3,})\s*([0-9]*)\s*([|](?:<[^<>]*>|[^>])*?)?\s*\/?>/gi;

// ecrire/src/Texte/Collecteur/Liens.php — _RACCOURCI_LIEN
export const RE_LIEN = /\[([^\][]*?([[][^\]>-]*[\]][^\][]*)*)->(>?)([^\]]*)\]/gs;

// plugins-dist/textwheel/inc/notes.php — _NOTES_RACCOURCI
export const RE_NOTE = /\[\[(\s*(<([^>'"]*)>)?(.*?))\]\]/gs;

// plugins-dist/textwheel/inc/lien.php — _RACCOURCI_GLOSSAIRE, _RACCOURCI_ANCRE
export const RE_GLOSSAIRE = /\[\?+\s*([^\][<>]+)\]/g;
export const RE_ANCRE = /\[#?([^\][]*)<-\]/g;

// plugins-dist/textwheel/wheels/spip/spip.yaml — règle abbr
export const RE_ABBR = /\[([^|[\]>]+)\|([^|\]{>]+)(?:\{([a-z]+)\})?\]/g;

// ecrire/src/Texte/Collecteur/Multis.php
export const RE_MULTI = /<multi>(.*?)<\/multi>/gs;

// ecrire/src/Texte/Collecteur/Idiomes.php
export const RE_IDIOME = /<:(?:([a-z0-9_]+):)?([a-z0-9_]+):>/gi;

// ecrire/inc/texte_mini.php — _PROTEGE_BLOCS, plus <math> (règle math de spip.yaml)
export const RE_PROTEGE_BLOCS = /<(html|pre|code|cadre|frame|script|style|math)(\b[^>]*)?>(.*?)<\/\1>/gis;

// plugins-dist/textwheel/wheels/spip/backticks.php — replace_backticks(), dans cet ordre
export const RE_BACKTICKS = [
	/(?<!`)(```+)([^`]|[^`].*?[^`])(\1)(?=$|[^`])/gms,
	/(?<!`)(``)([^`]|[^`].*?[^`])(``)(?=$|[^`])/gms,
	/(?<!`)(`)([^`]|[^`].*?[^`])(`)(?=$|[^`])/gms,
];

// backticks.yaml bt-echappe-backticks : traité avant les backticks
export const RE_ECHAPPEMENT_CODE = /\\([\\`])/g;

// spip.yaml echappe-raccourcis
export const RE_ECHAPPEMENT = /\\([{}_\-[\]|<>*#+~])/g;
