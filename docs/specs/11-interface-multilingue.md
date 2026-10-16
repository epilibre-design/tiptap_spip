# Interface multilingue de Tiptap SPIP — première phase

## Objectif et périmètre

L'interface de l'éditeur doit afficher ses libellés dans la langue de l'interface SPIP. Cette première phase livre **une traduction anglaise**, en plus du français déjà présent. Elle couvre l'espace privé, les formulaires publics et Crayons, y compris leurs rechargements AJAX, sous SPIP 4.2 à 5.x.

La langue de l'interface est distincte de la langue de l'objet édité et de celle affichée dans un bloc `<multi>`. Changer la langue du texte ne retraduit pas les boutons. Les noms proposés dans le sélecteur `<multi>` restent ceux fournis par `traduire_nom_langue()` de SPIP, par exemple « English » et « français » ; ils ne font pas partie des chaînes à traduire du plugin.

## Architecture

Conserver l'injection des libellés dans `window.spipConfig.tiptap_spip.i18n`, au sein de la page hôte. `tiptap_spip_head()` rend `prive/javascript/tiptap_spip_config.js.html` avec `recuperer_fond()` ; le fond garde son `#CACHE{0}`. Le démarrage de l'éditeur conserve son ordre actuel et ne charge aucun catalogue séparé.

Sous SPIP 4.4.21, `recuperer_fond()` ajoute automatiquement la langue courante au contexte quand `lang` n'est pas fourni (`ecrire/inc/utils.php`, `recuperer_fond()`), puis le rendu du fond sélectionne cette langue (`ecrire/public/parametrer.php`). `_T()` utilise `$GLOBALS['spip_lang']` (`ecrire/inc/utils.php`). Le rendu actuel du fond et le pipeline `tiptap_spip_i18n` s'exécutent donc déjà dans la langue du fond. Dans le public, le `lang` de l'URL entre dans le contexte et dans la clé de cache de la page (`ecrire/public/assembler.php`, `ecrire/public/cacher.php`). La page publique hôte peut conserver son HTML en cache même si le fond inclus porte `#CACHE{0}`.

## Résolution de la langue

1. Garder l'appel actuel de `recuperer_fond()` dans `tiptap_spip_head()`, avec son seul argument de contexte `prive`. Les traductions du fond et celles des extensions suivent la langue courante de SPIP au moment du rendu. Ne pas ajouter de sélection ou de validation de langue propre au plugin.
2. Dans le privé, les libellés suivent la langue d'interface effectivement sélectionnée par SPIP pour la page. Dans le public, ils suivent la langue du rendu de la page, y compris `?lang=...` quand SPIP l'applique. La langue du textarea et celle d'un bloc `<multi>` ne pilotent pas les libellés.
3. Une clé absente de la traduction demandée suit le repli de SPIP vers la langue du site, puis vers le français (`ecrire/inc/traduire.php`). Un site en allemand sans `lang/tiptap_spip_de.php` affiche ainsi l'interface du plugin en français ; cette phase fournit les catalogues français et anglais.
4. Dans `prive/javascript/tiptap_spip_config.js.html`, ajouter la langue courante à l'URL `services` : `[(#URL_PAGE*{tiptap_spip_services}|parametre_url{lang,#ENV{lang},&}|url_absolue|tiptap_spip_js_string)]`. L'étoile de `#URL_PAGE*` et le séparateur `&` produisent une URL utilisable directement par JavaScript, sans `&amp;`. Cette URL sert au chargement à la demande dans Crayons et les autres hôtes sans formulaire SPIP. La requête initiale `?page=tiptap_spip_services` doit recevoir la même langue que la page hôte ; le fond `tiptap_spip_services.html` la transmet explicitement à son inclusion avec `{lang=#ENV{lang}}`. Le formulaire ainsi rendu conserve `lang` dans son URL d'action. SPIP 4.4 place aussi la langue du formulaire dans ses arguments CVT signés et la restaure avant `verifier()` et `traiter()` (`ecrire/balise/formulaire_.php`, `ecrire/public/aiguiller.php`).

## Chaînes et extensions

- Ajouter `lang/tiptap_spip_en.php` avec une traduction anglaise de toutes les clés d'interface de `lang/tiptap_spip_fr.php`, y compris les textes d'erreur, les attributs ARIA et les messages avec paramètres `@nom@`. `lang/tiptap_spip_fr.php` reste la référence ; les fichiers `paquet-tiptap_spip_*.php` ne traduisent que les métadonnées du plugin.
- Garder `src/ui/labels.js` comme repli français côté navigateur. Adapter `tests/ui/i18n.test.js` à la nouvelle expression SPIP du fond, puis l'étendre : toutes les clés de `lang/tiptap_spip_fr.php`, y compris celles de la page de configuration, doivent exister dans `lang/tiptap_spip_en.php` avec les mêmes paramètres `@nom@`. Les clés transmises par la configuration JS et utilisées par `label()` doivent rester couvertes par `labels.js` et par les deux fichiers de langue. Une traduction anglaise manquante fait échouer le test.
- Garder le contrat actuel du pipeline `tiptap_spip_i18n` : `$flux['data']` contient `clé => texte déjà traduit`. Les extensions utilisant `_T()` traduisent sous la langue courante du fond. L'exemple FAQ reçoit aussi un fichier `lang/tiptap_spip_faq_en.php` pour que ses libellés soient anglais lorsque cet exemple est installé.
- Préserver la précédence actuelle : les clés ajoutées par le pipeline tiers arrivent après les clés du cœur et peuvent les remplacer. Ce comportement doit être documenté et testé avec une clé tierce qui porte le même nom qu'une clé du cœur ; ce n'est pas une collision ignorée silencieusement.

## Insertion sûre dans le script

La configuration est écrite dans un `<script type="module">` intégré à la page. Ajouter dans `tiptap_spip_fonctions.php` un filtre `tiptap_spip_js_string()` qui renvoie `json_encode((string) $texte, TIPTAP_SPIP_JSON)`, y compris pour la chaîne vide. Dans `prive/javascript/tiptap_spip_config.js.html`, remplacer chaque valeur du cœur de forme `"<:tiptap_spip:cle|texte_script:>"` par une valeur JSON non entourée de guillemets, par exemple `<:tiptap_spip:mode_source|tiptap_spip_js_string:>`. Le compilateur des squelettes SPIP 4.4 applique les filtres directement aux chaînes de langue (`ecrire/public/compiler.php`). Garder les noms des clés et le dictionnaire `i18n` actuels. Les chaînes tierces restent encodées avec les mêmes drapeaux `TIPTAP_SPIP_JSON`. Cet encodage protège le script intégré, notamment contre `</script>`.

Tester au minimum les guillemets, antislashs, sauts de ligne, accents et `</script>` dans une traduction de test, ainsi qu'une valeur apportée par le pipeline. Le HTML final doit garder un script valide, et `label()` doit rendre le texte attendu sans exécuter de contenu injecté.

## Recette de la première phase

1. Basculer la préférence d'un auteur du français vers l'anglais dans le privé : vérifier barre d'outils, popovers, barre d'état, erreurs et noms accessibles. Ouvrir deux comptes de langues différentes : chacun reçoit ses libellés, sans création d'une ressource de traduction par compte.
2. Sur un site où le français et l'anglais sont activés, vérifier les mêmes libellés dans un formulaire public et dans Crayons, sur des pages françaises et anglaises dont une appelée avec `?lang=en`. Dans Crayons sur cette page anglaise, provoquer une erreur de validation du service : son texte renvoyé par `verifier()` est en anglais, même si le cookie de langue du visiteur est français. Vérifier que l'URL du chargement initial des services et l'URL d'action du formulaire portent `lang=en`. Recharger un formulaire par AJAX : les nouveaux éditeurs utilisent la langue effective de la page, sans requête de traduction supplémentaire.
3. Vérifier que changer la langue affichée d'un `<multi>` ou éditer un objet d'une autre langue ne change pas la langue de l'interface.
4. Vérifier la couverture complète des clés et des paramètres en anglais, le repli d'une langue sans traduction, l'insertion sûre dans le script et la précédence d'une clé du pipeline tiers.
5. Exécuter la recette sur SPIP 4.2 et 5.x.
