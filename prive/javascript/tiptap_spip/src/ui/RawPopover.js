import { schemaJSON } from '../editor/content.js';
import { anomalie } from '../spip/anomalies.js';
import { parse, serialize } from '../spip/index.js';
import { explication } from '../editor/anomalies.js';
import { raccourciLisible } from './boutons.js';
import { label } from './labels.js';
import { idUnique, Popover, suivrePosition } from './popover.js';

/**
 * Blocs de premier niveau du segment de source (carte de segments, spec 04 §4) qui contient `pos` :
 * { debut, fin, premier, dernier, blocs }. Un bloc hors carte (créé dans l'éditeur) est seul.
 */
export function segmentDe(doc, pos) {
	const enfants = [];
	doc.forEach((node, p) => enfants.push({ node, p }));
	const index = doc.resolve(pos).index(0);
	let [premier, dernier] = [index, index];
	// premier bloc d'un segment au plus près avant : le segment couvre-t-il `index` ?
	for (let k = index; k >= 0; k--) {
		const groupe = enfants[k].node.attrs.spipGroup;
		if (!groupe) continue;
		if (k + groupe > index) [premier, dernier] = [k, Math.min(k + groupe, enfants.length) - 1];
		break;
	}
	return {
		premier,
		dernier,
		debut: enfants[premier].p,
		fin: enfants[dernier].p + enfants[dernier].node.nodeSize,
		blocs: enfants.slice(premier, dernier + 1).map((e) => e.node),
	};
}

/**
 * Popover d'un nœud brut (spec 06 §4) : la source exacte de son segment, éditable, avec l'explication
 * de l'anomalie s'il en est une. « Appliquer » relit la source et remplace le segment : un raccourci
 * réparé devient éditable (« convertir »). Mod-Entrée applique.
 */
export function openRawPopover({ editor, wrapper, parent }, pos) {
	const { doc } = editor.state;
	const brut = doc.nodeAt(pos);
	if (!brut) return null;
	editor.commands.setNodeSelection(pos);
	const segment = segmentDe(doc, pos);
	// le document peut changer pendant que le popover est ouvert : position suivie
	const suivi = suivrePosition(editor, pos);
	const source = serialize({ type: 'doc', content: segment.blocs.map((b) => b.toJSON()) });

	const popover = new Popover({ editor, wrapper, parent, titre: label('brut'), className: 'tts-popover--brut', onSubmit: () => appliquer(), onClose: () => suivi.fin() });
	const cle = brut.type.name === 'spipRawInline' ? anomalie(brut.attrs.source) : null;
	if (cle) {
		const texte = document.createElement('p');
		texte.className = 'tts-popover__explication';
		texte.id = idUnique('tts-explication');
		texte.textContent = explication(cle);
		popover.form.prepend(texte);
		popover.form.setAttribute('aria-describedby', texte.id);
	}
	const zone = document.createElement('textarea');
	zone.name = 'source';
	zone.rows = Math.min(12, Math.max(3, source.split('\n').length + 1));
	zone.value = source;
	popover.field(label('brut_source'), zone);
	zone.addEventListener('keydown', (event) => {
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			popover.form.requestSubmit();
		}
	});

	const appliquer = () => {
		if (zone.value === source) return true;
		const position = suivi.pos();
		if (position === null) return true;
		const actuel = editor.state.doc;
		const cible = segmentDe(actuel, position);
		let blocs;
		try {
			blocs = editor.schema.nodeFromJSON(schemaJSON(parse(zone.value), editor.schema)).content;
		} catch {
			blocs = null;
		}
		const ancien = cible.blocs[0];
		// le séparateur qui précédait le segment reste le même
		if (blocs?.firstChild && 'spipSep' in blocs.firstChild.attrs) {
			const premier = blocs.firstChild;
			blocs = blocs.replaceChild(0, premier.type.create({ ...premier.attrs, spipSep: ancien.attrs.spipSep }, premier.content, premier.marks));
		}
		if (!blocs || !actuel.canReplace(cible.premier, cible.dernier + 1, blocs)) {
			popover.error(label('brut_invalide'));
			return false;
		}
		editor.chain().focus().command(({ tr }) => {
			tr.replaceWith(cible.debut, cible.fin, blocs);
			return true;
		}).run();
		return true;
	};

	popover.button(label('appliquer'), null, { submit: true, name: 'appliquer' }).title = `${label('appliquer')} (${raccourciLisible('Mod-Enter')})`;
	popover.button(label('annuler'), () => {}, { name: 'annuler' });
	popover.open(zone);
	return popover;
}
