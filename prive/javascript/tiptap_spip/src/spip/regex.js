/**
 * Expressions régulières alignées sur le core SPIP 4.4.
 * Chaque constante cite son origine PHP : ne la modifier qu'en suivant le core.
 * Les modificateurs PHP sont traduits : U (ungreedy) → quantificateurs paresseux,
 * s → s, i → i, m → m. Toutes sont globales (g) : utiliser matchAll().
 *
 * Provenance : expressions et liste des codes de langue du core de SPIP 4.4.21 (ecrire/) et du plugin
 * TextWheel (plugins-dist/textwheel/), © Arnaud Martin, Antoine Pitrou, Philippe Rivière, Emmanuel
 * Saint-James, Collectif SPIP, licence GNU GPL (TextWheel : GPL-3.0-or-later). Adaptation du
 * 2026-10-11 : traduction de PCRE en JavaScript ; formes ancrées (…_SEUL) pour analyser un raccourci
 * entier ; <math> ajouté à _PROTEGE_BLOCS ; \s de _NOTES_RACCOURCI limité aux blancs ASCII.
 */

// ecrire/src/Texte/Collecteur/Modeles.php — <modeleN|params>
export const RE_MODELE = /<([a-z_-]{3,})\s*([0-9]*)\s*([|](?:<[^<>]*>|[^>])*?)?\s*\/?>/gi;

// ecrire/src/Texte/Collecteur/Liens.php — _RACCOURCI_LIEN
export const RE_LIEN = /\[([^\][]*?([[][^\]>-]*[\]][^\][]*)*)->(>?)([^\]]*)\]/gs;

// plugins-dist/textwheel/inc/notes.php — _NOTES_RACCOURCI (\s de PCRE sans /u : blancs ASCII)
export const RE_NOTE = /\[\[([ \t\n\v\f\r]*(<([^>'"]*)>)?(.*?))\]\]/gs;

// plugins-dist/textwheel/inc/lien.php — _RACCOURCI_GLOSSAIRE, _RACCOURCI_ANCRE
export const RE_GLOSSAIRE = /\[\?+\s*([^\][<>]+)\]/g;
export const RE_ANCRE = /\[#?([^\][]*)<-\]/g;

// plugins-dist/textwheel/wheels/spip/spip.json — règle abbr
export const RE_ABBR = /\[([^|[\]>]+)\|([^|\]{>]+)(?:\{([a-z]+)\})?\]/g;

// ecrire/src/Texte/Collecteur/Multis.php
export const RE_MULTI = /<multi>(.*?)<\/multi>/gs;

// ecrire/src/Texte/Collecteur/Multis.php — extraire_trads() : marqueur de langue [fr], [pt_br]…
const CODE_LANGUE = '[a-z]{2,3}(?:_[a-z]{2,3})?(?:_[a-z]{2,3})?';
export const RE_LANGUE_MULTI = new RegExp(`\\[(${CODE_LANGUE})\\]`, 'gi');
// code de langue seul (saisie d'une langue de multi)
export const RE_CODE_LANGUE = new RegExp(`^${CODE_LANGUE}$`, 'i');
// [ d'un marqueur de langue (même code), à écrire en entité dans le texte d'une partie
export const RE_AVANT_LANGUE = new RegExp(`\\[(?=${CODE_LANGUE}\\])`, 'gi');
// ligne vide (paragraphes) : un multi qui en contient une n'est représentable qu'en bloc
export const LIGNE_VIDE = /\n[ \t\r]*\n/;

// ecrire/src/Texte/Collecteur/Idiomes.php
export const RE_IDIOME = /<:(?:([a-z0-9_]+):)?([a-z0-9_]+):>/gi;

// ecrire/inc/texte_mini.php — _PROTEGE_BLOCS, plus <math> (règle math de wheels/spip/spip.json)
export const RE_PROTEGE_BLOCS = /<(html|pre|code|cadre|frame|script|style|math)(\b[^>]*)?>(.*?)<\/\1>/gis;

// plugins-dist/textwheel/wheels/spip/backticks.php — replace_backticks(), dans cet ordre
export const RE_BACKTICKS = [
	/(?<!`)(```+)([^`]|[^`].*?[^`])(\1)(?=$|[^`])/gms,
	/(?<!`)(``)([^`]|[^`].*?[^`])(``)(?=$|[^`])/gms,
	/(?<!`)(`)([^`]|[^`].*?[^`])(`)(?=$|[^`])/gms,
];

// wheels/spip/backticks.json bt-echappe-backticks : traité avant les backticks
export const RE_ECHAPPEMENT_CODE = /\\([\\`])/g;

// wheels/spip/spip.json echappe-raccourcis
export const RE_ECHAPPEMENT = /\\([{}_\-[\]|<>*#+~])/g;

// ecrire/inc/lang_liste.php — clés de $GLOBALS['codes_langues'] : les codes que traduire_nom_langue()
// reconnaît, donc ceux qu'un {xx} de lien transforme en hreflang (sinon c'est un italique)
export const LANGUES = new Set(`
aa ab af am an ar as ast ay az ba be ber_tam ber_tam_tfng bg bh bi bm bn bo br bs ca co cpf
cpf_dom cpf_hat cs cy da de dz el en en_hx en_sm eo es es_co es_mx_pop et eu fa ff fi fj fo fon
fr fr_fem fr_sc fr_lpc fr_lsf fr_spl fr_tu fy ga gd gl gn grc gu ha hac hbo haz he hi hr hu hy
ia id ie ik is it it_fem iu ja jv ka kk kl km kn ko kok ks ku ky la lb ln lo lt lu lv man mfv mg
mi mk ml mn mo mos mr ms mt my na nap ne nqo nl no nb nn oc oc_lnc oc_ni oc_ni_la oc_ni_mis
oc_prv oc_gsc oc_lms oc_auv oc_va om or pa pbb pl prs ps pt pt_br qu rm rn ro roa ru rw sa sc
scn sd sg sh sh_latn sh_cyrl si sk sl sm sn so sq sr src sro ss st su sv sw ta te tg th ti tk tl
tn to tr ts tt tw ty ug uk ur uz vi vo wa wo xh yi yo za zh zh_tw zu
`.trim().split(/\s+/));

// plugins-dist/textwheel/inc/lien.php — _RACCOURCI_ATTRIBUTS : texte|bulle{lang} d'un lien
export const RE_ATTRIBUTS_LIEN = /^((?:[^[]*?(?:\[[^\]]*\])?)*?)([|]([^<>]*?))?([{]([a-z_]*)[}])?$/;

// Formes ancrées sur un raccourci entier (analyse d'une région repérée par protect.js) :
// plugins-dist/textwheel/inc/notes.php — _NOTES_RACCOURCI ; d : positions des groupes
export const RE_NOTE_SEULE = /^\[\[([ \t\n\v\f\r]*(<([^>'"]*)>)?([\s\S]*?))\]\]$/d;
// plugins-dist/textwheel/inc/lien.php — _RACCOURCI_GLOSSAIRE, puis _RACCOURCI_GLOSES sur son contenu
export const RE_GLOSSAIRE_SEUL = /^\[\?+\s*([^\][<>]+)\]$/;
export const RE_GLOSES = /^([^|#{]*\w[^|#{]*)([^#]*)(#([^|{}]*))?(.*)$/;
// plugins-dist/textwheel/wheels/spip/spip.json — règle abbr
export const RE_ABBR_SEUL = /^\[([^|[\]>]+)\|([^|\]{>]+)(?:\{([a-z]+)\})?\]$/;
// ecrire/src/Texte/Collecteur/Idiomes.php — même regex que RE_IDIOME
export const RE_IDIOME_SEUL = /^<:(?:([a-z0-9_]+):)?([a-z0-9_]+):>$/i;
// ecrire/src/Texte/Collecteur/Modeles.php — même regex que RE_MODELE
export const RE_MODELE_SEUL = /^<([a-z_-]{3,})\s*([0-9]*)\s*([|](?:<[^<>]*>|[^>])*?)?\s*\/?>$/i;
