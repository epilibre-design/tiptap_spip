import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { anomalie } from '../spip/anomalies.js';
import { label } from '../ui/labels.js';

/**
 * Anomalies de syntaxe du document (spec 06 §5) : nœuds bruts en ligne issus d'un raccourci cassé.
 *
 * @param {import('@tiptap/pm/model').Node} doc
 * @returns {{ pos: number, cle: string, node: import('@tiptap/pm/model').Node }[]}  dans l'ordre du texte
 */
export function anomaliesDuDocument(doc) {
	const out = [];
	doc.descendants((node, pos) => {
		if (node.type.name !== 'spipRawInline') return true;
		const cle = anomalie(node.attrs.source);
		if (cle) out.push({ pos, cle, node });
		return false;
	});
	return out;
}

/** Explication d'une anomalie : ce que SPIP en fera au rendu. */
export const explication = (cle) => label(`anomalie_${cle}`);

const decorations = (doc) => DecorationSet.create(doc, anomaliesDuDocument(doc).map(({ pos, cle, node }) =>
	Decoration.node(pos, pos + node.nodeSize, { class: 'tts-anomalie', 'data-tts-anomalie': cle, title: explication(cle) })));

const clef = new PluginKey('spipAnomalies');

/** Anomalies surlignées (soulignement ondulé), l'explication en bulle. */
export const SpipAnomalies = Extension.create({
	name: 'spipAnomalies',
	addProseMirrorPlugins: () => [new Plugin({
		key: clef,
		state: {
			init: (config, { doc }) => decorations(doc),
			apply: (tr, valeur) => (tr.docChanged ? decorations(tr.doc) : valeur),
		},
		props: { decorations: (state) => clef.getState(state) },
	})],
});
