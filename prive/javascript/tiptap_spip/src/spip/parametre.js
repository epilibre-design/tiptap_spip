/**
 * Valeur d'un paramètre de modèle saisie dans le formulaire du plugin Insérer modèles. Le plugin la
 * colle telle quelle dans le raccourci (`<modele|champ=valeur>`), que SPIP coupe à chaque `|` et
 * termine au premier `>` hors d'une balise : ces caractères y sont écrits en entités HTML, que SPIP
 * affiche tels quels. Les balises gardent leurs chevrons (`<quote>`, `<sup>` : le raccourci les
 * admet), pas leurs `|`.
 */

const ENTITES = { '|': '&#124;', '<': '&lt;', '>': '&gt;' };

/** Valeur écrite dans le textarea : `|`, `<` et `>` hors d'une balise en entités. Idempotente. */
export const echapperParametre = (texte) =>
	texte.replace(/<[a-z/!][^<>]*>|[|<>]/gi, (m) => (m.length > 1 ? m.replaceAll('|', ENTITES['|']) : ENTITES[m]));

/**
 * Valeur lue dans le textarea : `&#124;` redevient `|` (le parseur décode lui-même `&lt;` et
 * `&gt;`, et garderait `&#124;` en source brute).
 */
export const lireParametre = (texte) => texte.replace(/&#(?:124|x7c);/gi, '|');
