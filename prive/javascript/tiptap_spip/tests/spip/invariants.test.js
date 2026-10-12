import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fichiersCorpus } from '../../scripts/corpus.mjs';
import { canon, parse, serialize } from '../../src/spip/index.js';

// corpus versionné + corpus local optionnel (TTS_CORPUS=/chemin, jamais commité)
const dirs = [fileURLToPath(new URL('../../../../../tests/corpus/', import.meta.url)), process.env.TTS_CORPUS].filter(Boolean);
const files = dirs.flatMap((dir) => fichiersCorpus(dir).map((f) => join(dir, f)));

describe.each(files)('%s', (file) => {
	const source = readFileSync(file, 'utf8');

	it('identité : un texte non modifié est restitué caractère pour caractère', () => {
		expect(serialize(parse(source))).toBe(source);
	});

	it('idempotence de la forme canonique', () => {
		const once = serialize(parse(source), { conservative: false });
		expect(serialize(parse(once), { conservative: false })).toBe(once);
	});

	it('stabilité du JSON : la forme canonique re-parsée redonne le même JSON', () => {
		const doc = parse(source);
		expect(canon(parse(serialize(doc, { conservative: false })).content)).toBe(canon(doc.content));
	});
});

// gros texte (spec 08 §1, cas pathologiques) : le corpus versionné concaténé jusqu'à 200 Ko, produit ici
// plutôt que versionné
describe('texte de 200 Ko', () => {
	const morceaux = files.filter((f) => !process.env.TTS_CORPUS || !f.startsWith(process.env.TTS_CORPUS)).map((f) => readFileSync(f, 'utf8'));
	let source = '';
	for (let k = 0; source.length < 200_000; k++) source += `${morceaux[k % morceaux.length]}\n\n`;

	it('totalité, identité et idempotence canonique', () => {
		expect(source.length).toBeGreaterThanOrEqual(200_000);
		const doc = parse(source);
		expect(serialize(doc)).toBe(source);
		const once = serialize(doc, { conservative: false });
		expect(serialize(parse(once), { conservative: false })).toBe(once);
	});
});
