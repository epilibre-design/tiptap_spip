// Catalogue des modèles (spec 05 §3, question Q3) sur un site SPIP JETABLE qui a le plugin Insérer
// modèles (et Saisies, Verifier, YAML) dans plugins/ : formulaire YAML en modalbox pour insérer et
// modifier un modèle, saisie brute pour ce qu'il ne couvre pas. Sautés sans le plugin (SPIP 5).
import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { DEFAUTS } from '../../src/ui/labels.js';
import { activer, configure, creerDocument, crlf, ecrireTexte, editer, enregistrer, selectionStable, texte } from './site.js';

configure(test);
const plugin = existsSync(`${process.env.TTS_SITE}/plugins/inserer_modeles`);
test.skip(!plugin, 'plugin inserer_modeles absent du site');
test.beforeAll(() => activer('saisies', 'verifier', 'yaml', 'inserer_modeles'));

const boite = (page) => page.locator('.lity-content .formulaire_inserer_modeles');

/** Article dont le texte cite un document lié, posé après sa création (son id est dans le raccourci). */
const articleAvecDocument = async (page, texteDe) => {
	let doc;
	const id = await editer(page, '', {
		avant: (idArticle) => {
			doc = creerDocument(idArticle);
			ecrireTexte(idArticle, texteDe(doc));
		},
	});
	return { id, doc };
};

test('insertion par le catalogue : liste, formulaire du modèle, raccourci posé en bloc et enregistré', async ({ page }) => {
	const { id, doc } = await articleAvecDocument(page, () => 'Texte');
	await page.locator('.ProseMirror p').first().click();
	await page.keyboard.press('End');
	await selectionStable(page);
	await page.keyboard.press('Enter');

	await page.locator('.tts-toolbar .tts-outil--modele').click();
	await page.getByRole('menuitem', { name: DEFAUTS.modele_catalogue }).click();
	await boite(page).locator('input[name=formulaire_modele][value=media]').check();
	await boite(page).locator('button[name=choisir]').click();
	await boite(page).locator('input[name=id_modele]').fill(String(doc));
	await boite(page).locator('select[name=align]').selectOption('right');
	await boite(page).locator('button[name=inserer]').click();

	await expect(page.locator('.lity')).toHaveCount(0);
	await expect(page.locator('.tts-model-block img')).toBeVisible();
	await enregistrer(page);
	expect(texte(id)).toBe(crlf(`Texte\n\n<doc${doc}|right>`));
});

test('Modifier : formulaire prérempli avec le modèle, modèle remplacé', async ({ page }) => {
	const { id, doc } = await articleAvecDocument(page, (d) => `Avant\n\n<doc${d}|left|largeur=200>`);
	// « Modifier » apparaît au survol du modèle
	await page.locator('.tts-model-block').hover();
	await page.locator('.tts-model-block .tts-model__modifier').click();
	await expect(boite(page).locator('input[name=id_modele]')).toHaveValue(String(doc));
	await expect(boite(page).locator('select[name=align]')).toHaveValue('left');
	await expect(boite(page).locator('input[name=largeur]')).toHaveValue('200');
	await boite(page).locator('select[name=align]').selectOption('center');
	await boite(page).locator('button[name=inserer]').click();

	await expect(page.locator('.lity')).toHaveCount(0);
	await enregistrer(page);
	expect(texte(id)).toBe(crlf(`Avant\n\n<doc${doc}|center|largeur=200>`));
});

test('Modifier : paramètre sans champ dans le formulaire, saisie brute (rien n\'est perdu)', async ({ page }) => {
	await articleAvecDocument(page, (d) => `<doc${d}|left|inconnu=1>`);
	await page.locator('.tts-model-block').hover();
	await page.locator('.tts-model-block .tts-model__modifier').click();
	await expect(page.locator('.tts-popover input[name=raccourci]')).toHaveValue(/\|inconnu=1>$/);
	await expect(page.locator('.lity')).toHaveCount(0);
});

test('plein écran : barre au-dessus du bandeau de SPIP, modalbox du catalogue au-dessus de l\'éditeur', async ({ page }) => {
	await articleAvecDocument(page, () => 'Texte');
	await page.locator('.ProseMirror p').first().click();
	await page.keyboard.press('F11');
	await expect(page.locator('.tts-editor')).toHaveClass(/tts-editor--plein-ecran/);
	await page.locator('.tts-toolbar .tts-outil--modele').click();
	await page.getByRole('menuitem', { name: DEFAUTS.modele_catalogue }).click();
	const choix = boite(page).locator('input[name=formulaire_modele][value=media]');
	await expect(choix).toBeVisible();
	// le choix est cliquable : rien de l'éditeur plein écran ne le recouvre
	await choix.click({ trial: true });
});
