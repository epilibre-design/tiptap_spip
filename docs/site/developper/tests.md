# Réaliser les tests

Les tests protègent surtout l’aller-retour entre les raccourcis SPIP, le document Tiptap et le texte enregistré. Ils se lancent depuis le dépôt du plugin. Les tests de bout en bout utilisent **un site SPIP jetable** : leur pilote crée des articles, active des plugins et ouvre une session d’administration. Ne les lancez jamais contre un site contenant des données à conserver.

## Choisir la suite

| Suite | Ce qu’elle vérifie | Commande |
|---|---|---|
| Vitest | Parseur, sérialiseur, schéma, propriétés et client des services CVT | `npm test` |
| PHPUnit | Fonctions PHP, formulaires et pipelines avec des simulations légères | `composer tests-unit` |
| Équivalence de rendu | Compare le rendu de `propre(source)` à celui de `propre(serialize(parse(source)))` sur le corpus, avec SPIP comme oracle | `SPIP_ROOT=/chemin/vers/spip npm run equivalence` |
| Playwright | Édition et enregistrement dans un vrai site SPIP, services AJAX, interface, hôtes publics et accessibilité | `TTS_SITE=/chemin/vers/spip TTS_URL=http://127.0.0.1:18931 npm run e2e` |

Les commandes `npm` s’exécutent dans `prive/javascript/tiptap_spip/` ; `composer tests-unit` s’exécute à la racine du dépôt. Installez les dépendances avec `npm ci` et `composer install` selon les suites choisies. Pour Playwright, installez aussi les navigateurs avec `npx playwright install`.

Les tests Vitest n’ont pas besoin d’un site SPIP. L’équivalence de rendu et Playwright en ont besoin. Le corpus versionné se trouve dans [`tests/corpus/`](https://github.com/epilibre-design/tiptap_spip/tree/main/tests/corpus) ; la [spécification de recette](https://github.com/epilibre-design/tiptap_spip/blob/main/docs/specs/08-tests-recette.md) décrit les invariants, les cas couverts et les écarts acceptés.

## Préparer un site pour Playwright

Installez SPIP dans un répertoire distinct, avec une base SQLite et un compte administrateur, puis terminez son installation dans le navigateur. Utilisez une version compatible avec le plugin (SPIP 4.2, 4.4 ou 5). Le répertoire doit contenir `ecrire/` et `plugins/` ; le serveur de test doit pouvoir écrire dans la base et les répertoires de cache. Les tests modifient ce site et y laissent leurs articles.

Depuis la racine du dépôt, reliez le plugin et son compagnon de test au site :

```bash
export TTS_REPO="$PWD"
export TTS_SITE="/chemin/vers/site-spip-jetable"
mkdir -p "$TTS_SITE/plugins"
ln -s "$TTS_REPO" "$TTS_SITE/plugins/tiptap_spip"
ln -s "$TTS_REPO/tests/e2e/plugin/tts_test" "$TTS_SITE/plugins/tts_test"
```

Ces chemins de destination doivent être libres avant de créer les liens. Si vous avez déjà installé ces plugins dans ce site jetable, utilisez les installations existantes ou remplacez-les après vérification.

Dans un premier terminal, lancez le serveur depuis la racine du dépôt :

```bash
PHP_CLI_SERVER_WORKERS=4 php -d opcache.revalidate_freq=0 \
  -S 127.0.0.1:18931 -t "$TTS_SITE"
```

Choisissez un port libre et gardez le serveur actif. `PHP_CLI_SERVER_WORKERS=4` évite un blocage lors du premier rendu public de SPIP 4.2. `opcache.revalidate_freq=0` permet au serveur de voir immédiatement les pipelines après l’activation d’un plugin par le pilote.

Dans un second terminal, depuis le même dépôt :

```bash
export TTS_SITE="/chemin/vers/site-spip-jetable"
export TTS_URL="http://127.0.0.1:18931"
cd prive/javascript/tiptap_spip
npm ci
npx playwright install
npm run build
npm run e2e
```

`npm run build` reconstruit le script servi par SPIP si vous avez modifié ses sources. Par défaut, Playwright lance Chromium, Firefox et WebKit, avec un seul worker. Pour une vérification ciblée, utilisez par exemple :

```bash
npm run e2e -- --project=chromium tests/e2e/hotes.e2e.js
```

`TTS_SITE` désigne la racine du site installé ; `TTS_URL` est l’adresse **du même site** servi par PHP. Pour SPIP 4.2, utilisez si nécessaire `TTS_PHP=php8.3` pour le pilote, et démarrez aussi le serveur avec un PHP compatible. Si `TTS_SITE` ou `TTS_URL` manque, la plupart des tests E2E sont sautés : vérifiez le résumé Playwright avant d’interpréter le résultat.

## Ce qui se passe pendant un test E2E

La configuration Playwright utilise l’agent navigateur `tts-e2e` et les projets Chromium, Firefox et WebKit. Son [assistant JavaScript](https://github.com/epilibre-design/tiptap_spip/blob/main/prive/javascript/tiptap_spip/tests/e2e/site.js) appelle le [pilote PHP](https://github.com/epilibre-design/tiptap_spip/blob/main/tests/e2e/site.php) avec `SPIP_ROOT=TTS_SITE`. Celui-ci active `tiptap_spip`, crée un article, prépare une session liée à cet agent navigateur et lit ensuite le texte enregistré directement dans la base.

Les tests d’article ouvrent la page d’édition, manipulent l’éditeur et soumettent le formulaire SPIP. Pour vérifier qu’un enregistrement sans modification conserve le texte, ils soumettent aussi le même formulaire avec le script de l’éditeur bloqué. Ils comparent **les deux valeurs enregistrées**, car un textarea HTML peut convertir les fins de ligne ou ignorer un saut de ligne initial. D’autres fichiers E2E vérifient les services CVT par de vrais appels AJAX, les commandes de l’interface, les styles, le clavier et l’accessibilité.

### À quoi sert `tts_test` ?

Le plugin [`tests/e2e/plugin/tts_test`](https://github.com/epilibre-design/tiptap_spip/tree/main/tests/e2e/plugin/tts_test) fournit deux cas nécessaires à la suite :

- Un formulaire public `tts_test` avec un champ `texte`. Son pipeline `tiptap_spip_contextes` déclare que ce champ correspond au texte de l’article reçu en argument. Le test ouvre `spip.php?page=tts_test&id_article=…` et vérifie que l’éditeur et ses services sont reliés à la même instance du formulaire. Le formulaire affiche seulement le nombre de caractères reçus : il **n’enregistre pas** l’article.
- La fonction `glossaire_tts()`, qui donne une URL prévisible au glossaire nommé `tts` pour tester les liens de glossaire.

Le fichier `hotes.e2e.js` active `tts_test` et teste aussi, si le plugin **Crayons** est présent dans le site jetable, l’édition publique par crayons. Sans Crayons, ces cas sont sautés ; le test du formulaire `tts_test` reste disponible. D’autres fichiers E2E activent `tts_test` pour le glossaire. Ce plugin est une fixture de test, pas une dépendance à installer en production.

## Lancer les autres vérifications

Depuis `prive/javascript/tiptap_spip/` :

```bash
npm test
SPIP_ROOT="$TTS_SITE" npm run equivalence
```

Pour rejouer une graine de tests de propriétés, utilisez `TTS_FC_SEED` ; `TTS_FC_RUNS` augmente le nombre de cas générés. L’oracle d’équivalence emploie `TTS_PHP` s’il est défini. Ses écarts de rendu attendus sont enregistrés dans `tests/corpus/ecarts.yaml` ; un écart nouveau fait échouer la vérification.

Depuis la racine du dépôt, pour les tests PHP sans site SPIP :

```bash
composer install
composer tests-unit
```
