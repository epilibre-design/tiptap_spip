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

// plugins-dist/textwheel/wheels/spip/spip.json — règle abbr
export const RE_ABBR = /\[([^|[\]>]+)\|([^|\]{>]+)(?:\{([a-z]+)\})?\]/g;

// ecrire/src/Texte/Collecteur/Multis.php
export const RE_MULTI = /<multi>(.*?)<\/multi>/gs;

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

// ecrire/src/Texte/Collecteur/Modeles.php — même regex que RE_MODELE, ancrée sur un raccourci entier
export const RE_MODELE_SEUL = /^<([a-z_-]{3,})\s*([0-9]*)\s*([|](?:<[^<>]*>|[^>])*?)?\s*\/?>$/i;
