// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { corrigerExtension, trierDepot } from '../../src/editor/deposer.js';

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
