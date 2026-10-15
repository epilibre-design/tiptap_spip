// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { corrigerExtension, trierDepot } from '../../src/editor/deposer.js';
import { instances, tiptap_spip_init } from '../../src/main.js';

const CONFIG = { images: ['image/png', 'image/jpeg'], extensions: { 'image/jpeg': 'jpg', 'image/png': 'png' }, taille_image: 1000, documents: ['png', 'jpg', 'pdf', 'odt', 'svg'], documents_limite_image: ['png', 'jpg', 'svg'], taille_document: 5000 };
const fichier = (nom, type, taille = 10) => new File([new Uint8Array(taille)], nom, { type });
const depot = (files, { html = '', texte = '' } = {}) => ({ files, getData: (t) => ({ 'text/html': html, 'text/plain': texte })[t] ?? '' });

describe('corrigerExtension (corriger_extension de SPIP)', () => {
	it('jpeg → jpg, htm → html, tiff → tif, aif → aiff, mpeg → mpg ; autres inchangées', () => {
		expect(['jpeg', 'htm', 'tiff', 'aif', 'mpeg', 'pdf'].map(corrigerExtension)).toEqual(['jpg', 'html', 'tif', 'aiff', 'mpg', 'pdf']);
	});
});

describe('trierDepot (spec 10 §8)', () => {
	it('sans fichier : null (texte glissé, déplacement interne)', () => {
		expect(trierDepot(depot([], { texte: 'x' }), CONFIG)).toBeNull();
		expect(trierDepot(null, CONFIG)).toBeNull();
	});

	it('images et documents dans l\'ordre ; image renommée, document gardant son nom', () => {
		const tri = trierDepot(depot([fichier('', 'image/png'), fichier('Rapport final.PDF', 'application/pdf'), fichier('photo.jpeg', 'image/jpeg')]), CONFIG);
		expect(tri.refuses).toEqual([]);
		expect(tri.envoyer.map((f) => f.name.replace(/\d{8}-\d{6}/, 'D'))).toEqual(['capture-D.png', 'Rapport final.PDF', 'photo.jpg']);
	});

	it('fichiers et HTML (image glissée depuis une page) : les fichiers sont traités', () => {
		expect(trierDepot(depot([fichier('a.png', 'image/png')], { html: '<p>du texte</p>' }), CONFIG).envoyer).toHaveLength(1);
	});

	it('extension non déposable : refusée (type), sans bloquer les autres', () => {
		const exe = fichier('setup.exe', 'application/x-msdownload');
		const tri = trierDepot(depot([exe, fichier('a.pdf', 'application/pdf')]), CONFIG);
		expect(tri.refuses).toEqual([{ fichier: exe, raison: 'type' }]);
		expect(tri.envoyer.map((f) => f.name)).toEqual(['a.pdf']);
	});

	it('image hors liste blanche mais extension déposable (svg) : document, nom gardé', () => {
		expect(trierDepot(depot([fichier('logo.svg', 'image/svg+xml')]), CONFIG).envoyer.map((f) => f.name)).toEqual(['logo.svg']);
	});

	it('extension jpeg d\'un document : corrigée comme par medias', () => {
		const config = { ...CONFIG, images: [] };
		expect(trierDepot(depot([fichier('a.JPEG', 'image/jpeg')]), config).envoyer).toHaveLength(1);
	});

	it('taille d\'un SVG : taille_image, la limite que medias lui applique (getimagesize le reconnaît)', () => {
		const svg = fichier('logo.svg', 'image/svg+xml', 1001);
		expect(trierDepot(depot([svg]), CONFIG).refuses).toEqual([{ fichier: svg, raison: 'taille' }]);
		expect(trierDepot(depot([fichier('logo.svg', 'image/svg+xml', 999)]), CONFIG).envoyer).toHaveLength(1);
	});

	it('tailles : image (taille_image) et document (taille_document) ; 0 = sans limite', () => {
		const image = fichier('a.png', 'image/png', 1001);
		const pdf = fichier('a.pdf', 'application/pdf', 5001);
		expect(trierDepot(depot([image, pdf]), CONFIG).refuses).toEqual([{ fichier: image, raison: 'taille' }, { fichier: pdf, raison: 'taille' }]);
		expect(trierDepot(depot([image, pdf]), { ...CONFIG, taille_image: 0, taille_document: 0 }).envoyer).toHaveLength(2);
	});
});

const tick = () => new Promise((r) => setTimeout(r, 0));

const services = (...reponses) => ({
	container: document.createElement('div'),
	available: true,
	depot: () => CONFIG,
	call: vi.fn(async () => {
		const r = reponses.shift();
		await tick();
		if (r instanceof Error) throw r;
		return r;
	}),
});

const monterInstance = (source, s, { mode = 'visual', classe = '' } = {}) => {
	document.body.innerHTML = `<form><textarea class="inserer_barre_edition ${classe}" name="texte">${source}</textarea></form>`;
	tiptap_spip_init();
	const instance = [...instances][0];
	instance.services = s;
	// jsdom n'a pas de géométrie (elementFromPoint) : position du dépôt introuvable, sauf simulation
	instance.editor.view.posAtCoords = () => null;
	if (mode === 'source') instance.toggleMode({ focus: false });
	return instance;
};

/** Événement de glisser-déposer avec des fichiers (types : ['Files']). */
const glisser = (cible, type, files = [], { x = 0, y = 0 } = {}) => {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.assign(event, { clientX: x, clientY: y });
	Object.defineProperty(event, 'dataTransfer', { value: { types: files.length || type !== 'drop' ? ['Files'] : [], files, dropEffect: 'none', getData: () => '' } });
	cible.dispatchEvent(event);
	return event;
};

afterEach(() => {
	for (const instance of [...instances]) instance.destroy();
	document.body.innerHTML = '';
	localStorage.clear();
});

describe('DepotFichiers (spec 10 §8)', () => {
	it('survol avec des fichiers : état visible, retiré à la sortie et après le dépôt', () => {
		const instance = monterInstance('Texte', services({ id_document: 9, raccourci: 'doc9' }));
		const { wrapper } = instance;
		const surface = instance.editor.view.dom;
		expect(glisser(surface, 'dragenter').defaultPrevented).toBe(true);
		expect(glisser(surface, 'dragover').defaultPrevented).toBe(true);
		expect(wrapper.classList.contains('tts-editor--depot')).toBe(true);
		expect(wrapper.dataset.ttsDepot).toBe('Déposer les fichiers');
		const sortie = new Event('dragleave', { bubbles: true });
		Object.defineProperty(sortie, 'relatedTarget', { value: document.body });
		surface.dispatchEvent(sortie);
		expect(wrapper.classList.contains('tts-editor--depot')).toBe(false);
		glisser(surface, 'dragover');
		glisser(surface, 'drop', [fichier('a.pdf', 'application/pdf')]);
		expect(wrapper.classList.contains('tts-editor--depot')).toBe(false);
	});

	it('glisser de fichiers sur l\'éditeur : invisible pour les zones de dépôt englobantes (Bigup sur #contenu)', () => {
		const instance = monterInstance('Texte', services({ id_document: 7, raccourci: 'doc7' }));
		const vus = [];
		for (const type of ['dragenter', 'dragover', 'dragleave', 'drop']) document.body.addEventListener(type, () => vus.push(type));
		const surface = instance.editor.view.dom;
		glisser(surface, 'dragenter');
		glisser(surface, 'dragover');
		const sortie = new Event('dragleave', { bubbles: true });
		Object.defineProperty(sortie, 'relatedTarget', { value: surface });
		surface.dispatchEvent(sortie);
		glisser(surface, 'drop', [fichier('a.pdf', 'application/pdf')]);
		// dragleave remonte : une zone englobante retire son état de survol quand on entre dans l'éditeur
		expect(vus).toEqual(['dragleave']);
	});

	it('glisser du texte (sans fichier) : laissé à ProseMirror, pas d\'état de survol', () => {
		const instance = monterInstance('Texte', services());
		const vus = [];
		instance.editor.view.dom.addEventListener('dragover', () => vus.push('dragover'));
		const event = new Event('dragover', { bubbles: true, cancelable: true });
		Object.defineProperty(event, 'dataTransfer', { value: { types: ['text/plain'], files: [] } });
		instance.editor.view.dom.dispatchEvent(event);
		// l'événement atteint le contenu (ProseMirror l'annule lui-même) ; l'éditeur ne s'en mêle pas
		expect(vus).toEqual(['dragover']);
		expect(instance.wrapper.classList.contains('tts-editor--depot')).toBe(false);
	});

	it('visuel : deux fichiers à la position du dépôt, dans l\'ordre, un appel chacun', async () => {
		const s = services({ id_document: 1, raccourci: 'doc1' }, { id_document: 2, raccourci: 'doc2' });
		const instance = monterInstance('Avant après', s);
		// jsdom n'a pas de géométrie : posAtCoords simulée au point du dépôt
		instance.editor.view.posAtCoords = () => ({ pos: 6, inside: -1 });
		const event = glisser(instance.editor.view.dom, 'drop', [fichier('a.pdf', 'application/pdf'), fichier('', 'image/png')]);
		expect(event.defaultPrevented).toBe(true);
		await vi.waitFor(() => expect(instance.envois.enCours()).toBe(0));
		expect(s.call.mock.calls.map(([op, , { fichier: f }]) => [op, f.name.replace(/\d{8}-\d{6}/, 'D')])).toEqual([['deposer_document', 'a.pdf'], ['deposer_document', 'capture-D.png']]);
		instance.bridge.flush();
		expect(instance.textarea.value).toBe('Avant<doc1><doc2> après');
	});

	it('visuel : dépôt dans un bloc de code : après le bloc', async () => {
		const instance = monterInstance('<code class="php">\n$a;\n</code>', services({ id_document: 3, raccourci: 'doc3' }));
		instance.editor.view.posAtCoords = () => ({ pos: 3, inside: 0 });
		glisser(instance.editor.view.dom, 'drop', [fichier('a.pdf', 'application/pdf')]);
		await vi.waitFor(() => expect(instance.envois.enCours()).toBe(0));
		instance.bridge.flush();
		expect(instance.textarea.value).toMatch(/<\/code>\n\n<doc3>$/);
	});

	it('source : fichiers après la sélection du textarea', async () => {
		const instance = monterInstance('Texte', services({ id_document: 4, raccourci: 'doc4' }), { mode: 'source' });
		instance.textarea.setSelectionRange(0, 3);
		const event = glisser(instance.textarea, 'drop', [fichier('a.pdf', 'application/pdf')]);
		expect(event.defaultPrevented).toBe(true);
		await vi.waitFor(() => expect(instance.envois.enCours()).toBe(0));
		expect(instance.textarea.value).toBe('Tex<doc4>te');
	});

	it('refus (type, services absents ou indisponibles) : preventDefault quand même, message, rien envoyé', () => {
		const s = services();
		const instance = monterInstance('Texte', s);
		const exe = glisser(instance.editor.view.dom, 'drop', [fichier('setup.exe', 'application/x-msdownload')]);
		expect(exe.defaultPrevented).toBe(true);
		expect(instance.etat.message.textContent).toBe('Type de fichier non accepté : setup.exe.');
		instance.services = null;
		expect(glisser(instance.editor.view.dom, 'dragover').defaultPrevented).toBe(true);
		expect(glisser(instance.editor.view.dom, 'drop', [fichier('a.pdf', 'application/pdf')]).defaultPrevented).toBe(true);
		expect(instance.etat.message.textContent).toBe('L’ajout de fichiers n’est pas disponible ici.');
		instance.services = { ...services(), depot: () => null };
		glisser(instance.editor.view.dom, 'drop', [fichier('a.pdf', 'application/pdf')]);
		expect(instance.etat.message.textContent).toBe('L’ajout de fichiers n’est pas disponible ici.');
		expect(s.call).not.toHaveBeenCalled();
	});

	it('mode source d\'un textarea .uploader (Crayons) : rien n\'est fait, l\'événement continue', () => {
		const instance = monterInstance('Texte', services(), { mode: 'source', classe: 'uploader' });
		const vus = [];
		instance.textarea.addEventListener('drop', (e) => vus.push(e.defaultPrevented));
		const survol = glisser(instance.textarea, 'dragover');
		const depot = glisser(instance.textarea, 'drop', [fichier('a.pdf', 'application/pdf')]);
		expect([survol.defaultPrevented, depot.defaultPrevented]).toEqual([false, false]);
		expect(vus).toEqual([false]);
		expect(instance.wrapper.classList.contains('tts-editor--depot')).toBe(false);
		expect(instance.envois.enCours()).toBe(0);
	});

	it('mode source d\'un textarea .uploader : passage par la barre d\'outils puis dépôt sur le textarea, état de survol retiré', () => {
		const instance = monterInstance('Texte', services(), { mode: 'source', classe: 'uploader' });
		const { wrapper, textarea } = instance;
		const barre = wrapper.querySelector('.tts-toolbar');
		const vus = [];
		textarea.addEventListener('dragenter', (e) => vus.push(['dragenter', e.defaultPrevented]));
		textarea.addEventListener('drop', (e) => vus.push(['drop', e.defaultPrevented]));
		glisser(barre, 'dragenter');
		glisser(barre, 'dragover');
		expect(wrapper.classList.contains('tts-editor--depot')).toBe(true);
		// dragleave de la barre vers le textarea : déplacement interne, l'état reste
		const sortie = new Event('dragleave', { bubbles: true });
		Object.defineProperty(sortie, 'relatedTarget', { value: textarea });
		barre.dispatchEvent(sortie);
		const entree = glisser(textarea, 'dragenter');
		expect(wrapper.classList.contains('tts-editor--depot')).toBe(false);
		expect(wrapper.dataset.ttsDepot).toBeUndefined();
		glisser(textarea, 'dragover');
		const depot = glisser(textarea, 'drop', [fichier('a.pdf', 'application/pdf')]);
		expect([entree.defaultPrevented, depot.defaultPrevented]).toEqual([false, false]);
		expect(vus).toEqual([['dragenter', false], ['drop', false]]);
		expect(wrapper.classList.contains('tts-editor--depot')).toBe(false);
		expect(instance.envois.enCours()).toBe(0);
	});

	it('mode source d\'un textarea .uploader, dépôt ailleurs dans la zone : traité par l\'éditeur', async () => {
		const instance = monterInstance('Texte', services({ id_document: 6, raccourci: 'doc6' }), { mode: 'source', classe: 'uploader' });
		instance.textarea.setSelectionRange(5, 5);
		const barre = instance.wrapper.querySelector('.tts-toolbar');
		expect(glisser(barre, 'dragover').defaultPrevented).toBe(true);
		expect(glisser(barre, 'drop', [fichier('a.pdf', 'application/pdf')]).defaultPrevented).toBe(true);
		await vi.waitFor(() => expect(instance.envois.enCours()).toBe(0));
		expect(instance.textarea.value).toBe('Texte<doc6>');
	});

	it('visuel d\'un textarea .uploader : Tiptap traite le dépôt', async () => {
		const instance = monterInstance('Texte', services({ id_document: 5, raccourci: 'doc5' }), { classe: 'uploader' });
		instance.editor.commands.setTextSelection(6);
		expect(glisser(instance.editor.view.dom, 'drop', [fichier('a.pdf', 'application/pdf')]).defaultPrevented).toBe(true);
		await vi.waitFor(() => expect(instance.envois.enCours()).toBe(0));
		instance.bridge.flush();
		expect(instance.textarea.value).toBe('Texte<doc5>');
	});
});
