# 08 — Tests et recette

La qualité de l'outil se joue sur l'aller-retour SPIP ⇄ JSON : un éditeur qui altère silencieusement les
textes existants est inacceptable. Les tests sont donc centrés sur le parseur/sérialiseur, avec un
oracle fourni par SPIP lui-même.

## 1. Corpus

`tests/corpus/` : fichiers `.spip` (source) avec, pour les cas unitaires, le `.json` attendu.

| Origine | Contenu |
|---------|---------|
| Cas unitaires écrits à la main | un fichier par raccourci et par cas limite (notes nommées vs balise `<i>`, `|<|`, `{{{x {y}}}}`, échappements, modèles avec balises dans les paramètres…) |
| Tests du core | cas extraits des tests TextWheel / `propre()` de SPIP. Réalisé (lot corpus et propriétés) : `tests/corpus/textwheel/`, 124 textes des jeux `base`, `typo`, `modeles_block` et `modeles_inline` de TextWheel (SPIP 4.4.21), doublons retirés, importés par `scripts/importer-textwheel.mjs` |
| Corpus réel anonymisé | export de champs `texte` de quelques sites SPIP volontaires (articles longs, tableaux, multi) ; hors dépôt (`TTS_CORPUS`, `tests/corpus/exporter.php`) |
| Cas pathologiques | accolades orphelines, `[[` non fermés, HTML cassé, textes de 200 Ko. Réalisé : `tests/corpus/pathologiques/`, 12 cas (délimiteurs et balises non fermés, HTML cassé, fins de ligne mêlées, caractères de contrôle et Unicode, modèles, multi et tableaux mal formés, imbrications profondes, échappements, raccourcis coupés par une ligne vide) ; le texte de 200 Ko est produit par `tests/spip/invariants.test.js` (corpus concaténé) |

## 2. Niveaux de tests

| Niveau | Outil | Ce qui est testé |
|--------|-------|------------------|
| Unitaires JS | **Vitest** (Node, sans DOM) | `src/spip/` : chaque règle, parse → JSON attendu, serialize → source attendue, invariants 1, 2, 4, 5 de [04](04-parseur-serialiseur.md) §5 |
| Propriétés | Vitest + `fast-check` | génération de JSON aléatoires valides pour le schéma → sérialisation → re-parse = même JSON (invariant 5). Réalisé (lot corpus et propriétés, `fast-check` 4.10.2) : `tests/spip/proprietes-source.test.js` (sources tirées parmi des fragments de syntaxe : invariants 1, 2, 4, stabilité du JSON, validité pour le schéma) et `tests/spip/proprietes-json.test.js` (documents tirés selon le schéma, dans la forme normale de la spec 03 et des limites de la spec 04 §5 : invariant 5). Graine fixe dans `npm test` ; `TTS_FC_RUNS` lance une passe longue à graine aléatoire, `TTS_FC_SEED` rejoue un échec. Chaque contre-exemple est repris dans un test unitaire |
| Schéma | Vitest + `@tiptap/core` (jsdom) | tout JSON produit par `parse` donne un nœud valide : `schema.nodeFromJSON(json)` **puis `node.check()`** (`fromJSON` seul ne vérifie pas les contraintes de contenu) ; en exécution, l'éditeur est créé avec `enableContentCheck: true` et journalise `contentError` |
| **Équivalence de rendu** | script PHP + Node | pour chaque fichier du corpus : `propre(s)` vs `propre(serializeCanonique(parse(s)))` (HTML normalisé : espaces, ordre d'attributs) ; c'est l'oracle principal (invariant 3). L'oracle ajoute au rendu le texte des notes (`#NOTES`, que `propre()` ne rend pas). `<multi>` ne rendant qu'une langue, un texte qui en contient est rendu aussi dans chaque langue citée par un marqueur, code gardé tel quel (la casse compte) et posé directement dans `spip_lang` (`lang_select()` ignore une langue absente du site), notes remises à zéro entre les langues (lot L4.1). **Décision (lot L3.1)** : la bulle des notes est exclue de la comparaison, et seulement elle — l'attribut `title` de l'appel de note (`a.spip_note` vers `#nb…`) ; SPIP la construit à partir de l'orthographe brute de la note, qui peut donc différer après une réécriture équivalente. Le texte rendu des notes reste comparé en entier. Tests de régression : `normalize` dans `scripts/ecarts.mjs`, `tests/equivalence/ecarts.test.js` |
| Intégration CVT | Playwright (SPIP réel) + Vitest | une soumission AJAX réelle (`var_ajax=form`) de chaque opération renvoie une réponse que `src/services/cvt.js` analyse correctement : résultat, erreurs de `verifier()`, réponse sans formulaire (non autorisé), signature invalide ; les réponses PHP enregistrées servent de fixtures aux tests JS. Réalisé par `tests/e2e/services.e2e.js` (opérations, falsification des arguments signés et de la signature de session), `tests/services/cvt.test.js` sur les réponses enregistrées par `tests/e2e/fixtures-cvt.e2e.js`, et PHPUnit pour les fonctions pures et `formulaire_fond`. Le cas « deux formulaires d'édition du même objet » est couvert au niveau unitaire (identifiant d'instance différent à chaque calcul, association par instance) |
| Imbrication et repérage | Playwright | sur `editer_article`, `document.forms` contient le formulaire d'édition **et** ses formulaires de services, hors du premier ; page de test avec **deux formulaires d'édition du même article** : identifiants d'instance distincts, chaque éditeur appelle les services de sa propre instance (vérifié en interceptant les requêtes), y compris après rechargement AJAX de l'un des deux |
| Hôtes | Playwright (réalisé au lot L2b : `tests/e2e/hotes.e2e.js`, plugins Crayons 3.5.1 et `tests/e2e/plugin/tts_test`) | éditeur monté sur : un crayon du site public (ouverture, édition, enregistrement, fermeture puis réouverture sans fuite d'instance), deux crayons ouverts en même temps, un CVT public déclaré par `tiptap_spip_contextes`, un réglage sans objet (`descriptif_site`) ; services présents seulement si autorisé ; en public, styles du site appliqués dans la zone d'édition |
| PHP | **PHPUnit** (comme markdown_editor) | formulaire CVT `tiptap_spip` : `charger()` renvoie `false` sans autorisation ou si `champ` n'est pas un champ texte de l'objet (formulaire à la demande), `verifier()` refuse opérations/paramètres hors liste blanche, `traiter()` ; `traitements_previsu`, listes de modèles, pipelines |
| E2E | **Playwright** sur un SPIP jetable | ouverture d'un article, édition, enregistrement, diff de révision ; insertion note / glossaire / modèle ; bascule source ; plein écran + modalbox ; copier-coller. Référence d'identité : le texte enregistré par le **même formulaire soumis sans l'éditeur** (bundle bloqué) — le navigateur soumet les fins de ligne d'un textarea en CRLF et ignore un saut de ligne en tête de `<textarea>`, avec ou sans éditeur. Outillage : `tests/e2e/site.php` (pilote du site jetable SQLite), `npm run e2e` avec `TTS_SITE` et `TTS_URL` ; serveur `php -d opcache.revalidate_freq=0 -S …` (le plugin est activé en ligne de commande : sans cette option, OPcache sert l'ancien `charger_pipelines.php` pendant 2 s et la première page s'affiche sans l'éditeur) |

L'équivalence de rendu tourne en CI avec une image SPIP 4.4 et une SPIP 5 (spip-cli pour `propre()`), avec le core seul (configuration de référence, cf. [01](01-contexte-objectifs.md) §3).

## 3. Critères d'acceptation (v1)

1. 100 % du corpus : sans modification, égalité **caractère pour caractère** avec la source de référence
   `textarea.value` (invariant 1, [04](04-parseur-serialiseur.md) §4).
2. 100 % du corpus : équivalence de rendu canonique (invariant 3), hors écarts enregistrés (§4).
3. Aucun texte du corpus ne fait lever d'exception au parseur.

   Critères 1 à 3, lot corpus et propriétés : corpus de 164 fichiers (28 cas écrits à la main, 124 cas de
   TextWheel, 12 cas pathologiques), plus le texte de 200 Ko. Identité, idempotence et totalité sur tout le
   corpus ; équivalence de rendu 163/164 sur SPIP 4.2, 4.4 et 5, avec l'écart accepté `code-accoles`.
   La normalisation de l'oracle (`normalize`) traite une entité comme le caractère qu'elle code (sauf `<`,
   `&`, guillemets et blancs) et ignore l'ordre de balises de mise en forme imbriquées de même étendue.
4. Insérer / modifier / supprimer une note, un terme de glossaire, un modèle (avec et sans YAML) depuis
   l'interface produit la source attendue.
5. Une modification d'un paragraphe ne change, dans la révision SPIP, que ce paragraphe.
6. Performance : parse + montage < 150 ms pour 50 000 caractères (mesuré en CI, Chromium).
   Vérifié en e2e (lot L5.3) :
   - texte : le corpus d'équivalence répété ;
   - mesure : médiane de 5 montages, après un premier de chauffe ;
   - résultat : 104 à 134 ms selon les passes, une passe sur six au-dessus de 150 ms (152 ms) dans la
     suite complète sur un poste chargé ; 199 ms avant les optimisations de `protect()`, `regionsIn()` et
     des empreintes. Le montage de chauffe prend environ 170 ms.
7. Accessibilité : barre et popovers utilisables au clavier seul ; audit axe sans erreur critique.
   Vérifié en e2e (lots L5.1 et L5.2) :
   - barre au clavier seul, jusqu'à l'enregistrement ;
   - audit axe de l'éditeur, d'un menu ouvert et d'un popover ouvert : aucune violation critique ni
     sérieuse ; depuis le lot L5.3, aucune violation du tout.
8. Fonctionne dans l'espace privé SPIP 4.2, 4.4 et 5.x (Firefox ESR, Chromium, Safari récents).
   Lot L5.3 : la suite e2e tourne sous Chromium, Firefox et WebKit (projets Playwright), sur SPIP 4.4.
   Lot Compatibilité SPIP 4.2 et 5 : vérifié sur trois sites jetables, la même suite sous les trois navigateurs :
   - SPIP 4.2.16 (PHP 8.3) : 124 passés, 5 sautés ;
   - SPIP 4.4.21 : 124 passés, 5 sautés ;
   - SPIP 5.0-dev (branche `master`, `5.0.0-beta`, PHP 8.4) : 115 passés, 14 sautés, dont les tests Crayons,
     plugin sans version pour SPIP 5.

   Sautés partout : la réécriture des fixtures CVT (sur demande) et la mesure du critère 6 hors Chromium.
   Équivalence de rendu (§1, invariant 3) contre les trois oracles : 27/28, l'écart accepté `code-accoles` ayant
   un diff propre à SPIP 5 (§4).
   Lancement : `TTS_PHP` désigne le PHP du site, pour le pilote des e2e et pour l'oracle de l'équivalence
   (SPIP 4.2 s'arrête à PHP 8.3) ; le serveur PHP de test tourne avec `PHP_CLI_SERVER_WORKERS=4`, SPIP 4.2
   s'appelant lui-même au premier rendu public (vérification des accès, environ 70 s de blocage avec un
   seul processus).

## 4. Écarts de rendu acceptés

Un écart à l'invariant 3 n'est accepté que s'il est **enregistré** dans `tests/corpus/ecarts.yaml` :

```yaml
- fichier: pathologiques/accolade-orpheline-titre.spip
  type: espacement            # type parmi la liste fermée ci-dessous
  diff: ecarts/accolade-orpheline-titre.diff   # diff HTML attendu, figé
  justification: "séparateur de sécurité inséré dans {{{Titre {x}}}}"
  accepte_par: "<mainteneur>"  # relecture de la PR qui ajoute l'entrée
```

- **Types tolérés** (liste fermée) :
  - `espacement` : espaces ou espaces insécables ajoutés par un séparateur de sécurité ;
  - `balisage-equivalent` : même texte, même structure de blocs, balisage inline équivalent. Deux formes :
    - substitution de balises équivalentes (`<i>`/`<em>` par exemple) ;
    - fusion inline : plusieurs éléments inline accolés de même balise et de mêmes attributs, sans rien
      entre eux, deviennent un seul élément contenant leurs textes concaténés dans l'ordre
      (`<code>a</code><code>b</code>` → `<code>ab</code>`). Le nombre de balises change, pas le texte. C'est
      la conséquence du modèle de document : le JSON, comme Tiptap, fusionne les textes voisins de mêmes
      marks.
  - Limites de la fusion inline : elle ne traverse ni texte, ni espace, ni autre balise entre les éléments ;
    elle ne change ni l'ordre ni le contenu des textes ; elle ne touche ni un bloc, ni un lien, ni une note,
    ni un modèle. Une fusion d'un nombre différent d'éléments (quatre codes accolés au lieu de deux) produit
    un autre hunk : c'est un autre écart, qui demande sa propre entrée.
- **Jamais tolérés** : texte perdu ou ajouté, lien/note/modèle/glossaire perdu ou modifié, changement de
  structure (niveau de titre, liste, tableau, paragraphes).
- **Non-régression** : le test compare le diff obtenu au diff figé ; un diff différent fait échouer la CI,
  un diff disparu aussi (l'entrée doit alors être supprimée).
- **Diff figé** : rendus normalisés coupés en une ligne par balise, réduits aux lignes modifiées (sans
  contexte) ; chaque hunk liste ses lignes retirées (`- `) puis ajoutées (`+ `), les hunks sont séparés par
  `@@`. Il s'écrit avec `npm run equivalence -- --figer` (entrées déjà enregistrées seulement).
- **Diff propre à une branche de SPIP** : quand l'oracle d'une branche majeure rend autrement le même écart,
  l'entrée déclare `branches: { "5": { diff, justification } }`. L'oracle donne sa branche
  (`propre.php --branche`) et le diff figé de cette branche remplace le diff commun, y compris pour
  `--figer`. Cas actuel : `code-accoles.spip` sous SPIP 5, dont le rendu perd le texte `</code` de
  `<code></code</code>` (régression du cœur signalée sur `spip/ecrire`). Quand SPIP 5 sera corrigé, son diff
  redeviendra le diff commun et le test signalera un diff changé : supprimer alors la branche et son diff.
- **Corpus non versionné** (corpus réel, `npm run equivalence -- <dossier>`) : un écart y est « couvert »
  quand tous ses hunks figurent dans le diff figé d'une même entrée, c'est-à-dire quand le cas a été réduit
  à un extrait du corpus versionné et enregistré ; tout autre écart échoue. Un hunk figé peut apparaître
  plusieurs fois dans un même fichier : chaque occurrence reproduit le même écart connu (deux paires de codes
  accolés séparées par du texte donnent deux hunks identiques, tous deux couverts).
- **Plafond** : au plus 1 % des fichiers examinés en écart accepté ou couvert, arrondi à l'entier
  supérieur (un écart toléré pour un corpus de moins de 100 fichiers).
- Ajout d'une entrée : uniquement par PR, approuvée par un mainteneur autre que l'auteur.

