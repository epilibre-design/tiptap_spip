// Interface des liens et modèles (lot L2.3), des notes, du glossaire et des abréviations (lot L3.2,
// critère d'acceptation 4) sur un site SPIP JETABLE : prévisualisation, titres des liens sans texte,
// popovers, insertion, modification, suppression, enregistrement.
// Usage et serveur : cf. article.e2e.js.
import { expect, test } from '@playwright/test';
import { activer, configure, creerDocument, crlf, ecrireTexte, editer, enregistrer, selectionStable, texte } from './site.js';

configure(test);
// tts_test définit le glossaire nommé glossaire_tts()
test.beforeAll(() => activer('tts_test'));

test('un modèle de document est prévisualisé, un lien sans texte affiche le titre de sa cible', async ({ page }) => {
	let doc;
	const titre = `Cible ${Date.now()}`;
	const cible = await editer(page, 'x', { titre });
	const id = await editer(page, '', {
		avant: (idArticle) => {
			doc = creerDocument(idArticle);
			const source = `Voir [->art${cible}].\n\n<doc${doc}|left>`;
			// texte posé après la création du document (son id est dans le raccourci)
			ecrireTexte(idArticle, source);
		},
	});
	await expect(page.locator('.tts-model-block img')).toBeVisible();
	await expect(page.locator('.tts-link-auto')).toHaveText(titre);
	await enregistrer(page);
	expect(texte(id)).toBe(crlf(`Voir [->art${cible}].\n\n<doc${doc}|left>`));
});

test('Ctrl+K : recherche d\'un article, lien posé sur la sélection et enregistré', async ({ page }) => {
	const titre = `Destination ${Date.now()}`;
	const cible = await editer(page, 'x', { titre });
	const id = await editer(page, 'Lire la suite');
	const paragraphe = page.locator('.ProseMirror p').first();
	await paragraphe.click();
	await page.keyboard.press('End');
	await selectionStable(page);
	// Ctrl+K juste après Maj+flèches, sans attendre : le popover doit lire la sélection réelle
	for (let i = 0; i < 'la suite'.length; i++) await page.keyboard.press('Shift+ArrowLeft');
	await page.keyboard.press('ControlOrMeta+k');
	const champ = page.locator('.tts-popover input[name=cible]');
	await expect(champ).toBeFocused();
	await champ.fill(titre.slice(0, 15));
	await page.locator('.tts-popover__suggestions li', { hasText: titre }).click();
	await expect(champ).toHaveValue(`article${cible}`);
	await page.locator('.tts-popover button[name=appliquer]').click();
	await expect(page.locator('.ProseMirror a.tts-link')).toHaveText('la suite');
	await enregistrer(page);
	expect(texte(id)).toBe(`Lire [la suite->article${cible}]`);
});

test('bouton Modèle : raccourci inséré en bloc, prévisualisé, enregistré', async ({ page }) => {
	let doc;
	const id = await editer(page, 'Texte', { avant: (idArticle) => { doc = creerDocument(idArticle); } });
	const paragraphe = page.locator('.ProseMirror p').first();
	await paragraphe.click();
	await page.keyboard.press('End');
	await selectionStable(page);
	await page.keyboard.press('Enter');
	await page.locator('.tts-toolbar .tts-modele').click();
	await page.locator('.tts-popover input[name=raccourci]').fill(`<doc${doc}|center>`);
	await page.keyboard.press('Enter');
	await expect(page.locator('.tts-model-block img')).toBeVisible();
	await enregistrer(page);
	expect(texte(id)).toBe(crlf(`Texte\n\n<doc${doc}|center>`));
});

test('notes : appels numérotés comme SPIP, renumérotés après suppression, enregistrés', async ({ page }) => {
	const id = await editer(page, 'Un[[première]] deux[[<A>nommée]] trois[[seconde]] quatre[[<>cachée]].');
	const appels = page.locator('.ProseMirror .tts-note');
	const affiche = () => appels.evaluateAll((els) => els.map((el) => getComputedStyle(el, '::before').content));
	expect(await affiche()).toEqual(['"[1]"', '"[A]"', '"[2]"', '"•"']);
	// un clic ouvre le popover de la note ; Échap le ferme, la note reste sélectionnée
	await appels.first().click();
	await expect(page.locator('.tts-popover--note')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.locator('.tts-popover--note')).toHaveCount(0);
	await page.keyboard.press('Delete');
	await expect(appels).toHaveCount(3);
	expect(await affiche()).toEqual(['"[A]"', '"[1]"', '"•"']);
	await enregistrer(page);
	expect(texte(id)).toBe('Un deux[[<A>nommée]] trois[[seconde]] quatre[[<>cachée]].');
});

/** Curseur en fin du premier paragraphe de l'éditeur. */
const finDuTexte = async (page) => {
	await page.locator('.ProseMirror p').first().click();
	await page.keyboard.press('End');
	await selectionStable(page);
};

test('notes : insérer au clavier, modifier, supprimer depuis l\'interface ; source enregistrée', async ({ page }) => {
	const id = await editer(page, 'Un texte');
	const note = page.locator('.tts-popover--note');
	const sousEditeur = note.locator('.tts-note__texte .ProseMirror');
	await finDuTexte(page);
	// [[ tapé : popover d'une nouvelle note, texte saisi dans le sous-éditeur avec du gras
	await page.keyboard.type(' [[');
	await expect(sousEditeur).toBeFocused();
	await page.keyboard.type('Ma ');
	await page.keyboard.press('ControlOrMeta+b');
	await page.keyboard.type('note');
	await note.locator('button[name=appliquer]').click();
	await expect(note).toHaveCount(0);
	// Ctrl+Alt+N : note nommée
	await page.keyboard.type(' et');
	await page.keyboard.press('ControlOrMeta+Alt+n');
	await expect(sousEditeur).toBeFocused();
	await page.keyboard.type('Nommée');
	await note.locator('input[name=nom]').fill('A');
	await page.keyboard.press('Enter');
	await expect(page.locator('.ProseMirror .tts-note')).toHaveCount(2);
	await expect(page.locator('.tts-notes summary')).toHaveText('Notes (2)');
	// modification depuis le panneau des notes
	await page.locator('.tts-notes summary').click();
	await page.locator('.tts-notes__note').first().click();
	await expect(sousEditeur).toHaveText('Ma note');
	await sousEditeur.click();
	await page.keyboard.press('ControlOrMeta+a');
	await page.keyboard.type('Autre note');
	await note.locator('button[name=appliquer]').click();
	// suppression de la note nommée
	await page.locator('.ProseMirror .tts-note').nth(1).click();
	await note.locator('button[name=retirer]').click();
	await expect(page.locator('.ProseMirror .tts-note')).toHaveCount(1);
	await enregistrer(page);
	expect(texte(id)).toBe('Un texte [[Autre note]] et');
});

test('glossaire et abréviation : posés depuis l\'interface, définition ouverte ; source enregistrée', async ({ page }) => {
	await page.context().route('https://glossaire.test/**', (route) => route.fulfill({ body: 'définition' }));
	const id = await editer(page, 'Le SPIP et le CMS');
	const popover = page.locator('.tts-popover');
	// double-clic sur SPIP, Ctrl+Alt+G : glossaire nommé du site, proposé par la liste
	await page.locator('.ProseMirror p').first().dblclick({ position: { x: 30, y: 5 } });
	await selectionStable(page);
	await page.keyboard.press('ControlOrMeta+Alt+g');
	await expect(popover.locator('datalist option[value=tts]')).toHaveCount(1);
	await popover.locator('input[name=glossaire]').fill('tts');
	await popover.locator('input[name=numero]').fill('12');
	const [definition] = await Promise.all([page.waitForEvent('popup'), popover.locator('button[name=definition]').click()]);
	await expect.poll(() => definition.url()).toBe('https://glossaire.test/SPIP/12');
	await definition.close();
	await popover.locator('button[name=appliquer]').click();
	await expect(page.locator('.ProseMirror .tts-glossary')).toHaveText('SPIP');
	// sélection de CMS, bouton Abréviation
	await finDuTexte(page);
	for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft');
	await selectionStable(page);
	await page.locator('.tts-toolbar .tts-bouton-abbr').click();
	await popover.locator('input[name=explication]').fill('Content Management System');
	await page.keyboard.press('Enter');
	await expect(page.locator('.ProseMirror abbr')).toHaveText('CMS');
	// [?terme] tapé
	await page.keyboard.press('End');
	await page.keyboard.type(' [?Wiki]');
	await expect(page.locator('.ProseMirror .tts-glossary')).toHaveCount(2);
	await enregistrer(page);
	expect(texte(id)).toBe('Le [?SPIP#tts12] et le [CMS|Content Management System] [?Wiki]');
});
