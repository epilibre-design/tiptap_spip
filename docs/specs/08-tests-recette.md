# 08 — Tests et recette

La qualité de l'outil se joue sur l'aller-retour SPIP ⇄ JSON : un éditeur qui altère silencieusement les
textes existants est inacceptable. Les tests sont donc centrés sur le parseur/sérialiseur, avec un
oracle fourni par SPIP lui-même.

## 1. Corpus

`tests/corpus/` : fichiers `.spip` (source) avec, pour les cas unitaires, le `.json` attendu.

| Origine | Contenu |
|---------|---------|
| Cas unitaires écrits à la main | un fichier par raccourci et par cas limite (notes nommées vs balise `<i>`, `|<|`, `{{{x {y}}}}`, échappements, modèles avec balises dans les paramètres…) |
| Tests du core | cas extraits des tests TextWheel / `propre()` de SPIP |
| Corpus réel anonymisé | export de champs `texte` de quelques sites SPIP volontaires (articles longs, tableaux, multi) |
| Cas pathologiques | accolades orphelines, `[[` non fermés, HTML cassé, textes de 200 Ko |

## 2. Niveaux de tests

| Niveau | Outil | Ce qui est testé |
|--------|-------|------------------|
| Unitaires JS | **Vitest** (Node, sans DOM) | `src/spip/` : chaque règle, parse → JSON attendu, serialize → source attendue, invariants 1, 2, 4, 5 de [04](04-parseur-serialiseur.md) §5 |
| Propriétés | Vitest + `fast-check` | génération de JSON aléatoires valides pour le schéma → sérialisation → re-parse = même JSON (invariant 5) |
| Schéma | Vitest + `@tiptap/core` (jsdom) | tout JSON produit par `parse` donne un nœud valide : `schema.nodeFromJSON(json)` **puis `node.check()`** (`fromJSON` seul ne vérifie pas les contraintes de contenu) ; en exécution, l'éditeur est créé avec `enableContentCheck: true` et journalise `contentError` |
| **Équivalence de rendu** | script PHP + Node | pour chaque fichier du corpus : `propre(s)` vs `propre(serializeCanonique(parse(s)))` (HTML normalisé : espaces, ordre d'attributs) ; c'est l'oracle principal (invariant 3) |
| Intégration CVT | PHPUnit (SPIP réel) + Vitest | une soumission AJAX réelle (`var_ajax=form`) de chaque opération renvoie une réponse que `src/services/cvt.js` analyse correctement : résultat, erreurs de `verifier()`, réponse sans formulaire (non autorisé), signature invalide ; les réponses PHP enregistrées servent de fixtures aux tests JS |
| Imbrication et repérage | Playwright | sur `editer_article`, `document.forms` contient le formulaire d'édition **et** ses formulaires de services, hors du premier ; page de test avec **deux formulaires d'édition du même article** : identifiants d'instance distincts, chaque éditeur appelle les services de sa propre instance (vérifié en interceptant les requêtes), y compris après rechargement AJAX de l'un des deux |
| PHP | **PHPUnit** (comme markdown_editor) | formulaire CVT `tiptap_spip` : `charger()` renvoie `false` sans autorisation, `verifier()` refuse opérations/paramètres hors liste blanche, `traiter()` ; `traitements_previsu`, listes de modèles, pipelines |
| E2E | **Playwright** sur un SPIP jetable | ouverture d'un article, édition, enregistrement, diff de révision ; insertion note / glossaire / modèle ; bascule source ; plein écran + modalbox ; copier-coller |

L'équivalence de rendu tourne en CI avec une image SPIP 4.4 et une SPIP 5 (spip-cli pour `propre()`), avec le core seul (configuration de référence, cf. [01](01-contexte-objectifs.md) §3).

## 3. Critères d'acceptation (v1)

1. 100 % du corpus : sans modification, égalité **caractère pour caractère** avec la source de référence
   `textarea.value` (invariant 1, [04](04-parseur-serialiseur.md) §4).
2. 100 % du corpus : équivalence de rendu canonique (invariant 3), hors écarts enregistrés (§4).
3. Aucun texte du corpus ne fait lever d'exception au parseur.
4. Insérer / modifier / supprimer une note, un terme de glossaire, un modèle (avec et sans YAML) depuis
   l'interface produit la source attendue.
5. Une modification d'un paragraphe ne change, dans la révision SPIP, que ce paragraphe.
6. Performance : parse + montage < 150 ms pour 50 000 caractères (mesuré en CI, Chromium).
7. Accessibilité : barre et popovers utilisables au clavier seul ; audit axe sans erreur critique.
8. Fonctionne dans l'espace privé SPIP 4.2, 4.4 et 5.x (Firefox ESR, Chromium, Safari récents).

## 4. Écarts de rendu acceptés

Un écart à l'invariant 3 n'est accepté que s'il est **enregistré** dans `tests/corpus/ecarts.yaml` :

```yaml
- fichier: pathologiques/accolade-orpheline-titre.spip
  type: espacement            # type parmi la liste fermée ci-dessous
  diff: ecarts/accolade-orpheline-titre.diff   # diff HTML attendu, figé
  justification: "séparateur de sécurité inséré dans {{{Titre {x}}}}"
  accepte_par: "<mainteneur>"  # relecture de la PR qui ajoute l'entrée
```

- **Types tolérés** (liste fermée) : `espacement` (espaces ou espaces insécables ajoutés par un séparateur de
  sécurité), `balisage-equivalent` (même texte et même structure, balises équivalentes : `<i>`/`<em>` par
  exemple).
- **Jamais tolérés** : texte perdu ou ajouté, lien/note/modèle/glossaire perdu ou modifié, changement de
  structure (niveau de titre, liste, tableau, paragraphes).
- **Non-régression** : le test compare le diff obtenu au diff figé ; un diff différent fait échouer la CI,
  un diff disparu aussi (l'entrée doit alors être supprimée).
- **Plafond** : au plus 1 % des fichiers du corpus en écart accepté.
- Ajout d'une entrée : uniquement par PR, approuvée par un mainteneur autre que l'auteur.

