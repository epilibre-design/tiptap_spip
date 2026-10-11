import { describe, expect, it } from 'vitest';
import { node, raw, text } from '../../src/spip/json.js';
import { parse } from '../../src/spip/parse.js';
import { noteSeRelit, seRelitInline } from '../../src/spip/valider.js';

const gloss = (extra = {}) => ({ type: 'spipGlossary', attrs: { glossaire: null, numero: null, bulle: null, hreflang: null, ...extra } });
const abbr = (title, lang = null) => ({ type: 'spipAbbr', attrs: { title, lang } });
const link = (href, extra = {}) => ({ type: 'spipLink', attrs: { href, bulle: null, hreflang: null, newWindow: false, ...extra } });
const p = (...content) => node('paragraph', null, content.length ? content : undefined);

describe('seRelitInline', () => {
	it('raccourcis qui se relisent à l\'identique', () => {
		expect(seRelitInline([text('SPIP', [gloss({ glossaire: 'mots', numero: '12', bulle: 'b', hreflang: 'fr' })])])).toBe(true);
		expect(seRelitInline([text('CMS', [abbr('x', 'en')])])).toBe(true);
		expect(seRelitInline([text('x', [link('art1')])])).toBe(true);
		expect(seRelitInline([text('x', [link('https://spip.net', { bulle: 'b', newWindow: true })])])).toBe(true);
	});

	it('saisies qui ne se relisent pas', () => {
		expect(seRelitInline([text('S{P}', [gloss()])])).toBe(false);
		expect(seRelitInline([text(' SPIP', [gloss()])])).toBe(false);
		expect(seRelitInline([text('SPIP', [gloss({ bulle: 'a]b' })])])).toBe(false);
		expect(seRelitInline([text('SPIP', [gloss({ numero: 'x' })])])).toBe(false);
		expect(seRelitInline([text('x', [link('a]b')])])).toBe(false);
		expect(seRelitInline([text('A', [abbr('')])])).toBe(false);
		expect(seRelitInline([text('A', [abbr('x|y')])])).toBe(false);
	});
});

describe('noteSeRelit', () => {
	const contenu = [p(text('Voir '), text('la doc', [link('art1')]), text('.'))];

	it('automatique, nommée, sans appel, vide', () => {
		expect(noteSeRelit({ name: null, content: contenu })).toBe(true);
		expect(noteSeRelit({ name: 'A', content: contenu })).toBe(true);
		expect(noteSeRelit({ name: '', content: contenu })).toBe(true);
		expect(noteSeRelit({ name: null, content: [p()] })).toBe(true);
		expect(noteSeRelit({ name: null, content: parse('-* a\n-* b\n\n<doc1>').content })).toBe(true);
	});

	it('nom ou contenu qui changent à la relecture', () => {
		// un texte </i> est échappé ; un fragment brut ne l'est pas
		expect(noteSeRelit({ name: 'i', content: [p(text('a</i> b'))] })).toBe(true);
		expect(noteSeRelit({ name: 'i', content: [p(text('a'), raw('</i>'))] })).toBe(false);
		expect(noteSeRelit({ name: 'a>b', content: contenu })).toBe(false);
		expect(noteSeRelit({ name: null, content: [node('heading', { level: 2 }, [text('t')])] })).toBe(false);
	});
});
