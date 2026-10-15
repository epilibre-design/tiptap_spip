// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatusBar } from '../../src/ui/StatusBar.js';
import { editor, monter } from './outils.js';

let etat;
afterEach(() => {
	etat?.destroy();
	editor?.destroy();
});

describe('StatusBar : message', () => {
	it('affiche un message, annoncé, puis l\'efface', () => {
		monter('Un texte');
		etat = new StatusBar({ editor, editRaw: () => {} });
		etat.signaler('Type de fichier non accepté : a.pdf.');
		const message = etat.element.querySelector('.tts-etat__message');
		expect(message.textContent).toBe('Type de fichier non accepté : a.pdf.');
		expect(message.getAttribute('role')).toBe('status');
		etat.effacer();
		expect(message.textContent).toBe('');
		expect(message.hidden).toBe(true);
	});

	it('action : bouton qui exécute et efface', () => {
		monter('Un texte');
		etat = new StatusBar({ editor, editRaw: () => {} });
		const faire = vi.fn();
		etat.signaler('Une image est en cours d’envoi.', { libelle: 'Enregistrer sans attendre', faire });
		const bouton = etat.element.querySelector('.tts-etat__message button');
		expect(bouton.textContent).toBe('Enregistrer sans attendre');
		bouton.click();
		expect(faire).toHaveBeenCalledTimes(1);
	});

	it('mode source : barre masquée sauf s\'il y a un message, mots et anomalies masqués', () => {
		monter('Un texte');
		etat = new StatusBar({ editor, editRaw: () => {} });
		etat.setMode(true);
		expect(etat.element.hidden).toBe(true);
		etat.signaler('Échec');
		expect(etat.element.hidden).toBe(false);
		expect(etat.mots.hidden).toBe(true);
		etat.effacer();
		expect(etat.element.hidden).toBe(true);
		etat.setMode(false);
		expect(etat.element.hidden).toBe(false);
		expect(etat.mots.hidden).toBe(false);
	});
});
