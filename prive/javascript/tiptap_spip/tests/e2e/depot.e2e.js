// Glisser-déposer des documents (spec 10 §8) sur un site SPIP JETABLE : dépôt dans l'éditeur visuel et en
// mode source, état de survol, refus sans perte de la page, coexistence avec crayons/upload.
// Usage et serveur : cf. article.e2e.js.
import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { activer, configure, configurer, documents, editer, enregistrer, lireConfig, module, publier, texte } from './site.js';

configure(test);

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PDF = Buffer.from('%PDF-1.4\n%%EOF\n').toString('base64');

test.beforeAll(() => configurer('tiptap_spip/coller_images', 'oui'));

/**
 * Glisse puis dépose des fichiers sur l'élément, au centre de sa première ligne : dragenter, dragover,
 * drop, avec un vrai DataTransfer (dataTransfer posé par defineProperty, que DragEvent n'accepte pas
 * partout). Rend l'état d'annulation de chaque événement.
 */
const deposer = (page, selecteur, fichiers) => page.evaluate(([selecteur, fichiers, PNG]) => {
	const cible = document.querySelector(selecteur);
	const rect = cible.getBoundingClientRect();
	const dt = new DataTransfer();
	for (const { nom = 'image.png', type = 'image/png', base64 = PNG } of fichiers) {
		dt.items.add(new File([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], nom, { type }));
	}
	const etats = {};
	for (const type of ['dragenter', 'dragover', 'drop']) {
		const event = new Event(type, { bubbles: true, cancelable: true });
		Object.assign(event, { clientX: rect.right - 2, clientY: rect.top + 8 });
		Object.defineProperty(event, 'dataTransfer', { value: dt });
		cible.dispatchEvent(event);
		etats[type] = event.defaultPrevented;
	}
	return etats;
}, [selecteur, fichiers, PNG]);

const envoisTermines = (page) => expect(page.locator('.tts-envoi')).toHaveCount(0, { timeout: 10_000 });

test.describe('dépôt', () => {
	test('visuel : un PDF et un PNG → deux documents liés, deux <docN> dans l\'ordre', async ({ page }) => {
		const id = await editer(page, 'Texte');
		const etats = await deposer(page, '.tts-editor .ProseMirror p', [{ nom: 'notes.pdf', type: 'application/pdf', base64: PDF }, {}]);
		expect(etats).toEqual({ dragenter: true, dragover: true, drop: true });
		// zone de dépôt étendue de Bigup (boîte Documents, #contenu) : pas d'état de survol laissé, il
		// masquerait le formulaire (SPIP 4.2)
		await expect(page.locator('#contenu')).not.toHaveClass(/drag-over/);
		await expect(page.locator('.tts-editor .tts-model')).toHaveCount(2, { timeout: 10_000 });
		await envoisTermines(page);
		const docs = documents('article', id);
		expect(docs.map((d) => [d.extension, d.mode])).toEqual([['pdf', 'document'], ['png', 'document']]);
		await enregistrer(page);
		expect(texte(id)).toBe(`Texte<doc${docs[0].id_document}><doc${docs[1].id_document}>`);
	});

	test('mode source : <docN> après la sélection', async ({ page }) => {
		const id = await editer(page, 'Texte');
		await module(page);
		await page.evaluate(() => [...window.__tts.instances][0].toggleMode());
		const textarea = page.locator('.tts-editor textarea');
		await textarea.evaluate((t) => t.setSelectionRange(5, 5));
		await deposer(page, '.tts-editor textarea', [{ nom: 'notes.pdf', type: 'application/pdf', base64: PDF }]);
		await expect(textarea).toHaveValue(/^Texte<doc\d+>$/, { timeout: 10_000 });
		const [doc] = documents('article', id);
		await enregistrer(page);
		expect(texte(id)).toBe(`Texte<doc${doc.id_document}>`);
	});

	test('survol : état visible, retiré à la sortie de la zone', async ({ page }) => {
		await editer(page, 'Texte');
		const zone = page.locator('.tts-editor');
		await page.evaluate(() => {
			const dt = new DataTransfer();
			dt.items.add(new File(['x'], 'a.pdf', { type: 'application/pdf' }));
			const ev = (type, cible, relatedTarget = null) => {
				const e = new Event(type, { bubbles: true, cancelable: true });
				Object.defineProperty(e, 'dataTransfer', { value: dt });
				Object.defineProperty(e, 'relatedTarget', { value: relatedTarget });
				cible.dispatchEvent(e);
			};
			window.__glisser = ev;
			ev('dragenter', document.querySelector('.tts-editor .ProseMirror'));
		});
		await expect(zone).toHaveClass(/tts-editor--depot/);
		await page.evaluate(() => window.__glisser('dragleave', document.querySelector('.tts-editor .ProseMirror'), document.body));
		await expect(zone).not.toHaveClass(/tts-editor--depot/);
	});

	test('refus (type non accepté) : page conservée, texte intact, message', async ({ page }) => {
		const id = await editer(page, 'Texte');
		const etats = await deposer(page, '.tts-editor .ProseMirror p', [{ nom: 'setup.exe', type: 'application/x-msdownload', base64: 'TVo=' }]);
		expect(etats).toEqual({ dragenter: true, dragover: true, drop: true });
		await expect(page.locator('.tts-etat__message')).toHaveText('Type de fichier non accepté : setup.exe.');
		await expect(page).toHaveURL(/exec=article_edit/);
		expect(documents('article', id)).toEqual([]);
		await expect(page.locator('.tts-editor .ProseMirror')).toHaveText('Texte');
	});

	test('services absents : dépôt annulé quand même, page et texte intacts, message', async ({ page }) => {
		// formulaire de services retiré de la page avant le montage de l'éditeur, et page de services à la
		// demande bloquée : mode dégradé
		await page.route(/page=tiptap_spip_services/, (route) => route.abort());
		await page.addInitScript(() => {
			new MutationObserver(() => document.querySelectorAll('.tts-services').forEach((c) => c.remove()))
				.observe(document, { childList: true, subtree: true });
		});
		const id = await editer(page, 'Texte');
		await module(page);
		expect(await page.evaluate(async () => {
			const instance = [...window.__tts.instances][0];
			await instance.servicesPrets;
			return instance.services;
		})).toBeNull();
		const etats = await deposer(page, '.tts-editor .ProseMirror p', [{ nom: 'notes.pdf', type: 'application/pdf', base64: PDF }]);
		expect(etats).toEqual({ dragenter: true, dragover: true, drop: true });
		await expect(page.locator('.tts-etat__message')).toHaveText('L’ajout de fichiers n’est pas disponible ici.');
		await expect(page).toHaveURL(/exec=article_edit/);
		await expect(page.locator('.tts-editor .ProseMirror')).toHaveText('Texte');
		expect(documents('article', id)).toEqual([]);
	});

	test('réglage désactivé : dépôt annulé quand même, message, rien envoyé', async ({ page }) => {
		configurer('tiptap_spip/coller_images', 'non');
		try {
			const id = await editer(page, 'Texte');
			const etats = await deposer(page, '.tts-editor .ProseMirror p', [{ nom: 'notes.pdf', type: 'application/pdf', base64: PDF }]);
			expect(etats.drop).toBe(true);
			await expect(page.locator('.tts-etat__message')).toHaveText('L’ajout de fichiers n’est pas disponible ici.');
			expect(documents('article', id)).toEqual([]);
		} finally {
			configurer('tiptap_spip/coller_images', 'oui');
		}
	});
});

const crayons = existsSync(`${process.env.TTS_SITE}/plugins/crayons`);

test.describe('coexistence avec crayons/upload', () => {
	test.skip(!crayons, 'plugin crayons absent du site');
	let upload;
	test.beforeAll(() => {
		if (!crayons) return;
		activer('crayons');
		configurer('tiptap_spip/crayons', 'oui');
		upload = lireConfig('crayons/upload');
		configurer('crayons/upload', 'on');
	});
	test.afterAll(() => {
		if (crayons) configurer('crayons/upload', upload);
	});

	/**
	 * Article public, crayon de son texte ouvert, services à la demande arrivés. Envois comptés : ceux de
	 * l'éditeur par l'événement tiptap-spip:document-recu (le corps multipart d'un XHR avec fichier n'est
	 * pas exposé par tous les navigateurs), ceux de Crayons par l'URL de son action crayons_upload.
	 */
	const ouvrirCrayon = async (page) => {
		const id = await editer(page, 'Texte du crayon.');
		publier(id);
		let crayons = 0;
		page.on('request', (r) => {
			if (r.method() === 'POST' && /crayons_upload/.test(r.url())) crayons++;
		});
		await page.goto(`/spip.php?page=article&id_article=${id}&var_mode=calcul`);
		await module(page);
		await page.evaluate(() => {
			window.__envoisTiptap = 0;
			document.addEventListener('tiptap-spip:document-recu', () => window.__envoisTiptap++);
		});
		await page.locator(`.crayon.article-texte-${id}`).dblclick();
		await expect(page.locator('.crayon-html .tts-editor .ProseMirror')).toBeVisible();
		await page.evaluate(() => Promise.all([...window.__tts.instances].map((i) => i.servicesPrets)));
		const requetes = async () => ({ tiptap: await page.evaluate(() => window.__envoisTiptap), crayons });
		return { id, requetes };
	};

	test('mode visuel : Tiptap seul envoie, un document lié à l\'article, un <docN>', async ({ page }) => {
		const { id, requetes } = await ouvrirCrayon(page);
		await deposer(page, '.crayon-html .tts-editor .ProseMirror p', [{ nom: 'notes.pdf', type: 'application/pdf', base64: PDF }]);
		await expect(page.locator('.crayon-html .tts-editor .tts-model')).toHaveCount(1, { timeout: 10_000 });
		await envoisTermines(page);
		expect(await requetes()).toEqual({ tiptap: 1, crayons: 0 });
		expect(documents('article', id)).toHaveLength(1);
		await page.locator('.crayon-html .crayon-submit').click();
		await expect(page.locator('.crayon-html')).toHaveCount(0, { timeout: 10_000 });
		expect(texte(id)).toMatch(/^Texte du crayon\.<doc\d+>$/);
	});

	test('mode source : Crayons seul envoie, rien n\'est inséré dans le texte', async ({ page }) => {
		const { id, requetes } = await ouvrirCrayon(page);
		await page.evaluate(() => [...window.__tts.instances].find((i) => i.textarea.closest('.crayon-html')).toggleMode());
		const textarea = page.locator('.crayon-html .tts-editor textarea');
		await expect(textarea).toHaveClass(/uploader/);
		await deposer(page, '.crayon-html .tts-editor textarea', [{ nom: 'notes.pdf', type: 'application/pdf', base64: PDF }]);
		// Crayons reçoit le dépôt : sa ligne dans le panneau, son envoi vers crayons_upload. Ni le document
		// ni la fin de l'envoi (li.ok) ne sont vérifiés : Crayons 3.5.1 appelle distant_table() avant
		// d'inclure inc/crayons, son action répond 500
		await expect(page.locator('#uploader_liste li')).toHaveCount(1, { timeout: 10_000 });
		await expect.poll(requetes).toEqual({ tiptap: 0, crayons: 1 });
		await expect(textarea).toHaveValue('Texte du crayon.');
		expect(documents('article', id)).toEqual([]);
	});

	test('panneau de Crayons : sa propre zone de dépôt, inchangée', async ({ page }) => {
		const { id, requetes } = await ouvrirCrayon(page);
		// panneau latéral de crayons/upload (uploader.js.html : #uploader<id_article>)
		await deposer(page, `#uploader${id}`, [{ nom: 'notes.pdf', type: 'application/pdf', base64: PDF }]);
		await expect(page.locator('#uploader_liste li')).toHaveCount(1, { timeout: 10_000 });
		await expect.poll(requetes).toEqual({ tiptap: 0, crayons: 1 });
		await expect(page.locator('.crayon-html .tts-editor .tts-model')).toHaveCount(0);
		await expect(page.locator('.crayon-html .tts-editor .ProseMirror')).toHaveText('Texte du crayon.');
	});

	test('Tiptap désactivé dans les crayons : comportement de Crayons conservé', async ({ page }) => {
		configurer('tiptap_spip/crayons', 'non');
		try {
			const id = await editer(page, 'Texte du crayon.');
			publier(id);
			await page.goto(`/spip.php?page=article&id_article=${id}&var_mode=calcul`);
			await page.locator(`.crayon.article-texte-${id}`).dblclick();
			const textarea = page.locator('.crayon-html textarea.crayon-active');
			await expect(textarea).toHaveClass(/uploader/);
			await expect(page.locator('.crayon-html .tts-editor')).toHaveCount(0);
			let crayons = 0;
			page.on('request', (r) => {
				if (r.method() === 'POST' && /crayons_upload/.test(r.url())) crayons++;
			});
			await deposer(page, '.crayon-html textarea.crayon-active', [{ nom: 'notes.pdf', type: 'application/pdf', base64: PDF }]);
			await expect(page.locator('#uploader_liste li')).toHaveCount(1, { timeout: 10_000 });
			await expect.poll(() => crayons).toBe(1);
			await expect(textarea).toHaveValue('Texte du crayon.');
			expect(id).toBeGreaterThan(0);
		} finally {
			configurer('tiptap_spip/crayons', 'oui');
		}
	});
});
