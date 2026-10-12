# Interface (lot L5) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** une interface complète et accessible (spec 06), sous les critères 6, 7 et 8 de la spec 08.

**Découpage :**
- **L5.1 :** barres d'outils.
  - Registre de composants et barres `edition`, `forum`, `minimale` déclarées côté PHP (pipeline `tiptap_spip_toolbars`).
  - Tous les outils de la barre `edition` (spec 06 §2).
  - Menus accessibles, roving tabindex.
  - Raccourcis clavier manquants, plein écran, mode mémorisé.
- **L5.2 :** anomalies et popovers.
  - Signalement des nœuds bruts issus d'un raccourci cassé, barre d'état (mots, anomalies).
  - Popover du nœud brut (source éditable, validation par relecture, « convertir »).
  - Piège de focus des popovers (reporté depuis L3.2).
  - Nœuds atomiques annoncés, audit axe (critère 7).
- **L5.3 :** configuration et recette.
  - Page CFG `configurer_tiptap_spip`, qui remplace les métas posées à la main.
  - Options :
    - public ;
    - crayons ;
    - objets et champs ;
    - mode par défaut ;
    - niveaux d'intertitres ;
    - modèles masqués ;
    - glossaires.
  - Contrôle i18n : chaque libellé de `labels.js` est présent dans le fichier de langue et dans la config JS.
  - Mesure du critère 6 en e2e. Critère 8 : projets Playwright Firefox et WebKit ; les sites SPIP 4.2 et 5 restent à fournir.

**Architecture L5.1 :**
- **Une seule déclaration des barres : `src/ui/barres.json`.**
  - Le bundle l'importe (esbuild sait importer du JSON).
  - PHP la lit (`tiptap_spip_barres()`), la passe au pipeline `tiptap_spip_toolbars` et la transmet par la config JS (`spipConfig.tiptap_spip.toolbars`). Le JS prend celle de la config, sinon celle du bundle.
  - Une barre est une liste de noms de composants (`'|'` : séparateur), ou d'objets `{ "composant": nom, …options }`.
  - Pas de libellés dans la déclaration : chaque composant prend les siens dans `labels.js` (règle i18n du projet). Un plugin ajoute un composant par `Toolbar.registerComponent` (L6) et son nom dans la barre par le pipeline.
- **Choix de la barre (spec 02 §6, « Barre d'outils par hôte ») :**
  - d'abord `data-tts-toolbar`, puis la classe `inserer_barre_edition` ou `inserer_barre_forum` ;
  - sinon : `forum` dans un formulaire de forum (`.formulaire_forum`), `edition` pour les champs `texte` et `chapo`, `minimale` pour les autres.
  - Une barre inconnue donne `minimale`.
- **Composant :** une fabrique `(ctx, options) => { element, maj?(), source? }`, avec `ctx = { editor, ui, instance }`.
  - La barre appelle `maj()` à chaque transaction et à chaque changement de mode.
  - En mode source, les composants sans `source: true` sont désactivés (seuls `source` et `pleinEcran` restent actifs).
- **Icônes :** SVG de Remix Icon (Apache-2.0), extraits par `scripts/icones.mjs` (dépendance de développement `remixicon`) dans `src/ui/icones.js`, versionné.
  - Pas de police : celle de markdown_editor n'a ni exposant, ni tableau, ni alignement, et son préfixe `sp-icone_` entrerait en conflit.
  - Le libellé traduit est porté par `aria-label` et `title` (avec le raccourci).
- **Accessibilité (spec 06 §7) :**
  - barre `role="toolbar"`, roving tabindex : un seul élément tabulable, `←`/`→`/`Début`/`Fin`, les éléments désactivés sautés ;
  - boutons bascules avec `aria-pressed` ;
  - menus : bouton `aria-haspopup="menu"` / `aria-expanded`, liste `role="menu"`, éléments `menuitem` (`menuitemradio` + `aria-checked` pour les choix exclusifs), `↑`/`↓`, `Échap` qui rend le focus au bouton.
- **Plein écran : CSS** (`.tts-editor--plein-ecran`, position fixe), pas l'API Fullscreen de markdown_editor.
  - Avec l'API, seul l'élément en plein écran est affiché : la modalbox des modèles, posée dans `body`, serait cachée, ce que la spec 06 §3 exclut.
  - `F11` dans l'éditeur bascule, `Échap` sort (sauf popover ou menu ouvert, qui se ferme d'abord).
- **Mode mémorisé :** `localStorage['tiptap_spip.mode']` (`visual` / `source`), sinon `spipConfig.tiptap_spip.mode`, sinon `visual`. Lecture et écriture protégées par try/catch.
- **Commandes d'édition** (nouvelle extension `SpipEdition`, `src/editor/edition.js`) :
  - `setAlignement(align | null)` : entoure les blocs de premier niveau de la sélection d'un `spipAlign`, le modifie ou le retire ;
  - `togglePoesie()` ;
  - `entourer(ouvrant, fermant)` : guillemets autour de la sélection, marks gardées ;
  - `changerCasse('majuscules' | 'minuscules')` : texte de la sélection, marks gardées.

**Tech Stack :** inchangée, plus `remixicon` (développement seulement).

## Global Constraints

- **Contraintes des lots précédents :**
  - commentaires en français, tabulations ;
  - commits sans trailer ;
  - aucune chaîne en dur : chaque libellé dans `labels.js`, `lang/tiptap_spip_fr.php` et `_inits/09_tiptap_spip_config.js.html` ;
  - bundle reconstruit et versionné.
- **Aucun outil ne doit produire un document que le sérialiseur écrit mal.** Pour les tableaux après fusion, ajout ou suppression de lignes, test d'invariant : `parse(serialize(json))` redonne `json`.
- **Guillemets selon la langue** (porte-plume, `barre_outils/edition.php`), langue de l'objet : `closest('[lang]')` du textarea, sinon `<html lang>`.
  - `fr eo cpf ar es` : « » et “ ” ;
  - `bg de pl hr src` : „ “ et ‚ ‘ ;
  - autres langues : “ ” et ‘ ’.
  - Pas d'espace ajoutée : la typographie française de SPIP pose l'espace insécable.

## Tâches L5.1

### Tâche 1 : icônes, barres déclarées, registre

- **Fichiers :**
  - `scripts/icones.mjs` (lit `node_modules/remixicon/icons/**/<nom>.svg`, écrit `src/ui/icones.js` : `export const ICONES = { nom: '<svg…>' }`), script npm `icones` ;
  - `src/ui/barres.json` ;
  - `src/ui/Toolbar.js` ;
  - tests : `tests/ui/toolbar.test.js`.
- **Barres :**
  ```json
  {
    "edition": ["annuler", "retablir", "|", "titre", "liste", "citation", "poesie", "cadre", "|", "gras", "italique", "barre", "exposant", "indice", "code", "|", "lien", "note", "glossaire", "abbr", "modele", "|", "alignement", "tableau", "guillemets", "caracteres", "|", "multi", "langues", "|", "source", "pleinEcran"],
    "forum": ["gras", "italique", "lien", "|", "citation", "liste", "code", "|", "source"],
    "minimale": ["gras", "italique", "lien", "|", "source"]
  }
  ```
  - `code` = mark code (`` ` ``) ; `cadre` = `codeBlock`, comme le porte-plume (`` ` `` et ```` ``` ````).
  - Menu Titre : option `niveaux`, par défaut `[2, 3, 4]` (spec 05 §8), sans dépasser les niveaux du schéma.
- **`Toolbar` :**
  - `static registerComponent(nom, fabrique)` et `static composant(nom)` ;
  - `new Toolbar({ ctx, barre, element })` construit les éléments. Un nom inconnu donne un `console.warn`, sans composant. Un séparateur donne `span.tts-separateur` avec `role="separator"`.
  - `maj()` met à jour l'état des composants.
  - Roving tabindex : `keydown` sur la barre, `tabindex=0` sur l'élément courant.
- **Tests :**
  - barre construite dans l'ordre, nom inconnu ignoré ;
  - roving : une seule cible tabulable, les flèches sautent les désactivés, `Début`/`Fin` ;
  - mode source : seuls `source` et `pleinEcran` restent actifs.

### Tâche 2 : commandes d'édition

- **Fichiers :** `src/editor/edition.js` (extension `SpipEdition`, ajoutée à `coreExtensions`, exportée) ; tests : `tests/editor/edition.test.js`.
- **Tests (source SPIP avant/après, par `serialize`) :**
  - alignement :
    - deux paragraphes alignés puis réalignés : `<div class="text-center">\n\nA\n\nB\n\n</div>`, puis `text-right` ;
    - retiré, puis `A\n\nB` ;
  - poésie : appliquée et retirée ;
  - guillemets : `« {{a}} »`, sélection d'un texte gras ;
  - casse : `{{A}}b` → `{{A}}B`, marks gardées ;
  - tableau :
    - inséré (3×3, première ligne d'en-têtes) ;
    - ligne et colonne ajoutées et supprimées, cellules fusionnées et scindées ;
    - à chaque étape, `parse(serialize(json))` donne le même JSON ;
  - `Mod-Alt-m` ouvre le popover de modèle.

### Tâche 3 : composants de la barre

- **Fichiers :**
  - `src/ui/composants.js` : enregistre tous les composants du tableau ci-dessous ;
  - `src/ui/menu.js` : menu déroulant accessible ;
  - `src/ui/labels.js`, `lang/tiptap_spip_fr.php`, `_inits/09_tiptap_spip_config.js.html` ;
  - `css/tiptap_spip.css` ;
  - tests : `tests/ui/composants.test.js`.
- **Composants :**

  | Nom | Type | Action | État |
  |-----|------|--------|------|
  | `annuler`, `retablir` | bouton | `undo` / `redo` | `can()` |
  | `titre` | menu radio | paragraphe, niveaux configurés | niveau actif |
  | `liste` | menu | puces, numérotée, indenter, désindenter | — |
  | `citation`, `poesie`, `cadre` | bascules | `toggleBlockquote`, `togglePoesie`, `toggleCodeBlock` | `isActive` |
  | `gras`, `italique`, `barre`, `exposant`, `indice`, `code` | bascules | `toggleMark` | `isActive`, `can()` |
  | `lien`, `note`, `glossaire`, `abbr`, `modele`, `multi` | boutons | popovers existants | glossaire : sélection sans `[ ] < >` |
  | `langues` | select | `setLangueAffichee` | masqué sans multi |
  | `alignement` | menu radio | gauche, centre, droite, justifié, aucun | alignement actif |
  | `tableau` | menu | insérer ; ligne avant/après, colonne avant/après, supprimer ligne/colonne, fusionner, scinder, supprimer le tableau | `can()` par élément |
  | `guillemets` | menu | doubles, simples selon la langue | — |
  | `caracteres` | menu | À É È æ Æ œ Œ Ç, majuscules, minuscules | — |
  | `source` | bascule (`source: true`) | `instance.toggleMode()` | `aria-pressed` |
  | `pleinEcran` | bascule (`source: true`) | `instance.togglePleinEcran()` | `aria-pressed` |

  - Chaque bouton a la classe `tts-outil tts-outil--<nom>`, `aria-label` et `title` (libellé, plus le raccourci).
  - Les classes actuelles (`tts-lien`, `tts-bouton-note`, `tts-mode`…) sont remplacées. Les tests jsdom et e2e sont à mettre à jour.
- **Tests :**
  - gras par le bouton : `aria-pressed` suit la sélection ;
  - menu Titre au clavier : ouverture, `↓`, `Entrée` ; menu fermé par `Échap`, focus rendu au bouton ;
  - glossaire désactivé sur `[` ;
  - guillemets en allemand ;
  - barre `forum` : ni note ni modèle.

### Tâche 4 : instance — barre par hôte, plein écran, mode mémorisé, raccourcis

- **Fichiers :**
  - `src/main.js` : construit la `Toolbar` et retire les boutons construits à la main ;
  - `src/hosts/contexte.js` : `barreDuTextarea(textarea)` ;
  - `tiptap_spip_fonctions.php` : `tiptap_spip_barres()` lit `barres.json` et passe le pipeline ;
  - `paquet.xml` : pipeline `tiptap_spip_toolbars` ;
  - config JS : `toolbars` ;
  - tests : `tests/editor/main.test.js`, `tests/unit/PipelinesTest.php`.
- **Comportements :**
  - `Mod-Shift-E` bascule le mode depuis l'éditeur comme depuis le textarea ;
  - `F11` bascule le plein écran, `Échap` en sort ;
  - en plein écran, la classe `tts-plein-ecran` est posée sur `<html>` (pas de défilement de la page) ;
  - la destruction de l'instance retire ces classes.
- **Tests :**
  - choix de la barre :
    - attribut, classe ;
    - `texte` et `chapo` donnent `edition`, `ps` donne `minimale` ;
    - forum ;
    - inconnue donne `minimale` ;
  - mode mémorisé et `localStorage` qui lève une exception ;
  - `F11` et `Échap` ;
  - PHPUnit : pipeline qui ajoute un composant.

### Tâche 5 : e2e, specs, bundle

- **e2e (`tests/e2e/interface.e2e.js`) :**
  - barre `edition` sur `editer_article` ;
  - gras au clavier seul : `Tab` jusqu'à la barre, flèches, `Entrée` ; texte enregistré `{{…}}` ;
  - plein écran : `F11`, popover au-dessus, `Échap` ferme le popover puis le plein écran. La modalbox des modèles n'existe pas encore (Q3), donc pas de test « modalbox au-dessus ».
- **Specs :**
  - 06 §2, §3, §6 et §7 ;
  - 02 (pipeline `tiptap_spip_toolbars`, `barres.json`) ;
  - 09 (découpage de L5).
- **Bundle :** `npm run build`, puis commit.
