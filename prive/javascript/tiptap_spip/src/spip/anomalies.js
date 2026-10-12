/**
 * Anomalies de syntaxe (spec 06 §5) : nœuds bruts en ligne issus d'un raccourci cassé, dont le rendu
 * SPIP surprend (vérifié avec l'oracle, SPIP 4.4). Les bruts légitimes (HTML inconnu, entités, `{}`)
 * ne sont pas des anomalies.
 */

/** Balises de mise en forme : ouvertes sans fermeture, elles s'étendent jusqu'à la fin du paragraphe. */
const MISE_EN_FORME = 'strong|i|del|sup|sub|code';
/** Balises de bloc de SPIP : sans fermeture, elles ne sont pas traitées (sauf <quote>). */
const BLOCS = 'quote|multi|cadre|frame|poesie|poetry|html|math';

const REGLES = [
	// {{{ hors d'un intertitre complet : la suite devient un intertitre
	[/^\{{3,}$/, 'intertitre'],
	[/^\{{1,2}$/, 'ouverture'],
	[/^\}+$/, 'fermeture'],
	[new RegExp(`^<(?:${MISE_EN_FORME})>$`, 'i'), 'ouverture'],
	[new RegExp(`^</(?:${MISE_EN_FORME}|${BLOCS})>$`, 'i'), 'fermeture'],
	// <quote> sans fermeture : tout le texte qui suit passe en citation
	[/^<quote\b[^<>]*>$/i, 'citation'],
	[new RegExp(`^<(?:${BLOCS})\\b[^<>]*>$`, 'i'), 'balise'],
];

/**
 * Anomalie que révèle la source d'un nœud brut en ligne.
 *
 * @param {string} source
 * @returns {'ouverture'|'fermeture'|'intertitre'|'citation'|'balise'|null}
 */
export function anomalie(source) {
	return REGLES.find(([re]) => re.test(source))?.[1] ?? null;
}
