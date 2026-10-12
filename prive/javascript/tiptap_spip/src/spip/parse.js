import { blocksOf } from './blocks.js';
import { canon, node } from './json.js';
import { protect, regionsIn } from './protect.js';
import { avecRegles } from './regles.js';
import { segment } from './segment.js';

/**
 * Source SPIP → document JSON Tiptap, avec la carte de segments de la sérialisation
 * conservatrice (spec 04 §4) :
 *   doc.attrs.spipLead / spipTrail : blancs avant le premier et après le dernier bloc ;
 *   1er bloc de chaque segment : spipSep (séparateur exact qui le précède), spipSrc (source
 *   exacte du segment), spipGroup (nombre de blocs JSON issus du segment), spipHash (forme
 *   canonique de ces blocs).
 * Ne lève jamais d'exception.
 *
 * @param {string} source
 * @param {{ empreintes?: boolean, regles?: object[] }} options  empreintes false : spipHash non
 *        calculées (l'éditeur les recalcule sur la forme que donne le schéma, cf. schemaJSON) ;
 *        regles : règles tierces (regles.js), sinon celles de l'appel englobant
 * @returns {object} nœud doc
 */
export function parse(source, { empreintes = true, regles } = {}) {
	return avecRegles(regles, () => analyser(source, empreintes));
}

function analyser(source, empreintes) {
	const { masked, regions } = protect(source);
	const { lead, trail, segments } = segment(source, masked);
	const content = [];
	for (const seg of segments) {
		const src = source.slice(seg.start, seg.end);
		const blocks = blocksOf(src, masked.slice(seg.start, seg.end), regionsIn(regions, seg.start, seg.end));
		blocks[0] = withTech(blocks[0], { spipSep: seg.sep, spipSrc: src, spipGroup: blocks.length, spipHash: empreintes ? canon(blocks) : null });
		content.push(...blocks);
	}
	if (!content.length) {
		content.push(withTech(node('paragraph'), { spipSep: '', spipSrc: '', spipGroup: 1, spipHash: canon([node('paragraph')]) }));
	}
	return node('doc', { spipLead: lead, spipTrail: trail }, content);
}

const withTech = (block, tech) => ({ ...block, attrs: { ...(block.attrs ?? {}), ...tech } });
