import { getSchema } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { coreExtensions } from '../../src/editor/extensions.js';
import { filtrerSuggestions } from '../../src/suggestions/filtre.js';
import { trouverSuggestion } from '../../src/suggestions/match.js';

const schema = getSchema(coreExtensions());
const texte = (text, marks) => ({ type: 'text', text, marks });
const position = (content, offset) => {
	const doc = schema.nodeFromJSON({ type: 'doc', content: [{ type: 'paragraph', content }] });
	return doc.resolve(offset ?? doc.content.size - 1);
};
const chercher = (content, options = {}, offset) => trouverSuggestion({
	char: ':', $position: position(content, offset), ...options,
});

describe('filtre de suggestions', () => {
	it('exact_avant_prefixe_avant_inclusion, ordre stable et aucune mutation', () => {
		const items = Object.freeze([
			{ id: 'inclusion', title: 'un chat' },
			{ id: 'prefixe', title: 'Chaton' },
			{ id: 'exact', title: 'CHAT' },
			{ id: 'motcle', title: 'Animal', keywords: ['chat'] },
			{ id: 'sous', title: 'Autre', subtext: 'Chatte' },
		]);
		expect(filtrerSuggestions(items, 'chat').map((i) => i.id))
			.toEqual(['exact', 'motcle', 'prefixe', 'sous', 'inclusion']);
		expect(filtrerSuggestions(items, '')).toEqual(items);
		expect(filtrerSuggestions(items, '')).not.toBe(items);
		expect(items[0].id).toBe('inclusion');
	});
	it('aucun_synonyme_francais ou équivalence implicite de ligature/accent', () => {
		const items = [{ id: 'heart', title: 'heart' }, { id: 'fr', title: 'cœur ému' }];
		for (const q of ['coeur', 'emu']) expect(filtrerSuggestions(items, q)).toEqual([]);
		expect(filtrerSuggestions(items, 'cœur')).toEqual([items[1]]);
	});
});

describe('déclencheur dans le bloc réel', () => {
	it.each([':h', ' :h'])('vrai début et espace : %s', (t) => {
		expect(chercher([texte(t)])).toEqual({ range: { from: t.indexOf(':') + 1, to: t.length + 1 }, query: 'h', text: ':h' });
	});
	it('frontiere_mark_sans_espace : aucun faux début de bloc', () => {
		expect(chercher([texte('mot', [{ type: 'bold' }]), texte(':h')])).toBeNull();
		expect(chercher([texte('mot ', [{ type: 'bold' }]), texte(':h')])?.query).toBe('h');
		expect(chercher([texte(':h', [{ type: 'bold' }]), texte('e')])?.query).toBe('he');
	});
	it('atome_non_autorise, même lorsque son texte est vide', () => {
		const atome = { type: 'spipRawInline', attrs: { source: '<x>' } };
		expect(chercher([atome, texte(':h')])).toBeNull();
		expect(chercher([atome, texte(' :h')])?.range).toEqual({ from: 3, to: 5 });
	});
	it('hardBreak_autorise explicitement et positions conservées', () => {
		const content = [texte('mot'), { type: 'hardBreak' }, texte(':h')];
		expect(chercher(content)).toBeNull();
		expect(chercher(content, { allowedPrefixes: [' ', '\n'] })?.range).toEqual({ from: 5, to: 7 });
	});
	it.each(['\u00a0:h', '\u202f:h', 'mot:h', 'https://', '12:30', ':h ', ':h\tx'])('préfixe ou requête non autorisé : %s', (t) => {
		expect(chercher([texte(t)])).toBeNull();
	});
	it('seuil, début de bloc et requête vide', () => {
		expect(chercher([texte(':')])?.query).toBe('');
		expect(chercher([texte(':')], { minQueryLength: 1 })).toBeNull();
		expect(chercher([texte(' :h')], { startOfLine: true })).toBeNull();
		expect(chercher([texte(':h')], { startOfLine: true })?.query).toBe('h');
	});
	it.each(['g', 'y'])('motif_%s_deterministe et vérification de la requête entière', (flag) => {
		const pattern = new RegExp('[a-z]+', flag);
		pattern.lastIndex = 1;
		for (let i = 0; i < 3; i++) {
			expect(chercher([texte(':he')], { queryPattern: pattern })?.query).toBe('he');
			expect(chercher([texte(':he!')], { queryPattern: pattern })).toBeNull();
		}
		expect(pattern.lastIndex).toBe(1);
	});
	it('plage arrêtée au curseur, caractères spéciaux et espaces optionnels', () => {
		expect(chercher([texte(':heart')], {}, 4)).toEqual({ range: { from: 1, to: 4 }, query: 'he', text: ':he' });
		expect(chercher([texte('+abc')], { char: '+' })?.query).toBe('abc');
		expect(chercher([texte(':deux mots')], { allowSpaces: true })?.query).toBe('deux mots');
	});
});
