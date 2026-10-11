// Formulaire de services de l'éditeur (spec 02 §5) sur un site SPIP JETABLE : appels AJAX réels
// depuis la page d'édition d'un article. Usage et serveur : cf. article.e2e.js.
import { expect, test } from '@playwright/test';
import { activer, configure, creerAuteur, creerDocument, editer, inserer, module } from './site.js';

configure(test);
// tts_test définit le glossaire nommé glossaire_tts()
test.beforeAll(() => activer('tts_test'));

/** Appelle une opération des services du premier éditeur de la page. */
const appeler = (page, operation, params) => page.evaluate(async ([operation, params]) => {
	const { services } = [...window.__tts.instances][0];
	try {
		return { resultat: await services.call(operation, params) };
	} catch (e) {
		return { erreur: e.name, erreurs: e.erreurs ?? null, disponible: services.available };
	}
}, [operation, params]);

let id;
let idDocument;

test.beforeEach(async ({ page }) => {
	id = await editer(page, 'Texte de test', { avant: (idArticle) => { idDocument = creerDocument(idArticle); } });
	await module(page);
});

test('l\'éditeur est relié au formulaire de services de son champ', async ({ page }) => {
	const lien = await page.evaluate(() => {
		const { services, textarea } = [...window.__tts.instances][0];
		return { services: services?.container.dataset.ttsInstance, form: textarea.form.dataset.ttsInstance, champ: services?.container.dataset.ttsChamp };
	});
	expect(lien.services).toMatch(/^tts-[0-9a-f]{12}$/);
	expect(lien.services).toBe(lien.form);
	expect(lien.champ).toBe('texte');
});

test('titre_lien : titre des objets visibles, rien pour un objet absent', async ({ page }) => {
	const { resultat } = await appeler(page, 'titre_lien', { cibles: [`art${id}`, 'art999999', 'https://www.spip.net/fr', '#ancre'] });
	expect(resultat[0]).toMatchObject({ cible: `art${id}`, titre: 'Test tiptap_spip', objet: 'article', id });
	expect(resultat[1]).toMatchObject({ titre: null, objet: 'article', id: 999999 });
	expect(resultat[2]).toMatchObject({ url: 'https://www.spip.net/fr' });
	expect(resultat[3]).toMatchObject({ titre: null, url: null });
});

test('previsu_modele : HTML du modèle calculé par SPIP', async ({ page }) => {
	const { resultat } = await appeler(page, 'previsu_modele', { modele: `<doc${idDocument}|left>` });
	expect(resultat).toMatch(/<img[^>]+tts-[0-9a-f]{8}\.png/);
	expect(resultat).not.toMatch(/<script/i);
});

test('rechercher : objets dont le titre correspond, les plus récents d\'abord', async ({ page }) => {
	const titre = `Recherche ${Date.now()}`;
	const autre = await editer(page, 'x', { titre });
	await module(page);
	const { resultat } = await appeler(page, 'rechercher', { q: titre.slice(3), objets: ['article', 'rubrique'] });
	expect(resultat).toEqual([{ objet: 'article', id: autre, titre, raccourci: `article${autre}` }]);
	const tous = (await appeler(page, 'rechercher', { q: 'Test tiptap', objets: ['article'] })).resultat;
	expect(tous[0].id).toBe(id);
	expect(tous.length).toBeLessThanOrEqual(20);
});

test('rechercher : autorisation appliquée avant de retenir 20 résultats, ordre commun entre types', async ({ page }) => {
	const mot = `Visibilite${Date.now()}`;
	const article = (titre, statut, maj) => inserer('spip_articles', { titre, statut, maj, date: maj, id_rubrique: 1, id_secteur: 1, lang: 'fr' });
	// 45 articles en préparation d'un autre auteur, les plus récents : invisibles pour un rédacteur
	for (let i = 0; i < 45; i++) article(`${mot} caché ${i}`, 'prepa', '2026-01-02 00:00:00');
	const visible = article(`${mot} publié`, 'publie', '2020-01-01 00:00:00');
	const rubrique = inserer('spip_rubriques', { titre: `${mot} rubrique`, statut: 'publie', id_parent: 0, id_secteur: 0, maj: '2025-01-01 00:00:00' });

	await editer(page, 'x', { auteur: creerAuteur('1comite') });
	await module(page);
	const { resultat } = await appeler(page, 'rechercher', { q: mot, objets: ['article', 'rubrique'] });
	expect(resultat.map((r) => [r.objet, r.id])).toEqual([['rubrique', rubrique], ['article', visible]]);
});

test('glossaire : URL de la définition calculée par SPIP, glossaires nommés disponibles', async ({ page }) => {
	const { resultat } = await appeler(page, 'glossaire', { raccourci: '[?Système de publication]' });
	expect(resultat).toEqual({ url: 'https://fr.wikipedia.org/wiki/Syst%C3%A8me_de_publication', glossaires: ['tts'] });
	expect((await appeler(page, 'glossaire', { raccourci: '[?SPIP#tts12|bulle]' })).resultat.url).toBe('https://glossaire.test/SPIP/12');
	expect((await appeler(page, 'glossaire', {})).resultat).toEqual({ url: null, glossaires: ['tts'] });
	expect((await appeler(page, 'glossaire', { raccourci: '[?SPIP#inconnu]' })).erreurs.raccourci).toBe('Ce glossaire n’existe pas sur le site.');
	const r = await appeler(page, 'glossaire', { raccourci: '[?a] [?b]' });
	expect(r).toMatchObject({ erreur: 'ServiceError', disponible: true });
	expect(r.erreurs.raccourci).toBe('Raccourci de glossaire invalide.');
});

test('idiomes : traductions de SPIP dans la langue de l\'objet, null pour une chaîne absente', async ({ page }) => {
	const { resultat } = await appeler(page, 'idiomes', { cles: ['tiptap_spip:lien', 'info_titre', 'inconnu:absente'] });
	expect(resultat).toEqual([
		{ cle: 'tiptap_spip:lien', texte: 'Lien' },
		// traduction telle que dans le fichier de langue (espace insécable avant le deux-points)
		{ cle: 'info_titre', texte: 'Titre\u00a0:' },
		{ cle: 'inconnu:absente', texte: null },
	]);
	expect((await appeler(page, 'idiomes', { cles: ['<:x:>'] })).erreurs.cles).toBe('Liste d’idiomes invalide.');
});

test('verifier() refuse une demande invalide, le service reste disponible', async ({ page }) => {
	const r = await appeler(page, 'previsu_modele', { modele: '<doc1> <doc2>' });
	expect(r).toMatchObject({ erreur: 'ServiceError', disponible: true });
	expect(r.erreurs.modele).toBe('Raccourci de modèle invalide.');
	expect((await appeler(page, 'operation_inconnue', {})).erreur).toBe('ServiceError');
	expect((await appeler(page, 'titre_lien', { cibles: [`art${id}`] })).resultat).toHaveLength(1);
});

for (const champ of ['formulaire_action_args', 'formulaire_action_sign']) {
	test(`${champ} falsifié : SPIP ne traite pas la demande, mode dégradé`, async ({ page }) => {
		await page.evaluate((champ) => {
			const input = document.querySelector(`.tts-services [name=${champ}]`);
			input.value = `${input.value.slice(0, -4)}${input.value.endsWith('AAAA') ? 'BBBB' : 'AAAA'}`;
		}, champ);
		expect(await appeler(page, 'titre_lien', { cibles: [`art${id}`] })).toMatchObject({ erreur: 'ServiceUnavailable', disponible: false });
	});
}
