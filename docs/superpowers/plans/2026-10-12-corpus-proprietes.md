# Corpus élargi et tests de propriétés — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** tenir les critères 1 à 3 de la spec 08 sur un corpus qui mérite ce nom (cas du cœur, cas pathologiques) et vérifier les invariants 1, 2, 4 et 5 de la spec 04 §5 par des tests de propriétés (`fast-check`).

**Architecture :**
- **Corpus en sous-dossiers** sous `tests/corpus/` :
  - à la racine, les cas écrits à la main (inchangés ; seuls ceux-là passent par les e2e) ;
  - `textwheel/` : les textes des tests de TextWheel (`plugins-dist/textwheel/tests/data/{base,typo,modeles_block,modeles_inline}/*.txt` de SPIP 4.4.21), renommés en `.spip`, doublons de contenu retirés ; un `LISEZMOI.md` en donne l'origine et la licence (GPL, comme SPIP) ;
  - `pathologiques/` : accolades orphelines, `[[` et `<code>` non fermés, HTML cassé, fins de ligne mêlées, caractères de contrôle, etc.
- **Lecture récursive** du corpus, commune aux tests Vitest (`invariants`, `roundtrip`) et au script d'équivalence : `scripts/corpus.mjs`, `fichiersCorpus(dossier)` → chemins relatifs triés, séparateur `/`. Les écarts de `ecarts.yaml` désignent un fichier par ce chemin relatif.
- **Gros textes** (spec 08 §1, « textes de 200 Ko ») : produits par le test (corpus concaténé jusqu'à 200 Ko), pas versionnés.
- **Tests de propriétés** (`fast-check` 4.10.2, devDependency, version exacte) :
  - `tests/spip/proprietes-source.test.js` : sources tirées d'un alphabet de fragments SPIP (délimiteurs de raccourcis, balises, blancs, fins de ligne, texte) → totalité (4), identité (1), idempotence canonique (2), stabilité du JSON ;
  - `tests/spip/proprietes-json.test.js` : documents JSON tirés selon le schéma du cœur (blocs, marks et leurs exclusions, attributs) → sérialisation canonique → re-parse = même JSON (5), et le JSON est valide pour le schéma de l'éditeur (`node.check()`) ;
  - nombre de tirages par défaut raisonnable pour `npm test` ; `TTS_FC_RUNS` l'augmente pour une passe longue ; un échec affiche la graine et le contre-exemple réduit (`fc.assert`).
- **Chaque contre-exemple** trouvé (corpus ou propriété) devient un test unitaire réduit avant correction (TDD). S'il relève d'une limite assumée, la limite est écrite dans la spec (04 ou 08) et le générateur l'évite explicitement, avec un commentaire qui la cite.

**Tech Stack :** inchangée, plus `fast-check` 4.10.2.

## Global Constraints

- Commentaires en français, tabulations ; commits sans trailer ; bundle reconstruit et versionné si `src/` change.
- Ne jamais perdre de source : l'identité (invariant 1) ne souffre aucune exception.
- Un écart de rendu n'est accepté que par `ecarts.yaml` (spec 08 §4) ; plafond 1 % des fichiers, arrondi au supérieur.
- Équivalence vérifiée contre les trois oracles (`/src/jetables/v4.2.16` avec `TTS_PHP=php8.3`, `v4.4.21`, `v5.0-dev` avec `TTS_PHP=php8.4`).
- Le corpus réel (`TTS_CORPUS`) reste hors dépôt ; l'exporter depuis une base demande l'accord de l'utilisateur.
- Sites jetables conservés ; pas de changement de branche pendant un e2e.

## Tâches

1. **Lecture récursive du corpus :**
   - `scripts/corpus.mjs` (Vitest : dossier temporaire avec sous-dossiers, fichiers non `.spip` ignorés, ordre) ;
   - `invariants.test.js`, `roundtrip.test.js`, `equivalence.mjs` l'utilisent ; corpus actuel inchangé (28/28).
2. **Cas du cœur :** `scripts/importer-textwheel.mjs <plugins-dist/textwheel>` (copie, dédoublonnage) ; `tests/corpus/textwheel/` et son `LISEZMOI.md` ; Vitest puis équivalence sur les trois oracles ; corrections en TDD ou écarts enregistrés.
3. **Cas pathologiques :** `tests/corpus/pathologiques/` ; test du gros texte (200 Ko : totalité, identité, idempotence) ; corrections en TDD.
4. **Propriétés sur la source :** `fast-check`, `proprietes-source.test.js` ; corrections en TDD.
5. **Propriétés sur le JSON :** générateur selon le schéma, `proprietes-json.test.js` ; corrections en TDD ou limites écrites dans la spec.
6. **Specs** 04 §5 et 08 (§1, §2, critères 1 à 3 : chiffres du corpus) ; « Réalisation » de ce plan.

## Réalisation

- **Corpus** : 164 fichiers (28 cas écrits à la main, 124 cas de TextWheel, 12 cas pathologiques), plus le texte
  de 200 Ko produit par le test. Équivalence de rendu 163/164 sur SPIP 4.2, 4.4 et 5, avec l'écart accepté
  `code-accoles`.
- **Normalisation de l'oracle** (`normalize`) : une entité vaut le caractère qu'elle code (sauf `<`, `&`,
  guillemets, blancs), et l'ordre de balises de mise en forme imbriquées de même étendue est ignoré. Ces deux
  faux écarts apparaissaient sur les cas de TextWheel ; les diffs figés de `code-accoles` ont été réécrits.
- **Propriétés** : `fast-check` 4.10.2. Graine fixe dans `npm test` (300 tirages sur la source, 200 sur le
  JSON) ; `TTS_FC_RUNS` pour une passe longue, `TTS_FC_SEED` pour rejouer.
- **Corrections** (une trentaine de contre-exemples, chacun repris dans un test unitaire) : liste détaillée
  dans la spec 04 §3, « Ajouts du lot corpus et propriétés ».
- **Forme normale du générateur JSON** (ce que l'éditeur peut produire, spec 03) : termes de glossaire et
  d'abréviation valides et entiers, texte de lien non vide une fois rogné, modèle seul en bloc, pas de saut
  de ligne au bord ni de paragraphe vide, contenu fait seulement d'espaces sans mark vide (`[[ ]]` est une
  note vide, `{{ }}` se relit ; relevé par la revue), saut forcé dans une cellule ou un intertitre, en-têtes sans gras, légende vide quand
  seul le résumé est donné.
- **Limites écrites** (spec 04 §5) :
  - `\r` seul (Mac OS 9) : non géré, segment brut (décision de l'utilisateur, pour les notes de version) ;
  - note automatique qui commence par un idiome ou une mark écrite en balise HTML : lue nommée par le core ;
  - balise fermante dans un bloc verbatim ; langue d'un code qui passe par `<code>`.
- **Régression évitée** : la première règle du `\r` seul rendait brut tout segment CRLF suivi d'une ligne vide
  (corrigée avant fusion, test de non-régression).
- **Hors plan, constaté** : l'équivalence de rendu sur 143 sources aléatoires dont la forme canonique diffère
  donne 7 écarts (oracle 4.4), dont des lectures du parseur à revoir (`\<` devant une balise, `<strong>`
  refermé par `}}`). À traiter dans un lot suivant.
- **Tri de la revue** (critère choisi par l'utilisateur : 20 graines consécutives propres) : chaque
  contre-exemple réduit, qualifié avec l'oracle SPIP 4.4 (JSON relu et rendu), puis corrigé avec un test
  unitaire ou borné par une limite écrite (spec 04 §5). Critère atteint sur les graines 20261089 à
  20261108, puis, après les dernières corrections, sur les graines 20261111 à 20261130 (10 000 tirages sur
  la source, 3 000 sur le JSON par graine). L'équivalence de rendu du corpus a rattrapé une régression
  qu'aucune propriété ne voyait (compte des crochets dans la cible d'un lien).
- **Changement de comportement à signaler** : une première ligne de tableau entièrement vide est un
  en-tête pour SPIP (`<thead>`) ; un tableau inséré vide se relit donc avec un en-tête vide, jusqu'à ce
  qu'une cellule de sa première ligne reçoive du texte.
- **Corpus réel** : non exporté (accord de l'utilisateur requis pour lire une base).
