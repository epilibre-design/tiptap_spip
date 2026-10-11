import { describe, expect, it } from 'vitest';
import { node, text } from '../../src/spip/json.js';
import { parseLinkAtts } from '../../src/spip/links.js';
import { parseModel, serializeModel } from '../../src/spip/models.js';
import { parse } from '../../src/spip/parse.js';
import { serialize, serializeInline } from '../../src/spip/serialize.js';

const inline = (source) => parse(source).content[0].content;
const canonical = (source) => serialize(parse(source), { conservative: false });
const link = (href, extra = {}) => ({ type: 'spipLink', attrs: { href, bulle: null, hreflang: null, newWindow: false, ...extra } });
const B = { type: 'bold' };

describe('parseLinkAtts (traiter_raccourci_lien_atts du core)', () => {
	it('texte seul, bulle, langue', () => {
		expect(parseLinkAtts('texte')).toEqual({ text: 'texte', bulle: null, hreflang: null });
		expect(parseLinkAtts('texte|bulle')).toEqual({ text: 'texte', bulle: 'bulle', hreflang: null });
		expect(parseLinkAtts('texte|bulle{en}')).toEqual({ text: 'texte', bulle: 'bulle', hreflang: 'en' });
		expect(parseLinkAtts('texte{en}')).toEqual({ text: 'texte', bulle: null, hreflang: 'en' });
	});

	it('une accolade qui n\'est pas une langue connue reste dans le texte ou la bulle', () => {
		expect(parseLinkAtts('a{zz}')).toEqual({ text: 'a{zz}', bulle: null, hreflang: null });
		expect(parseLinkAtts('a|b{zz}')).toEqual({ text: 'a', bulle: 'b{zz}', hreflang: null });
	});

	it('{} (langue de l\'objet, dépend du contexte) : non représentable', () => {
		expect(parseLinkAtts('a{}')).toBeNull();
	});
});

describe('liens', () => {
	it('lien avec texte : mark spipLink sur le contenu analysé', () => {
		expect(inline('Voir [la {{doc}}->art12].')).toEqual([
			text('Voir '),
			text('la ', [link('art12')]),
			text('doc', [link('art12'), B]),
			text('.'),
		]);
	});

	it('bulle, langue, nouvelle fenêtre', () => {
		expect(inline('[a|b{en}->>https://x.org]')).toEqual([text('a', [link('https://x.org', { bulle: 'b', hreflang: 'en', newWindow: true })])]);
	});

	it('lien sans texte : nœud spipLinkAuto', () => {
		expect(inline('[->art12]')).toEqual([node('spipLinkAuto', { href: 'art12', bulle: null, hreflang: null, newWindow: false })]);
		expect(inline('[|bulle->rub3]')).toEqual([node('spipLinkAuto', { href: 'rub3', bulle: 'bulle', hreflang: null, newWindow: false })]);
	});

	it('entités du texte de lien décodées : | ] ->', () => {
		expect(inline('[a&#124;b&#93;c-&gt;d->art1]')).toEqual([text('a|b]c->d', [link('art1')])]);
	});

	it('lien non représentable : conservé brut', () => {
		expect(inline('[a{}->art1]')).toEqual([node('spipRawInline', { source: '[a{}->art1]' })]);
	});

	it('modèle dans un lien', () => {
		const [model] = inline('[<img3|left>->art12]');
		expect(model.type).toBe('spipModel');
		expect(model.marks).toEqual([link('art12')]);
	});

	it('sérialisation : texte de lien échappé, attributs dans l\'ordre du core', () => {
		expect(serializeInline([text('a|b]c->d[e', [link('art1')])])).toBe('[a&#124;b&#93;c-&gt;d&#91;e->art1]');
		expect(serializeInline([text('a', [link('x', { bulle: 'b', hreflang: 'en', newWindow: true })])])).toBe('[a|b{en}->>x]');
		expect(serializeInline([node('spipLinkAuto', { href: 'art1', bulle: 'b', hreflang: null, newWindow: false })])).toBe('[|b->art1]');
	});

	it('deux liens voisins restent deux liens', () => {
		expect(serializeInline([text('a', [link('art1')]), text('b', [link('art2')])])).toBe('[a->art1][b->art2]');
	});

	it('gras autour d\'une partie du lien, lien autour du gras', () => {
		expect(canonical('[voir {{la}} doc->art1]')).toBe('[voir {{la}} doc->art1]');
		expect(canonical('{{voir [la doc->art1] ici}}')).toBe('{{voir [la doc->art1] ici}}');
	});
});

describe('ancres', () => {
	it('[#ancre<-] et [ancre<-] : nœud spipAnchor, écrit [#ancre<-]', () => {
		expect(inline('[#sec<-]Titre')).toEqual([node('spipAnchor', { name: 'sec' }), text('Titre')]);
		expect(canonical('[sec<-]Titre')).toBe('[#sec<-]Titre');
	});
});

describe('modèles', () => {
	it('parseModel : nom, id, paramètres ordonnés', () => {
		expect(parseModel('<doc12|center|largeur=300>')).toEqual({
			name: 'doc', id: '12',
			params: [{ key: null, value: 'center' }, { key: 'largeur', value: '300' }],
			source: '<doc12|center|largeur=300>',
		});
		expect(parseModel('<span>')).toBeNull();
	});

	it('serializeModel : source conservée tant que le modèle n\'a pas changé', () => {
		const m = parseModel('<doc12 | center />');
		expect(serializeModel(m)).toBe('<doc12 | center />');
		expect(serializeModel({ ...m, params: [{ key: null, value: 'left' }] })).toBe('<doc12|left>');
	});

	it('seul dans son paragraphe : spipModelBlock ; dans une phrase : spipModel', () => {
		expect(parse('<doc12|center>').content[0].type).toBe('spipModelBlock');
		expect(inline('Voir <doc12|center> ici')[1].type).toBe('spipModel');
		expect(canonical('Texte\n\n<doc12|center>\n\nSuite <img3> ici')).toBe('Texte\n\n<doc12|center>\n\nSuite <img3> ici');
	});
});
