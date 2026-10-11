import { parse } from './parse.js';
import { RE_NOTE_SEULE } from './regex.js';

/** Blocs qu'une note peut contenir (spec 03 §5). */
const BLOCS = new Set(['paragraph', 'bulletList', 'orderedList', 'spipModelBlock']);

/**
 * Note [[texte]], [[<nom>texte]], [[<>texte]], reconnue comme traiter_raccourci_notes() : un `<nom>`
 * en tête est un nom, sauf si le texte contient la balise fermante `</nom>` sans `<nom…>` avant
 * (`[[<i>x</i> y]]` est une note automatique). Le contenu est analysé avec parse() : carte de
 * segments comprise, il est restitué à l'identique tant qu'il n'est pas modifié.
 *
 * Le nom se cherche dans le texte que voit le core, où liens, modèles et glossaire sont déjà
 * remplacés : `[[<doc1>]]` est une note automatique qui contient un modèle.
 *
 * @param {string} src  raccourci entier
 * @param {string} [masked]  même texte, raccourcis traités avant les notes masqués (même longueur)
 * @returns {{ name: string|null, content: object[], lead: string, trail: string } | null}
 *          name : null = automatique, '' = sans appel ; null si non représentable
 */
export function parseNote(src, masked = src) {
	const m = masked.match(RE_NOTE_SEULE);
	if (!m) return null;
	const [, , ref, , texte] = m;
	const morceau = (i) => src.slice(m.indices[i][0], m.indices[i][1]);
	const nom = ref === undefined ? null : morceau(3);
	let name = null;
	let contenu = morceau(1);
	if (ref !== undefined) {
		const ferme = texte.includes(`</${nom}>`);
		// le core place le nom tel quel dans une regex : seuls les noms simples s'y lisent pareil
		if (ferme && !/^[\w-]*$/.test(nom)) return null;
		if (!ferme || new RegExp(`<${nom}\\W.*</${nom}>`).test(texte)) {
			name = nom;
			contenu = morceau(4);
		}
	}
	// SPIP rend le texte rogné juste avant </div> : un \ final (non échappé) y devient \< et
	// disparaît. Il n'appartient donc pas au contenu ; il reste dans la fin technique de la note.
	const fin = contenu.match(/(?<!\\)(?:\\\\)*\\[ \t\n\r\0\x0B]*$/)?.[0] ?? '';
	const invisible = fin === '' ? '' : fin.slice(fin.lastIndexOf('\\'));
	const doc = parse(contenu.slice(0, contenu.length - invisible.length));
	if (!doc.content.every((b) => BLOCS.has(b.type))) return null;
	return { name, content: doc.content, lead: doc.attrs.spipLead, trail: doc.attrs.spipTrail + invisible };
}
