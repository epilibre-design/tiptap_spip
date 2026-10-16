// Langue de l'interface (spec 11) sur un site SPIP JETABLE : les libellés de l'éditeur suivent la
// langue de l'auteur dans l'espace privé, pas celle du navigateur ni du texte. Usage et serveur :
// cf. article.e2e.js.
import { expect, test } from '@playwright/test';
import { editer, inserer } from './site.js';

test.skip(!process.env.TTS_SITE || !process.env.TTS_URL, 'TTS_SITE et TTS_URL requis');

/** Administrateur dont la langue d'interface est `lang`. */
const administrateur = (lang) => {
	const login = `tts${Math.random().toString(16).slice(2, 10)}`;
	return inserer('spip_auteurs', { nom: login, login, statut: '0minirezo', email: `${login}@exemple.test`, lang });
};

test('auteur anglais : barre d\'outils, barre d\'état et popover en anglais, navigateur en français', async ({ page }) => {
	await editer(page, 'Un texte en français <multi>[fr]un [en]one</multi>.', { auteur: administrateur('en') });
	await expect(page.locator('.tts-toolbar').first()).toHaveAttribute('aria-label', 'Toolbar');
	await expect(page.getByRole('button', { name: 'Bold', exact: true })).toBeVisible();
	await expect(page.locator('.tts-etat__mots')).toHaveText(/^\d+ words$/);
	await page.locator('.ProseMirror p').first().click();
	await page.keyboard.press('ControlOrMeta+k');
	await expect(page.locator('.tts-popover').getByText('Target (art12, rub3, https://…)')).toBeVisible();
});

test('auteur français : mêmes éléments en français', async ({ page }) => {
	await editer(page, 'Un texte <multi>[fr]un [en]one</multi>.', { auteur: administrateur('fr') });
	await expect(page.locator('.tts-toolbar').first()).toHaveAttribute('aria-label', 'Barre d’outils');
	await expect(page.getByRole('button', { name: 'Gras', exact: true })).toBeVisible();
	await expect(page.locator('.tts-etat__mots')).toHaveText(/^\d+ mots$/);
});
