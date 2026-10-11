# 04 — Parseur et sérialiseur SPIP

## 1. Pourquoi pas markdown-it

markdown_editor passe par `tiptap-markdown` : markdown-it découpe le texte en tokens, rendus en HTML, que
Tiptap re-parse avec `parseHTML`. Pour SPIP cette chaîne ne convient pas :

- la grammaire SPIP n'est pas CommonMark : `{…}` italique, `-*` listes, `|…|` tableaux, `_ ` sauts de ligne,
  un simple retour à la ligne n'est pas significatif, `[…]` sert à cinq raccourcis différents ;
- passer par le HTML perd l'information de forme (paramètres de modèles, nom de note, cible brute `art12`) ;
- TextWheel applique des règles **ordonnées par priorité** sur la chaîne entière ; il faut reproduire cet
  ordre pour obtenir le même découpage.

On écrit donc un parseur dédié **chaîne → JSON** et un sérialiseur **JSON → chaîne**, sans DOM,
dans `src/spip/` (cf. [02](02-architecture.md) §3). Les regex sont recopiées du core SPIP 4.4
dans `src/spip/regex.js` (source unique, avec référence au fichier PHP d'origine) :

| Constante JS | Origine PHP |
|--------------|-------------|
| `RE_MODELE` | `ecrire/src/Texte/Collecteur/Modeles.php` |
| `RE_LIEN` | `ecrire/src/Texte/Collecteur/Liens.php` (`_RACCOURCI_LIEN`) |
| `RE_LIEN_ATTRIBUTS` | `textwheel/inc/lien.php` (`_RACCOURCI_ATTRIBUTS`) |
| `RE_NOTE` | `textwheel/inc/notes.php` (`_NOTES_RACCOURCI`) |
| `RE_GLOSSAIRE`, `RE_GLOSES` | `textwheel/inc/lien.php` |
| `RE_ANCRE` | `textwheel/inc/lien.php` (`_RACCOURCI_ANCRE`) |
| `RE_MULTI`, `RE_MULTI_LANG` | `ecrire/src/Texte/Collecteur/Multis.php` |
| `RE_IDIOME` | `ecrire/src/Texte/Collecteur/Idiomes.php` |
| `RE_PROTEGE_BLOCS` | `ecrire/inc/texte_mini.php` (`_PROTEGE_BLOCS`) |
| `RE_BACKTICKS_*` | `textwheel/wheels/spip/backticks.yaml` / `backticks.php` |
| `RE_ABBR`, listes, tableaux, intertitres | `textwheel/wheels/spip/*.yaml` |

## 2. Parseur : étapes

Le parseur suit l'ordre de TextWheel. Chaque étape est une **règle enregistrée** dans un registre
(`src/spip/registry.js`) avec une priorité, ce qui permet aux extensions tierces d'en insérer
([07](07-extensibilite.md)).

1. **Normalisation** : `\r\n?` → `\n` ; lignes ne contenant que des blancs → vides. Ces normalisations ne
   servent qu'à l'analyse : la carte de segments (§4) garde la source exacte.
2. **Protection** (priorité la plus basse) — remplacer par des jetons opaques `\u0001N\u0001` :
   - code en backticks, **avant tout** (wheel `pre_echappe_html_propre`) : ```` ``` ```` (bloc, 1re ligne =
     langage éventuel), ``` `` ``` puis `` ` `` (inline) ;
   - blocs `<html>`, `<code>`, `<cadre>`/`<frame>`, `<math>`, `<script>`/`<style>` (`RE_PROTEGE_BLOCS`) ;
   - échappements `\{ \} \_ \- \[ \] \| \< \> \\ \* \# \+ \~` ;
   - modèles (`RE_MODELE`, avec la condition du core : il faut un id **ou** des paramètres commençant
     par `|`, sinon c'est une balise HTML) ;
   - `<multi>…</multi>`, idiomes `<:…:>`.
3. **Découpage en blocs** sur les lignes vides, en reconnaissant :
   - tableau : suite de lignes commençant et finissant par `|` ;
   - liste : lignes commençant par `-*`/`-#` (profondeur = nombre de caractères, type = `*` ou `#`) ;
   - `----` / `____` → `horizontalRule` ;
   - `{{{…}}}` occupant tout le bloc → `heading` niveau 2 ; `<h3>…</h3>` à `<h6>…</h6>` seuls dans le bloc →
     `heading` 3 à 6 (contenu parsé en inline) ;
   - `<div class="text-…">` … `</div>` (classes configurées, aucun autre attribut) → `spipAlign`, contenu parsé
     récursivement ; tout autre `<div>` → `spipRaw` ;
   - `<quote>`, `<poesie>` (blocs conteneurs, parsés récursivement) ;
   - bloc ne contenant qu'un jeton de modèle → `spipModelBlock` ;
   - bloc ne contenant qu'un jeton `<multi>` dont les parties contiennent des lignes vides → `spipMultiBlock` ;
   - sinon `paragraph`.
4. **Inline** dans chaque bloc textuel, dans cet ordre :
   notes `[[…]]` (contenu parsé récursivement) → ancres `[#x<-]` → liens `[…->…]` (texte parsé
   récursivement, attributs via `RE_LIEN_ATTRIBUTS`) → glossaire `[?…]` → abréviations `[A|b]` →
   `{{…}}` / `{…}` (appariement par pile, cf. §3) → HTML inline connu → `_ ` (hardBreak), `-- ` (alinéa),
   `- ` (puce isolée) → texte.
   Un simple `\n` dans un paragraphe devient un espace (comportement SPIP).
5. **Restauration** des jetons protégés en nœuds (`codeBlock`, `spipModel`, `spipMultiInline`…) ou en
   texte littéral (échappements).
6. **Repli** : toute construction non reconnue ou mal formée (accolade orpheline, `[` non fermé
   ressemblant à un raccourci, balise HTML inconnue) devient `spipRawInline` / `spipRaw` avec sa source.

### Appariement des accolades

SPIP remplace `{{`/`}}` puis `{`/`}` **sans vérifier l'appariement** (règles `type: str`). Le parseur
utilise une pile : une paire bien formée produit `bold`/`italic` ; une accolade orpheline produit un
`spipRawInline` contenant `{` ou `}`, pour qu'elle soit restituée et que son effet au rendu (balise
`<i>` non fermée) reste identique — et l'interface la signale comme anomalie (cf. [06](06-interface.md)).

### Tableaux

- 1re ligne de la forme `||légende|résumé||` → attributs `caption`/`summary` de `table`.
- 1re ligne de données dont **toutes** les cellules sont en `{{…}}` → ligne de `tableHeader`
  (le gras est retiré du contenu : il est implicite).
- `|<|` : la cellule fusionne avec sa voisine de gauche (→ `colspan` +1 de la voisine).
  `|^|` : fusion avec la cellule du dessus (→ `rowspan` +1).

## 3. Sérialiseur : règles

Chaque type de nœud/mark déclare sa sérialisation (`renderSpip`, cf. [07](07-extensibilite.md)).
Règles générales :

| Élément | Sortie |
|---------|--------|
| Séparation des blocs | une ligne vide (`\n\n`) |
| `hardBreak` | `\n_ ` |
| `heading` | niveau 2 → `{{{…}}}` ; niveaux 3–6 → `<h3>…</h3>` … `<h6>…</h6>` |
| `spipAlign` | `<div class="text-center">` + ligne vide + blocs + ligne vide + `</div>` (les lignes vides permettent à SPIP de paragrapher le contenu) |
| Listes | `-*`/`-#` répétés selon la profondeur, une ligne par item, pas de ligne vide entre items |
| `bold` / `italic` | `{{…}}` / `{…}` ; bold+italic → `{{{…}}}` **interdit** (confusion avec intertitre) : émettre `{{ {…} }}` |
| `code` | `` `…` `` (comme le porte-plume ; ``` `` ``` si le code contient un backtick) ; `<code>` conservé si c'était la forme d'origine |
| `codeBlock` | ```` ```langage\n…\n``` ```` ; `<code class="lang">` conservé si c'était la forme d'origine ; `spipCadre` → `<cadre>\n…\n</cadre>` |
| `spipLink` | `[texte\|bulle{lang}->cible]` ; `newWindow` → `->>` |
| `spipLinkAuto` | `[->cible]`, `[\|bulle{lang}->cible]` |
| `spipNote` | `[[<nom>contenu]]` ; collée au mot précédent (SPIP supprime l'espace avant l'appel) |
| `spipGlossary` | `[?terme#glossaireN\|bulle{lang}]` |
| `spipModel` | `source` si inchangé, sinon `<name id\|p1\|k=v>` reconstruit |
| `spipRaw*` | `source` tel quel |

### Échappements

Le sérialiseur échappe dans le **texte** ce qui serait interprété comme raccourci :

- toujours : `{`, `}` → `\{`, `\}` ; `[` suivi de `?`, `#`, `[` ou d'une séquence contenant `->`/`<-` → `\[` ;
  `<` suivi de ce qui ressemble à un modèle, `<multi>`, `<:`, une balise protégée, `<hN>` ou `<div` → `\<` ;
- en début de ligne : `-`, `_ `, `|`, `----` → `\-`, `\_`, `\|` ;
- `~` littéral → `\~` (sinon espace insécable) ;
- `` ` `` littéral → `` \` `` ;
- `\` → `\\` seulement quand il précède un caractère échappable.

On n'échappe **que si nécessaire** (minimiser le bruit dans la source).

### Ambiguïtés de collage

Certaines juxtapositions produiraient un autre raccourci : `{{gras}}{italique}` → `{{gras}}{italique}` est
correct, mais `{italique}}` suivi de texte, ou un italique en fin d'intertitre (`{{{Titre {x}}}}`), peuvent
se mal découper. Le sérialiseur dispose d'une table de **séparateurs de sécurité** (espace ou espace
insécable) insérés uniquement quand un test de re-parse détecte une ambiguïté.

## 4. Sérialisation conservatrice

Objectif : ouvrir puis enregistrer un texte non modifié produit **exactement** la source d'origine,
et une modification locale ne réécrit que le bloc concerné (diffs de révisions SPIP lisibles).

**Source de référence** : `textarea.value` au montage de l'éditeur (le navigateur y présente toujours des
fins de ligne `\n` ; la conversion en `\r\n` à la soumission est faite par le navigateur, à l'identique
avec ou sans éditeur, et sort du périmètre).

### Carte de segments

Le parseur découpe la source en segments **contigus couvrant chaque caractère** :

```
source = lead + Σ ( sep_i + bloc_i ) + trail
```

| Segment | Stockage |
|---------|----------|
| `lead` (lignes vides/blancs avant le 1er bloc) | attribut `spipLead` du nœud `doc` |
| `sep_i` (séparateur exact avant le bloc *i* : `\n\n`, `\n\n\n`, espaces…) | attribut `spipSep` du bloc |
| `bloc_i` (source exacte du bloc) | attribut `spipSrc` du bloc, avec `spipHash` (empreinte du JSON canonique issu du parse) |
| `trail` (blancs après le dernier bloc) | attribut `spipTrail` du nœud `doc` |

Le nœud `doc` est étendu (extension `Document`) pour porter ces attributs. Pour le **document vide** (`''`
ou blancs seuls) : aucun bloc source, ProseMirror crée un paragraphe vide ; un `doc` réduit à un paragraphe
vide sans `spipSrc` se sérialise en `lead + trail`, donc la source d'origine.

### Algorithme

1. **Chemin rapide** : si l'empreinte du document entier est égale à celle du parse initial, on renvoie la
   source de référence telle quelle.
2. Sinon, pour chaque bloc de premier niveau : `spipSep` (ou `\n\n` si absent) puis, si l'empreinte du JSON
   courant du bloc est égale à `spipHash`, `spipSrc` ; sinon sa sérialisation normale. Puis `lead` en tête,
   `trail` en fin.
3. `spipSrc`/`spipHash`/`spipSep` ne sont pas rendus en HTML, sont exclus du copier-coller et sont perdus
   quand ProseMirror scinde ou fusionne le bloc (le bloc est alors « modifié »).

Corollaire : les normalisations (simple `\n` → espace, espaces en fin de ligne, forme des modèles)
ne s'appliquent qu'aux blocs effectivement édités.

**Test** : pour toute source du corpus, la concaténation des segments est égale à la source (vérifié avant
même la sérialisation), y compris sources vides, blancs seuls, lignes vides initiales/finales multiples.

## 5. Invariants (testés, cf. [08](08-tests-recette.md))

1. **Identité** : `serialize(parse(s)) === s` pour tout `s` non modifié (via §4).
2. **Idempotence canonique** : sans la conservation (§4 désactivée), `serialize(parse(serialize(parse(s))))
   === serialize(parse(s))`.
3. **Équivalence de rendu** : `propre(s) ≡ propre(serializeCanonique(parse(s)))` (HTML normalisé).
4. **Totalité** : `parse` ne lève jamais d'exception ; au pire il produit des nœuds bruts.
5. **Sûreté du schéma** : tout JSON valide pour le schéma est sérialisable, et son re-parse redonne le même JSON.

## 6. Copier-coller

| Source | Traitement |
|--------|------------|
| Interne (éditeur → éditeur) | HTML ProseMirror avec `data-spip-*` : fidélité totale |
| Texte brut contenant des raccourcis SPIP | Option « coller comme SPIP » (défaut : actif si le texte contient des raccourcis reconnus) → `parse` du fragment |
| HTML externe (Word, LibreOffice, web) | `parseHTML` des extensions, nettoyé par le schéma ; les styles non représentables sont perdus (comportement normal d'un WYSIWYG) |
| Copie vers l'extérieur | `text/plain` = SPIP sérialisé du fragment ; `text/html` = HTML de l'éditeur |
