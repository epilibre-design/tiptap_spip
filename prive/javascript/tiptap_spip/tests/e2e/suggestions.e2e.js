import { expect, test } from '@playwright/test';
import { configure, editer, module, verifierBundleServi } from './site.js';
import AxeBuilder from '@axe-core/playwright';

configure(test);
test.beforeEach(async ({ page }, info) => {
	const inline = info.titlePath.includes('inline');
	const bundle = verifierBundleServi(page);
	await editer(page, inline ? '' : 'Un texte à conserver.', { suggestions: inline });
	await bundle;
	await module(page);
});

test('bundle du checkout servi et module courant accessible', async ({ page }) => {
	expect(await page.evaluate(() => window.__tts.instances.size)).toBe(1);
	expect(await page.evaluate(() => [...window.__tts.instances][0].editor.extensionManager.extensions.some((e) => e.name === 'ttsFormules'))).toBe(false);
	expect(await page.evaluate(() => performance.getEntriesByType('resource').some((r) => r.name.includes('/javascript/suggestions.js')))).toBe(false);
	await expect(page.locator('.tts-content .ProseMirror')).toHaveText('Un texte à conserver.');
});

const ouvrir = (page, { note = false, erreur = false, shadow = false } = {}) => page.evaluate(({ note, erreur, shadow }) => {
	const instance = [...window.__tts.instances][0];
	if (note) instance.togglePleinEcran(true);
	const parent = note ? instance.ui.editNote(null) : null;
	const ui = parent?.sousUi ?? instance.ui;
	const controls = document.createElement('div');
	controls.innerHTML = '<button type="button" id="tts-test-before">Avant</button><button type="button" id="tts-test-open">Ouvrir</button><button type="button" id="tts-test-after">Après</button>';
	(parent?.form ?? instance.wrapper).append(controls);
	const trigger = controls.querySelector('#tts-test-open');
	const content = document.createElement('div');
	const dedans = shadow ? content.attachShadow({ mode: 'open' }) : content;
	dedans.innerHTML = (erreur ? '<p role="alert">Recherche indisponible</p>' : '<input type="search" aria-label="Rechercher suggestions">')
		+ '<button type="button">Réessayer</button>';
	const panneau = ui.openSuggestionsPanel({ anchor: trigger, origin: { trigger }, content, label: 'Suggestions de test' });
	if (shadow) dedans.querySelector('input').focus();
	window.__panneauTest = { instance, parent, panneau, content };
}, { note, erreur, shadow });

test('note_plein_ecran_tab_echap : sortie avant et arrière, parent conservé', async ({ page }) => {
	await ouvrir(page, { note: true });
	await expect(page.getByRole('searchbox', { name: 'Rechercher suggestions' })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(page.getByRole('button', { name: 'Réessayer', exact: true })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(page.locator('#tts-test-after')).toBeFocused();
	await expect(page.getByRole('dialog', { name: 'Suggestions de test' })).toHaveCount(0);
	expect(await page.evaluate(() => window.__panneauTest.parent.ouvert && window.__panneauTest.instance.pleinEcran())).toBe(true);
	await page.evaluate(() => {
		const { parent, content } = window.__panneauTest;
		parent.sousUi.openSuggestionsPanel({ anchor: document.querySelector('#tts-test-open'), origin: { trigger: document.querySelector('#tts-test-open') }, content, label: 'Suggestions de test' });
	});
	await page.keyboard.press('Shift+Tab');
	await expect(page.locator('#tts-test-before')).toBeFocused();
});

test('erreur_tab_reessayer_sortie : cible de repli entre sentinelles', async ({ page }) => {
	await ouvrir(page, { note: true, erreur: true });
	expect(await page.evaluate(() => document.activeElement === window.__panneauTest.panneau.corps)).toBe(true);
	await page.keyboard.press('Tab');
	await expect(page.getByRole('button', { name: 'Réessayer', exact: true })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(page.locator('#tts-test-after')).toBeFocused();
});

test('plein écran sans note : Échap ferme le panneau avant le plein écran', async ({ page }) => {
	await page.evaluate(() => [...window.__tts.instances][0].togglePleinEcran(true));
	await ouvrir(page);
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: 'Suggestions de test' })).toHaveCount(0);
	expect(await page.evaluate(() => window.__panneauTest.instance.pleinEcran())).toBe(true);
	await page.keyboard.press('Escape');
	expect(await page.evaluate(() => window.__panneauTest.instance.pleinEcran())).toBe(false);
});

test('Échap en remontée après consommation interne, puis panneau seul', async ({ page }) => {
	await ouvrir(page, { note: true });
	await page.evaluate(() => window.__panneauTest.content.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
	}, { once: true }));
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: 'Suggestions de test' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.locator('#tts-test-open')).toBeFocused();
	await expect(page.getByRole('dialog', { name: 'Suggestions de test' })).toHaveCount(0);
	expect(await page.evaluate(() => window.__panneauTest.parent.ouvert && window.__panneauTest.instance.pleinEcran())).toBe(true);
});

test('Tab traverse le Shadow DOM natif sans inventaire des contrôles', async ({ page }) => {
	await ouvrir(page, { note: true, shadow: true });
	await page.keyboard.press('Tab');
	await expect(page.getByRole('button', { name: 'Réessayer', exact: true })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(page.locator('#tts-test-after')).toBeFocused();
});

test('Entrée et Ctrl/Cmd+Entrée ne soumettent ni note ni formulaire extérieur', async ({ page }) => {
	await ouvrir(page, { note: true });
	await page.evaluate(() => {
		window.__soumissions = 0;
		document.addEventListener('submit', (e) => { window.__soumissions++; e.preventDefault(); }, true);
	});
	for (const key of ['Enter', 'Control+Enter', 'Meta+Enter']) await page.keyboard.press(key);
	expect(await page.evaluate(() => window.__soumissions)).toBe(0);
	expect(await page.evaluate(() => window.__panneauTest.parent.ouvert)).toBe(true);
});

test('panneau_non_decoupe_par_note et placement après défilement', async ({ page }) => {
	await ouvrir(page, { note: true });
	expect(await page.evaluate(() => {
		const { parent, panneau } = window.__panneauTest;
		parent.element.style.maxHeight = '120px'; parent.element.style.overflowY = 'auto';
		parent.element.scrollTop = 100;
		return panneau.element.matches(':popover-open') && panneau.element.parentElement === parent.element;
	})).toBe(true);
	await page.waitForTimeout(50);
	expect(await page.evaluate(() => {
		const el = window.__panneauTest.panneau.element; const r = el.getBoundingClientRect();
		return r.top >= 0 && r.bottom <= innerHeight && el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
	})).toBe(true);
});

test('autre popover, changement de mode et destruction ferment sans ancien refocus', async ({ page }) => {
	await ouvrir(page, { note: true });
	await page.evaluate(() => window.__panneauTest.parent.sousUi.openLink());
	await expect(page.getByRole('dialog', { name: 'Suggestions de test' })).toHaveCount(0);
	await expect(page.locator('.tts-popover--lien input').first()).toBeFocused();
	await page.evaluate(() => {
		window.__tts.ui.Popover.current.close({ refocus: false });
		window.__tts.ui.Popover.current.close({ refocus: false });
	});
	await ouvrir(page);
	await page.evaluate(() => window.__panneauTest.instance.toggleMode());
	await expect(page.getByRole('dialog', { name: 'Suggestions de test' })).toHaveCount(0);
	await page.evaluate(() => window.__panneauTest.instance.toggleMode());
	await ouvrir(page);
	await page.evaluate(() => window.__panneauTest.instance.destroy());
	await expect(page.getByRole('dialog', { name: 'Suggestions de test' })).toHaveCount(0);
});

test('panneau accessible sans nouvelle violation axe', async ({ page }) => {
	await ouvrir(page);
	const result = await new AxeBuilder({ page }).include('.tts-suggestions-panneau').analyze();
	expect(result.violations).toEqual([]);
});

test('sortie Tab ignore les contrôles cachés et boucle dans la note', async ({ page }) => {
	await ouvrir(page, { note: true, erreur: true });
	await page.evaluate(() => {
		const cache = document.createElement('div'); cache.style.display = 'none';
		cache.innerHTML = '<button type="button">Caché</button>';
		document.querySelector('#tts-test-open').after(cache);
	});
	await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
	await expect(page.locator('#tts-test-after')).toBeFocused();
	await page.evaluate(() => {
		const { parent, content } = window.__panneauTest;
		document.querySelector('#tts-test-after').remove();
		parent.sousUi.openSuggestionsPanel({ anchor: document.querySelector('#tts-test-open'), origin: { trigger: document.querySelector('#tts-test-open') }, content, label: 'Suggestions de test' });
	});
	await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
	await expect(page.locator('.tts-popover--note input[name="nom"]')).toBeFocused();
});

test('clic extérieur conserve sa cible sans modifier le document', async ({ page }) => {
	await ouvrir(page);
	await page.locator('#tts-test-after').click();
	await expect(page.locator('#tts-test-after')).toBeFocused();
	await expect(page.getByRole('dialog', { name: 'Suggestions de test' })).toHaveCount(0);
	await expect(page.locator('.tts-content .ProseMirror')).toHaveText('Un texte à conserver.');
});

test('multi : accès par ligne et nettoyage indépendant des deux éditeurs', async ({ page }) => {
	expect(await page.evaluate(() => {
		const instance = [...window.__tts.instances][0]; const multi = instance.ui.editMulti(null);
		const [premiere, seconde] = multi.lignes;
		const content = document.createElement('div'); content.innerHTML = '<input type="search" aria-label="Test multi">';
		const p = premiere.sousUi.openSuggestionsPanel({ content, label: 'Panneau multi' });
		seconde.sous.destroy();
		const independant = p.element.isConnected && !premiere.sous.isDestroyed;
		premiere.sous.destroy();
		return independant && !p.element.isConnected && multi.ouvert;
	})).toBe(true);
});

test('C1 : curseur de note longue visible dès ouverture sans focus différé', async ({ page }) => {
	await page.evaluate(() => {
		const i = [...window.__tts.instances][0];
		const content = Array.from({ length: 80 }, (_, n) => ({ type: 'paragraph', content: [{ type: 'text', text: `Paragraphe ${n} de cette longue note.` }] }));
		i.editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'spipNote', attrs: { content } }] }] });
		window.__noteLongue = i.ui.editNote(1);
	});
	await expect.poll(() => page.evaluate(() => {
		const n = window.__noteLongue; const r = n.sous.view.coordsAtPos(n.sous.state.selection.from);
		const cadre = n.element.getBoundingClientRect();
		return r.top >= cadre.top && r.bottom <= cadre.bottom && n.sous.view.hasFocus();
	})).toBe(true);
});

test('C2 : clic dans la marge intérieure garde un focus et Échap ferme', async ({ page }) => {
	await ouvrir(page, { note: true });
	await page.locator('.tts-suggestions-panneau').click({ position: { x: 4, y: 4 } });
	expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: 'Suggestions de test' })).toHaveCount(0);
	expect(await page.evaluate(() => window.__panneauTest.instance.pleinEcran())).toBe(true);
});

test('C2 : réessai remplace le bouton actif, récupère le focus et reste sans submit', async ({ page }) => {
	await ouvrir(page, { note: true, erreur: true });
	await page.keyboard.press('Tab');
	await page.evaluate(() => {
		const p = window.__panneauTest.panneau;
		p.corps.querySelector('button').onclick = () => {
			const content = document.createElement('div'); content.innerHTML = '<input type="search" aria-label="Recherche après essai"><button>Choisir</button>';
			p.remplacer(content);
		};
	});
	await page.keyboard.press('Enter');
	await expect(page.getByRole('searchbox', { name: 'Recherche après essai' })).toBeFocused();
	expect(await page.getByRole('dialog', { name: 'Suggestions de test' }).getByRole('button', { name: 'Choisir', exact: true }).getAttribute('type')).toBe('button');
	await page.keyboard.press('Escape'); await expect(page.getByRole('dialog', { name: 'Suggestions de test' })).toHaveCount(0);
});

test('C2 : Échap récupère un panneau dont le contrôle actif a disparu', async ({ page }) => {
	await ouvrir(page);
	await page.evaluate(() => { window.__panneauTest.instance.togglePleinEcran(true); document.activeElement.remove(); });
	expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: 'Suggestions de test' })).toHaveCount(0);
	expect(await page.evaluate(() => window.__panneauTest.instance.pleinEcran())).toBe(true);
});

test('le contenu redimensionné est replacé dans la fenêtre', async ({ page }) => {
	await ouvrir(page);
	await page.evaluate(() => { const p = window.__panneauTest.panneau; p.corps.style.height = '2000px'; });
	await expect.poll(() => page.evaluate(() => {
		const r = window.__panneauTest.panneau.element.getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0;
	})).toBe(true);
});

test.describe('inline', () => {
	const editeur = (page) => page.locator('.tts-content > .ProseMirror');
	const liste = (page) => page.locator('.tts-suggestions');
	const texte = (page) => page.evaluate(() => window.__inline.state.doc.textContent);
	const reset = (page) => page.evaluate(() => {
		window.__inline.commands.clearContent(); window.__inline.view.focus();
	});
	test.beforeEach(async ({ page }) => {
		await page.evaluate(() => { window.__inline = [...window.__tts.instances][0].editor; });
		await editeur(page).click();
	});

	test('module/global identiques, premier caractère et second déclencheur', async ({ page }) => {
		expect(await page.evaluate(() => window.__tts.ui === window.tiptapSpip.ui)).toBe(true);
		await page.keyboard.type('@b'); await expect(liste(page).getByRole('option')).toHaveCount(2);
		await page.keyboard.type('o'); await expect(liste(page).getByRole('option')).toHaveCount(2);
		await page.keyboard.type(' #a'); await expect(liste(page).getByRole('option')).toHaveText('Autre');
		await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
		expect(await texte(page)).toBe('@bo Autre !');
	});

	test('validation, frappe, deux annulations, rétablissement et réouverture', async ({ page }) => {
		await page.keyboard.type('ab @bo'); await expect(liste(page).getByRole('option')).toHaveCount(2);
		await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.keyboard.type('x');
		expect(await texte(page)).toBe('ab Bonjour !x');
		await page.keyboard.press('Control+z'); expect(await texte(page)).toBe('ab Bonjour !');
		await page.keyboard.press('Control+z'); expect(await texte(page)).toBe('ab @bo');
		await expect(liste(page).getByRole('option')).toHaveCount(2);
		await page.keyboard.press('Control+Shift+z'); await page.keyboard.press('Control+Shift+z');
		expect(await texte(page)).toBe('ab Bonjour !x');
	});

	test('refus conserve requête et menu utilisable', async ({ page }) => {
		await page.keyboard.type('@refus'); await expect(liste(page).getByRole('option')).toHaveText('Refuser');
		await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
		expect(await texte(page)).toBe('@refus'); await expect(liste(page).getByRole('option')).toHaveCount(1);
	});

	test('clic sur marge ou état vide conserve le focus et Échap ferme', async ({ page }) => {
		for (const query of ['b', 'zzz']) {
			await reset(page); await page.keyboard.type(`@${query}`); await expect(liste(page)).toBeVisible();
			await liste(page).click({ position: { x: 1, y: 1 } });
			await expect(editeur(page)).toBeFocused(); expect(await texte(page)).toBe(`@${query}`);
			if (query === 'zzz') { await page.getByRole('status').filter({ hasText: 'Aucune formule' }).click(); await expect(editeur(page)).toBeFocused(); }
			await page.keyboard.press('Escape'); await expect(liste(page)).toHaveCount(0);
		}
	});

	test('défilement molette et zone de barre gardent le focus ; tactile non annulé', async ({ page, browserName }) => {
		await page.keyboard.type('@tout'); await expect(liste(page).getByRole('option')).toHaveCount(43);
		const box = await liste(page).boundingBox();
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, 250);
		await expect.poll(() => liste(page).evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
		await page.mouse.click(box.x + box.width - 2, box.y + box.height / 2);
		await expect(editeur(page)).toBeFocused();
		expect(await liste(page).evaluate((el) => ['touchstart', 'touchmove'].every((type) => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }))))).toBe(true);
		if (browserName === 'chromium') {
			// Geste tactile réel via CDP ; les deux autres moteurs vérifient les événements non annulés.
			const cdp = await page.context().newCDPSession(page);
			await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
			await liste(page).evaluate((el) => { el.scrollTop = 0; });
			const x = box.x + box.width / 2, y = box.y + box.height - 20;
			await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
			for (let i = 1; i <= 8; i++) {
				await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - i * 20 }] });
				await page.waitForTimeout(20);
			}
			await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
			await expect.poll(() => liste(page).evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
			await expect(editeur(page)).toBeFocused(); await cdp.detach();
		}
		await page.keyboard.press('Escape'); await expect(liste(page)).toHaveCount(0);
	});

	test('Échap tient après motif invalide et passage sous seuil', async ({ page }) => {
		for (const cas of ['motif', 'seuil']) {
			await reset(page); await page.keyboard.type('@b'); await expect(liste(page).getByRole('option')).toHaveCount(2);
			await page.keyboard.press('Escape');
			if (cas === 'motif') { await page.keyboard.type('!'); await page.keyboard.press('Backspace'); }
			else { await page.keyboard.press('Backspace'); await page.keyboard.type('b'); }
			await expect(liste(page)).toHaveCount(0);
			await page.keyboard.type(' @b'); await expect(liste(page).getByRole('option')).toHaveCount(2);
		}
	});

	test('fin de composition ouvre sans entrée d’historique supplémentaire', async ({ page }) => {
		await page.keyboard.type('@');
		await editeur(page).dispatchEvent('compositionstart', { data: '' });
		await page.evaluate(() => window.__inline.commands.insertContent('bo'));
		await expect(liste(page)).toHaveCount(0);
		await editeur(page).dispatchEvent('compositionend', { data: 'bo' });
		await expect(liste(page).getByRole('option')).toHaveCount(2);
		await page.keyboard.press('Control+z'); expect(await texte(page)).toBe('');
	});

	test('retour du focus réévalue ; sélection programmée hors focus reste fermée', async ({ page }) => {
		await page.locator('input[name=titre]').focus();
		await page.evaluate(() => window.__inline.commands.insertContent('@bo'));
		await expect(liste(page)).toHaveCount(0);
		await page.evaluate(() => window.__inline.view.focus());
		await expect(liste(page).getByRole('option')).toHaveCount(2);
	});

	test('Maj+Entrée et Maj+flèche gardent leur fonction d’édition', async ({ page }) => {
		await page.keyboard.type('@bo'); await expect(liste(page).getByRole('option')).toHaveCount(2);
		await page.keyboard.press('Shift+ArrowLeft');
		await expect.poll(() => page.evaluate(() => window.__inline.state.selection.empty)).toBe(false);
		await page.keyboard.press('ArrowRight'); await expect(liste(page).getByRole('option')).toHaveCount(2);
		await page.keyboard.press('ArrowDown'); await page.keyboard.press('Shift+Enter');
		expect(await texte(page)).toBe('@bo');
		expect(await page.evaluate(() => window.__inline.state.doc.firstChild.lastChild.type.name)).toBe('hardBreak');
	});

	test('réponse lente après changement de requête ou fermeture ignorée', async ({ page }) => {
		await page.keyboard.type('@lent'); await expect(liste(page)).toBeVisible();
		await page.keyboard.press('Escape'); await page.keyboard.type(' @bo');
		await expect(liste(page).getByRole('option')).toHaveCount(2);
		await page.waitForTimeout(350); await expect(liste(page).getByRole('option')).toHaveCount(2);
		await liste(page).getByRole('option').first().click();
		expect(await texte(page)).toBe('@lent Bonjour !'); await expect(editeur(page)).toBeFocused();
	});

	for (const bloc of ['liste', 'tableau', 'titre']) test(`Entrée active prioritaire dans ${bloc}, sinon native`, async ({ page }) => {
		await page.evaluate((bloc) => {
			const p = { type: 'paragraph' };
			const content = bloc === 'liste' ? { type: 'bulletList', content: [{ type: 'listItem', content: [p] }] }
				: bloc === 'tableau' ? { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [p] }] }] }
					: { type: 'heading', attrs: { level: 2 } };
			window.__inline.commands.setContent({ type: 'doc', content: [content] });
			let pos; window.__inline.state.doc.descendants((n, p) => { if (pos === undefined && n.isTextblock) pos = p + 1; });
			window.__inline.commands.setTextSelection(pos); window.__inline.view.focus();
		}, bloc);
		await page.keyboard.type('@bo'); await expect(liste(page).getByRole('option')).toHaveCount(2);
		await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
		expect(await texte(page)).toBe('Bonjour !');
		expect(await page.evaluate(() => window.__inline.state.doc.childCount)).toBe(1);
		await page.keyboard.type(' @bo'); await expect(liste(page).getByRole('option')).toHaveCount(2);
		await page.keyboard.press('Enter'); expect(await texte(page)).not.toContain('Bonjour ! Bonjour');
	});

	test('note en plein écran : clic marge, Échap consommé avant note et plein écran', async ({ page }) => {
		await page.evaluate(() => {
			const instance = [...window.__tts.instances][0]; instance.togglePleinEcran(true);
			window.__noteInline = instance.ui.editNote(null); window.__inline = window.__noteInline.sous;
		});
		await page.keyboard.type('@bo'); await expect(liste(page).getByRole('option')).toHaveCount(2);
		await liste(page).click({ position: { x: 1, y: 1 } });
		await page.keyboard.press('Escape'); await expect(liste(page)).toHaveCount(0);
		expect(await page.evaluate(() => window.__noteInline.ouvert && [...window.__tts.instances][0].pleinEcran())).toBe(true);
		await page.keyboard.type(' @bo'); await expect(liste(page).getByRole('option')).toHaveCount(2);
		await page.keyboard.press('Tab'); await expect(liste(page)).toHaveCount(0);
		expect(await page.evaluate(() => window.__noteInline.ouvert)).toBe(true);
	});

	test('multi : un fournisseur par langue et fermeture isolée', async ({ page }) => {
		await page.evaluate(() => {
			const instance = [...window.__tts.instances][0];
			instance.editor.commands.setContent('<p>Texte</p>'); instance.editor.commands.setTextSelection(6);
			window.__multiInline = instance.ui.editMulti(null);
			window.__inline = window.__multiInline.lignes[0].sous; window.__inline.view.focus();
		});
		await page.keyboard.type('@bo'); await expect(liste(page).getByRole('option')).toHaveCount(2);
		await page.evaluate(() => { window.__inline = window.__multiInline.lignes[1].sous; window.__inline.view.focus(); });
		await expect(liste(page)).toHaveCount(0); await page.keyboard.type('#a');
		await expect(liste(page).getByRole('option')).toHaveText('Autre');
		await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
		expect(await texte(page)).toBe('Autre !');
		expect(await page.evaluate(() => window.__multiInline.lignes[0].sous.state.doc.textContent)).toBe('@bo');
	});

	test('HTML fournisseur inerte et liste accessible', async ({ page }) => {
		await page.keyboard.type('@html'); await expect(liste(page).getByRole('option')).toHaveText('<img src=x onerror=alert(1)>');
		await expect(liste(page).locator('img')).toHaveCount(0);
		const result = await new AxeBuilder({ page }).include('.tts-editor').analyze();
		expect(result.violations).toEqual([]);
	});
});
