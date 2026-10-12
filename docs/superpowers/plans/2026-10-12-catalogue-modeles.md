# Catalogue des modèles (Q3) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** insérer et modifier un modèle par son formulaire YAML, avec le catalogue du plugin « Insérer modèles » quand il est actif, sans perdre la saisie brute (spec 05 §3, spec 06 §2, question Q3 de la spec 09).

**Décision Q3 (utilisateur, 2026-10-12) :** le plugin contrib `inserer_modeles` est **facultatif** (`<utilise>`). Il n'y a ni copie ni paquet commun avec markdown_editor. Sans ce plugin (et en SPIP 5, qu'il ne déclare pas), l'éditeur garde la saisie brute du raccourci.

**Architecture :**
- **Contrat avec le plugin**, sans le modifier :
  - le plugin pose dans chaque formulaire qui a un `<textarea>` (`formulaire_fond`, crayons par `recuperer_fond`) un `input[name=url_inserer_modeles]` désactivé : l'URL de sa modalbox pour l'objet édité, présente si `autoriser('inserer_modeles', objet, id)` ;
  - le formulaire `#FORMULAIRE_INSERER_MODELES` en modalbox, après « Insérer », appelle `$.markItUp({ replaceWith: code })`. Le porte-plume déclenche alors l'événement jQuery `insertion` sur **tous** les `textarea`, et n'insère que dans celui qui a le focus markItUp, ce qui n'est jamais le cas du nôtre (porte-plume retiré). Il ferme ensuite la modalbox ;
  - préremplissage par l'URL : `formulaire_modele=<yaml>` et chaque champ par son nom (`_request()` dans `charger()`).
- **PHP :**
  - `paquet.xml` : `<utilise nom="inserer_modeles" />` ;
  - `inc/tiptap_spip_modeles.php` : `tiptap_spip_decrire_formulaire_modele(array $parametres): ?array` (fonction pure : modèle produit et champs d'un YAML) et `tiptap_spip_catalogue_modeles(): ?array` (null sans le plugin ; sinon `nom du modèle → description`, modèles ignorés exclus) ;
  - config JS : `modeles` (catalogue ou `null`).
- **Description d'un formulaire**, tirée des saisies, imbrications comprises :
  - `modele` : `defaut` de la saisie `modele` ; sans elle, pas de description ;
  - `id` : `id_modele` s'il existe ;
  - `champs` : les autres noms de champs ;
  - `valeurs` : valeur nue → champ, d'après les `data` des saisies à choix (`align` : `left`, `center`, `right`) ;
  - `multiples` : champs à cases (`checkbox`), écrits `champ=a,b` par le plugin.
- **JS :**
  - `src/ui/catalogue.js` :
    - `urlCatalogue(textarea)` : l'`input[name=url_inserer_modeles]` du formulaire du textarea, ou de son conteneur pour un crayon ;
    - `parametresFormulaire(model, description)` : paramètres d'URL qui préremplissent le formulaire, ou `null` si un paramètre n'a pas de champ, pour ne jamais perdre un paramètre en réécrivant ;
    - `ouvrirCatalogue({ editor, textarea, url, pos, parametres })` : `jQuery.modalbox(url)`, écoute `insertion` sur le textarea le temps de la modalbox, puis pose le modèle lu par `parseModel()`. Il remplace le modèle à `pos` ; sinon il l'insère comme le popover brut (bloc dans un paragraphe vide, en ligne ailleurs).
  - `poserModele(editor, model, courant)` est extrait de `ModelPopover`, pour un seul comportement d'insertion.
  - **Interface :** `creerInterface({ catalogue })`, avec `catalogue = { url, modeles }` ou `null`.
    - `ui.openCatalogue()` : liste des modèles ;
    - `ui.editModel(pos)` : formulaire prérempli si le modèle a une description et que tous ses paramètres s'y retrouvent, saisie brute sinon ;
    - `ui.editRawModel(pos)` : saisie brute ;
    - `Mod-Alt-M` : saisie brute.
  - **Barre :** avec catalogue, `modele` devient un menu « Modèle » à deux entrées : « Catalogue des modèles… » et « Raccourci… ». Sans catalogue, c'est le bouton actuel.
  - **Plein écran :** la modalbox passe au-dessus (z-index de lity sous `.tts-plein-ecran`).
- **Masquage :** c'est le réglage « Ne pas proposer les modèles suivants » du plugin (`inserer_modeles/ignorer_modeles`). La page de configuration y renvoie quand le plugin est actif ; pas d'option propre.

**Tech Stack :** inchangée. Le plugin « Insérer modèles » 2.4.1, avec Saisies 6.4.0, Verifier 3.9.2 et YAML 3.3.0, est installé sur les sites jetables 4.2.16 et 4.4.21.

## Global Constraints

- **Contraintes des lots précédents :**
  - commentaires en français, tabulations ;
  - commits sans trailer ;
  - aucune chaîne en dur (libellés dans `labels.js`, `lang/tiptap_spip_fr.php` et `tiptap_spip_config.js.html`) ;
  - bundle reconstruit et versionné.
- **Ne jamais perdre de source :** un modèle dont un paramètre n'a pas de champ dans le formulaire s'édite en brut ; un raccourci rendu par le plugin qui ne se relit pas en modèle (`parseModel` nul) n'est pas posé.
- **Sans le plugin, rien ne change :** la barre, les popovers et les e2e restent ceux d'aujourd'hui (site SPIP 5).
- **Sites jetables conservés.**

## Tâches

1. **PHP :**
   - `tiptap_spip_decrire_formulaire_modele()` (PHPUnit : `media.yaml`, imbrications, sans saisie `modele`) ;
   - `tiptap_spip_catalogue_modeles()` (absent : `null` ; modèles ignorés exclus) ;
   - config JS `modeles` ; `paquet.xml`.
2. **JS, module `catalogue.js` :** `urlCatalogue`, `parametresFormulaire`, `ouvrirCatalogue` (Vitest, avec un faux `jQuery.modalbox` et un `trigger('insertion')`).
3. **JS, interface :** `poserModele`, `creerInterface({ catalogue })`, menu Modèle, NodeView « Modifier », libellés (Vitest).
4. **Configuration :** renvoi vers le réglage du plugin ; plein écran (CSS).
5. **e2e** sur 4.4 et 4.2 (sautés sans le plugin) :
   - insertion par le catalogue ;
   - modification préremplie d'un `<docN|left>` ;
   - modèle à paramètre inconnu modifié en brut ;
   - modalbox au-dessus du plein écran.
6. **Specs** 02, 05, 06, 09 (Q3 tranchée) ; bundle.

## Réalisation

- **Plugin installé** sur les sites 4.2.16 et 4.4.21 : Insérer modèles 2.4.1 (24 septembre), Saisies 6.4.0, Verifier 3.9.2 et YAML 3.3.0, depuis `git.spip.net`. Le site 5.0-dev ne l'a pas.
- **Écarts au plan :**
  - **Insertion :** l'événement jQuery `insertion` n'est pas utilisable. Sans zone markItUp qui a le focus, le script du plugin lève une erreur (`$('#')`) avant d'appeler `$.markItUp`. L'éditeur lit plutôt le raccourci dans `#code_modele_modalbox`, comme markdown_editor, par un `MutationObserver` actif tant que sa modalbox est ouverte. Il remet `$.markItUp.focused` à `null` à l'ouverture, pour que le plugin n'insère pas aussi le raccourci dans un autre champ.
  - **Modalbox :** elle s'ouvre avec `{ type: 'ajax', minHeight: '90%' }`, comme le fait le plugin. Sans le type, mediabox devine une image.
  - **Saisies du formulaire :** la liste du plugin 2.4.1 ne contient plus les saisies (`parametres`) ; elles sont lues par `charger_infos_formulaire_modele()`.
  - **Bug du plein écran (antérieur à ce lot) :** `.formulaire_spip` (`position: relative`, `z-index: 2`) enfermait l'éditeur plein écran sous le bandeau de l'espace privé (`z-index: 1001`), qui recouvrait sa barre d'outils. L'e2e du plein écran ne testait que le clavier. Désormais, le plein écran est à 9000, sous lity (9990), et ses ancêtres passent au même niveau par `:has()`. L'e2e vérifie qu'un bouton de la barre est cliquable.
  - **Page de configuration :** pas d'option propre. Elle renvoie à la configuration du plugin (`test_plugin_actif` : `#PLUGIN{inserer_modeles}` y rendait la liste sérialisée des plugins).
- **Limites :**
  - le formulaire réécrit le raccourci dans l'ordre du plugin ;
  - un modèle dans une note s'édite en brut ;
  - le parcours du sélecteur de documents (« Parcourir », modalbox imbriquée) n'est pas testé en e2e ;
  - le masquage n'a pas d'e2e (réglage du plugin) : `catalogueDe()` sans modèle proposé est couvert en Vitest.
