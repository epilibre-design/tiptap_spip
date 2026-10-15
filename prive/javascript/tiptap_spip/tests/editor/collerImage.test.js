// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { nommer, trierPressePapiers } from '../../src/editor/collerImage.js';

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
