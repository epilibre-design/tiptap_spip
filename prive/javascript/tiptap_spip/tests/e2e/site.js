// Outils des tests de bout en bout : pilote du site SPIP JETABLE (tests/e2e/site.php) et page
// d'édition d'un article.
import { expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const repo = fileURLToPath(new URL('../../../../../', import.meta.url));
const driver = `${repo}tests/e2e/site.php`;
const env = { ...process.env, SPIP_ROOT: process.env.TTS_SITE };
// binaire PHP du site (php8.3 pour SPIP 4.2, par exemple)
const binaire = process.env.TTS_PHP || 'php';

export const php = (args, input) => execFileSync(binaire, [driver, ...args], { env, input, encoding: 'utf8' });
export const texte = (id) => php(['texte', String(id)]);
export const ecrireTexte = (id, source, champ = 'texte') => php(['modifier', String(id), champ], source);
export const creerDocument = (id) => Number(php(['document', String(id)]));
export const creerAuteur = (statut) => Number(php(['auteur', statut]));
export const inserer = (table, champs) => Number(php(['inserer', table, JSON.stringify(champs)]));
export const activer = (...prefixes) => php(['activer', ...prefixes]);
export const publier = (id) => php(['publier', String(id)]);
export const configurer = (cle, valeur) => php(['config', cle, valeur]);
export const effacerConfig = (cle) => php(['effacer_config', cle]);

/** Fins de ligne telles que le navigateur les soumet. */
export const crlf = (s) => s.replace(/\r?\n/g, '\r\n');

export const configure = (test) => test.skip(!process.env.TTS_SITE || !process.env.TTS_URL, 'TTS_SITE et TTS_URL requis');

/**
 * Crée un article, ouvre une session et charge sa page d'édition.
 * @param {{ sansEditeur?: boolean, source?: boolean, avant?: (id: number) => void, titre?: string, auteur?: number }} options
 *        sansEditeur : bundle bloqué, textarea natif ; source : éditeur attendu en mode source ; avant : préparation après la création de
 *        l'article (document lié…) ; titre : titre de l'article (défaut « Test tiptap_spip ») ;
 *        auteur : auteur de l'article et de la session (1, l'administrateur, par défaut)
 */
export async function editer(page, source, { sansEditeur = false, source: modeSource = false, avant, titre = 'Test tiptap_spip', auteur = 1 } = {}) {
	const { id_article: id, cookie } = JSON.parse(php(['preparer', 'tts-e2e', titre, String(auteur)], source));
	avant?.(id);
	const url = new URL(process.env.TTS_URL);
	await page.context().addCookies([{ name: 'spip_session', value: cookie, domain: url.hostname, path: '/' }]);
	if (sansEditeur) await page.route(/tiptap_spip(\.min)?\.js/, (route) => route.abort());
	await page.goto(`/ecrire/?exec=article_edit&id_article=${id}`);
	if (!sansEditeur) await expect(page.locator(modeSource ? '.tts-editor textarea' : '.tts-editor .ProseMirror')).toBeVisible();
	return id;
}

export const enregistrer = async (page) => {
	await Promise.all([
		page.waitForURL(/exec=article&/),
		page.locator('.formulaire_editer_article .boutons [type=submit]').first().click(),
	]);
};

/**
 * Attend que ProseMirror ait pris en compte la sélection du navigateur (événement selectionchange,
 * asynchrone) : Playwright enchaîne les touches plus vite qu'un humain.
 */
export const selectionStable = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))));

/** Le module de l'éditeur chargé par la page (même URL, donc même instance de module). */
export const module = (page) => page.evaluate(async () => {
	const source = [...document.scripts].map((s) => s.textContent).join('\n');
	window.__tts = await import(source.match(/from '([^']*tiptap_spip(?:\.min)?\.js[^']*)'/)[1]);
});
