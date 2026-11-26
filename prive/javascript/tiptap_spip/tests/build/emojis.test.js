import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { copierCatalogueEmojis } from '../../scripts/emojis.mjs';

const temporaires = [];
const preparer = (version = '1.8.0') => {
	const racine = mkdtempSync(join(tmpdir(), 'tts-emojis-')); temporaires.push(racine);
	const modules = join(racine, 'node_modules'); const destination = join(racine, 'livraison');
	const paquet = join(modules, 'emoji-picker-element-data');
	mkdirSync(join(paquet, 'en/emojibase'), { recursive: true });
	writeFileSync(join(paquet, 'package.json'), JSON.stringify({ version }));
	writeFileSync(join(paquet, 'en/emojibase/data.json'), '[{"emoji":"❤️","shortcodes":["heart"]}]\n');
	return { modules, destination, paquet };
};
afterEach(() => temporaires.splice(0).forEach((p) => rmSync(p, { recursive: true, force: true })));
it('copie le JSON sans transformation et dérive le manifeste de la version installée', () => {
	const o = preparer(); const m = copierCatalogueEmojis(o);
	expect(m).toEqual({ version: '1.8.0', locale: 'en-tiptap-spip-1.8.0', fichier: '1.8.0/en-emojibase.json' });
	expect(readFileSync(join(o.destination, m.fichier))).toEqual(readFileSync(join(o.paquet, 'en/emojibase/data.json')));
	expect(JSON.parse(readFileSync(join(o.destination, 'manifest.json')))).toEqual(m);
});
it('une autre version produit un chemin et une base cohérents, retire uniquement les anciennes données générées', () => {
	const o = preparer(); copierCatalogueEmojis(o);
	writeFileSync(join(o.destination, 'voisin.txt'), 'conserver');
	mkdirSync(join(o.destination, '2.0.0')); writeFileSync(join(o.destination, '2.0.0', 'autre.txt'), 'conserver');
	symlinkSync(o.paquet, join(o.destination, '3.0.0'));
	writeFileSync(join(o.paquet, 'package.json'), JSON.stringify({ version: '1.9.2' }));
	const m = copierCatalogueEmojis(o);
	expect(m).toEqual({ version: '1.9.2', locale: 'en-tiptap-spip-1.9.2', fichier: '1.9.2/en-emojibase.json' });
	expect(existsSync(join(o.destination, '1.8.0'))).toBe(false);
	for (const p of ['voisin.txt', '2.0.0/autre.txt', '3.0.0/package.json']) expect(existsSync(join(o.destination, p))).toBe(true);
});
it('un échec de lecture ne détruit ni le manifeste ni la version livrée', () => {
	const o = preparer(); const m = copierCatalogueEmojis(o);
	writeFileSync(join(o.paquet, 'package.json'), JSON.stringify({ version: '1.9.0' }));
	rmSync(join(o.paquet, 'en/emojibase/data.json'));
	expect(() => copierCatalogueEmojis(o)).toThrow();
	expect(JSON.parse(readFileSync(join(o.destination, 'manifest.json')))).toEqual(m);
	expect(existsSync(join(o.destination, m.fichier))).toBe(true);
});
it('refuse un chemin de version ou une destination de version détournés', () => {
	const o = preparer('../etranger'); expect(() => copierCatalogueEmojis(o)).toThrow();
	writeFileSync(join(o.paquet, 'package.json'), JSON.stringify({ version: '1.8.0' }));
	mkdirSync(o.destination); symlinkSync(o.paquet, join(o.destination, '1.8.0'));
	expect(() => copierCatalogueEmojis(o)).toThrow();
	expect(existsSync(join(o.paquet, 'en-emojibase.json'))).toBe(false);
});
it('livre exactement les octets du paquet de données réellement installé', () => {
	const o = preparer();
	const modules = new URL('../../node_modules/', import.meta.url).pathname;
	const m = copierCatalogueEmojis({ modules, destination: o.destination });
	expect(readFileSync(join(o.destination, m.fichier))).toEqual(readFileSync(join(modules, 'emoji-picker-element-data/en/emojibase/data.json')));
	expect(m.version).toBe(JSON.parse(readFileSync(join(modules, 'emoji-picker-element-data/package.json'))).version);
});
