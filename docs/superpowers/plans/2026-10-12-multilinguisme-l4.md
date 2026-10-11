# Multilinguisme (lot L4) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** éditer un texte multilingue (`<multi>` en ligne et en bloc, idiomes `<:module:cle:>`) sans perte, avec un rendu SPIP identique dans **chaque** langue.

**Découpage :**
- **L4.1 :** cœur, schéma et affichage.
- **L4.2 :** interface. Elle couvre :
  - un sélecteur de la langue affichée par les multis en ligne et bloc (barre), qui remplace les onglets de la spec 05 §5 ;
  - les traductions des idiomes (opération `idiomes`) ;
  - le popover de multi en ligne (sous-éditeur par langue) ;
  - l'insertion d'un multi ;
  - l'ajout, le retrait et la langue des parties d'un multi bloc ;
  - l'édition du raccourci d'un idiome.

**Architecture :**
- **Ordre de traitement du core (vérifié avec l'oracle) :**
  - `<multi>` et idiomes sont traités dans `typo()`, après tous les autres raccourcis : liens, notes, gras et le reste d'un multi sont donc rendus normalement.
  - `protect.js` cherche le multi sur le texte masqué, où ces raccourcis sont déjà remplacés.
  - Les marqueurs de langue `[xx]` se cherchent dans ce même texte masqué (`Multis::extraire_trads()`).
  - Une première partie sans marqueur n'existe que si elle n'est pas vide.
- **Multi en ligne (`spipMultiInline`) : atome inline**, attribut `parts: [{ lang, content }]`, où `content` est le contenu inline analysé de la partie. Choix qui s'écarte de la spec 03 : les nœuds inline à contenu de ProseMirror sont peu fiables à l'édition. Comme une note, le multi s'édite dans un popover (L4.2). Restitution à l'identique : `spipSrc` et `spipHash` (forme canonique des parties). Un multi dont les parties n'ont pas changé est réécrit tel quel, même si son paragraphe change.
- **Multi bloc (`spipMultiBlock` > `spipLangBlock` > `paragraph+`) :** un multi seul dans son segment, dont une partie contient une ligne vide. Chaque partie est analysée avec `parse()` et ne doit donner que des paragraphes, sinon le multi reste brut. Le multi est un bloc de premier niveau, avec sa carte de segments.
- **Idiome (`spipIdiome`) :** atome, attributs `module` (null si absent) et `cle`.
- **Échappement dans une partie :** `[` suivi d'un code de langue et de `]` s'écrit `\[`. L'échappement `\[` passe avant `typo()`, donc il protège.
- **Oracle :** `propre()` dans chaque langue citée par un `<multi>`, notes remises à zéro entre les langues.

**Tech Stack :** inchangée.

## Global Constraints

- Contraintes des lots précédents : `src/spip/` sans Tiptap ni DOM, `parse()` sans exception, identité caractère pour caractère, commentaires en français, commits sans trailer.
- **Codes de langue :** regex du core `[a-z]{2,3}(_[a-z]{2,3}){0,2}`, sans tenir compte de la casse (`Multis::extraire_trads()`).
- **Gardés bruts :**
  - un multi dont une partie contient une ligne vide, sauf s'il est seul dans son segment ;
  - un multi bloc dont une partie n'est pas faite que de paragraphes.

## Tâches L4.1

1. **`src/spip/multi.js` :**
   - `parseMulti(src, masked)` renvoie `[{ lang, start, end }]` (positions relatives au raccourci), ou null si un marqueur est caché dans un raccourci traité avant ;
   - `RE_LANGUE_MULTI` dans `regex.js`.
   - Tests : marqueurs, partie initiale vide ou non, marqueur dans un lien masqué, casse.
2. **Analyse et sérialisation :**
   - `inline.js` : jeton `spipMultiInline` ;
   - `blocks.js` : `spipMultiBlock` ;
   - jeton idiome `spipIdiome` ;
   - `serialize.js` : multi en ligne (source conservée si inchangé), multi bloc, idiome, échappement `[xx]` en contexte multi.
   - Tests d'identité et de forme canonique ; corpus `multi.spip` ; équivalence dans toutes les langues.
3. **Schéma et affichage :**
   - nœuds Tiptap ;
   - multi en ligne affiché dans la langue de l'interface (sinon la première partie), avec les autres langues en infobulle et un badge de langue ;
   - multi bloc : parties empilées avec leur langue en badge ;
   - idiome : puce `<:module:cle:>`.
   - Tests jsdom ; copier-coller interne.
4. **Specs 03, 04, 05 et 08 ; e2e d'identité** (`multi.spip` dans la liste de `article.e2e.js`).
