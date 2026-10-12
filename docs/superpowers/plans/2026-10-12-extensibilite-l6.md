# Extensibilité (lot L6) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** un plugin SPIP ajoute un raccourci à l'éditeur (lecture, écriture, bouton) sans modifier tiptap-spip (spec 07, critère L6 de la spec 09).

**Architecture :**
- **Règles tierces dans le parseur sans refonte du moteur.**
  - Le parseur garde son ordre en dur ; le registre générique de la spec 04 §2 n'est pas construit. Trois points d'insertion correspondent aux niveaux de la spec 07 :
    - `protect` : après les backticks, avant les blocs protégés du cœur (`<code>`, `<cadre>`…) ;
    - `block` : après les échappements, avant les modèles ;
    - `inline` : après les notes, avant les abréviations.
  - À chaque niveau, les règles passent par ordre de `priority` croissante.
  - Une règle tierce trouve des régions `extension` dans `protect()` : leur contenu est masqué, donc une ligne vide intérieure ne coupe pas le segment.
- **Lecture d'une région `extension` :**
  - **Bloc** (nœud non `inline`) qui occupe tout son segment : `parseSpip(match, helpers)` donne le bloc.
  - **Nœud en ligne :** `parseSpip` donne le nœud.
  - **Mark :** `parseSpip` donne `{ attrs, content }` ; `content` est fait de nœuds en ligne, qui reçoivent la mark.
  - **Ailleurs** (bloc au milieu d'un paragraphe, `parseSpip` qui renvoie `null`) : fragment brut, source gardée.
  - `match` est recalculé sur la source de la région, pas sur le texte masqué.
- **Écriture :**
  - `renderSpip(node, helpers)` pour un bloc ou un nœud en ligne ;
  - `renderSpip: { open, close }` ou `renderSpip(mark) → { open, close }` pour une mark.
  - La sérialisation conservatrice reste générique : empreinte canonique.
- **Règles actives par éditeur :**
  - `parse(source, { regles })` et `serialize(doc, { regles })` les posent pour la durée de l'appel (portée dynamique, comme le `contexte` du sérialiseur) ; les appels imbriqués (contenu d'une note, d'un conteneur) en héritent.
  - `reglesSpip(extensions)` (`src/editor/regles.js`) les lit dans les extensions Tiptap avec `getExtensionField` : `spipTokenizer`, `parseSpip`, `renderSpip`.
  - `createEditor` attache `editor.tiptapSpip = { regles, tierces }`. Le pont du textarea, le popover du nœud brut et les sous-éditeurs (note, multi) s'en servent.
- **Registre** (`src/api.js`) :
  - `registerExtension(ext, { toolbars? })` ; `registerToolbarComponent(nom, fabrique)` (alias de `Toolbar.registerComponent`).
  - `extensionsTierces(barre)` : les extensions de cette barre.
  - `coreExtensions({ tierces })` remplace une extension du cœur de même nom, avec un avertissement console. Deux enregistrements du même nom : le dernier gagne, avec un avertissement.
- **API publique :**
  - exports nommés du bundle et `window.tiptapSpip` : `registerExtension`, `registerToolbarComponent`, `core`, `ui`, `label`, `allerRetour` ;
  - `core` : `Node`, `Mark`, `Extension`, `mergeAttributes`, `nodeInputRule`, `markInputRule`, `Plugin`, `PluginKey` ;
  - `ui` : `boutonOutil`, `menuOutil`, `Popover` ;
  - `allerRetour(source, extensions)` : le harnais d'aller-retour (`{ json, canonique, conserve }`).
- **PHP :**
  - pipeline `tiptap_spip_extensions` (`nom => ['src' => chemin, 'dependances' => [noms]]`), ordonné selon les dépendances ;
  - URL absolues dans la config JS (`extensions`) ;
  - pipeline `tiptap_spip_i18n` (`clé => texte`) fusionné dans `i18n` ;
  - lancement SPIP 4 (`tiptap_spip_head`) et SPIP 5 (`_inits/80_tiptap_spip.js`) : chaque script est importé avant le premier `tiptap_spip_init()` ; un échec est signalé en console sans bloquer l'éditeur.
- **Plugin d'exemple** `exemples/tiptap_spip_faq/` :
  - nœud `faqItem` (`<faq|q=…>` … `</faq>`, contenu `block+`) et bouton `faq` (popover de la question) ;
  - libellés par `tiptap_spip_i18n` ;
  - rendu public par `pre_propre`.
  - Relié au site jetable comme `tts_test`.

**Tech Stack :** inchangée.

## Global Constraints

- **Contraintes des lots précédents :**
  - commentaires en français, tabulations ;
  - commits sans trailer ;
  - aucune chaîne en dur (les libellés d'un plugin tiers passent par `tiptap_spip_i18n`) ;
  - bundle reconstruit et versionné.
- **Sans extension tierce, rien ne change :**
  - corpus et équivalence identiques ;
  - les 538 tests Vitest passent sans modification de leurs attentes.
- **Ne jamais perdre de source :** une règle tierce qui ne se relit pas (`parseSpip` qui renvoie `null`, bloc mal placé) laisse un nœud brut.
- **Site jetable `/src/jetables/v4.4.21` conservé :** ni suppression, ni réinitialisation.

## Tâches L6

1. **Règles dans le cœur** (`src/spip/regles.js`, `protect.js`, `blocks.js`, `inline.js`, `serialize.js`, `parse.js`) :
   - extension de test `faqItem` (bloc), `sc` (mark `<sc>…</sc>`), `emoji` (nœud en ligne `:nom:`) ;
   - aller-retour à l'identique ; forme canonique ; bloc mal placé ou `parseSpip` nul gardés bruts ;
   - FAQ dans une note et dans une citation ; code et échappements qui protègent ;
   - priorités et niveaux ; niveau inconnu ignoré avec avertissement.
2. **Éditeur :**
   - `reglesSpip`, `createEditor` (`tiptapSpip`) ;
   - `TextareaBridge`, `RawPopover`, sous-éditeurs de note et de multi ;
   - `coreExtensions({ tierces })` avec surcharge par nom.
3. **API :**
   - `src/api.js` (registre, restriction par barre) ;
   - exports de `main.js` et `window.tiptapSpip` ;
   - `Instance` : extensions tierces de sa barre ;
   - `allerRetour`.
4. **PHP :**
   - pipelines `tiptap_spip_extensions` et `tiptap_spip_i18n` (`paquet.xml`), ordre des dépendances ;
   - config JS ; chargement avant `tiptap_spip_init` (SPIP 4 et 5) ;
   - PHPUnit.
5. **Plugin d'exemple FAQ et e2e :**
   - lecture d'un article avec FAQ, enregistrement sans modification à l'identique ;
   - insertion par le bouton, question modifiée, source enregistrée ;
   - rendu public ;
   - aucune modification du cœur nécessaire au plugin.
6. **Specs 07 et 09, bundle.**
