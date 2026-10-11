# Notes, glossaire et abréviations dans le cœur (lot L3.1) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** le parseur et le sérialiseur reconnaissent les notes `[[…]]`, `[[<nom>…]]`, `[[<>…]]`, les termes de glossaire `[?terme#glossaireN|bulle{lang}]` et les abréviations `[ABBR|explication{lang}]`, que les lots précédents gardaient bruts, et l'éditeur les affiche sous forme compacte (appels de note numérotés), sans perte et avec un rendu SPIP identique, contenu des notes compris.

**Architecture :** `protect.js` suit l'ordre réel du core (glossaire et ancres dans `pre_liens`, puis liens et modèles, puis notes, puis la wheel) et cherche notes, glossaire et ancres sans tenir compte des échappements `\[` `\]`, qui ne les protègent pas ; `notes.js` reconnaît une note comme `traiter_raccourci_notes()` et analyse son contenu avec `parse()` (carte de segments comprise : un contenu de note non modifié est restitué à l'identique même si le paragraphe qui la contient change) ; `glossary.js` et `abbr.js` découpent les raccourcis comme `traiter_raccourci_glossaire()` et la règle `abbr` de la wheel ; le sérialiseur écrit le contenu des notes en contexte de note (`]` → `\]`) et ne pose une mark glossaire ou abréviation que si son raccourci se relit à l'identique. Côté éditeur, un nœud `spipNote` (contenu JSON en attribut), deux marks, un plugin de décorations pour la numérotation.

**Tech Stack :** inchangée (Tiptap 3.31.4, Vitest 3.2.4, Playwright 1.61.0, oracle `propre()` de SPIP 4.4.21).

**Découpage du lot L3 :** L3.1 (ce plan) cœur, schéma et affichage compact ; L3.2 services et interface (opération `glossaire` du formulaire CVT, popover de note avec sous-éditeur, panneau des notes, popovers glossaire et abréviation, commandes, raccourcis clavier et règles de saisie).

## Global Constraints

- Mêmes contraintes que les lots précédents : `src/spip/` sans Tiptap ni DOM, `parse()` sans exception (construction non représentable → `spipRawInline`), identité caractère pour caractère d'un texte non modifié, commentaires en français, tabulations, commits sans trailer.
- Comportements du core vérifiés avec `propre()` pendant la préparation (ne pas « corriger ») :
  - ordre de `propre()` : `echappe_html` → `pre_liens` (`traiter_raccourci_glossaire`, `traiter_raccourci_ancre`) → collecteur de liens et modèles → notes (`traiter_raccourcis`, avant la wheel) → wheel (abréviations, échappements `\x`, typographie) ;
  - `[[note->art1]]` est un lien entre crochets, pas une note (les liens passent avant) ;
  - `\[` ne protège ni une note (`x\[[n]]`), ni un terme de glossaire (`x\[?SPIP]`), ni une ancre (`\[#a<-]`) : le `\` disparaît au rendu (il précède alors une balise) ; il protège un lien (`\[a->b]`) et une abréviation (`\[A|b]`) ;
  - `[[a\]]` est une note de texte `a\` ; `[[a\]b]]` une note de texte `a]b` (l'échappement est traité dans le texte de la note) ;
  - note nommée : `<nom>` en tête, sauf si le texte contient `</nom>` sans `<nom…>` avant (`[[<i>x</i> y]]` est une note automatique) ; `[[<>b]]` : note sans appel ; deux notes de même nom gardent chacune leur texte ;
  - l'espace avant l'appel de note est supprimé (`rtrim`) : `mot [[n]]` se rend `mot[1]` ;
  - `propre()` ne rend que les appels ; le texte des notes est accumulé et rendu par `#NOTES` : l'oracle d'équivalence doit l'ajouter à sa sortie ;
  - `[?SPIP|bulle#mots12]` et `[?SPIP#mots12|bulle]` donnent le même rendu ; `[? SPIP]`, `[??SPIP]` aussi que `[?SPIP]` ; `[?S{P}]` rend `S<i>P</i>`.
- Formes non représentables gardées brutes (`spipRawInline`, rendu identique) : terme de glossaire ou texte d'abréviation qui ne s'écrit pas tel quel (accolades, entités, balises, `~`, `\`), raccourci qui ne se relit pas à l'identique depuis ses attributs (`[? SPIP]`, `[?SPIP|b#x]`), glossaire ou abréviation dans le texte d'un lien, note dont le contenu a d'autres blocs que paragraphes, listes et modèles seuls, note nommée dont le nom n'est pas fait de lettres, chiffres, `_` et `-` alors que le texte contient `</nom>` (la regex PHP n'est pas échappée).
- Sérialisation d'une mark glossaire ou abréviation créée dans l'éditeur : elle ne couvre qu'un texte sans lien ni code ; si plusieurs textes voisins la portent avec des marks différentes, ils sont fusionnés avec les seules marks communes ; si le raccourci écrit ne se relit pas à l'identique, la mark est abandonnée et le texte écrit normalement (l'interface du lot L3.2 empêche ces saisies).

## Structure des fichiers

| Fichier | Responsabilité |
|---------|----------------|
| `tests/equivalence/propre.php` | ajoute le texte des notes (`inc_notes([])`) au rendu |
| `prive/javascript/tiptap_spip/src/spip/protect.js` | ordre du core ; notes, glossaire et ancres cherchés sans les échappements ; `\` avant l'un d'eux → région brute |
| `prive/javascript/tiptap_spip/src/spip/notes.js` | `parseNote(src)` |
| `prive/javascript/tiptap_spip/src/spip/glossary.js` | `parseGlossary(src)`, `serializeGlossary(term, attrs)` |
| `prive/javascript/tiptap_spip/src/spip/abbr.js` | `parseAbbr(src)`, `serializeAbbr(text, attrs)` |
| `prive/javascript/tiptap_spip/src/spip/inline.js` | jetons note, glossaire, abréviation |
| `prive/javascript/tiptap_spip/src/spip/json.js` | `MARK_ORDER` : `spipAbbr`, `spipGlossary` avant `code` |
| `prive/javascript/tiptap_spip/src/spip/serialize.js` | contexte (conservatif, note) ; `spipNote` ; marks glossaire et abréviation ; `]` en contexte de note |
| `prive/javascript/tiptap_spip/src/editor/extensions.js` | nœud `spipNote`, marks `spipGlossary`, `spipAbbr`, numérotation |
| `css/tiptap_spip.css` | affichage compact |
| `tests/corpus/notes.spip`, `glossaire.spip` | corpus |
| `docs/specs/04`, `05`, `08`, `09` | ordre réel, échappements, oracle, découpage |

---

### Task 1 : oracle avec le texte des notes

**Files:** Modify `tests/equivalence/propre.php`.

- [ ] **Step 1 :** après `propre()`, ajouter le texte des notes accumulé, séparé par un commentaire :

```php
$html = propre(stream_get_contents(STDIN));
// le texte des notes n'est pas dans propre() : SPIP l'accumule pour #NOTES
$notes = charger_fonction('notes', 'inc', true);
$bas = $notes ? (string) $notes([]) : '';
echo $html . ($bas === '' ? '' : "\n<!-- notes -->\n" . $bas);
```

- [ ] **Step 2 :** `SPIP_ROOT=… npm run equivalence` : résultat inchangé (aucune note reconnue jusqu'ici, la source brute est restituée).
- [ ] **Step 3 :** commit `test(equivalence): l'oracle rend aussi le texte des notes`.

### Task 2 : ordre du core et échappements dans `protect.js`

**Files:** Modify `src/spip/protect.js` ; Test `tests/spip/protect.test.js`.

**Interfaces :** Produces : régions `note` `{ }`, `glossary` `{ }`, `anchor` `{ name }` cherchées sans les échappements ; région `raw` pour un `\` dont l'échappement chevauche le début de l'une d'elles.

- [ ] **Step 1 : tests qui échouent** (`describe('ordre du core et échappements')`) :
  - `[[note->art1]]` → régions `link` seulement (1 à 13), pas de `note` ;
  - `x\[[n]]` → `raw` (1–2, `\`) puis `note` (2–7) ;
  - `x\[?SPIP]` → `raw` puis `glossary` ; `\[#a<-]` → `raw` puis `anchor` de nom `a` ;
  - `[[a\]]` → une seule région `note` (0–6) ; `[[a\]b]]` → `note` (0–8) ;
  - `\[a->b]` → `escape` (pas de lien) ; `\[A|b]` → `escape` (pas d'abréviation) ;
  - `[[voir [a->b] et [?x]]]` → une région `note` qui absorbe `link` et `glossary`.
- [ ] **Step 2 : implémenter.** Les échappements de l'étape 3 portent `data.raccourci = true`. `scanSansEchappements(regex, onMatch)` cherche sur le texte masqué où ces échappements sont rétablis depuis la source ; avant `add()`, un échappement qui chevauche le début du raccourci est remplacé par une région `raw` réduite à son `\` (le caractère suivant est rendu au texte masqué). Ordre de l'étape 4 : modèles, glossaire, ancres, liens, notes, abréviations, multi, idiomes.
- [ ] **Step 3 :** `npx vitest run` vert (corpus : identité, idempotence, stabilité) ; commit `fix(spip): ordre du core pour notes, glossaire et ancres, que \[ ne protège pas`.

### Task 3 : glossaire et abréviations

**Files:** Create `src/spip/glossary.js`, `src/spip/abbr.js` ; Modify `src/spip/inline.js`, `src/spip/json.js`, `src/spip/serialize.js` ; Test `tests/spip/glossaire.test.js` ; Create `tests/corpus/glossaire.spip`.

**Interfaces :**
- `parseGlossary(src)` → `{ term, attrs: { glossaire, numero, bulle, hreflang } } | null`, découpage de `_RACCOURCI_GLOSSAIRE` puis `_RACCOURCI_GLOSES` puis `parseLinkAtts()` ; `serializeGlossary(term, attrs)` → `[?term#glossaireN|bulle{lang}]`.
- `parseAbbr(src)` → `{ text, attrs: { title, lang } } | null` ; `serializeAbbr(text, attrs)` → `[text|title{lang}]`.
- `MARK_ORDER = ['spipLink', 'bold', 'italic', 'strike', 'superscript', 'subscript', 'spipAbbr', 'spipGlossary', 'code']`.

- [ ] **Step 1 : tests qui échouent :**
  - `[?SPIP]`, `[?SPIP#wikipedia]`, `[?SPIP#mots12]`, `[?SPIP#12]`, `[?SPIP|Système de publication]`, `[?SPIP{fr}]`, `[?SPIP#mots12|bulle{en}]` → texte `SPIP` avec la mark et ses attributs ; identité et forme canonique égale à la source ;
  - bruts : `[? SPIP]`, `[??SPIP]`, `[?SPIP|b#mots]`, `[?S{P}]`, `[?a&amp;b]`, `[?SPIP#]`, `[a [?x] b->art1]` (glossaire dans un lien) ;
  - `[ABBR|explication]`, `[ABBR|explication{fr}]`, `[W3C|World Wide Web <i>Consortium</i>]` → mark `spipAbbr` ; bruts : `[{A}|b]`, `[A~B|c]`, `[a [B|c] d->art1]` ;
  - imbrication : `{{[?SPIP]}}` et `{[ABBR|x]}` → marks `bold`/`italic` + mark ; sérialisation identique ;
  - sérialisation de JSON saisi : terme `SP{IP}` → `SP\{IP\}` sans mark ; deux textes `SP` (gras) + `IP` sous la même mark glossaire → `[?SPIP]` ; glossaire + lien sur le même texte → lien seul ; bulle `a]b` → mark abandonnée.
- [ ] **Step 2 : implémenter.** Dans `inline.js`, une région `glossary` / `abbr` devient un jeton `{ t: 'marked', mark, v }` si le raccourci se relit à l'identique (`serializeX(...) === src`), que le texte s'écrit tel quel (`escapeText(v) === v`) et qu'on n'est pas dans le texte d'un lien ; sinon brut. Dans `serialize.js`, une passe `marksAtomiques(nodes)` applique les règles de la contrainte globale avant l'imbrication ; la validation relit le raccourci écrit avec `parse()` et compare la forme canonique. Le texte sous ces marks est écrit sans échappement (déjà validé).
- [ ] **Step 3 :** corpus `glossaire.spip` ; `npx vitest run` ; équivalence ; commit `feat(spip): glossaire et abréviations`.

### Task 4 : notes

**Files:** Create `src/spip/notes.js` ; Modify `src/spip/inline.js`, `src/spip/serialize.js` ; Test `tests/spip/notes.test.js` ; Create `tests/corpus/notes.spip`.

**Interfaces :** `parseNote(src)` → `{ name: string|null, content: object[], lead: string, trail: string } | null` ; nœud JSON `spipNote { name?, content, spipLead, spipTrail }` (`name` absent = automatique, `""` = sans appel).

- [ ] **Step 1 : tests qui échouent :**
  - `Texte[[Une note.]]`, `[[<A>Nommée]]`, `[[<>Sans appel]]`, `[[<i>x</i> y]]` (automatique), `[[<i>x]]` (nommée `i`), `[[]]`, `[[<A>]]` → `spipNote` et attributs attendus ;
  - contenu analysé : `[[Voir [la doc->art1], {{gras}} et [?SPIP].]]` → paragraphe avec lien, gras, glossaire ; `[[Premier.\n\nSecond.]]` → deux paragraphes ; `[[-* a\n-* b]]` → liste ; `[[<doc1>]]` → `spipModelBlock` ;
  - bruts : `[[{{{titre}}}]]`, `[[<a.b>x</a.b>]]` ;
  - sérialisation : note modifiée dans un paragraphe modifié → contenu non modifié restitué à l'identique (`[[ Premier.\n\n\nSecond.]]` garde ses blancs) ; texte `a]` dans une note → `[[a\]]]` ; `[[a\]b]]` → texte `a]b`, identité ; canonique de `[[\nTexte\n]]` → `[[Texte]]`.
- [ ] **Step 2 : implémenter.** `parseNote` : regex `_NOTES_RACCOURCI` ancrée, règle de la balise fermante, `parse(texte)` pour le contenu (blocs autorisés : `paragraph`, `bulletList`, `orderedList`, `spipModelBlock`). `serialize.js` : un contexte de module `{ conservative, note }` ; `spipNote` → `[[` + `<nom>` + `serialize({ attrs: { spipLead, spipTrail }, content })` + `]]` ; `escapeText` écrit `]` en `\]` en contexte de note (hors texte de lien, déjà en entités).
- [ ] **Step 3 :** corpus `notes.spip` ; `npx vitest run` ; équivalence (contenu des notes compris) ; commit `feat(spip): notes, contenu analysé et restitué à l'identique`.

### Task 5 : schéma et affichage compact

**Files:** Modify `src/editor/extensions.js`, `css/tiptap_spip.css` ; Test `tests/editor/notes.test.js`.

- [ ] **Step 1 : tests qui échouent :** le JSON du corpus passe `check()` et `serialize(editor.getJSON()) === source` (déjà couvert par `roundtrip.test.js` dès que les nouveaux fichiers de corpus existent) ; appels numérotés `[1]`, `[A]`, `[2]`, puce pour `<>` (attribut `data-tts-label`) ; numérotation recalculée après suppression d'une note ; copier-coller interne d'une note (HTML → nœud identique) ; `title` = aperçu texte du contenu.
- [ ] **Step 2 : implémenter.** `SpipNote` : nœud inline atome, attributs `name`, `content` (JSON dans `data-tts-note`), `spipLead`, `spipTrail` (cachés) ; rendu `sup.tts-note` sans texte. Extension `SpipNoteNumbers` : plugin ProseMirror dont l'état recalcule, à chaque changement du document, une décoration de nœud par note (`data-tts-label` = numéro automatique, nom, ou rien pour `<>` ; `aria-label`). Marks `SpipAbbr` (`abbr[title]`) et `SpipGlossary` (`span[data-tts-glossary]`), `inclusive: false`, exclusives avec le lien et le code, déclarées dans l'ordre de `MARK_ORDER`.
- [ ] **Step 3 :** `npx vitest run` ; bundle ; e2e identité sur `notes.spip` et `glossaire.spip` (ajout à `article.e2e.js`) ; commit `feat(editor): notes, glossaire et abréviations dans le schéma, appels numérotés`.

### Task 6 : specs et feuille de route

- [ ] Spec 04 : ordre réel du core et échappements ; spec 05 : `]` → `\]` dans une note, formes gardées brutes ; spec 08 : oracle avec notes ; spec 09 : découpage L3.1 / L3.2. Commit `docs: specs du lot L3.1`.
