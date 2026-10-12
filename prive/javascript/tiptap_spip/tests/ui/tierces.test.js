// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { coreExtensions } from '../../src/editor/extensions.js';
import { reglesSpip } from '../../src/editor/regles.js';
import { Popover } from '../../src/ui/popover.js';
import { Emoji, Faq, Sc, TIERCES } from '../fixtures/tierces.js';
import { champ, demonter, editor, monter, notePos, source, valider, wrapper } from './outils.js';

afterEach(() => {
	demonter();
	vi.restoreAllMocks();
});

describe('reglesSpip', () => {
	it('lit spipTokenizer, parseSpip et renderSpip ; type selon nœud bloc, nœud en ligne, mark', () => {
		const regles = reglesSpip([...coreExtensions(), ...TIERCES]);
		expect(regles.map((r) => [r.name, r.type, r.niveau])).toEqual([['faqItem', 'block', 'block'], ['sc', 'mark', 'inline'], ['emoji', 'inline', 'inline']]);
	});

	it('extension étendue (extend) : champs hérités du parent', () => {
		const Question = Faq.extend({ name: 'question' });
		expect(reglesSpip([Question])[0]).toMatchObject({ name: 'question', type: 'block', niveau: 'block' });
	});
});

describe('éditeur avec extensions tierces', () => {
	const texte = 'Intro avec <sc>petites</sc> et :smile:\n\n<faq|q=Pourquoi ?>\nParce que.\n</faq>\n\nFin';

	it('lu, affiché, restitué à l\'identique ; une modification est écrite par renderSpip', () => {
		monter(texte, null, { tierces: TIERCES });
		expect(wrapper.querySelector('.tts-faq').textContent).toBe('Parce que.');
		expect(wrapper.querySelector('span.sc').textContent).toBe('petites');
		expect(wrapper.querySelector('[data-emoji=smile]')).not.toBeNull();
		expect(source()).toBe(texte);
		let pos = null;
		editor.state.doc.descendants((n, p) => {
			if (n.type.name === 'faqItem') pos = p;
		});
		editor.commands.command(({ tr }) => {
			tr.setNodeAttribute(pos, 'question', 'Comment ?');
			return true;
		});
		expect(source()).toBe(texte.replace('Pourquoi ?', 'Comment ?'));
	});

	it('sans les extensions : mêmes raccourcis gardés bruts ou en texte, source identique', () => {
		monter(texte);
		expect(wrapper.querySelector('.tts-faq')).toBeNull();
		expect(source()).toBe(texte);
	});

	it('extension du cœur surchargée par son nom, avec un avertissement', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const Cadre = Faq.extend({ name: 'spipCadre' });
		const extensions = coreExtensions({ tierces: [Cadre] });
		expect(extensions.filter((e) => e.name === 'spipCadre')).toEqual([Cadre]);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('spipCadre'));
	});

	it('note : le sous-éditeur connaît les extensions tierces de l\'éditeur', () => {
		const { ui } = monter('Texte[[Un :smile: <sc>b</sc>]]', null, { tierces: [Emoji, Sc] });
		ui.editNote(notePos());
		const { sous } = Popover.current;
		expect(sous.state.doc.textContent).toContain('b');
		expect(sous.tiptapSpip.regles.map((r) => r.name)).toEqual(['emoji', 'sc']);
		let emoji = false;
		sous.state.doc.descendants((n) => {
			if (n.type.name === 'emoji') emoji = true;
		});
		expect(emoji).toBe(true);
		valider();
		expect(source()).toBe('Texte[[Un :smile: <sc>b</sc>]]');
	});

	it('popover du nœud brut : la source réparée est relue avec les règles tierces', () => {
		const { ui } = monter('Avant\n<faq|q=Q>\nA\n</faq>', null, { tierces: TIERCES });
		let pos = null;
		editor.state.doc.descendants((n, p) => {
			if (pos === null && n.type.name === 'spipRawInline') pos = p;
		});
		ui.editRaw(pos);
		expect(champ('source').value).toBe('Avant\n<faq|q=Q>\nA\n</faq>');
		champ('source').value = 'Avant\n\n<faq|q=Q>\nA\n</faq>';
		valider();
		expect(editor.state.doc.child(1).type.name).toBe('faqItem');
		expect(source()).toBe('Avant\n\n<faq|q=Q>\nA\n</faq>');
	});
});
