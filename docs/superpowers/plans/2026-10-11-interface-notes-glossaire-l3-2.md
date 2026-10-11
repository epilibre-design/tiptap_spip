# Interface des notes, du glossaire et des abréviations (lot L3.2) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** insérer, modifier et supprimer une note, un terme de glossaire et une abréviation depuis l'interface, en produisant la source SPIP attendue (critère d'acceptation 4 de la spec 08).

**Architecture :**
- **Cœur :** `src/spip/valider.js` dit si une saisie s'écrit en un raccourci qui se relit à l'identique. Il sert pour une cible de lien, un terme de glossaire, une abréviation, ou une note (nom et contenu). L'interface refuse une saisie qui ne se relit pas, au lieu de laisser le sérialiseur l'abandonner.
- **Éditeur :**
  - commandes `insertSpipNote`, `updateSpipNote`, `removeSpipNote` ;
  - raccourcis `Mod-Alt-N` et `Mod-Alt-G` ;
  - règles de saisie `[[` (note) et `[?terme]` (glossaire) ;
  - un schéma réduit pour le sous-éditeur des notes : sans notes, blocs permis dans une note seulement.
- **Interface :**
  - popover de note, avec sous-éditeur, champ « Nom » et case « Sans appel » ;
  - popovers glossaire et abréviation ;
  - panneau des notes sous l'éditeur ;
  - boutons Note, Glossaire et Abréviation dans la barre.
- **Imbrication des popovers :** un popover peut être enfant d'un autre (lien ou glossaire ouvert depuis le sous-éditeur d'une note). À la fermeture de l'enfant, le focus revient au sous-éditeur.
- **Serveur :** opération `glossaire` du formulaire CVT. Elle reçoit un raccourci `[?…]` et renvoie l'URL de la définition, calculée par `traiter_raccourci_glossaire()`, ainsi que la liste des glossaires nommés disponibles (fonctions `glossaire_*`).

**Tech Stack :** inchangée (Tiptap 3.31.4, Vitest 3.2.4, Playwright 1.61.0, SPIP 4.4.21 jetable).

## Global Constraints

- **Contraintes reprises des lots précédents :**
  - `src/spip/` sans Tiptap ni DOM ;
  - identité caractère pour caractère d'un texte non modifié ;
  - commentaires en français, tabulations ;
  - commits sans trailer ;
  - aucune chaîne en dur dans le JS : `labels.js`, la langue et `_inits/09_tiptap_spip_config.js` sont modifiés ensemble.
- **Contenu d'une note non modifiée dans le sous-éditeur :** il est restitué tel quel (l'attribut `content` d'origine est gardé). Un contenu modifié passe par le schéma, et les `spipHash` des blocs non touchés sont recalculés comme le fait `toEditorJSON`.
- **Popovers (spec 06 §4) :** `role="dialog"`, `Échap` ferme, `Entrée` valide dans un champ, le focus revient à l'éditeur qui a ouvert le popover.
- **Services absents (mode dégradé) :** popovers utilisables. Seuls « Voir la définition » et la liste des glossaires disparaissent.

## Structure des fichiers

| Fichier | Responsabilité |
|---------|----------------|
| `src/spip/valider.js` | `seRelitInline(content)`, `noteSeRelit({ name, content })` |
| `src/editor/content.js` | `schemaJSON(doc, schema)` : passage par le schéma et empreintes recalculées (utilisé par `toEditorJSON` et le sous-éditeur) |
| `src/editor/extensions.js` | commandes de note, raccourcis, règles de saisie, `noteExtensions()` (schéma du sous-éditeur) |
| `src/ui/popover.js` | popover enfant (`parent`) |
| `src/ui/NotePopover.js` | popover de note et sous-éditeur |
| `src/ui/MarkPopover.js` | popovers glossaire et abréviation |
| `src/ui/NotesPanel.js` | panneau des notes |
| `src/ui/LinkPopover.js` | cible validée par `seRelitInline` ; option `parent` |
| `src/main.js` | boutons, panneau, `ui.editNote`, `ui.openGlossary`, `ui.openAbbr` |
| `formulaires/tiptap_spip.php`, `tiptap_spip_fonctions.php` | opération `glossaire` |
| `lang/tiptap_spip_fr.php`, `prive/javascript/_inits/09_tiptap_spip_config.js`, `src/ui/labels.js` | libellés |
| `css/tiptap_spip.css` | popovers enfants, sous-éditeur, panneau |

## Tâches

### Tâche 1 : validation des saisies (`valider.js`)

- [ ] **Tests (`tests/spip/valider.test.js`) :**
  - `seRelitInline` est vrai pour `[?SPIP#mots12|b{fr}]`, `[CMS|x{en}]` et `[x->art1]` ;
  - il est faux pour un terme avec accolade ou blanc de bord, une bulle avec `]`, une cible avec `]` ou un saut de ligne, une explication vide ;
  - `noteSeRelit` est vrai pour une note automatique, nommée `A` ou sans appel ;
  - il est faux pour un nom `i` quand le contenu contient `</i>`, pour un nom avec `>` ou `]]`, et pour une liste de blocs vide (note vide acceptée : `[p()]`).
- [ ] **Implémentation :**
  - `seRelitInline(content)` : paragraphe `content` sérialisé (forme canonique), relu ; vrai si `canon` du relu égale `canon(mergeText(content))`.
  - `noteSeRelit({ name, content })` : `x` + note sérialisés et relus. Vrai si le relu est `[text x, spipNote]`, avec le même nom (`?? null`) et `canon(contenu relu)` égal à `canon(parse(serialize(doc(content))).content)`. Ce que le contenu devient seul doit être ce qu'il devient dans la note.
- [ ] **Commit :** `feat(spip): validation des saisies par relecture`.

### Tâche 2 : commandes, raccourcis, règles de saisie, schéma du sous-éditeur

- [ ] **Tests (`tests/editor/commandes.test.js`, jsdom) :**
  - `insertSpipNote({ content })` insère une note au curseur, et sans contenu appelle `ui.editNote(null)` ;
  - `updateSpipNote` sur la note sélectionnée change nom et contenu ;
  - `removeSpipNote` la supprime ;
  - `Mod-Alt-N` et `Mod-Alt-G` appellent `ui.editNote` et `ui.openGlossary` ;
  - taper `[[` appelle `ui.editNote` après avoir retiré `[[` ;
  - taper `[?SPIP#mots12]` donne le terme marqué (`serialize` → `[?SPIP#mots12]`) ;
  - le schéma de `noteExtensions()` refuse un titre (`doc.check()` lève) et n'a pas `spipNote` ;
  - `schemaJSON` recalcule les empreintes.
- [ ] **Implémentation :**
  - `SpipNote.addCommands()`.
  - `SpipUi` : raccourcis `Mod-Alt-n` et `Mod-Alt-g`, règle `[[` (InputRule qui supprime la plage et appelle `ui.editNote(null)`).
  - Règle `[?…]` sur `SpipGlossary`, via `parseGlossary` ; pas de règle si le raccourci n'est pas représentable.
  - `noteExtensions({ ui })` : `coreExtensions` sans `SpipNote` ni `SpipNoteNumbers`, avec un `Document` de contenu `(paragraph | bulletList | orderedList | spipModelBlock)+`.
- [ ] **Commit :** `feat(editor): commandes de note, raccourcis et règles de saisie`.

### Tâche 3 : opération `glossaire` du formulaire CVT

- [ ] **Tests :**
  - PHPUnit `tiptap_spip_glossaires()` (fonctions `glossaire_*` hors `glossaire_std`, sans suffixe `_dist`, triées) ;
  - e2e `services.e2e.js` : `glossaire` renvoie `https://fr.wikipedia.org/wiki/SPIP` pour `[?SPIP]` ; refus d'un raccourci invalide.
- [ ] **Implémentation :**
  - `verifier()` : `raccourci` de 500 caractères au plus, un seul raccourci de glossaire (`_RACCOURCI_GLOSSAIRE` ancré).
  - `traiter()` : `['url' => href du lien rendu par traiter_raccourci_glossaire(), 'glossaires' => tiptap_spip_glossaires()]`.
- [ ] **Commit :** `feat(services): opération glossaire`.

### Tâche 4 : popovers glossaire, abréviation et lien

- [ ] **Tests (`tests/ui/glossaire.test.js`) :**
  - texte sélectionné, popover glossaire, numéro et bulle → `[?SPIP#mots12|b]` ;
  - curseur dans un terme : modification, puis retrait ;
  - curseur sans sélection : champ « Terme » et insertion ;
  - un terme invalide (`S{P}`) donne une erreur et laisse le popover ouvert ;
  - « Voir la définition » appelle `glossaire` et ouvre l'URL ;
  - la liste des glossaires remplit le `datalist` ;
  - mêmes cas pour l'abréviation (`[CMS|Content Management System{en}]`) ;
  - une cible de lien avec `]` est refusée.
- [ ] **Implémentation :** `openGlossaryPopover(contexte)` et `openAbbrPopover(contexte)`, construits sur une même fonction `openMarkPopover`. Les deux types de mark n'ont pas les mêmes champs : la fabrique reçoit la description des champs.
- [ ] **Commit :** `feat(ui): popovers glossaire et abréviation`.

### Tâche 5 : popover de note, sous-éditeur, popovers imbriqués

- [ ] **Tests (`tests/ui/notes.test.js`) :**
  - `Mod-Alt-N` ouvre le popover ; texte saisi dans le sous-éditeur et appliqué → `a[[texte]]` ;
  - note nommée ;
  - « Sans appel » → `[[<>…]]` ;
  - modification d'une note existante, mise en forme et lien compris (lien ouvert depuis le sous-éditeur : popover enfant, la note reste ouverte) ;
  - ouvrir puis appliquer une note sans la modifier la restitue à l'identique (`[[ Premier.\n\n\nSecond.]]`) ;
  - nom `i` avec `</i>` dans le texte → erreur ;
  - « Supprimer » retire la note ;
  - clic sur un appel de note → popover ;
  - `Échap` dans le sous-éditeur ferme le popover et rend le focus à l'éditeur.
- [ ] **Implémentation :**
  - `Popover` : option `parent`. `open()` ne ferme pas le parent ; `close()` rend `current` au parent, et la fermeture du parent ferme d'abord l'enfant.
  - `openNotePopover(contexte, pos)` :
    - le sous-éditeur `new Editor({ extensions: noteExtensions({ ui: sousUi }), content: schemaJSON(...) })` ;
    - une mini-barre Gras, Italique, Lien, Glossaire ;
    - à la fermeture, `destroy()` du sous-éditeur.
  - Clic sur un appel : `handleClickOn` dans `SpipUi`, qui appelle `ui.editNote(pos)`.
- [ ] **Commit :** `feat(ui): popover de note avec sous-éditeur`.

### Tâche 6 : panneau des notes, barre, libellés, styles

- [ ] **Tests :**
  - `tests/ui/notes.test.js` : le panneau liste les notes avec leur numéro et leur aperçu ; il est mis à jour après suppression et masqué sans note ; un clic sélectionne la note et ouvre son popover ;
  - `main.test.js` : boutons Note, Glossaire et Abréviation, désactivés en mode source.
- [ ] **Implémentation :**
  - `NotesPanel` : `<details class="tts-notes">`, `<summary>` « Notes (n) », `<ol>` ; mise à jour sur `update` ; même calcul des numéros que `SpipNoteNumbers` (fonction `numerosDesNotes(doc)` partagée).
  - Libellés dans les trois fichiers ; CSS.
- [ ] **Commit :** `feat(ui): panneau des notes, boutons note, glossaire, abréviation`.

### Tâche 7 : de bout en bout (critère 4) et specs

- [ ] **Tests e2e `interface.e2e.js` :** insérer une note au clavier, modifier son texte, la supprimer ; poser un glossaire sur un mot ; poser une abréviation ; enregistrer l'article et lire la source enregistrée.
- [ ] **Specs :**
  - 05 §1, §2 et §7 : ce qui est réalisé ;
  - 06 : barre, popovers imbriqués ;
  - 09 : L3.2 fait.
- [ ] **Commit :** `docs: specs du lot L3.2`.
