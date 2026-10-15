// Barre d'outils toujours visible dans le formulaire d'édition de l'espace privé, sur un site SPIP
// JETABLE : .cadre-formulaire-editer .formulaire_spip est en overflow: hidden, ce qui fait du formulaire
// le conteneur de défilement de la barre collante (sticky) : elle partait avec la page.
// Usage et serveur : cf. article.e2e.js.
import { expect, test } from '@playwright/test';
import { configure, editer } from './site.js';

configure(test);

const LONG = Array.from({ length: 80 }, (_, k) => `Paragraphe ${k + 1} d'un texte assez long pour faire défiler la page.`).join('\n\n');

test('page défilée : la barre reste affichée en haut de la fenêtre', async ({ page }) => {
	await page.setViewportSize({ width: 1200, height: 700 });
	await editer(page, LONG);
	// défilement depuis l'éditeur : les champs affichés au-dessus (surtitre, chapeau…) varient selon le site
	await page.evaluate(() => window.scrollTo(0, document.querySelector('.tts-editor').getBoundingClientRect().top + window.scrollY + 900));
	const barre = page.locator('.tts-editor .tts-toolbar');
	const etat = await barre.evaluate((b) => {
		const r = b.getBoundingClientRect();
		return { haut: Math.round(r.top), affichee: b.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)) };
	});
	expect(etat).toEqual({ haut: 0, affichee: true });
});

test('mise en page du formulaire inchangée par la règle : mêmes positions et hauteur qu\'avec overflow: hidden', async ({ page }) => {
	await page.setViewportSize({ width: 1200, height: 700 });
	await editer(page, 'Texte');
	// clip ne contient pas les flottants ni n'empêche le débordement des marges, contrairement à hidden
	const mesures = await page.locator('.cadre-formulaire-editer .formulaire_spip').first().evaluate((formulaire) => {
		const mesurer = () => [...formulaire.parentElement.children, formulaire, ...formulaire.children].map((el) => {
			const r = el.getBoundingClientRect();
			return [Math.round(r.top), Math.round(r.height)];
		});
		const avec = mesurer();
		formulaire.style.overflow = 'hidden';
		const sans = mesurer();
		formulaire.style.overflow = '';
		return { avec, sans };
	});
	expect(mesures.avec).toEqual(mesures.sans);
});
