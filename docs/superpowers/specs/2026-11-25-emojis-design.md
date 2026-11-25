# Insertion d’emojis dans l’éditeur SPIP

Statut : spécifications à implémenter. Arbitrage du demandeur après relecture :
**catalogue anglais d’`emoji-picker-element` partagé avec l’inline, insertion de texte Unicode,
sans nœud emoji Tiptap ; ouverture inline dès un caractère autorisé après `:`**.
Ce choix remplace l’extraction du catalogue de `@tiptap/extension-emoji`. Les deux parcours
utilisent les mêmes données, indépendamment de la langue de l’interface ; aucun alias traduit
n’est ajouté. « Plus… » et le bouton de barre ouvrent le même sélecteur complet.

Plan associé : [livraison emoji après le socle](../plans/2026-11-25-emojis.md).

## Besoin et prérequis

Insérer un emoji depuis un bouton visible, sans connaître la saisie `:nom:`. Les suggestions
pendant la frappe restent un accès complémentaire. Les deux parcours utilisent le même
catalogue et la même commande d’insertion de texte. Le filtre inline est indépendant du moteur
de recherche interne du sélecteur : leurs seuils et leur classement ne sont pas nécessairement
identiques.

Livrer d’abord le [socle de suggestions](2026-11-25-menu-suggestions-design.md), réutilisable
par d’autres fonctionnalités et plugins. Le dropdown emoji en est la première déclinaison.

La fonctionnalité est fournie avec le cœur de `tiptap_spip`, dans des modules dédiés et une
extension interne de suggestions assemblée par `coreExtensions`. Aucun plugin SPIP séparé,
nouveau nœud du schéma, nouvelle syntaxe stockée ou traitement public n’est nécessaire.

## Références et représentation

- [Emoji Trigger Button](https://tiptap.dev/docs/ui-components/components/emoji-trigger-button)
  et [Emoji Dropdown Menu](https://tiptap.dev/docs/ui-components/components/emoji-dropdown-menu) :
  références fonctionnelles. Adaptation en JavaScript sans React, sans copie de leur code UI.
  `Mod-Shift-E` reste réservé au mode source.
- [Suggestion Menu](https://tiptap.dev/docs/ui-components/utils-components/suggestion-menu) :
  socle conceptuel commun, décrit dans la spec préalable.
- [emoji-picker-element](https://github.com/nolanlawson/emoji-picker-element) : Web Component
  du sélecteur complet, sans React. Utiliser son événement `emoji-click` et les caractères
  de `event.detail.unicode` pour l’insertion, y compris la variante de peau choisie.
- [emoji-picker-element-data](https://github.com/nolanlawson/emoji-picker-element-data) :
  source unique du catalogue, jeu anglais `en/emojibase/data.json`.

Le nœud emoji a été écarté après vérification du sérialiseur : il fragmenterait les textes
utilisés pour les échappements et les marques atomiques, et différerait du JSON relu par
le parseur. Sa conversion automatique peut modifier les sélecteurs de variation. L’insertion
de texte évite ces adaptations du schéma, des empreintes, du sérialiseur et des aides de texte.

## Découpage du code et ordre de réalisation

| Module | Responsabilité et frontière |
|--------|-----------------------------|
| Socle de suggestions | Liste accessible, clavier, focus, placement et sessions ; aucune dépendance emoji |
| Ressource de catalogue | Copie au build le JSON anglais du picker, versionné et servi par le plugin ; un chargeur partagé pour le filtre inline |
| Fournisseur et extension interne emoji | Filtre dès un caractère, autorisations, suggestions `:` et insertion de texte ; utilise le socle |
| Interface emoji | Bouton, action « Plus… » et enveloppe de `emoji-picker-element` ; même commande d’insertion, clavier interne fourni par le picker |

1. Livrer et tester le socle sans dépendance emoji.
2. Distribuer le catalogue du picker et livrer le fournisseur inline d’insertion Unicode.
3. Brancher le picker sur le bouton et « Plus… », puis les accès des sous-éditeurs.

Le fournisseur n’embarque aucun parseur ou sérialiseur SPIP. Vérifier séparément le socle,
l’insertion sans interface, puis les parcours depuis le bouton et depuis le texte.

## Catalogue et poids

Ajouter `emoji-picker-element` comme dépendance d’exécution et `emoji-picker-element-data`
comme dépendance de build, dans des versions exactes verrouillées. Références étudiées :
picker `1.29.1`, données `1.8.0`. Ne pas ajouter `@tiptap/extension-emoji` : aucun de ses nœuds,
plugins ou données n’est utilisé. Aucune conversion automatique d’émoticônes ou de shortcodes.
Le web component exige `HTMLElement` dès son import : le charger seulement depuis
l’interface navigateur, jamais depuis le catalogue, le fournisseur ou `coreExtensions`.
Le fournisseur demande l’ouverture du sélecteur par son interface `ui.openEmoji`.

Le build copie sans transformation le fichier `en/emojibase/data.json` dans les ressources
du plugin, sous une URL versionnée. Configurer explicitement `dataSource` vers cette URL
locale, fournie en URL absolue par la configuration PHP comme celle du bundle, afin de
fonctionner depuis `ecrire/` et le site public. Configurer `locale: 'en-tiptap-spip-1.8.0'`
pour les données étudiées, sans CDN ni requête vers un service tiers. Cette valeur isole la
base IndexedDB du plugin et sa version ; elle ne traduit ni données ni interface. Générer le
segment de version de l’URL et celui de `locale` depuis la version du paquet de données
effectivement installé au build, avec un manifeste commun ; ne pas maintenir deux valeurs
indépendantes. Après une copie vérifiée et la publication du manifeste, le build retire
les anciens dossiers de catalogue générés dans la destination dédiée du plugin ; une mise
à jour ne cumule pas les anciennes copies du JSON dans la distribution. Ce nettoyage ne
supprime pas les anciennes bases IndexedDB du navigateur. Le filtre
inline lit exactement ce même JSON : `annotation`, `shortcodes`, `tags` et `emoji` ; les
groupes, l’ordre, les versions et les variantes de peau restent disponibles pour le picker.
Un index en mémoire dérivé de ce JSON n’est pas un second catalogue maintenu séparément.

Le moteur natif du picker ignore les requêtes d’un caractère (`MIN_SEARCH_TEXT_LENGTH = 2`,
[sources](https://github.com/nolanlawson/emoji-picker-element/blob/master/src/shared/constants.js)).
Cela n’empêche pas l’inline de chercher dès un caractère : appliquer notre filtre au JSON
complet, pour toutes les longueurs, sans appeler `Database.getEmojiBySearchQuery` pour ce
parcours. Ne pas modifier ou forker le picker pour changer son seuil. Sa recherche interne
conserve son comportement natif à deux caractères dans le sélecteur complet.

Mutualiser chargement et index inline entre instances avec une promesse partagée ; ne pas
bloquer le montage de l’éditeur. Au premier `:h`, ouvrir l’état de chargement si le JSON n’est
pas prêt, puis montrer les résultats de la requête encore courante. Un échec est un état
d’erreur distinct d’une recherche vide ; une fermeture ou une réponse obsolète ne rouvre rien.
Le chargement à la demande concerne le JSON ; le découpage différé du JavaScript n’est pas
imposé en v1. Le picker gère son cache IndexedDB ; inclure la version du JSON dans `locale`
à chaque mise à jour pour ne pas afficher d’abord l’ancien catalogue. Garder une URL et un
contenu immuables pour chaque version. Les favoris et la teinte préférée sont conservés
entre ouvertures de la même version, mais remis à zéro lors d’un changement de version ;
aucune migration de ces préférences en v1. Ne pas utiliser la base générique
`emoji-picker-element-en`, qui pourrait appartenir à un autre plugin sur la même origine.

Prévoir un état d’erreur si IndexedDB est indisponible, sans désactiver l’éditeur ni la
recherche inline qui lit le JSON sans cette dépendance. Sans en-tête HTTP `ETag`, le picker
calcule une empreinte avec `crypto.subtle` : si cette API manque, notamment en HTTP hors
contexte sécurisé, son premier chargement échoue. Documenter ce cas et afficher l’erreur
dans l’enveloppe ; ne pas ajouter de polyfill cryptographique en v1. Tester HTTPS, HTTP avec
ETag et HTTP sans ETag/`crypto.subtle`. Le filtre inline reste indépendant de cette empreinte.

Conserver versions, provenance et licences du composant et des données dans la distribution
et les crédits. Build reproductible sans réseau après installation des dépendances. Avec
les ressources déjà disponibles, l’inline fonctionne hors ligne ; le picker fonctionne
hors ligne après initialisation de son cache. Ne pas promettre un premier chargement hors
ligne si le JSON n’est ni disponible ni en cache.

Deux plafonds distincts remplacent le plafond global de 100 Kio : **40 Kio gzip maximum de
surcoût JS et CSS**, socle, dépendances, picker, traduction et enveloppe compris, et **80 Kio
gzip maximum pour le JSON**, chargé seulement à l’usage. Mesurer chaque ressource livrée
avec `gzip -n -6 -c`, puis additionner les tailles compressées des ressources JS/CSS ajoutées
et la différence des ressources existantes. Comparer la même version du build avant/après.
Le JSON anglais `1.8.0` contient 1 923 entrées et 439 662 octets bruts ; la mesure avec cette
commande donne 74 647 octets gzip, soit environ 72,9 Kio. La mesure antérieure de 72 079 octets
utilisait le niveau 9 ; elle ne sert plus de référence. L’option `-n` supprime nom et date du
fichier dans l’en-tête. Ces plafonds sont des critères de livraison ; le poids du JS/CSS
intégré reste à mesurer, sans additionner des estimations de paquets comme preuve du build.

À requête vide, conserver l’interface native du picker : catégories et emojis courants ou
favoris. Réutiliser ses fonctions intégrées de catégories, favoris et variantes de peau,
sans développer un autre sélecteur. Le nombre d’entrées dépend de la version verrouillée.

Libellés d’interface traduits par SPIP en français et anglais. Conserver noms, shortcodes et
mots-clés amont comme seul vocabulaire de recherche, pour la frappe comme pour le panneau.
Utiliser par exemple `:heart`, sans ajouter `:coeur` ou `:cœur` comme alias. Aucune traduction,
liste de synonymes locale ou adaptation de la recherche selon la langue de l’interface.
Le multilinguisme du catalogue est hors périmètre. L’objet `i18n` du picker peut traduire
les commandes de l’interface tout en gardant les données et la recherche en anglais.

## Intégration du composant et cycle d’une ouverture

Après chargement de notre dépendance, créer le composant avec
`document.createElement('emoji-picker')`, puis affecter ses propriétés avant de l’attacher
au DOM. Ne pas appeler `new Picker()` : la balise peut avoir été enregistrée par un autre
plugin. Dans ce cas, utiliser l’élément déjà enregistré, dont la version peut différer,
et vérifier les capacités nécessaires (`dataSource`, `locale`, `database.ready`, événement
de choix). Une incompatibilité produit une erreur locale au panneau, pas à l’éditeur ;
ne pas redéfinir la balise ni recourir silencieusement au catalogue de l’autre plugin.

L’enveloppe possède un état de chargement et d’erreur indépendant. Observer
`picker.database.ready()` : le message natif du picker peut disparaître après une attente
longue. Une ouverture ou un essai de rechargement crée un nouvel élément ; ne pas réutiliser
un élément dont l’initialisation a échoué. Ignorer le résultat de `ready()` après fermeture.

Chaque ouverture porte un identifiant et un verrou de validation. N’accepter qu’un seul
`emoji-click` par ouverture : vérifier que celle-ci est encore courante et ouverte, puis
revalider l’éditeur, la plage suivie et le contexte avant toute insertion. Un double-clic
ou un événement tardif après fermeture, destruction ou remplacement du panneau n’insère
rien de plus. Ne pas écouter simultanément `emoji-click` et `emoji-click-sync` pour insérer.
En l’absence de `event.detail.unicode` non vide, refuser le choix sans mutation.

Pour donner le focus initial à la recherche, autoriser l’accès ciblé
`picker.shadowRoot?.querySelector('input[type=search]')` dans un adaptateur testé sur la
version retenue. Si ce champ n’est pas disponible, donner le focus à l’enveloppe nommée et
focusable. Cette exception sert au focus, pas au préremplissage ni au remplacement du moteur
interne. Encadrer le picker par deux sentinelles focusables : leur réception du focus marque
la sortie par Tab/Maj+Tab et déclenche le parcours défini par le socle, sans inventaire des
contrôles privés du Shadow DOM. La cible de repli, l’état d’erreur et « Réessayer » se situent
entre ces sentinelles dans l’ordre de tabulation : prévoir une cible interne nommée si
l’enveloppe extérieure précède la première sentinelle. En erreur, Tab depuis cette cible
atteint « Réessayer » ; le Tab suivant sort vers l’avant, sans fermeture prématurée.

## Parcours depuis le bouton

1. Le rédacteur place le curseur ou sélectionne du texte et active « Emoji ».
2. Un panneau ancré au bouton affiche `emoji-picker-element`, sans écrire `:` dans le
   document. Le focus va dans sa recherche ; catégories et navigation restent celles du picker.
3. Le choix remplace la sélection mémorisée par `event.detail.unicode`, sans normalisation.
   Le panneau se ferme et le focus revient immédiatement après le texte inséré.

Ouvrir, rechercher et annuler ne changent ni document ni historique. Échap ferme et rend le
focus au bouton ; un clic extérieur laisse le focus à sa cible. Fermer sans insérer si la
sélection mémorisée devient obsolète. Aucun espace automatique ajouté.

Le composant déclaratif `emoji` se place par défaut dans ces barres :

| Barre | Emplacement |
|-------|-------------|
| `edition` | Après `caracteres`, avant le séparateur du multilinguisme |
| `forum` | Après `code`, avant le séparateur du mode source |
| `minimale` | Après `lien`, avant le séparateur du mode source |
| `modele` | Pas d’ajout par défaut |

Le pipeline `tiptap_spip_toolbars` peut déplacer ou retirer le bouton, sans changer les textes
existants. Ce retrait ne désactive pas les suggestions inline : le fournisseur appartient à
`coreExtensions` et reste actif dans les contextes autorisés de toutes les barres, `modele`
comprise. Aucun couplage entre présence du bouton et déclencheur `:` en v1. Bouton visible et
désactivé en source, lecture seule ou contexte exclu ; aucun nouveau raccourci clavier global.

Les sous-éditeurs de note et de multi n’ont actuellement aucune barre. Ajouter un petit
bouton « Emoji » près du texte de la note et près de chaque zone de langue du multi, sans
créer de barre complète. Chaque bouton cible son sous-éditeur, mémorise sa sélection et
utilise le même panneau ; le popover parent reste ouvert et n’est pas validé par ce choix.
Le panneau est monté à côté du `<form>` dans l’élément de dialogue parent, jamais dans le
formulaire. Les boutons de notre enveloppe sont `type="button"`, elle ne modifie ni
`Popover.current` ni l’enfant popover du parent. Laisser le picker gérer son clavier interne ;
empêcher toute soumission du formulaire parent, y compris sur Ctrl/Cmd+Entrée. Tab/Maj+Tab
parcourt les contrôles du picker ; quand la navigation sort du composant, fermer le panneau
et rejoindre le contrôle suivant/précédent du parent par rapport au bouton déclencheur.
Ouvrir un autre popover ferme d’abord le panneau sans reprendre le focus, selon le socle.
Fermer le parent détruit boutons, panneaux et sessions. Les suggestions inline y sont aussi
disponibles. Aucun état de session dans l’objet `tiptapSpip` partagé avec le parent.

## Suggestions pendant la frappe

- Ouvrir dès le **premier caractère autorisé après `:`** : lettres ASCII, chiffres, `_`,
  `-`, `+` et `=`, sans distinction de casse. Configurer le fournisseur avec
  `minQueryLength: 1`, `queryPattern: /^[a-z0-9_+=-]+$/i`, `allowSpaces: false` et
  `allowedPrefixes: [' ', '\n']`. Le matcher utilise le même alphabet. Seuil et motif
  contrôlent réellement l’ouverture via l’adaptateur, pas seulement la recherche native.
  `:` seul ne déclenche rien ; `:h`, `:-`, `:+` et `:=` déclenchent une recherche et affichent
  le menu s’il existe des correspondances dans le catalogue partagé avec le picker.
- Avant `:`, accepter uniquement l’absence de caractère au début du bloc, un espace
  ordinaire U+0020 ou un retour à la ligne. Ce dernier peut être une frontière entre blocs
  ou un saut de ligne explicite dans le même bloc. Ne pas traiter un simple changement de
  nœud texte ou de mark comme un début de ligne.
  Les espaces insécables U+00A0 et U+202F ne sont pas des préfixes autorisés en v1.
- Utiliser le matcher du socle tenant compte du bloc entier et des limites de marks/atomes :
  le début d’un nœud texte ne vaut pas début du bloc ; reconnaître le saut de ligne explicite
  comme préfixe autorisé, les autres atomes restent des séparateurs non autorisés.
- Filtrer uniquement annotations, shortcodes et tags du catalogue du picker : correspondance
  classée par un filtre propre à l’emoji, sans distinction de casse : **shortcode exact**,
  puis **shortcode en préfixe**, puis **annotation ou tag exact**, puis **annotation ou tag
  en préfixe**, puis **inclusion dans l’un de ces champs**. Conserver un seul résultat par
  emoji, avec son meilleur rang ; à rang égal, trier par `order` du catalogue puis par sa
  position dans le fichier. Ne pas appliquer le filtre commun ensuite, ni placer tags et
  shortcodes au même rang. Aucun enrichissement linguistique ni traduction de la requête.
  `:heart` permet de chercher l’emoji correspondant ; `:coeur` n’est pas un alias de `:heart`.
  En particulier, `:heart` place ❤️ en premier et `:smile` place l’emoji du shortcode exact
  `smile` avant ceux dont seul un tag ou une annotation correspond.
- Recalculer à chaque ajout ou suppression à partir de **toute la requête courante** après
  `:`. `:h` propose les correspondances de `h`, puis `:he` les remplace par celles de `he` ;
  supprimer le `e` rétablit celles de `h`. Les préfixes de shortcodes passent avant les
  correspondances par inclusion. `:h` et `:he` doivent donc produire des listes adaptées à
  ces deux requêtes, à partir des entrées du JSON partagé. Le catalogue versionné détermine
  les noms et résultats effectivement disponibles. Pour chaque emoji, choisir le shortcode
  affiché parmi ses alias : exact d’abord, sinon premier alias en préfixe, sinon premier alias
  contenant la requête, sinon premier alias du catalogue. Garder l’ordre amont pour départager
  les alias. Ainsi `:smile` affiche `:smile:` même si ce n’est pas le premier alias de l’emoji.
  Le `title` interne est le shortcode brut, sans glyphe ni `:` ; seul le rendu ajoute le
  glyphe et les deux `:`. Garder annotation, tags et caractères Unicode dans les données de
  contexte, sans confondre chaîne affichée et clés du classement.
- Pour l’inline, afficher les **six premiers résultats** classés, puis une action « Plus… »
  si d’autres existent. Elle ouvre le même picker que le bouton, sans pagination inline.
  Elle n’est pas une option emoji et ne passe jamais dans la commande d’insertion. Le contrôle
  interne permet d’y accéder avec Flèche bas après la sixième option puis Entrée, ou au clic ;
  fermer la liste et donner le focus à la recherche du picker. Mémoriser la plage `:requête`
  avant le transfert : un choix dans le picker la remplace exactement, une annulation laisse
  le texte intact et rend le focus à l’éditeur. Marquer la session inline comme rejetée,
  selon la même règle qu’Échap, avant ce retour de focus pour empêcher sa réouverture.
  Ancrer ce panneau près de la plage inline ; celui du bouton reste ancré au bouton.
  Le picker s’ouvre sur sa vue native, sans préremplissage de sa recherche par un accès privé
  au Shadow DOM. À chaque modification inline, refiltrer tout le catalogue et réinitialiser
  les six résultats et l’option active. Cette limite de présentation ne limite pas la recherche.
- Aucun résultat actif à l’ouverture ou après changement de requête. Flèches pour activer
  et parcourir ; Entrée valide seulement une option active, sinon garde sa fonction normale.
  Flèche haut sans choix actif désigne le dernier emoji visible, pas « Plus… » ; depuis
  « Plus… », Flèche haut revient au dernier emoji. Un clic sur une option la valide directement.
- Sans correspondance, masquer la liste emoji inline et retirer ses relations ARIA plutôt
  qu’afficher « aucun résultat » ; la requête peut continuer et une correspondance ultérieure
  peut rouvrir la liste, sauf après Échap. Le panneau du bouton conserve son état vide annoncé.
  Haut/Bas restent disponibles à l’éditeur en liste vide, chargement ou erreur.
- Accepter la différence de présentation liée à l’appareil : le picker peut masquer les
  emojis non pris en charge, tandis que l’inline garde les correspondances du JSON. L’inline
  insère le caractère de base de `emoji` ; la teinte préférée du picker ne s’y applique pas.
  Ces différences ne constituent ni un deuxième catalogue ni une conversion du document.
- Remplacer exactement `:requête`, sans espace ajouté. Le socle isole la validation dans
  l’historique : une annulation restaure la requête, une frappe ultérieure reste séparée.
  La requête et la plage s’arrêtent au curseur : dans `:he|art`, rechercher `he` et remplacer
  seulement `:he` en cas de choix ; le suffixe `art` reste intact. Ne pas consommer une fin
  de mot que l’utilisateur n’a pas incluse dans la requête.
- Un espace saisi après `:` ou dans la requête ferme immédiatement le menu, sans insertion
  ni suppression de texte. Un retour à la ligne ou un autre caractère hors motif ferme aussi
  la session ; la frappe conserve son comportement normal. Supprimer la requête jusqu’à
  ne laisser que `:` ferme le menu. Le champ de recherche du panneau reste un champ libre :
  cette règle de fermeture concerne le déclenchement inline.
- Échap ferme et conserve la saisie ; continuer la même requête ne rouvre rien avant un
  espace/retour à la ligne ou une nouvelle plage. Tab ferme sans valider et garde sa fonction.
- Taper, charger ou coller `:smile:`, `mot:smile:`, `:)` ou `<3` reste littéral. Une insertion
  exige un choix explicite ; aucune règle automatique de conversion des shortcodes en v1.
- Aucune ouverture dans `https://`, `12:30`, `mot:terme`, en composition IME ou en zone exclue.

## Contextes et conservation du contenu

Autoriser dans les textes des paragraphes, titres, listes, citations, poésie, cellules de
tableau, liens, glossaires, abréviations, notes et multis. Conserver les marks actives comme
pour une saisie ordinaire ; le texte suivant garde les marks prévues par l’éditeur.

Désactiver le sélecteur dans code en ligne, blocs de code, cadre, HTML, math, Markdown brut,
nœuds bruts et attributs (URL, bulles, paramètres de modèle, noms de note, langues). Les
caractères collés ou déjà présents dans ces zones restent intacts, sans conversion.

Les emojis Unicode sont des nœuds texte ordinaires. Chargement, édition, copie et bascule
source n’appliquent aucune normalisation Unicode, suppression de VS15/VS16, conversion en
shortcode ou image. Préserver variantes de peau, sélecteurs de variation, drapeaux et ZWJ,
même absents du catalogue. Parseur, sérialiseur et empreintes existants restent la référence ;
ne pas leur ajouter de cas `type === 'emoji'`.

### Enregistrement SQL

L’identité de source garantie par l’éditeur porte sur la source reçue et rendue au textarea.
SPIP peut ensuite transformer les caractères hors BMP en entités numériques avec une
connexion MySQL `utf8` et `_MYSQL_NOPLANES`. La documentation de
[`utf8_noplanes`](https://code.spip.net/ecrire/packages/Application.html#function_utf8_noplanes)
décrit cette compatibilité et l’alternative `utf8mb4`.

Ne pas promettre d’identité octet pour octet avant/après passage en base dans tous les
environnements. Tester enregistrement, rechargement et rendu public avec SQLite,
MySQL/MariaDB `utf8mb4` et la connexion `utf8` de compatibilité. Préserver les entités
renvoyées sans double échappement ni changement lors d’une édition voisine. Le parseur
actuel les conserve dans des nœuds bruts : cette livraison garde leur affichage brut
éditable, sans migration SQL ni décodage global des entités. Documenter cette limite
d’affichage pour les connexions concernées.

Une entité numérique rechargée est donc un atome brut : `:smi` tapé juste après elle,
sans espace U+0020, n’ouvre pas de suggestions. Ajouter cet espace rétablit le préfixe
autorisé ; le bouton reste utilisable à une position de texte autorisée. Ce comportement
conserve la règle commune des atomes, sans décodage spécial pour l’emoji.

## Interface, nettoyage et recette

Appliquer le contrat du socle : liste inline non modale, panneau distinct, placement depuis
un rectangle, parent et plein écran. Liste et enveloppe sont des popovers HTML `manual`,
indépendants de la classe `Popover`, pour ne pas être coupés par le parent défilant.
L’enveloppe traite Échap en remontée : laisser le picker fermer et consommer d’abord sa
liste de teintes. Le gestionnaire de plein écran en capture s’abstient tant qu’un panneau
est ouvert ; si Échap atteint l’enveloppe, fermer seulement celle-ci et consommer la touche.

Boutons nommés, `aria-expanded`/`aria-controls`, recherche libellée, liste et options
accessibles. Nom de l’emoji annoncé avec le glyphe ; états annoncés sans déplacer le focus.
Le nom annoncé est celui du catalogue anglais du picker, quelle que soit
la langue de l’interface ; les noms d’emojis ne sont pas traduits par cette fonctionnalité.
Classes `tts-` pour l’enveloppe ; adapter taille, thème et couleurs du picker par ses variables
CSS publiques, sans recopier son interface interne. Utiliser l’icône locale `svg-add-emoji`
([source SVG Repo](https://www.svgrepo.com/svg/309597/emoji-add)), décorative et accompagnée
d’un nom accessible pour le bouton. La fiche indique CC0 lors de l’étude ; conserver cette
provenance plutôt que déclarer MIT sans autre source. Fermer et nettoyer au changement de mode,
à la fermeture du parent et à la destruction. Aucun événement tardif ne rouvre ou n’insère.

| Cas | Résultat attendu |
|-----|------------------|
| Ouvrir depuis le bouton sans taper | Vue native du picker visible ; choix au clavier, à la souris ou au toucher |
| Sélectionner un mot puis choisir 😄 | Texte Unicode à sa place ; marks conservées ; une annulation restaure le mot |
| Ouvrir, rechercher, annuler | Document et historique inchangés |
| Taper `Voici la liste :` puis Entrée | Aucun menu ; retour à la ligne normal |
| Taper `:h` ou `:s` dans un contexte autorisé | Recherche dès le premier caractère ; six premiers résultats disponibles, puis « Plus… » si nécessaire |
| Passer de `:h` à `:he`, puis effacer `e` | Refiltrage sur toute la requête ; résultats remplacés à chaque étape ; aucun résultat actif spontanément |
| Rechercher `h`, `heart`, `smile` | Préfixes de shortcodes avant tags ; ❤️ en premier pour `heart`, 😄 en premier pour `smile` ; alias correspondant affiché, sans `:` dans le titre interne |
| Taper `:-`, `:+` ou `:=` | Caractère initial accepté ; suggestions du catalogue si elles existent, sinon liste masquée |
| Taper `:h `, ou un retour après `:h` | Menu fermé immédiatement ; texte et espace/retour conservés ; aucune insertion implicite |
| Effacer `h` de `:h` | Il reste `:` ; menu fermé |
| Taper `:h` au début, après U+0020 ou après un saut de ligne explicite | Menu autorisé ; aucun préfixe artificiel aux frontières de marks |
| Taper `mot:h`, `https://` ou `12:30` | Aucun menu ; caractère précédent non autorisé |
| Activer « Plus… » au clic ou avec Flèche bas puis Entrée | Picker complet ouvert ; plage `:requête` mémorisée ; aucune pagination ni mutation |
| Choisir un emoji dans le picker ouvert par « Plus… », ou annuler | Choix : remplacement exact de `:requête` ; annulation : texte conservé, focus à l’éditeur |
| Annuler après « Plus… », puis continuer la même requête | État rejeté identique à Échap ; aucune réouverture automatique |
| Flèche haut sans option active, ou depuis « Plus… » | Dernier emoji visible actif ; aucune ouverture du picker |
| Curseur dans `:he` suivi de `art` | Recherche de `he` ; choix remplaçant seulement `:he`, suffixe `art` préservé |
| Taper `:smi` puis Entrée sans navigation | Pas de choix implicite ; texte et retour conservés |
| Taper `:smi`, naviguer et valider | Remplacement exact sans espace ajouté ; annulation rétablit la requête |
| Déclencheur après un mot en gras sans espace ou après un atome | Pas de faux début de bloc ni d’ouverture |
| Taper, charger ou coller `:smile:`, `mot:smile:`, `:)`, `<3` | Conservation littérale |
| Taper `:heart` ou rechercher `heart` dans le panneau | Résultat issu du même catalogue anglais du picker, quelle que soit la langue de l’interface |
| Taper `:coeur` ou rechercher `coeur` dans le panneau | Aucun alias local vers `heart` ; seuls les champs amont sont recherchés |
| Taper `:cœur` | Aucun menu, caractères hors de l’alphabet de déclenchement ; texte conservé |
| Taper `:smi` après U+00A0 ou U+202F | Aucun menu ; seul U+0020 est accepté comme espace préfixe |
| Taper une requête sans résultat, dont `:--` | Liste inline masquée ; Haut/Bas disponibles ; un résultat ultérieur peut rouvrir la liste sans choix implicite |
| Valider une option active dans liste, tableau ou titre | Insertion de l’emoji avant les raccourcis du bloc ; sans résultat actif, édition normale |
| Retirer le bouton ou utiliser la barre `modele` | Suggestions inline toujours disponibles dans les contextes autorisés |
| Modifier le voisinage de `[a 😄 b]`, `[?a 😄 b]`, `[AB😄|explication]` | Crochets, marks et sémantique conservés |
| Modifier le voisinage de `😄 👍🏽 👩‍💻 🇫🇷 ❤️` | Séquences inchangées, FE0F et ZWJ compris |
| Texte avec code à risque, note et multi inchangés | Relecture et empreintes conservatrices valides |
| Bouton de note ou d’une langue du multi | Bonne sélection ; parent ouvert ; aucune insertion dans une autre zone |
| Entrée/Ctrl+Entrée/Cmd+Entrée dans le panneau | Navigation/sélection du picker seulement ; aucune validation de note/multi ou soumission de formulaire |
| Tab/Maj+Tab dans le panneau d’une note ou d’un multi | Navigation interne native ; à la sortie, fermeture sans insertion et focus au contrôle voisin du parent |
| Échap avec la liste des teintes ouverte, puis nouvel Échap | Teintes fermées d’abord, panneau fermé ensuite ; note et plein écran conservés |
| Faire défiler la note avec liste ou panneau ouvert | Affichage en couche supérieure, sans découpage ni déplacement incorrect |
| Ouvrir un autre popover pendant que le panneau est ouvert | Panneau fermé avant l’ouverture ; focus au nouveau popover ; aucun changement indu de `Popover.current` |
| Enregistrer/recharger dans les trois configurations SQL | Unicode ou entités selon SPIP ; pas de perte ni double échappement ; rendu public équivalent |
| Taper `:smi` juste après une entité SQL devenue atome brut | Aucun menu sans espace U+0020 ; ouverture autorisée après cet espace |
| Fermer le parent, changer de mode, détruire | Panneau fermé ; pas de fuite ni insertion tardive |
| Clavier/lecteur d’écran, plein écran et sous-éditeurs | Focus correct ; premier Échap limité aux suggestions |
| `:h` au premier chargement puis `:he` avant résolution du JSON | Chargement immédiat, puis seuls les résultats courants ; seuil inline d’un caractère indépendant du seuil natif du picker |
| Comparer les ressources et le vocabulaire des deux parcours | Même fichier anglais versionné ; aucune donnée Tiptap parallèle ni traduction ajoutée |
| Autre plugin utilisant le picker sur la même origine | Base `en-tiptap-spip-<version>` isolée ; élément créé sans constructeur imposé ; incompatibilité limitée au panneau |
| Mettre à jour le catalogue | Nouvelle base versionnée, aucune ancienne liste ; favoris/teinte remis à zéro, données de l’ancienne base non supprimées automatiquement |
| Double-clic, choix retardé après fermeture ou plage devenue invalide | Au plus une insertion valide par ouverture ; aucun événement tardif ne modifie le document |
| Erreur après attente longue, puis réessai | Erreur persistante dans l’enveloppe ; réessai avec un nouvel élément ; aucune action tardive de l’ancienne ouverture |
| Panneau en erreur, focus sur la cible de repli puis deux Tab | Cible, erreur et « Réessayer » entre les sentinelles ; premier Tab sur « Réessayer », suivant vers le contrôle voisin dans le sens avant ; pas de sortie arrière prématurée |
| HTTP avec ETag, puis HTTP sans ETag et sans `crypto.subtle` | Premier cas pris en charge ; second : erreur du picker explicite, inline et éditeur utilisables |
| Appareil masquant un emoji ou teinte préférée enregistrée | Différences natives du picker acceptées ; inline sur le JSON et caractère de base |
| IndexedDB indisponible ou catalogue non accessible | Erreur limitée au parcours concerné ; éditeur utilisable ; inline indépendant d’IndexedDB |
| Livraison et usage hors ligne | JSON local partagé, aucun CDN ni image distante ; cache et mises à jour vérifiés ; plafonds gzip mesurés |

Validation prévue : copie reproductible du catalogue et Vitest du filtre, des commandes, de
l’historique et des aller-retours ; Playwright Chromium/Firefox/WebKit avec axe ; recette SQL
et rendu SPIP réel. Relever aussi le montage du texte de 50 000 caractères
([spec 08](../../specs/08-tests-recette.md)). Aucun test n’est présenté ici comme déjà exécuté.

À la livraison : mettre à jour specs 06/07/08, documentation français/anglais, licences et
CHANGELOG. Les specs 03/04 ne gagnent aucun nœud ni format emoji ; préciser la limite SQL.
