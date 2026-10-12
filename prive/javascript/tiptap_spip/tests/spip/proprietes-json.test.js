// @vitest-environment jsdom
// Sûreté du schéma (spec 04 §5, invariant 5) : un document JSON tiré selon le schéma de l'éditeur se
// sérialise, et sa forme canonique relue redonne le même JSON. npm test : graine fixe ; TTS_FC_RUNS :
// passe longue, graine aléatoire (TTS_FC_SEED la rejoue).
import { getSchema } from '@tiptap/core';
import fc from 'fast-check';
import { describe, it } from 'vitest';
import { coreExtensions } from '../../src/editor/extensions.js';
import { canon, parse, serialize } from '../../src/spip/index.js';
import { mergeText, node, sameMark, sortMarks } from '../../src/spip/json.js';
import { parseModel } from '../../src/spip/models.js';
import { canBacktick } from '../../src/spip/protect.js';

const runs = Number(process.env.TTS_FC_RUNS) || 200;
const seed = process.env.TTS_FC_SEED ? Number(process.env.TTS_FC_SEED) : process.env.TTS_FC_RUNS ? undefined : 20261012;
const schema = getSchema(coreExtensions());

/** Morceaux de texte : lettres, blancs, et tout ce que le sérialiseur doit échapper. */
const MORCEAUX = [
	'a', 'mot', 'É', ' ', ' ', '0', '{', '}', '[', ']', '|', '<', '>', '&', '~', '`', '\\', '#', '-', '_', '*', '?',
	':', '!', '"', "'", '=', '/', '->', '<-', '[[', ']]', '&lt;', '&eacute;', '<b>', '<doc1>', 'https://x.org', '----',
];
const texte = fc.array(fc.constantFrom(...MORCEAUX), { minLength: 1, maxLength: 6 }).map((m) => m.join(''));
/**
 * Terme de glossaire ou d'abréviation, comme le valide le popover : la regex du core y interdit
 * [ ] < > (spec 03 §3), y veut un caractère de mot ASCII (\w sans /u : [?É] n'est pas un terme) et
 * en retire les blancs de bord.
 */
const terme = fc.array(fc.constantFrom('a', 'SPIP', 'É', ' ', '0', '-'), { minLength: 1, maxLength: 4 }).map((m) => m.join(''))
	.filter((t) => /\w/.test(t) && t.trim() === t);
const option = (arb) => fc.option(arb, { nil: null });
const langue = option(fc.constantFrom('fr', 'en'));
const bulle = option(fc.constantFrom('bulle', 'une bulle'));

const lien = fc.record({
	href: fc.constantFrom('art12', 'rub3', 'https://x.org', '#ancre', 'mailto:a@b.c', 'doc1'),
	bulle, hreflang: langue, newWindow: fc.boolean(),
});
const MARKS_SIMPLES = ['bold', 'italic', 'strike', 'superscript', 'subscript', 'code'];

/** Marks d'un texte, exclusions du schéma respectées (spipLink, spipGlossary, spipAbbr, code). */
const marks = fc.tuple(
	fc.subarray(MARKS_SIMPLES),
	fc.oneof(
		fc.constant(null),
		lien.map((attrs) => ({ type: 'spipLink', attrs })),
		fc.record({ glossaire: option(fc.constant('wikipedia')), numero: option(fc.constant('2')), bulle, hreflang: langue })
			.map((attrs) => ({ type: 'spipGlossary', attrs })),
		fc.record({ title: fc.constantFrom('explication', 'une explication'), lang: langue }).map((attrs) => ({ type: 'spipAbbr', attrs })),
	),
).map(([simples, special]) => {
	const avecCode = simples.includes('code') && ['spipGlossary', 'spipAbbr'].includes(special?.type) ? simples.filter((m) => m !== 'code') : simples;
	return sortMarks([...avecCode.map((type) => ({ type })), ...(special ? [special] : [])]);
});

// texte d'un lien non vide une fois rogné (spec 03 §3 : sinon c'est un lien sans texte)
const texteMarque = marks.chain((m) => (m.some((x) => ['spipGlossary', 'spipAbbr'].includes(x.type)) ? terme
	: m.some((x) => x.type === 'spipLink') ? texte.filter((t) => t.trim() !== '') : texte)
	.map((t) => (m.length ? { type: 'text', text: t, marks: m } : { type: 'text', text: t })));

const MODELES = ['<doc12>', '<doc12|left>', '<img3|center|largeur=300>', '<emb4|autostart=true>', '<doc1|legende=<i>x</i>>'];

/** Nœuds en ligne atomiques, sans note (la note a son propre contenu). */
const atome = fc.oneof(
	fc.constantFrom('manual', 'autobr').map((syntax) => ({ type: 'hardBreak', attrs: { syntax } })),
	fc.constantFrom(...MODELES).map((source) => ({ type: 'spipModel', attrs: { model: parseModel(source) } })),
	lien.map((attrs) => ({ type: 'spipLinkAuto', attrs })),
	fc.constantFrom('ancre', 'a1').map((name) => ({ type: 'spipAnchor', attrs: { name } })),
	fc.record({ module: option(fc.constant('public')), cle: fc.constantFrom('cle', 'info_x') }).map((attrs) => ({ type: 'spipIdiome', attrs })),
);

/**
 * Forme normale du contenu en ligne :
 * - aucune autre mark à l'intérieur d'un glossaire ou d'une abréviation (spec 03 §3) : des textes
 *   voisins sous la même de ces marks ne gardent que leurs marks communes, puis fusionnent ;
 * - pas de saut de ligne au bord (SPIP ne l'affiche pas en tête, affiche _ en fin : non écrit) ;
 * - un saut autobr suivi d'un autre saut est forcé (\n\n ferait une ligne vide) ;
 * - pas de blanc en tête de ligne après un saut (SPIP le retire, le navigateur ne l'affiche pas) ;
 * - un contenu fait seulement d'espaces est vide (le parseur et SPIP n'en gardent rien : [[ ]] est une
 *   note vide) ; l'espace insécable (~) compte.
 */
function formeNormale(nodes) {
	const une = formeNormaleUneFois(nodes);
	// retirer un blanc peut vider un texte et rapprocher deux sauts : jusqu'au point fixe
	return JSON.stringify(une) === JSON.stringify(nodes) ? une : formeNormale(une);
}

function formeNormaleUneFois(nodes) {
	if (nodes.every((n) => n.type === 'text' && /^[ \t]*$/.test(n.text))) return [];
	const out = [...nodes];
	while (out[0]?.type === 'hardBreak') out.shift();
	while (out.at(-1)?.type === 'hardBreak') out.pop();
	for (let k = 0; k + 1 < out.length; k++) {
		if (out[k].type === 'hardBreak' && out[k + 1].type === 'hardBreak') out[k] = { type: 'hardBreak', attrs: { syntax: 'manual' } };
		if (out[k].type === 'hardBreak' && out[k + 1].type === 'text') out[k + 1] = { ...out[k + 1], text: out[k + 1].text.replace(/^\s+/, '') };
	}
	for (let i = 0; i < out.length;) {
		const terme = out[i].marks?.find((m) => ['spipGlossary', 'spipAbbr'].includes(m.type));
		let j = i + 1;
		while (terme && j < out.length && out[j].type === 'text' && out[j].marks?.some((m) => sameMark(m, terme))) j++;
		if (j - i > 1) {
			const communes = out[i].marks.filter((m) => out.slice(i, j).every((n) => n.marks.some((x) => sameMark(x, m))));
			for (let k = i; k < j; k++) out[k] = { ...out[k], marks: communes };
		}
		i = j;
	}
	return mergeText(out);
}

/** Contenu en ligne d'un intertitre : toutes les marks sauf le gras (spec 03 §3). */
const sansGras = (nodes) => mergeText(nodes.map((n) => {
	if (!n.marks?.some((m) => m.type === 'bold')) return n;
	const marks = n.marks.filter((m) => m.type !== 'bold');
	const { marks: _, ...reste } = n;
	return marks.length ? { ...reste, marks } : reste;
}));

const enLigne = (avecNote) => fc.array(
	avecNote ? fc.oneof({ weight: 6, arbitrary: texteMarque }, { weight: 2, arbitrary: atome }, { weight: 1, arbitrary: note }) : fc.oneof({ weight: 3, arbitrary: texteMarque }, { weight: 1, arbitrary: atome }),
	{ minLength: 1, maxLength: 6 },
).map(formeNormale).filter((nodes) => nodes.length > 0);

/**
 * Paragraphe, jamais vide (SPIP n'a que des lignes vides) ; un modèle seul (sans mark) y est un
 * modèle de bloc (spec 03 §3), forme que l'éditeur insère dans un paragraphe vide.
 */
const paragraphe = (avecNote = true) => enLigne(avecNote).map((content) => (content.length === 1 && content[0].type === 'spipModel' && !content[0].marks
	? node('spipModelBlock', { model: content[0].attrs.model })
	: node('paragraph', null, content)));

/** Marks écrites en balise HTML (pas de raccourci SPIP). */
const EN_HTML = ['strike', 'superscript', 'subscript'];

/**
 * Note. Limite (spec 04 §5) : une note automatique qui commence par un idiome (<:cle:>, traité après
 * les notes) ou par une mark écrite en balise HTML (<sup>…, si la balise revient plus loin sur la ligne)
 * se lit nommée (règle du core) ; exclue. Barré, exposant et indice s'écrivent toujours en balise ; gras
 * et italique seulement contre un fragment brut à accolade, que ce générateur ne produit pas (un
 * italique en tête de note autour d'un lien s'écrit {…}).
 */
const note = fc.record({
	name: fc.constantFrom(null, 'n', ''),
	content: fc.array(paragraphe(false), { minLength: 1, maxLength: 2 }),
}).filter(({ name, content }) => {
	const premier = content[0].content?.[0];
	return name !== null || !(premier?.type === 'spipIdiome' || (premier?.marks ?? []).some((m) => EN_HTML.includes(m.type)));
})
	.map((attrs) => ({ type: 'spipNote', attrs }));

/** Texte de code : tout passe, sauts de ligne compris. */
const code = fc.array(fc.constantFrom('a', ' ', '\n', '{', '}', '<', '>', '&', '`', '```', '\\', '</code>', '</cadre>', '[[', 'é'), { maxLength: 8 })
	.map((m) => m.join(''));
const contenuCode = (t) => (t === '' ? undefined : [{ type: 'text', text: t }]);
/** Code écrit <code>…</code> plutôt qu'entre backticks (sérialiseur). */
const parCode = (t) => !canBacktick(t) || t.startsWith('\n') || t.endsWith('`');

const liste = (profondeur) => fc.tuple(
	fc.constantFrom('bulletList', 'orderedList'),
	fc.array(fc.tuple(enLigne(true), profondeur > 1 ? option(liste(profondeur - 1)) : fc.constant(null)), { minLength: 1, maxLength: 3 }),
).map(([type, items]) => node(type, null, items.map(([inline, sous]) => node('listItem', null, sous ? [node('paragraph', null, inline), sous] : [node('paragraph', null, inline)]))));

/** Contenu d'une seule ligne (cellule, intertitre) : un saut de ligne y est forcé (écrit <br />). */
const sautsForces = (nodes) => nodes.map((n) => (n.type === 'hardBreak' ? { type: 'hardBreak', attrs: { syntax: 'manual' } } : n));

/** Rogne les blancs du premier et du dernier texte (SPIP rogne le contenu d'une cellule). */
function rogner(nodes) {
	const out = nodes.map((n, k) => {
		if (n.type !== 'text') return n;
		let t = n.text;
		if (k === 0) t = t.replace(/^\s+/, '');
		if (k === nodes.length - 1) t = t.replace(/\s+$/, '');
		return { ...n, text: t };
	});
	return out.filter((n) => n.type !== 'text' || n.text !== '');
}

/** Cellule ; un en-tête n'a pas de gras (écrit {{…}}) ; contenu rogné, comme SPIP. */
const cellule = (type) => enLigne(false).map((inline) => {
	const contenu = rogner(sautsForces(type === 'tableHeader' ? sansGras(inline) : inline));
	return node(type, { colspan: 1, rowspan: 1 }, [node('paragraph', null, contenu.length ? formeNormale(contenu) : undefined)]);
});

/** Cellule entièrement en gras : en première ligne, c'est la syntaxe d'un en-tête (|{{a}}|). */
const toutEnGras = (c) => {
	const contenu = c.content[0].content ?? [];
	return contenu.length > 0 && contenu.every((n) => n.marks?.some((m) => m.type === 'bold'));
};
const tableau = fc.integer({ min: 1, max: 3 }).chain((colonnes) => fc.record({
	entete: fc.boolean(),
	lignes: fc.array(fc.array(cellule('tableCell'), { minLength: colonnes, maxLength: colonnes }), { minLength: 1, maxLength: 3 }),
	titres: fc.array(cellule('tableHeader'), { minLength: colonnes, maxLength: colonnes }),
	caption: option(fc.constantFrom('Légende', 'L')),
	summary: option(fc.constantFrom('Résumé')),
	// un résumé sans légende s'écrit ||légende vide|résumé|| : légende '' (forme normale)
	// première ligne de cellules toutes en gras : relue en-tête, exclue (forme ambiguë)
})).filter(({ entete, lignes }) => entete || !lignes[0].every(toutEnGras))
	.map(({ entete, lignes, titres, caption, summary }) => node('table', { caption: summary !== null && caption === null ? '' : caption, summary },
	[...(entete ? [titres] : []), ...lignes].map((cells) => node('tableRow', null, cells))));

const multiEnLigne = fc.array(fc.tuple(fc.constantFrom('fr', 'en', 'de'), enLigne(false)), { minLength: 1, maxLength: 3 })
	.map((parts) => ({ type: 'spipMultiInline', attrs: { parts: parts.map(([lang, content]) => ({ lang, content })) } }));

/** Poésie et partie de multi en bloc : paragraphes seulement (paragraph+), pas de modèle de bloc. */
const seulementParagraphe = (arb) => arb.filter((b) => b.type === 'paragraph');

/** Blocs, imbrication bornée par la profondeur (citation, alignement). */
const bloc = (profondeur) => fc.oneof(
	{ weight: 6, arbitrary: paragraphe() },
	{ weight: 2, arbitrary: fc.tuple(fc.integer({ min: 2, max: 6 }), enLigne(true)).map(([level, inline]) => node('heading', { level }, sautsForces(sansGras(inline)))) },
	{ weight: 1, arbitrary: fc.constant(node('horizontalRule')) },
	{ weight: 2, arbitrary: liste(3) },
	// limite (spec 04 §5) : la balise fermante n'a pas d'échappement dans un bloc verbatim ; un code qui
	// ne s'écrit pas entre backticks passe par <code> et perd sa langue
	{ weight: 1, arbitrary: fc.tuple(option(fc.constantFrom('php', 'js')), code.filter((t) => !parCode(t) || !/<\/code/i.test(t)))
		.map(([language, t]) => node('codeBlock', { language: parCode(t) ? null : language }, contenuCode(t))) },
	{ weight: 1, arbitrary: fc.constantFrom(['spipCadre', 'cadre'], ['spipHtml', 'html'], ['spipMath', 'math'])
		.chain(([type, tag]) => code.filter((t) => !t.toLowerCase().includes(`</${tag}`))
			.map((t) => node(type, { openTag: `<${tag}>`, closeTag: `</${tag}>` }, contenuCode(t)))) },
	{ weight: 1, arbitrary: fc.array(seulementParagraphe(paragraphe()), { minLength: 1, maxLength: 2 }).map((content) => node('spipPoesie', { tag: 'poesie' }, content)) },
	{ weight: 1, arbitrary: tableau },
	{ weight: 1, arbitrary: fc.array(fc.tuple(fc.constantFrom('fr', 'en'), fc.array(seulementParagraphe(paragraphe(false)), { minLength: 1, maxLength: 2 })), { minLength: 1, maxLength: 2 })
		.map((parts) => node('spipMultiBlock', null, parts.map(([lang, content]) => node('spipLangBlock', { lang }, content)))) },
	...(profondeur > 0 ? [
		{ weight: 1, arbitrary: fc.array(bloc(profondeur - 1), { minLength: 1, maxLength: 2 }).map((content) => node('blockquote', null, content)) },
		{ weight: 1, arbitrary: fc.tuple(fc.constantFrom('left', 'center', 'right', 'justify'), fc.array(bloc(profondeur - 1), { minLength: 1, maxLength: 2 }))
			.map(([align, content]) => node('spipAlign', { align }, content.filter((b) => b.type !== 'spipAlign'))).filter((b) => b.content.length > 0) },
	] : []),
);

const documents = fc.array(bloc(1), { minLength: 1, maxLength: 4 }).map((content) => node('doc', null, content));

describe('sûreté du schéma (invariant 5)', () => {
	it('un document valide pour le schéma se relit à l\'identique après sérialisation canonique', () => {
		fc.assert(fc.property(documents, (doc) => {
			schema.nodeFromJSON(doc).check();
			const source = serialize(doc, { conservative: false });
			return canon(parse(source).content) === canon(doc.content);
		}), { numRuns: runs, seed });
	}, Math.max(5000, runs * 20));
});
