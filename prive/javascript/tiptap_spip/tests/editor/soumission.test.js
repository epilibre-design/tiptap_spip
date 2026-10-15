// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoumissionRetenue } from '../../src/editor/soumission.js';

let soumission;
afterEach(() => {
	soumission?.destroy();
	delete globalThis.jQuery;
	delete globalThis.cQuery;
	document.body.innerHTML = '';
});

/** Formulaire, état d'envoi pilotable et soumissions réellement parties. */
const preparer = () => {
	document.body.innerHTML = '<form><button type="submit" name="enregistrer" value="1">OK</button><button type="submit" name="autre">Autre</button></form>';
	const form = document.querySelector('form');
	const parties = [];
	// dernier écouteur : enregistre la soumission et empêche la navigation (non implémentée par jsdom)
	form.addEventListener('submit', (e) => {
		if (!e.defaultPrevented) parties.push(e.submitter?.name ?? null);
		e.preventDefault();
	});
	const etat = { envois: 1, messages: [], abandons: 0 };
	soumission = new SoumissionRetenue({
		form,
		enCours: () => etat.envois > 0,
		signaler: (texte, action) => etat.messages.push({ texte, action }),
		effacer: () => etat.messages.push(null),
		abandonner: () => { etat.abandons++; etat.envois = 0; },
	});
	return { form, parties, etat };
};

describe('SoumissionRetenue (spec 10 §3)', () => {
	it('soumission native retenue, message, puis relancée avec le même bouton après le dernier envoi', () => {
		const { form, parties, etat } = preparer();
		form.querySelector('[name=autre]').click();
		expect(parties).toEqual([]);
		expect(etat.messages[0].texte).toBe('Un fichier est en cours d’envoi.');
		expect(etat.messages[0].action.libelle).toBe('Enregistrer sans attendre');
		soumission.verifier();
		expect(parties).toEqual([]);
		etat.envois = 0;
		soumission.verifier();
		expect(parties).toEqual(['autre']);
		expect(etat.messages.at(-1)).toBeNull();
	});

	it('sans envoi en cours : rien n\'est retenu', () => {
		const { form, parties, etat } = preparer();
		etat.envois = 0;
		form.querySelector('[name=enregistrer]').click();
		expect(parties).toEqual(['enregistrer']);
	});

	it('Enregistrer sans attendre : abandon puis soumission', () => {
		const { form, parties, etat } = preparer();
		form.querySelector('[name=enregistrer]').click();
		etat.messages[0].action.faire();
		expect(etat.abandons).toBe(1);
		expect(parties).toEqual(['enregistrer']);
	});

	it('destruction pendant une soumission retenue : aucune relance ensuite', () => {
		const { form, parties, etat } = preparer();
		form.querySelector('[name=enregistrer]').click();
		soumission.destroy();
		etat.envois = 0;
		soumission.verifier();
		soumission.relancer();
		expect(parties).toEqual([]);
	});

	it('relance unique : un verifier() pendant sansAttendre ne soumet pas deux fois', () => {
		const { form, parties, etat } = preparer();
		form.querySelector('[name=enregistrer]').click();
		// comme Envois : abandonner() prévient l'instance, qui appelle verifier()
		soumission.abandonner = () => {
			etat.envois = 0;
			soumission.verifier();
		};
		etat.messages[0].action.faire();
		soumission.verifier();
		expect(parties).toEqual(['enregistrer']);
	});

	it('relance sans bouton mémorisé (ajaxSubmit sans clic, bouton retiré) : requestSubmit() sans argument', () => {
		const ecouteurs = [];
		globalThis.jQuery = () => ({ on: (evt, fn) => ecouteurs.push(fn), off: vi.fn() });
		const { form, parties, etat } = preparer();
		const veto = {};
		ecouteurs[0]({ type: 'form-pre-serialize' }, form, {}, veto);
		expect(veto.veto).toBe(true);
		etat.envois = 0;
		expect(() => soumission.verifier()).not.toThrow();
		expect(parties).toEqual([null]);

		// bouton mémorisé puis retiré du DOM
		etat.envois = 1;
		const autre = form.querySelector('[name=autre]');
		autre.click();
		autre.remove();
		etat.envois = 0;
		expect(() => soumission.verifier()).not.toThrow();
		expect(parties).toEqual([null, null]);
	});

	it('formulaire AJAX (jquery.form) : form.clk rétabli pendant la relance, puis remis à null', () => {
		const ecouteurs = [];
		globalThis.jQuery = () => ({ on: (evt, fn) => ecouteurs.push(fn), off: vi.fn() });
		const { form, etat } = preparer();
		// comme ajaxForm : le clic pose form.clk, effacé ensuite ; ajaxSubmit lit form.clk dans le submit
		const lus = [];
		form.addEventListener('submit', () => lus.push(form.clk?.name ?? null));
		const autre = form.querySelector('[name=autre]');
		form.clk = autre;
		ecouteurs[0]({ type: 'form-pre-serialize' }, form, {}, {});
		form.clk = null;
		etat.envois = 0;
		soumission.verifier();
		expect(lus).toEqual(['autre']);
		expect(form.clk).toBeNull();
	});

	it('form-pre-serialize (jquery.form) : veto sur le 4e paramètre, avec jQuery et cQuery', () => {
		const ecouteurs = { jQuery: [], cQuery: [] };
		const fauxQuery = (nom) => (el) => ({ on: (evt, fn) => ecouteurs[nom].push({ evt, fn, el }), off: vi.fn() });
		globalThis.jQuery = fauxQuery('jQuery');
		globalThis.cQuery = fauxQuery('cQuery');
		const { form } = preparer();
		for (const nom of ['jQuery', 'cQuery']) {
			expect(ecouteurs[nom]).toHaveLength(1);
			expect(ecouteurs[nom][0].evt).toBe('form-pre-serialize.ttsimages');
			const options = {};
			const veto = {};
			ecouteurs[nom][0].fn({ type: 'form-pre-serialize' }, form, options, veto);
			expect(veto.veto).toBe(true);
			expect(options.veto).toBeUndefined();
		}
	});
});
