// Page de configuration configurer_tiptap_spip (lot L5.3, spec 02 « Configuration (CFG) ») sur un site
// SPIP JETABLE : réglages enregistrés dans la méta tiptap_spip, puis appliqués au formulaire
// d'édition d'un article. Usage et serveur : cf. article.e2e.js.
import { expect, test } from '@playwright/test';
import { activer, configure, ecrireTexte, editer, effacerConfig, inserer } from './site.js';

configure(test);
// tts_test définit le glossaire nommé glossaire_tts()
test.beforeAll(() => activer('tts_test'));
// les autres fichiers de tests partent de la configuration par défaut
test.afterAll(() => effacerConfig('tiptap_spip'));

test('formulaire de rubrique : descriptif et texte équipés, sans les classes du porte-plume (#7)', async ({ page }) => {
	await editer(page, 'x', { champs: 'defaut' });
	const id = inserer('spip_rubriques', { titre: 'Rubrique tts', descriptif: 'Descriptif', texte: 'Texte', statut: 'prepa' });
	await page.goto(`/ecrire/?exec=rubrique_edit&id_rubrique=${id}`);
	for (const champ of ['descriptif', 'texte']) {
		await expect(page.locator(`textarea[name=${champ}]`)).toHaveAttribute('data-tts-mounted');
	}
	await expect(page.locator('.formulaire_editer_rubrique .tts-editor')).toHaveCount(2);
	// barre du porte-plume (ou de Porte Plume Partout) jamais posée sur un champ équipé
	await expect(page.locator('.formulaire_editer_rubrique .markItUpEditor')).toHaveCount(0);
});

test('réglages enregistrés : champ décoché laissé au porte-plume, mode source, niveaux du menu Titre', async ({ page }) => {
	await editer(page, 'x', { champs: 'defaut' });
	// entrée du menu Configuration
	await expect(page.locator('a[href*="exec=configurer_tiptap_spip"]').first()).toHaveText(/Éditeur visuel/);
	await page.goto('/ecrire/?exec=configurer_tiptap_spip');
	const form = page.locator('.formulaire_configurer_tiptap_spip');
	await expect(form.getByRole('group', { name: 'Articles' }).getByLabel('Chapeau')).toBeChecked();
	await expect(form.getByLabel('tts', { exact: true })).toBeChecked();
	await form.getByRole('group', { name: 'Articles' }).getByLabel('Chapeau').uncheck();
	await form.getByLabel('Source (raccourcis SPIP)').check();
	await form.getByLabel('Titre de niveau 3').uncheck();
	await form.getByLabel('Titre de niveau 5').check();
	await form.locator('[type=submit]').click();
	await expect(form.locator('.reponse_formulaire_ok')).toBeVisible();
	await expect(form.getByRole('group', { name: 'Articles' }).getByLabel('Chapeau')).not.toBeChecked();

	await editer(page, 'Texte', { source: true, champs: 'garder', avant: (id) => ecrireTexte(id, 'Chapeau', 'chapo') });
	// texte équipé, ouvert en mode source ; chapeau laissé au porte-plume (les autres champs affichés
	// par le site, descriptif ou post-scriptum, restent équipés)
	const texte = page.locator('.editer_texte');
	await expect(texte.locator('.tts-editor')).toHaveCount(1);
	await expect(page.locator('textarea[name=chapo]')).not.toHaveAttribute('data-tts-mounted');
	await texte.locator('.tts-outil[aria-label=Source]').click();
	await texte.locator('.tts-outil[aria-label=Titre]').click();
	await expect(page.locator('.tts-menu--titre [role=menuitemradio]')).toHaveText(['Paragraphe', 'Intertitre', 'Titre de niveau 4', 'Titre de niveau 5']);

	// formulaire invalide : aucun niveau
	await page.goto('/ecrire/?exec=configurer_tiptap_spip');
	for (const niveau of ['Intertitre', 'Titre de niveau 4', 'Titre de niveau 5']) await form.getByLabel(niveau).uncheck();
	await form.locator('[type=submit]').click();
	await expect(form.locator('.editer_niveaux .erreur_message')).toHaveText('Choisissez au moins un niveau.');
});
