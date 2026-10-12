import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { fichiersCorpus } from '../../scripts/corpus.mjs';

let dossier;
afterEach(() => dossier && rmSync(dossier, { recursive: true, force: true }));

describe('fichiersCorpus', () => {
	it('liste les .spip des sous-dossiers, chemins relatifs triés avec /', () => {
		dossier = mkdtempSync(join(tmpdir(), 'corpus-'));
		mkdirSync(join(dossier, 'b/c'), { recursive: true });
		mkdirSync(join(dossier, 'a'));
		for (const f of ['z.spip', 'a/y.spip', 'b/c/x.spip', 'b/w.spip', 'notes.txt', 'ecarts/d.diff']) {
			mkdirSync(join(dossier, f, '..'), { recursive: true });
			writeFileSync(join(dossier, f), '');
		}
		expect(fichiersCorpus(dossier)).toEqual(['a/y.spip', 'b/c/x.spip', 'b/w.spip', 'z.spip']);
	});
});
