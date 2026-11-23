# Aide `helpers.lignes` — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** une extension tierce peut découper une source en lignes sans couper un code, une note ou un modèle.

**Architecture:** une fonction de `aides.js`, fondée sur les régions de `protect()`. Les zones opaques sont celles que SPIP met de côté avant la wheel ; liens et `<multi>` n'en sont pas (vérifié avec le plugin FAQ, SPIP 4.4.31).

**Tech Stack:** JavaScript, vitest 3.2.4.

## Global Constraints

- Commits sans trailer. Ne pas committer la modification de `.gitignore` déjà présente.
- Pas de changement de branche pendant un e2e : les sites jetables lisent ce dépôt.
- Bundles reconstruits ; entrée CHANGELOG `[Non publié]` dans la même branche.

---

### Task 1: `helpers.lignes`

**Files:**
- Modify: `prive/javascript/tiptap_spip/src/spip/aides.js`
- Test: `prive/javascript/tiptap_spip/tests/spip/aides.test.js` (nouveau)
- Modify: `docs/specs/07-extensibilite.md:43` et `:112`, `CHANGELOG.md`
- Modify (construits): `prive/javascript/tiptap_spip.js`, `prive/javascript/tiptap_spip.min.js`

**Interfaces:**
- Produces: `helpers.lignes(source: string): string[]`, avec `lignes(s).join('\n') === s`

- [ ] **Step 1: branche et test**

```bash
cd /src/tiptap-spip && git switch -c helpers-lignes
```

```js
// tests/spip/aides.test.js
import { describe, expect, it } from 'vitest';
import { aides } from '../../src/spip/aides.js';

describe('aides.lignes', () => {
	it.each([
		['vide', '', ['']],
		['lignes vides gardées', 'a\n\nb\n', ['a', '', 'b', '']],
		['CRLF : \\r gardé', 'a\r\nb', ['a\r', 'b']],
		['code', 'x\n<code>\n? p\n</code>\ny', ['x', '<code>\n? p\n</code>', 'y']],
		['backticks', '```\n? p\n```\nb', ['```\n? p\n```', 'b']],
		['note', 'R[[n\n? x]]\nf', ['R[[n\n? x]]', 'f']],
		['modèle', 'R <emb1|titre=a\n? b>\nf', ['R <emb1|titre=a\n? b>', 'f']],
		['lien : coupé', '[l\n? s->http://a.b]', ['[l', '? s->http://a.b]']],
		['multi : coupé', '<multi>[fr]a\n? b</multi>', ['<multi>[fr]a', '? b</multi>']],
	])('%s', (_, source, attendu) => {
		expect(aides.lignes(source)).toEqual(attendu);
		expect(aides.lignes(source).join('\n')).toBe(source);
	});
});
```

- [ ] **Step 2: échec attendu** — `cd prive/javascript/tiptap_spip && npx vitest run tests/spip/aides.test.js` → `aides.lignes is not a function`

- [ ] **Step 3: implémentation**, avant `export const aides` :

```js
/** Zones que SPIP met de côté avant la wheel : un saut de ligne n'y sépare pas deux lignes. */
const OPAQUES = new Set(['block', 'backtick', 'note', 'model']);

function lignes(source) {
	const zones = protect(source).regions.filter((r) => OPAQUES.has(r.kind) || (r.kind === 'extension' && r.data.echappe));
	const out = [];
	let debut = 0;
	for (let i = source.indexOf('\n'); i >= 0; i = source.indexOf('\n', i + 1)) {
		if (zones.some((z) => z.start <= i && i < z.end)) continue;
		out.push(source.slice(debut, i));
		debut = i + 1;
	}
	out.push(source.slice(debut));
	return out;
}
```

et dans `aides`, après `parseInline` :

```js
	/** Source → lignes, sans couper un code, une note ou un modèle ; jointes par \n, elles redonnent la source. */
	lignes,
```

- [ ] **Step 4:** même commande → 9 tests réussis ; puis `npm test` (toute la suite).

- [ ] **Step 5: documentation** — ajouter `lignes` aux deux listes d'aides de la spec 07, et au CHANGELOG :

```markdown
## [Non publié]

### Ajouté

- Extensions tierces : l'aide `helpers.lignes` découpe une source en lignes sans couper un code, une
  note ou un modèle.
```

- [ ] **Step 6: bundles et commit**

```bash
npm run build && cd /src/tiptap-spip
git add CHANGELOG.md docs/specs/07-extensibilite.md docs/superpowers prive/javascript/tiptap_spip.js prive/javascript/tiptap_spip.min.js prive/javascript/tiptap_spip/src/spip/aides.js prive/javascript/tiptap_spip/tests/spip/aides.test.js
git commit -m "Donner aux extensions tierces une aide de découpage en lignes"
```

Push et demande de fusion : après accord.
