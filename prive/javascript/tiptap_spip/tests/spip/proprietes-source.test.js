// @vitest-environment jsdom
// Propriétés sur la source (spec 04 §5, spec 08 §2) : textes tirés au hasard parmi des fragments de
// syntaxe SPIP. TTS_FC_RUNS augmente le nombre de tirages (passe longue) ; un échec affiche la graine
// et le contre-exemple réduit, à reprendre dans un test unitaire.
import { getSchema } from '@tiptap/core';
import fc from 'fast-check';
import { describe, it } from 'vitest';
import { coreExtensions } from '../../src/editor/extensions.js';
import { canon, parse, serialize } from '../../src/spip/index.js';

const runs = Number(process.env.TTS_FC_RUNS) || 300;
const schema = getSchema(coreExtensions());

/** Fragments : délimiteurs des raccourcis, balises, débuts de ligne, blancs et texte. */
const FRAGMENTS = [
	// typographie et échappements
	'{', '}', '{{', '}}', '{{{', '}}}', '~', '\\', '`', '```', '&', '&lt;', '&gt;', '&amp;', '&#91;', '&#93;',
	'&#124;', '&eacute;', '&nbsp;', '<', '>',
	// liens, notes, glossaire, ancres, abréviations
	'[', ']', '[[', ']]', '->', '->>', '<-', '|', '[?', '#', '[->art12]', '[texte->art12]', '[?SPIP]', '[[note]]',
	'[[<n>note]]', '[#ancre<-]', '[ABBR|explication{fr}]', '{fr}', 'art12', 'https://x.org', 'mailto:a@b.c',
	// balises
	'<code>', '</code>', '<quote>', '</quote>', '<poesie>', '</poesie>', '<cadre>', '</cadre>', '<html>', '</html>',
	'<math>', '</math>', '<strong>', '</strong>', '<i>', '</i>', '<del>', '</del>', '<sup>', '</sup>', '<sub>', '</sub>',
	'<small>', '</small>', '<span class="x">', '</span>', '<h3>', '</h3>', '<div class="text-center">', '</div>',
	'<br />', '<!-- c -->', '<b>', '<p>',
	// modèles, multi, idiomes
	'<doc12>', '<doc12|left>', '<img3|center|largeur=300>', '<doc', '<multi>', '</multi>', '[fr]', '[en]', '<:mod:cle:>',
	// débuts de ligne, tableaux
	'-* ', '-** ', '-# ', '- ', '_ ', '----', '||', '|<', '|^', '|a|', '|{{t}}|',
	// blancs et fins de ligne
	'\n', '\n\n', '\n\n\n', '\r\n', '\r', ' ', '  ', '\t', ' ', ' ',
	// texte
	'a', 'mot', 'É', 'ﬁ', '👩‍💻', '?', ':', '!', '"', "'", '=', '*', '-', '_', '0',
];

const source = fc.array(fc.constantFrom(...FRAGMENTS), { maxLength: 40 }).map((f) => f.join(''));

const verifier = (propriete) => fc.assert(fc.property(source, propriete), { numRuns: runs });

describe('propriétés sur la source', () => {
	it('totalité et identité : serialize(parse(s)) === s', () => {
		verifier((s) => serialize(parse(s)) === s);
	});

	it('idempotence de la forme canonique', () => {
		verifier((s) => {
			const once = serialize(parse(s), { conservative: false });
			return serialize(parse(once), { conservative: false }) === once;
		});
	});

	it('stabilité du JSON : la forme canonique re-parsée redonne le même JSON', () => {
		verifier((s) => {
			const doc = parse(s);
			return canon(parse(serialize(doc, { conservative: false })).content) === canon(doc.content);
		});
	});

	it('le JSON du parseur est valide pour le schéma de l\'éditeur (node.check)', () => {
		verifier((s) => {
			schema.nodeFromJSON(parse(s)).check();
			return true;
		});
	});
});
