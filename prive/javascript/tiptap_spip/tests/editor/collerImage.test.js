// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nommer, trierPressePapiers } from '../../src/editor/collerImage.js';
import { instances, tiptap_spip_init } from '../../src/main.js';
import { ServiceError, ServiceUnavailable } from '../../src/services/cvt.js';

const CONFIG = { types: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'], taille: 1000 };
const fichier = (nom, type, taille = 10) => new File([new Uint8Array(taille)], nom, { type });

/** DataTransfer minimal (jsdom n'en a pas) : files et getData. */
const presse = ({ files = [], html = '', texte = '' } = {}) => ({
	files,
	getData: (type) => ({ 'text/html': html, 'text/plain': texte })[type] ?? '',
});

describe('nommer', () => {
	const date = new Date(2026, 9, 15, 9, 5, 3);

	it('capture sans nom ou nommée image.png : capture-AAAAMMJJ-HHMMSS.<ext>', () => {
		expect(nommer(fichier('', 'image/png'), date).name).toBe('capture-20261015-090503.png');
		expect(nommer(fichier('image.png', 'image/png'), date).name).toBe('capture-20261015-090503.png');
		expect(nommer(fichier('image.jpeg', 'image/jpeg'), date).name).toBe('capture-20261015-090503.jpg');
	});

	it('extension annoncée par le serveur pour le type, sinon celle par défaut', () => {
		expect(nommer(fichier('', 'image/jpeg'), date, { 'image/jpeg': 'jpeg' }).name).toBe('capture-20261015-090503.jpeg');
		expect(nommer(fichier('photo.jpg', 'image/jpeg'), date, { 'image/jpeg': 'jpeg' }).name).toBe('photo.jpeg');
		expect(nommer(fichier('a.png', 'image/png'), date, { 'image/jpeg': 'jpeg' }).name).toBe('a.png');
	});

	it('fichier nommé : son nom, avec l\'extension de son type', () => {
		expect(nommer(fichier('Photo vacances.JPEG', 'image/jpeg'), date).name).toBe('Photo vacances.jpg');
		expect(nommer(fichier('schema.webp', 'image/webp'), date).name).toBe('schema.webp');
	});

	it('garde le contenu et le type', () => {
		const f = nommer(fichier('', 'image/gif', 7), date);
		expect(f.type).toBe('image/gif');
		expect(f.size).toBe(7);
	});
});

describe('trierPressePapiers (spec 10 §3)', () => {
	const png = fichier('a.png', 'image/png');
	const jpg = fichier('b.jpg', 'image/jpeg');
	const pdf = fichier('c.pdf', 'application/pdf');

	it('sans fichier : collage habituel', () => {
		expect(trierPressePapiers(presse({ html: '<p>x</p>' }), CONFIG)).toBeNull();
		expect(trierPressePapiers(null, CONFIG)).toBeNull();
	});

	it('images seules : toutes envoyées dans l\'ordre', () => {
		expect(trierPressePapiers(presse({ files: [png, jpg] }), CONFIG)).toEqual({ envoyer: [png, jpg], refuses: [] });
	});

	it('images + HTML réduit à une <img> (+ texte) : envoyées, HTML et texte ignorés', () => {
		const html = '<meta charset="utf-8"><img src="https://exemple.test/a.png" alt="">';
		expect(trierPressePapiers(presse({ files: [png], html, texte: 'https://exemple.test/a.png' }), CONFIG).envoyer).toEqual([png]);
		const windows = '<html><body><!--StartFragment--><a href="x"><img src="a.png"></a><!--EndFragment--></body></html>';
		expect(trierPressePapiers(presse({ files: [png], html: windows }), CONFIG).envoyer).toEqual([png]);
	});

	it('images + autre HTML ou texte : collage habituel, fichiers ignorés sans message', () => {
		expect(trierPressePapiers(presse({ files: [png], html: '<table><tr><td>1</td></tr></table>' }), CONFIG)).toBeNull();
		expect(trierPressePapiers(presse({ files: [png], html: '<p>texte <img src="a.png"></p>' }), CONFIG)).toBeNull();
		expect(trierPressePapiers(presse({ files: [png], texte: 'du texte' }), CONFIG)).toBeNull();
		expect(trierPressePapiers(presse({ files: [png], html: '<img src="a"><img src="b">' }), CONFIG)).toBeNull();
	});

	it('images et non-images : images envoyées, les autres refusées (type)', () => {
		expect(trierPressePapiers(presse({ files: [pdf, png] }), CONFIG)).toEqual({ envoyer: [png], refuses: [{ fichier: pdf, raison: 'type' }] });
	});

	it('rien d\'acceptable : envoyer vide, refus signalés', () => {
		const svg = fichier('d.svg', 'image/svg+xml');
		expect(trierPressePapiers(presse({ files: [pdf, svg] }), CONFIG)).toEqual({ envoyer: [], refuses: [{ fichier: pdf, raison: 'type' }, { fichier: svg, raison: 'type' }] });
	});

	it('trop grosse : refusée avant envoi sans bloquer les autres ; taille 0 = sans limite', () => {
		const gros = fichier('gros.png', 'image/png', 1001);
		expect(trierPressePapiers(presse({ files: [gros, jpg] }), CONFIG)).toEqual({ envoyer: [jpg], refuses: [{ fichier: gros, raison: 'taille' }] });
		expect(trierPressePapiers(presse({ files: [gros] }), { ...CONFIG, taille: 0 }).envoyer).toEqual([gros]);
	});
});

const tick = () => new Promise((r) => setTimeout(r, 0));

/** Services simulés : annonce et réponses de deposer_image, dans l'ordre. */
const services = (...reponses) => ({
	// conteneur des services à la demande, retiré à la destruction de l'instance
	container: document.createElement('div'),
	available: true,
	images: () => CONFIG,
	call: vi.fn(async (operation, params, { fichier, signal, progression }) => {
		const r = reponses.shift();
		await tick();
		if (signal?.aborted) throw new DOMException('abandon', 'AbortError');
		progression?.(1);
		if (r instanceof Error) throw r;
		return r;
	}),
});

/** Éditeur monté par tiptap_spip_init, services remplacés par `s`. */
const monterInstance = (source, s, { mode = 'visual' } = {}) => {
	document.body.innerHTML = `<form><textarea class="inserer_barre_edition" name="texte">${source}</textarea><button type="submit">Enregistrer</button></form>`;
	tiptap_spip_init();
	const instance = [...instances][0];
	instance.services = s;
	if (mode === 'source') instance.toggleMode({ focus: false });
	return instance;
};

/** Événement paste avec un presse-papiers donné. */
const coller = (cible, donnees) => {
	const event = new Event('paste', { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'clipboardData', { value: donnees });
	cible.dispatchEvent(event);
	return event;
};

afterEach(() => {
	for (const instance of [...instances]) instance.destroy();
	document.body.innerHTML = '';
	localStorage.clear();
});

describe('CollerImages (spec 10 §1, §3)', () => {
	const png = () => fichier('', 'image/png');

	it('visuel : deux images → deux appels dans l\'ordre, deux <docN>, événements', async () => {
		const s = services({ id_document: 1, raccourci: 'doc1' }, { id_document: 2, raccourci: 'doc2' });
		const instance = monterInstance('Texte', s);
		instance.editor.commands.setTextSelection(6);
		const recues = [];
		const inserees = [];
		instance.textarea.addEventListener('tiptap-spip:image-recue', (e) => recues.push(e.detail.fichier.name));
		instance.textarea.addEventListener('tiptap-spip:image-inseree', (e) => inserees.push(e.detail.raccourci));
		const event = coller(instance.editor.view.dom, presse({ files: [png(), fichier('b.jpg', 'image/jpeg')] }));
		expect(event.defaultPrevented).toBe(true);
		expect(instance.images.enCours()).toBe(2);
		await vi.waitFor(() => expect(instance.images.enCours()).toBe(0));
		expect(s.call.mock.calls.map(([op, , { fichier: f }]) => [op, f.name.replace(/\d{8}-\d{6}/, 'D')])).toEqual([['deposer_image', 'capture-D.png'], ['deposer_image', 'b.jpg']]);
		instance.bridge.flush();
		expect(instance.textarea.value).toBe('Texte<doc1><doc2>');
		expect(recues).toHaveLength(2);
		expect(inserees).toEqual(['doc1', 'doc2']);
	});

	it('services en chargement : collage habituel ; collage suivant envoyé une fois les services là', async () => {
		const instance = monterInstance('Texte', null);
		expect(coller(instance.editor.view.dom, presse({ files: [png()] })).defaultPrevented).toBe(false);
		instance.services = services({ id_document: 3, raccourci: 'doc3' });
		expect(coller(instance.editor.view.dom, presse({ files: [png()] })).defaultPrevented).toBe(true);
		await vi.waitFor(() => expect(instance.images.enCours()).toBe(0));
		instance.bridge.flush();
		expect(instance.textarea.value).toContain('<doc3>');
	});

	it('opération indisponible ou services hors service : collage habituel', () => {
		const instance = monterInstance('Texte', { ...services(), images: () => null });
		expect(coller(instance.editor.view.dom, presse({ files: [png()] })).defaultPrevented).toBe(false);
		instance.services = { ...services(), available: false };
		expect(coller(instance.editor.view.dom, presse({ files: [png()] })).defaultPrevented).toBe(false);
	});

	it('refus avant envoi : message, sans bloquer l\'autre image', async () => {
		const s = services({ id_document: 4, raccourci: 'doc4' });
		const instance = monterInstance('Texte', s);
		coller(instance.editor.view.dom, presse({ files: [fichier('c.pdf', 'application/pdf'), png()] }));
		expect(instance.etat.message.textContent).toBe('Type de fichier non accepté : c.pdf.');
		await vi.waitFor(() => expect(instance.images.enCours()).toBe(0));
		expect(s.call).toHaveBeenCalledTimes(1);
	});

	it('échec : marqueur retiré, rien inséré, message du serveur, événement image-erreur', async () => {
		const instance = monterInstance('Texte', services(new ServiceError({ message_erreur: 'Ce type d’image n’est pas accepté.' })));
		const erreurs = [];
		instance.textarea.addEventListener('tiptap-spip:image-erreur', (e) => erreurs.push(e.detail.message));
		coller(instance.editor.view.dom, presse({ files: [png()] }));
		await vi.waitFor(() => expect(instance.images.enCours()).toBe(0));
		expect(instance.editor.view.dom.querySelector('.tts-envoi')).toBeNull();
		instance.bridge.flush();
		expect(instance.textarea.value).toBe('Texte');
		expect(instance.etat.message.textContent).toBe('Ce type d’image n’est pas accepté.');
		expect(erreurs).toEqual(['Ce type d’image n’est pas accepté.']);
	});

	it('session expirée : message générique', async () => {
		const instance = monterInstance('Texte', services(new ServiceUnavailable()));
		coller(instance.editor.view.dom, presse({ files: [png()] }));
		await vi.waitFor(() => expect(instance.images.enCours()).toBe(0));
		expect(instance.etat.message.textContent).toBe('L’image n’a pas pu être envoyée (session expirée ou connexion perdue).');
	});

	it('mode source : marqueurs distincts dans le textarea, remplacés chacun par son <docN>', async () => {
		const instance = monterInstance('Texte', services({ id_document: 5, raccourci: 'doc5' }, new ServiceError({ message_erreur: 'Refus' })), { mode: 'source' });
		instance.textarea.setSelectionRange(5, 5);
		coller(instance.textarea, presse({ files: [png(), png()] }));
		expect(instance.textarea.value).toMatch(/^Texte<!-- envoi tts-img-[\w-]+ --><!-- envoi tts-img-[\w-]+ -->$/);
		await vi.waitFor(() => expect(instance.images.enCours()).toBe(0));
		expect(instance.textarea.value).toBe('Texte<doc5>');
		// le retour en visuel relit la source
		instance.toggleMode({ focus: false });
		expect(instance.editor.view.dom.querySelector('.tts-model')).not.toBeNull();
	});

	it('texte sélectionné conservé (comme Crayons), image insérée après lui, dans les deux modes', async () => {
		// visuel : « après » sélectionné
		const visuel = monterInstance('Avant après', services({ id_document: 11, raccourci: 'doc11' }));
		visuel.editor.commands.setTextSelection({ from: 7, to: 12 });
		coller(visuel.editor.view.dom, presse({ files: [png()] }));
		await vi.waitFor(() => expect(visuel.images.enCours()).toBe(0));
		visuel.bridge.flush();
		expect(visuel.textarea.value).toBe('Avant après<doc11>');
		visuel.destroy();
		// source : « Tex » sélectionné, la sélection reste en place
		const source = monterInstance('Texte', services({ id_document: 12, raccourci: 'doc12' }), { mode: 'source' });
		source.textarea.setSelectionRange(0, 3);
		coller(source.textarea, presse({ files: [png()] }));
		expect(source.textarea.value).toMatch(/^Tex<!-- envoi tts-img-[\w-]+ -->te$/);
		expect([source.textarea.selectionStart, source.textarea.selectionEnd]).toEqual([0, 3]);
		await vi.waitFor(() => expect(source.images.enCours()).toBe(0));
		expect(source.textarea.value).toBe('Tex<doc12>te');
	});

	it('marqueur effacé à la main (mode source) : rien inséré, pas d\'événement image-inseree', async () => {
		let liberer;
		const attente = new Promise((r) => { liberer = r; });
		const s = { ...services(), call: vi.fn(async () => { await attente; return { id_document: 13, raccourci: 'doc13' }; }) };
		const instance = monterInstance('Texte', s, { mode: 'source' });
		instance.textarea.setSelectionRange(5, 5);
		const inserees = [];
		instance.textarea.addEventListener('tiptap-spip:image-inseree', (e) => inserees.push(e.detail.raccourci));
		coller(instance.textarea, presse({ files: [png()] }));
		instance.textarea.value = 'Texte';
		liberer();
		await vi.waitFor(() => expect(instance.images.enCours()).toBe(0));
		expect(instance.textarea.value).toBe('Texte');
		expect(inserees).toEqual([]);
	});

	it('extension annoncée par le serveur pour le type (jpeg plutôt que jpg)', async () => {
		const s = services({ id_document: 14, raccourci: 'doc14' });
		s.images = () => ({ ...CONFIG, extensions: { 'image/jpeg': 'jpeg' } });
		const instance = monterInstance('Texte', s);
		coller(instance.editor.view.dom, presse({ files: [fichier('', 'image/jpeg'), fichier('photo.jpg', 'image/jpeg')] }));
		await vi.waitFor(() => expect(instance.images.enCours()).toBe(0));
		expect(s.call.mock.calls.map(([, , { fichier: f }]) => f.name.replace(/\d{8}-\d{6}/, 'D'))).toEqual(['capture-D.jpeg', 'photo.jpeg']);
	});

	it('bascule de mode refusée pendant un envoi', async () => {
		const instance = monterInstance('Texte', services({ id_document: 6, raccourci: 'doc6' }));
		coller(instance.editor.view.dom, presse({ files: [png()] }));
		instance.toggleMode({ focus: false });
		expect(instance.mode()).toBe('visual');
		expect(instance.etat.message.textContent).toBe('Une image est en cours d’envoi.');
		await vi.waitFor(() => expect(instance.images.enCours()).toBe(0));
		instance.toggleMode({ focus: false });
		expect(instance.mode()).toBe('source');
	});

	it('destruction pendant un envoi : abandon, rien inséré', async () => {
		const s = services({ id_document: 7, raccourci: 'doc7' });
		const instance = monterInstance('Texte', s);
		coller(instance.editor.view.dom, presse({ files: [png()] }));
		const { signal } = s.call.mock.calls[0][2];
		instance.destroy();
		expect(signal.aborted).toBe(true);
	});

	it('collage dans un bloc de code : collage habituel', () => {
		const instance = monterInstance('<code class="php">\n$a;\n</code>', services());
		instance.editor.commands.setTextSelection(3);
		expect(coller(instance.editor.view.dom, presse({ files: [png()] })).defaultPrevented).toBe(false);
	});

	it('soumission pendant l\'envoi : retenue, puis partie avec le <docN>', async () => {
		const instance = monterInstance('Texte', services({ id_document: 8, raccourci: 'doc8' }));
		instance.editor.commands.setTextSelection(6);
		const parties = [];
		instance.textarea.form.addEventListener('submit', (e) => {
			if (!e.defaultPrevented) parties.push(instance.textarea.value);
			e.preventDefault();
		});
		coller(instance.editor.view.dom, presse({ files: [fichier('', 'image/png')] }));
		instance.textarea.form.querySelector('button[type=submit]').click();
		expect(parties).toEqual([]);
		await vi.waitFor(() => expect(parties).toEqual(['Texte<doc8>']));
	});

	it('soumission retenue puis fermeture du crayon (destroy sans restauration) : rien n\'est soumis', async () => {
		const s = services({ id_document: 10, raccourci: 'doc10' });
		const instance = monterInstance('Texte', s);
		const parties = [];
		const form = instance.textarea.form;
		form.addEventListener('submit', (e) => {
			if (!e.defaultPrevented) parties.push(instance.textarea.value);
			e.preventDefault();
		});
		coller(instance.editor.view.dom, presse({ files: [fichier('', 'image/png')] }));
		form.querySelector('button[type=submit]').click();
		instance.destroy({ restore: false });
		await tick();
		await tick();
		expect(parties).toEqual([]);
		expect(s.call.mock.calls[0][2].signal.aborted).toBe(true);
	});

	it('Enregistrer sans attendre (vrai câblage) : une seule soumission, sans l\'image ni marqueur', async () => {
		const s = services({ id_document: 9, raccourci: 'doc9' });
		const instance = monterInstance('Texte', s, { mode: 'source' });
		instance.textarea.setSelectionRange(5, 5);
		const parties = [];
		instance.textarea.form.addEventListener('submit', (e) => {
			if (!e.defaultPrevented) parties.push(instance.textarea.value);
			e.preventDefault();
		});
		coller(instance.textarea, presse({ files: [fichier('', 'image/png')] }));
		instance.textarea.form.querySelector('button[type=submit]').click();
		instance.etat.element.querySelector('.tts-etat__message button').click();
		expect(parties).toEqual(['Texte']);
		await tick();
		await tick();
		expect(parties).toEqual(['Texte']);
		expect(s.call.mock.calls[0][2].signal.aborted).toBe(true);
	});
});
