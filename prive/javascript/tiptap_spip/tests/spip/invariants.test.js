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
