import AxeBuilder from '@axe-core/playwright';
import { demarrerTransportsEmoji } from './emojis-transport.js';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { configure, editer, module, verifierBundleServi, configurer, effacerConfig, lireConfig, activer, repo, enregistrer, texte, publier, crlf } from './site.js';

configure(test);
test.beforeEach(async ({ page }, info) => {
	if (info.title.includes('repli sans champ') || info.title.includes('balise incompatible') || info.title.includes('chargement sans fin')) {
		await page.addInitScript(({ incompatible, suspendu }) => {
			class PickerDejaPresent extends HTMLElement {
				dataSource = ''; locale = ''; i18n = {};
				get database() { return incompatible ? {} : { ready: () => suspendu && !window.__debloquerPicker ? new Promise(() => {}) : Promise.resolve() }; }
				constructor() { super(); this.attachShadow({ mode: 'open' }); }
			}
			customElements.define('emoji-picker', PickerDejaPresent);
		}, { incompatible: info.title.includes('balise incompatible'), suspendu: info.title.includes('chargement sans fin') });
	}
	if (info.title.includes('IndexedDB indisponible')) await page.addInitScript(() => Object.defineProperty(window, 'indexedDB', { value: undefined }));
	const bundle = verifierBundleServi(page);
	await editer(page, 'Un texte à conserver.'); await bundle; await module(page);
});
const panneau = (page) => page.locator('.tts-suggestions-panneau');
const recherche = (page) => panneau(page).locator('emoji-picker input[type="search"]');
const ouvrir = (page, { note = true } = {}) => page.evaluate(({ note }) => {
	const instance = [...window.__tts.instances][0]; instance.togglePleinEcran(true);
	const parent = note ? instance.ui.editNote(null) : null;
	const ui = parent?.sousUi ?? instance.ui;
	const controles = document.createElement('div');
	controles.innerHTML = '<button type="button" id="tts-emoji-before">Avant</button><button type="button" id="tts-emoji-open">Ouvrir</button><button type="button" id="tts-emoji-after">Après</button>';
	(parent?.form ?? instance.wrapper).append(controles);
	const trigger = controles.querySelector('#tts-emoji-open');
	const origin = { trigger, onChoose: (unicode) => { window.__emojiChoix.push(unicode); return true; } };
	window.__emojiChoix = [];
	window.__emojiTest = { instance, parent, ui, origin, controles, p: ui.openEmoji(origin) };
}, { note });
const rouvrir = (page) => page.evaluate(() => {
	const t = window.__emojiTest; t.p = t.ui.openEmoji(t.origin);
});
const parentIntact = async (page) => expect(await page.evaluate(() => {
	const t = window.__emojiTest; return t.instance.pleinEcran() && (!t.parent || t.parent.ouvert);
})).toBe(true);

test('note_plein_ecran_tab_echap : navigation réelle, sorties et aucun submit', async ({ page }) => {
	await ouvrir(page); await expect(recherche(page)).toBeFocused();
	expect(await panneau(page).evaluate((e) => e.parentElement === window.__emojiTest.parent.element && !window.__emojiTest.parent.form.contains(e) && e.matches(':popover-open'))).toBe(true);
	await page.evaluate(() => { window.__submits = 0; document.addEventListener('submit', (e) => { e.preventDefault(); window.__submits++; }, true); });
	await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await page.keyboard.press('Meta+Enter');
	expect(await page.evaluate(() => window.__submits)).toBe(0); await parentIntact(page);
	// Une recherche courte garde le parcours natif tout en évitant de tabuler une catégorie entière.
	await recherche(page).fill('headphones');
	await expect(panneau(page).locator('emoji-picker button[role=option]').first()).toBeVisible();
	// Tab entre dans les commandes du composant, puis atteint la sentinelle avant.
	await page.keyboard.press('Tab'); await expect(panneau(page)).toBeVisible();
	let i = 0;
	while (await panneau(page).count() && i++ < 40) await page.keyboard.press('Tab');
	await expect(panneau(page)).toHaveCount(0); await expect(page.locator('#tts-emoji-after')).toBeFocused();
	await parentIntact(page);
	await rouvrir(page); await expect(recherche(page)).toBeFocused();
	await page.keyboard.press('Shift+Tab'); await expect(page.locator('#tts-emoji-before')).toBeFocused(); await parentIntact(page);
	await rouvrir(page); await expect(recherche(page)).toBeFocused(); await page.keyboard.press('Escape');
	await expect(page.locator('#tts-emoji-open')).toBeFocused(); await parentIntact(page);
});

test('teintes_puis_panneau : le composant consomme le premier Échap', async ({ page }) => {
	await ouvrir(page); await expect(recherche(page)).toBeFocused();
	const teintes = panneau(page).locator('emoji-picker #skintone-button');
	await teintes.click(); await expect(teintes).toHaveAttribute('aria-expanded', 'true');
	await expect(panneau(page).locator('emoji-picker #skintone-list')).toBeFocused();
	await page.keyboard.press('Escape'); await expect(teintes).toHaveAttribute('aria-expanded', 'false');
	await expect(panneau(page)).toBeVisible(); await parentIntact(page);
	await page.keyboard.press('Escape'); await expect(panneau(page)).toHaveCount(0);
	await expect(page.locator('#tts-emoji-open')).toBeFocused(); await parentIntact(page);
});

test('erreur_tab_reessayer_sortie : erreur persistante et nouvel élément', async ({ page }) => {
	await page.route('**/tiptap_spip_emoji/*/en-emojibase.json', async (r) => { await new Promise((resolve) => setTimeout(resolve, 1200)); await r.abort(); });
	await ouvrir(page); const retry = panneau(page).getByRole('button', { name: 'Réessayer', exact: true });
	await expect(panneau(page).getByRole('alert')).toBeVisible(); await expect(panneau(page).locator('emoji-picker')).toHaveCount(0);
	expect(await panneau(page).locator('.tts-suggestions-panneau__corps').evaluate((e) => document.activeElement === e)).toBe(true);
	// Dépasser le délai de message natif : notre erreur ne disparaît pas.
	await page.waitForTimeout(1800); await expect(panneau(page).getByRole('alert')).toBeVisible();
	await page.keyboard.press('Shift+Tab'); await expect(page.locator('#tts-emoji-before')).toBeFocused(); await parentIntact(page);
	await rouvrir(page); await expect(retry).toBeVisible(); await expect(panneau(page).locator('emoji-picker')).toHaveCount(0);
	await expect(panneau(page).locator('.tts-suggestions-panneau__corps')).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(retry).toBeFocused(); await page.keyboard.press('Tab');
	await expect(page.locator('#tts-emoji-after')).toBeFocused(); await parentIntact(page);
	await rouvrir(page); await expect(retry).toBeVisible(); await expect(panneau(page).locator('emoji-picker')).toHaveCount(0);
	await page.unrouteAll({ behavior: 'wait' });
	await panneau(page).getByRole('button', { name: 'Réessayer', exact: true }).click();
	await expect(recherche(page)).toBeFocused(); await expect(panneau(page).getByRole('alert')).toHaveCount(0);
	await page.keyboard.press('Escape'); await parentIntact(page);
});

test('panneau_non_decoupe_par_note : couche supérieure, scroll, nouveau popover', async ({ page }) => {
	await ouvrir(page); await expect(recherche(page)).toBeFocused();
	const resultat = await panneau(page).evaluate((e) => {
		const parent = window.__emojiTest.parent; parent.element.style.height = '180px'; parent.element.style.overflow = 'auto';
		e.getBoundingClientRect(); const r = e.getBoundingClientRect();
		return { auDessus: e.matches(':popover-open'), horsForm: !parent.form.contains(e), plusGrand: r.height > parent.element.getBoundingClientRect().height,
			visible: document.elementFromPoint(r.left + 10, r.top + Math.min(r.height - 10, 220)) === e || e.contains(document.elementFromPoint(r.left + 10, r.top + Math.min(r.height - 10, 220))) };
	});
	expect(resultat).toEqual({ auDessus: true, horsForm: true, plusGrand: true, visible: true });
	await page.evaluate(() => { window.__emojiTest.parent.element.scrollTop = 100; });
	await expect(recherche(page)).toBeFocused();
	await page.evaluate(() => window.__emojiTest.parent.sousUi.openLink());
	await expect(panneau(page)).toHaveCount(0); await expect(page.locator('.tts-popover--lien input').first()).toBeFocused(); await parentIntact(page);
});

test('choix réel, événements tardifs et instance de chaque langue', async ({ page }) => {
	await ouvrir(page, { note: false }); await expect(recherche(page)).toBeFocused();
	await recherche(page).fill('heart');
	const option = panneau(page).locator('emoji-picker button[role="option"]').first(); await expect(option).toBeVisible();
	await option.dblclick(); await expect(panneau(page)).toHaveCount(0); expect(await page.evaluate(() => window.__emojiChoix.length)).toBe(1);
	await page.evaluate(() => { const t=window.__emojiTest; t.instance.editor.commands.setContent('<p>Texte</p>'); t.multi=t.instance.ui.editMulti(null); t.multi.lignes[0].sousUi.openEmoji({}); });
	await expect(recherche(page)).toBeFocused();
	await page.evaluate(() => window.__emojiTest.multi.lignes[1].sousUi.openEmoji({})); await expect(recherche(page)).toBeFocused();
	expect(await page.evaluate(() => window.__emojiTest.multi.ouvert)).toBe(true);
});

test('repli sans champ : balise compatible déjà définie et sortie du panneau', async ({ page }) => {
	await ouvrir(page);
	await expect(panneau(page).getByRole('status')).toHaveCount(0);
	await expect(panneau(page).locator('.tts-suggestions-panneau__corps')).toBeFocused();
	await page.keyboard.press('Escape'); await parentIntact(page);
});

test('balise incompatible : erreur locale, éditeur et note utilisables', async ({ page }) => {
	await ouvrir(page); await expect(panneau(page).getByRole('alert')).toBeVisible();
	await expect(panneau(page).locator('emoji-picker')).toHaveCount(0);
	await page.keyboard.press('Escape'); await parentIntact(page);
	await expect(page.locator('.tts-note__texte .ProseMirror')).toBeVisible();
});

test('catalogue paresseux, URL absolue identique en privé et public, octets originaux', async ({ page }) => {
	const config = await page.evaluate(() => window.spipConfig.tiptap_spip.emojis);
	expect(await page.evaluate(() => performance.getEntriesByType('resource').some((r) => r.name.includes('en-emojibase.json')))).toBe(false);
	const retour = await page.request.get(config.url); expect(retour.status()).toBe(200);
	expect((await retour.body()).equals(readFileSync(`${repo}prive/javascript/tiptap_spip/node_modules/emoji-picker-element-data/en/emojibase/data.json`))).toBe(true);
	const avant = lireConfig('tiptap_spip/public'); activer('tts_test'); configurer('tiptap_spip/public', 'oui');
	const id = new URL(page.url()).searchParams.get('id_article');
	try {
		const bundle = verifierBundleServi(page);
		await page.goto(`/spip.php?page=tts_test&id_article=${id}&var_mode=recalcul`); await bundle;
		await expect(page.locator('.tts-editor .ProseMirror')).toBeVisible();
		expect(await page.evaluate(() => window.spipConfig.tiptap_spip.emojis)).toEqual(config);
	} finally { if (avant) configurer('tiptap_spip/public', avant); else effacerConfig('tiptap_spip/public'); }
});

test.describe('inline emoji', () => {
	const liste = (page) => page.locator('.tts-suggestions');
	const texte = (page) => page.evaluate(() => window.__inlineEmoji.state.doc.textContent);
	test.beforeEach(async ({ page }) => {
		await page.evaluate(() => {
			window.__inlineEmoji = [...window.__tts.instances][0].editor;
			window.__inlineEmoji.commands.clearContent(); window.__inlineEmoji.view.focus();
		});
	});
	test('premier caractère, affinement, retour arrière, espace et résultat vide', async ({ page }) => {
		await page.keyboard.type(':h'); await expect(liste(page).getByRole('option')).toHaveCount(6);
		await expect(liste(page).getByRole('option').first()).toHaveText('😇 :halo:');
		await page.keyboard.type('e'); await expect(liste(page).getByRole('option').first()).not.toHaveText('😇 :halo:');
		await page.keyboard.press('Backspace'); await expect(liste(page).getByRole('option').first()).toHaveText('😇 :halo:');
		await page.keyboard.type(' '); await expect(liste(page)).toHaveCount(0); expect(await texte(page)).toBe(':h ');
		await page.keyboard.type(':='); await expect(liste(page)).toHaveCount(0);
		await page.keyboard.press('Backspace'); await page.keyboard.type('h'); await expect(liste(page).getByRole('option')).toHaveCount(6);
	});
	test('validation Unicode, frappe, annulations et rétablissements indépendants', async ({ page }) => {
		await page.keyboard.type(':smile'); await expect(liste(page).getByRole('option').first()).toHaveText('😄 :smile:');
		await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.keyboard.type('x'); expect(await texte(page)).toBe('😄x');
		await page.keyboard.press('Control+z'); expect(await texte(page)).toBe('😄');
		await page.keyboard.press('Control+z'); expect(await texte(page)).toBe(':smile'); await expect(liste(page).getByRole('option')).toHaveCount(6);
		await page.keyboard.press('Control+Shift+z'); await page.keyboard.press('Control+Shift+z'); expect(await texte(page)).toBe('😄x');
	});
	test('Plus au clavier hors listbox, annulation maintient le rejet', async ({ page }) => {
		await page.keyboard.type(':h'); await expect(liste(page).getByRole('option')).toHaveCount(6);
		expect(await liste(page).getByRole('button', { name: 'Plus…' }).evaluate((e) => !e.closest('[role=listbox]'))).toBe(true);
		await page.keyboard.press('ArrowUp'); await expect(liste(page).getByRole('option').last()).toHaveAttribute('aria-selected', 'true');
		await page.keyboard.press('ArrowDown');
		expect(await page.evaluate(() => window.__inlineEmoji.view.dom.hasAttribute('aria-activedescendant'))).toBe(false);
		await page.keyboard.press('Enter'); await expect(recherche(page)).toBeFocused(); expect(await texte(page)).toBe(':h');
		await page.keyboard.press('Escape'); await page.keyboard.type('e'); await expect(liste(page)).toHaveCount(0); expect(await texte(page)).toBe(':he');
		await page.keyboard.type(' :h'); await expect(liste(page).getByRole('option')).toHaveCount(6);
	});
	test('Plus puis choix réel remplace la requête, sans espace ajouté', async ({ page }) => {
		await page.keyboard.type(':h'); await liste(page).getByRole('button', { name: 'Plus…' }).click();
		await expect(recherche(page)).toBeFocused(); await recherche(page).fill('heart');
		const choix = panneau(page).locator('emoji-picker button[role=option]').first(); await expect(choix).toBeVisible();
		const unicode = await choix.textContent(); await choix.click(); await expect(panneau(page)).toHaveCount(0);
		expect(await texte(page)).toBe(unicode.trim());
		await page.keyboard.press('Control+z'); expect(await texte(page)).toBe(':h');
	});
	test('note en plein écran : inline et Plus gardent le parent ouvert', async ({ page }) => {
		await page.evaluate(() => {
			const instance = [...window.__tts.instances][0]; instance.togglePleinEcran(true);
			window.__noteEmoji = instance.ui.editNote(null); window.__inlineEmoji = window.__noteEmoji.sous;
		});
		await page.keyboard.type(':h'); await expect(liste(page).getByRole('option')).toHaveCount(6);
		await liste(page).getByRole('button', { name: 'Plus…' }).click(); await expect(recherche(page)).toBeFocused();
		await page.keyboard.press('Escape'); await page.keyboard.type('e'); await expect(liste(page)).toHaveCount(0);
		expect(await texte(page)).toBe(':he');
		expect(await page.evaluate(() => window.__noteEmoji.ouvert && [...window.__tts.instances][0].pleinEcran())).toBe(true);
	});
	test('premier caractère en chargement, réponse mutualisée pour la requête courante', async ({ page }) => {
		let liberer; const attente = new Promise((r) => { liberer = r; });
		await page.route('**/tiptap_spip_emoji/*/en-emojibase.json', async (route) => { await attente; await route.continue(); });
		await page.keyboard.type(':h'); await expect(liste(page).getByRole('status')).toHaveText('Chargement des emojis…');
		await page.keyboard.type('e'); liberer();
		await expect(liste(page).getByRole('option')).toHaveCount(6); await expect(liste(page).getByRole('option').first()).not.toHaveText('😇 :halo:');
		expect(await page.evaluate(() => performance.getEntriesByType('resource').filter((r) => r.name.includes('en-emojibase.json')).length)).toBe(1);
	});
});

test('bouton de barre : sélection remplacée, SVG décoratif, historique et curseur', async ({ page }) => {
	await page.evaluate(() => [...window.__tts.instances][0].editor.commands.setTextSelection({ from: 1, to: 3 }));
	const bouton = page.locator('.tts-toolbar .tts-outil--emoji');
	await expect(bouton.locator('svg.svg-add-emoji')).toHaveAttribute('aria-hidden', 'true');
	await bouton.click(); await expect(recherche(page)).toBeFocused(); await recherche(page).fill('heart');
	await panneau(page).getByRole('option', { name: /^❤️, red heart,/ }).click(); await expect(panneau(page)).toHaveCount(0);
	await page.keyboard.type('x');
	expect(await page.evaluate(() => [...window.__tts.instances][0].editor.state.doc.textContent)).toBe('❤️x texte à conserver.');
	await page.keyboard.press('Control+z'); expect(await page.evaluate(() => [...window.__tts.instances][0].editor.state.doc.textContent)).toBe('❤️ texte à conserver.');
	await page.keyboard.press('Control+z'); expect(await page.evaluate(() => [...window.__tts.instances][0].editor.state.doc.textContent)).toBe('Un texte à conserver.');
});

test('petit bouton de note : sélection locale, parent et plein écran conservés', async ({ page }) => {
	await page.evaluate(() => {
		const i = [...window.__tts.instances][0]; i.togglePleinEcran(true); window.__noteBouton = i.ui.editNote(null);
		window.__noteBouton.sous.commands.insertContent('note'); window.__noteBouton.sous.commands.setTextSelection({ from: 1, to: 5 });
	});
	await page.locator('.tts-note__bloc .tts-outil--emoji').click(); await expect(recherche(page)).toBeFocused();
	await recherche(page).fill('heart'); await panneau(page).getByRole('option', { name: /^❤️, red heart,/ }).click();
	await expect(panneau(page)).toHaveCount(0);
	expect(await page.evaluate(() => window.__noteBouton.sous.state.doc.textContent)).toBe('❤️');
	expect(await page.evaluate(() => window.__noteBouton.ouvert && [...window.__tts.instances][0].pleinEcran())).toBe(true);
	expect(await page.evaluate(() => [...window.__tts.instances][0].editor.state.doc.textContent)).toBe('Un texte à conserver.');
});

test('petit bouton par langue de multi : insertion indépendante', async ({ page }) => {
	await page.evaluate(() => {
		window.__multiBouton = [...window.__tts.instances][0].ui.editMulti(null);
		for (const [i, l] of window.__multiBouton.lignes.entries()) l.sous.commands.insertContent(i ? 'en' : 'fr');
	});
	for (const i of [0, 1]) {
		await page.locator('.tts-multi__partie').nth(i).getByRole('button', { name: 'Emoji', exact: true }).click();
		await expect(recherche(page)).toBeFocused(); await recherche(page).fill('heart');
		await panneau(page).getByRole('option', { name: /^❤️, red heart,/ }).click(); await expect(panneau(page)).toHaveCount(0);
	}
	expect(await page.evaluate(() => window.__multiBouton.lignes.map((l) => l.sous.state.doc.textContent))).toEqual(['fr❤️', 'en❤️']);
	expect(await page.evaluate(() => window.__multiBouton.ouvert)).toBe(true);
});

test('source, lecture seule et atome sélectionné : bouton désactivé, aucun remplacement', async ({ page }) => {
	const bouton = page.locator('.tts-toolbar .tts-outil--emoji');
	await page.evaluate(() => [...window.__tts.instances][0].toggleMode()); await expect(bouton).toBeDisabled();
	await page.evaluate(() => [...window.__tts.instances][0].toggleMode());
	await page.evaluate(() => [...window.__tts.instances][0].editor.setEditable(false)); await expect(bouton).toBeDisabled();
	await page.evaluate(() => {
		const e = [...window.__tts.instances][0].editor; e.setEditable(true);
		e.commands.insertContentAt(1, { type: 'spipNote', attrs: { name: null, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'note' }] }] } });
		e.commands.setNodeSelection(1);
	});
	await expect(bouton).toBeDisabled();
	expect(await page.evaluate(() => [...window.__tts.instances][0].ui.openEmoji({}) === null)).toBe(true);
	await expect(page.locator('.tts-note')).toHaveCount(1); await expect(panneau(page)).toHaveCount(0);
});

test('chargement sans fin : délai de dix secondes et nouvel essai récupérable', async ({ page }) => {
	await page.clock.install(); await page.locator('.tts-toolbar .tts-outil--emoji').click();
	await expect(panneau(page).getByRole('status')).toHaveText('Chargement des emojis…');
	await page.clock.fastForward(10_000); const retry = panneau(page).getByRole('button', { name: 'Réessayer' });
	await expect(retry).toBeVisible(); await page.evaluate(() => { window.__debloquerPicker = true; }); await retry.click();
	await expect(panneau(page).getByRole('alert')).toHaveCount(0); await expect(panneau(page).getByRole('status')).toHaveCount(0);
	await page.keyboard.press('Escape'); await expect(panneau(page)).toHaveCount(0);
});

test('langue SPIP conservée quand html lang est différent', async ({ page }) => {
	expect(await page.evaluate(() => window.spipConfig.tiptap_spip.lang)).toBe('fr');
	await page.evaluate(() => { document.documentElement.lang = 'en'; });
	await page.locator('.tts-toolbar .tts-outil--emoji').click(); await expect(panneau(page).getByRole('combobox', { name: 'Rechercher', exact: true })).toBeFocused();
});

test('IndexedDB indisponible : inline utilisable et erreur limitée au picker', async ({ page }) => {
	await page.evaluate(() => { const e = [...window.__tts.instances][0].editor; e.commands.clearContent(); e.view.focus(); });
	await page.keyboard.type(':heart'); await expect(page.locator('.tts-suggestions').getByRole('option').first()).toHaveText('❤️ :heart:');
	await page.locator('.tts-suggestions').getByRole('button', { name: 'Plus…' }).click();
	await expect(panneau(page).getByRole('button', { name: 'Réessayer' })).toBeVisible();
	await page.keyboard.press('Escape'); await page.keyboard.type(' :heart');
	await expect(page.locator('.tts-suggestions').getByRole('option').first()).toHaveText('❤️ :heart:');
});

test('configuration absente puis JSON indisponible : inline silencieux puis erreur distincte', async ({ page }) => {
	const configuration = await page.evaluate(() => {
		const c = window.spipConfig.tiptap_spip; const emojis = c.emojis; c.emojis = null;
		const e = [...window.__tts.instances][0].editor; e.commands.clearContent(); e.view.focus(); return emojis;
	});
	await page.keyboard.type(':h'); await expect(page.locator('.tts-suggestions')).toHaveCount(0);
	expect(await page.evaluate(() => [...window.__tts.instances][0].editor.state.doc.textContent)).toBe(':h');
	await page.evaluate((emojis) => { window.spipConfig.tiptap_spip.emojis = emojis; }, configuration);
	await page.route('**/tiptap_spip_emoji/*/en-emojibase.json', (route) => route.fulfill({ status: 503, body: 'Indisponible' }));
	await page.evaluate(() => { const e = [...window.__tts.instances][0].editor; e.commands.clearContent(); e.view.focus(); });
	await page.keyboard.type(':h'); await expect(page.locator('.tts-suggestions').getByRole('status')).toHaveText('Impossible de charger les emojis.');
	await page.keyboard.type(' '); await expect(page.locator('.tts-suggestions')).toHaveCount(0);
	expect(await page.evaluate(() => [...window.__tts.instances][0].editor.state.doc.textContent)).toBe(':h ');
	await page.locator('.tts-toolbar .tts-outil--emoji').click(); await expect(panneau(page).getByRole('button', { name: 'Réessayer' })).toBeVisible();
});

test('cache déjà initialisé hors ligne : picker et inline restent utilisables', async ({ page }) => {
	await page.evaluate(() => { const e = [...window.__tts.instances][0].editor; e.commands.clearContent(); e.view.focus(); });
	await page.keyboard.type(':h'); await expect(page.locator('.tts-suggestions').getByRole('option')).toHaveCount(6); await page.keyboard.press('Escape');
	const bouton = page.locator('.tts-toolbar .tts-outil--emoji'); await bouton.click(); await expect(recherche(page)).toBeFocused();
	await expect(panneau(page).getByRole('menuitem').first()).toBeVisible(); await page.keyboard.press('Escape');
	try {
		await page.context().setOffline(true); await bouton.click(); await expect(recherche(page)).toBeFocused();
		await expect(panneau(page).getByRole('menuitem').first()).toBeVisible(); await page.keyboard.press('Escape');
		await page.evaluate(() => [...window.__tts.instances][0].editor.view.focus()); await page.keyboard.type(' :heart');
		await expect(page.locator('.tts-suggestions').getByRole('option').first()).toHaveText('❤️ :heart:');
	} finally { await page.context().setOffline(false); }
});

test('versions de catalogue isolées : préférences conservées par version, anciennes bases gardées', async ({ page }) => {
	const bouton = page.locator('.tts-toolbar .tts-outil--emoji');
	const original = readFileSync(`${repo}prive/javascript/tiptap_spip_emoji/1.8.0/en-emojibase.json`);
	await page.route('**/tts-catalogue-v*.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { etag: '"fixture"' }, body: original }));
	const configurerVersion = (version) => page.evaluate((version) => {
		const c = window.spipConfig.tiptap_spip.emojis; c.locale = `en-tiptap-spip-fixture-${version}`; c.url = new URL(`/tts-catalogue-${version}.json`, location.href).href;
	}, version);
	await configurerVersion('v1'); await bouton.click(); await expect(recherche(page)).toBeFocused();
	await page.evaluate(async () => document.querySelector('emoji-picker').database.setPreferredSkinTone(4)); await page.keyboard.press('Escape');
	await bouton.click(); await expect(recherche(page)).toBeFocused();
	expect(await page.evaluate(() => document.querySelector('emoji-picker').database.getPreferredSkinTone())).toBe(4); await page.keyboard.press('Escape');
	await configurerVersion('v2'); await bouton.click(); await expect(recherche(page)).toBeFocused();
	expect(await page.evaluate(() => document.querySelector('emoji-picker').database.getPreferredSkinTone())).toBe(0);
	const bases = await page.evaluate(async () => (await indexedDB.databases()).map((b) => b.name));
	expect(bases).toContain('emoji-picker-element-en-tiptap-spip-fixture-v1'); expect(bases).toContain('emoji-picker-element-en-tiptap-spip-fixture-v2');
});

test('conservation Unicode : enregistrement, rechargement et rendu public Unicode', async ({ page }) => {
	const initial = '😄 👍🏽 👩‍💻 🇫🇷 ❤️ et [a 😄 b] ; [?a 😄 b] ; [ABBR 😄|explication].\n\nTexte[[ Une note ❤️. ]] <multi>[fr]cœur ❤️[en]heart ❤️</multi>.';
	const bundle = verifierBundleServi(page); const id = await editer(page, initial); await bundle; const recu = texte(id);
	await enregistrer(page); expect(texte(id)).toBe(crlf(recu));
	const servi = verifierBundleServi(page); await page.goto(`/ecrire/?exec=article_edit&id_article=${id}`); await servi;
	await enregistrer(page); expect(texte(id)).toBe(crlf(recu));
	publier(id); await page.goto(`/spip.php?page=article&id_article=${id}&var_mode=calcul`);
	for (const unicode of ['😄', '👍🏽', '👩‍💻', '🇫🇷', '❤️']) expect(await page.locator('body').innerText()).toContain(unicode);
});

test('picker réel accessible dans une note : aucune violation axe nouvelle', async ({ page }) => {
	await ouvrir(page); await expect(recherche(page)).toBeFocused(); await expect(panneau(page).getByRole('menuitem').first()).toBeVisible();
	const rapport = await new AxeBuilder({ page }).include('.tts-suggestions-panneau').analyze();
	expect(rapport.violations).toEqual([]);
});

test.describe('transports réels', () => {
	let transports;
	test.beforeAll(async () => { transports = await demarrerTransportsEmoji({ site: process.env.TTS_SITE, base: process.env.TTS_URL, php: process.env.TTS_PHP || 'php' }); });
	test.afterAll(async () => { await transports?.close(); });
	const cloner = async (page, browser, base, proxy) => {
		const contexte = await browser.newContext({ ignoreHTTPSErrors: true, userAgent: 'tts-e2e', locale: 'fr-FR', ...(proxy ? { proxy: { server: proxy } } : {}) });
		try {
			await contexte.addCookies((await page.context().cookies()).map((c) => ({ ...c, domain: new URL(base).hostname })));
			const autre = await contexte.newPage(); const servi = verifierBundleServi(autre); const url = new URL(page.url());
			await autre.goto(new URL(url.pathname + url.search, base).href); await servi; await module(autre);
			return { page: autre, fermer: () => contexte.close() };
		} catch (e) { await contexte.close(); throw e; }
	};
	for (const etag of [false, true]) test(`HTTP non sécurisé ${etag ? 'avec' : 'sans'} ETag, crypto.subtle réellement absent`, async ({ page, browser }) => {
		const alias = `http://tts-emojis.test:${new URL(process.env.TTS_URL).port || 80}`;
		const autre = await cloner(page, browser, alias, transports.proxy); const p = autre.page;
		try {
			expect(await p.evaluate(() => ({ secure: isSecureContext, subtle: typeof crypto.subtle }))).toEqual({ secure: false, subtle: 'undefined' });
			await p.route('**/tiptap_spip_emoji/*/en-emojibase.json', (r) => r.fulfill({ status: 200, contentType: 'application/json',
				headers: etag ? { etag: '"fixture"' } : {}, body: readFileSync(`${repo}prive/javascript/tiptap_spip_emoji/1.8.0/en-emojibase.json`) }));
			await p.locator('.tts-toolbar .tts-outil--emoji').click();
			if (etag) await expect(recherche(p)).toBeFocused();
			else { await expect(panneau(p).getByRole('button', { name: 'Réessayer' })).toBeVisible(); await expect(panneau(p).locator('emoji-picker')).toHaveCount(0); }
		} finally { await autre.fermer(); }
	});
	test('HTTPS réel sans ETag : crypto.subtle disponible et picker prêt', async ({ page, browser }) => {
		const autre = await cloner(page, browser, transports.https); const p = autre.page;
		try {
			expect(await p.evaluate(() => ({ secure: isSecureContext, digest: typeof crypto.subtle?.digest }))).toEqual({ secure: true, digest: 'function' });
			await p.route('**/tiptap_spip_emoji/*/en-emojibase.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: readFileSync(`${repo}prive/javascript/tiptap_spip_emoji/1.8.0/en-emojibase.json`) }));
			await p.locator('.tts-toolbar .tts-outil--emoji').click(); await expect(recherche(p)).toBeFocused();
		} finally { await autre.fermer(); }
	});
});
