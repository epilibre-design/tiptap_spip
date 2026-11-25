# Menu de suggestions réutilisable

Statut : proposition de spécifications, préalable à la fonctionnalité emoji.

Plan associé : [livraison du socle](../plans/2026-11-25-menu-suggestions.md).

## Objectif et livraisons

Créer une brique commune de sélection de suggestions. Les emojis en sont la première
déclinaison ; un plugin tiers doit pouvoir fournir une autre liste et sa commande sans
réimplémenter clavier, focus, positionnement et gestion des recherches.

La référence fonctionnelle est le [Suggestion Menu de Tiptap](https://tiptap.dev/docs/ui-components/utils-components/suggestion-menu),
dont le dropdown emoji est une déclinaison. L’adaptation respecte l’architecture JavaScript
sans React du projet ; elle ne recopie pas le code des composants UI Tiptap.

1. **Socle** : liste accessible, adaptateur `@tiptap/suggestion`, contrat et API des fournisseurs.
2. **Emojis** : catalogue, recherche, insertion et bouton, selon la [spec dédiée](2026-11-25-emojis-design.md).

Mentions, recherche d’objets SPIP, modèles et commandes `/` sont des usages possibles,
sans fournisseur livré dans cette première version. Le popover de lien existant n’est pas migré.

## Architecture et dépendances

| Brique interne | Responsabilité |
|----------------|----------------|
| Liste de suggestions | Options, résultat actif, clavier, annonces et défilement ; aucun catalogue ni type de contenu imposé |
| Adaptateur Tiptap | Déclenchement, plage courante, recherche et cycle de vie ; un plugin Suggestion par fournisseur et éditeur |
| Fournisseur | Résultats, restrictions métier et commande de validation |
| Panneau explicite | Enveloppe d’un sélecteur propre à la fonctionnalité ; mémorisation de la sélection ou plage inline, placement, fermeture et retour du focus |

Le socle ne dépend pas des emojis. Ajouter `@tiptap/suggestion` dans la même version exacte
que les paquets Tiptap (`3.31.4` actuellement), et satisfaire sa dépendance paire
`@floating-ui/dom` avec une version verrouillée dans le lockfile. Mesurer les deux dans le
bundle. Les [sources du paquet](https://github.com/ueberdosis/tiptap/blob/v3.31.4/packages/suggestion/package.json)
et de son adaptateur sont la référence technique, distincte des composants UI React.

La suggestion inline utilise un conteneur non modal qui ne prend pas le focus et ne modifie
pas `Popover.current`. Liste inline et enveloppe du panneau utilisent chacune un popover
HTML `popover="manual"`, affiché par `showPopover()`, pour accéder à la couche supérieure
et échapper au découpage par le dialogue parent défilant. Cela n’emploie pas la classe
`Popover` du projet et ne doit ni prendre le focus inline ni fermer le parent.
Le panneau ouvert depuis un bouton possède son champ de recherche et
sa propre gestion du focus ; sa liste n’est pas nécessairement celle du socle. L’emoji utilise
`emoji-picker-element` pour ce parcours et conserve la liste commune seulement en inline.
Ce panneau est un conteneur sans `<form>` : dans une note ou un
multi, le monter dans l’élément de dialogue parent, à côté de son formulaire, jamais dedans.
Hors popover, le monter dans le wrapper de l’éditeur. Les boutons de l’enveloppe sont tous
`type="button"` ; le composant hébergé conserve sa propre interface.
Il ne remplace ni `Popover.current` ni `parent.enfant` ; le parent reste courant et ouvert.
Ne pas créer de `Popover` pour cette liste ou ce panneau. Le panneau gère son propre clavier,
ses champs restent hors de `parent.focusables()` et du piège de focus du formulaire.

Fermer les suggestions inline et panneaux ouverts avant l’ouverture d’un autre `Popover`,
y compris un enfant du même parent, sans rendre le focus à l’ancien bouton. Prévoir cette
notification interne dans `Popover.open()`. Fermer aussi le panneau à la fermeture de son
parent ou à l’ouverture d’un autre panneau ; ne jamais valider le formulaire parent.

Extraire des aides de placement existantes un positionnement depuis un rectangle fourni
par une fonction : plage de saisie pour l’inline et son action « Plus… », bouton pour un
panneau ouvert depuis la barre. Ne pas faire dépendre
le placement de `liste.parentElement`. Avec ce placement, ne pas appeler le `mount()` de
Suggestion, qui apporterait une seconde gestion du placement et de la fermeture.

## API publique de première version

Deux fonctions supplémentaires dans `window.tiptapSpip.ui` et dans l’export `ui` du module :

```js
ui.creerSuggestions(options) // → Extension Tiptap, à passer à registerExtension
ui.filtrerSuggestions(items, query) // → nouvelle liste classée, sans modifier items
```

Le contrôleur de liste et les adaptateurs de rendu restent internes. Aucun export public
`MenuSuggestions`, `Suggestion` ou mécanisme de branchement sur un plugin Suggestion externe
n’est promis en v1. Les fournisseurs tiers utilisent la fabrique ; le cœur peut réutiliser
ses aides internes pour un composant spécialisé.

### Options de la fabrique

| Option | Type et comportement |
|--------|----------------------|
| `name` | Chaîne obligatoire et préfixée par le plugin ; nom de l’extension et base d’une `PluginKey` propre |
| `char` | Un caractère déclencheur obligatoire ; un seul fournisseur actif par caractère dans un éditeur, doublons ignorés avec avertissement |
| `items` | `({ editor, query, signal }) => Item[] \| Promise<Item[]>` ; aucune recherche réseau implicite |
| `command` | `({ editor, range, item }) => boolean` synchrone ; `true` après succès, `false` pour un refus sans mutation |
| `allow` | `({ editor, state, range }) => boolean`, facultatif ; ajoute une restriction aux exclusions communes |
| `minQueryLength` | Entier positif ou nul, défaut `0` ; sous ce seuil, aucune ouverture ni recherche |
| `queryPattern` | Expression régulière facultative validant la requête entière ; son échec empêche l’ouverture ; utiliser une copie interne sans les drapeaux `g` et `y` pour que `test()` soit stable |
| `allowedPrefixes` | Liste de caractères autorisés avant le déclencheur, défaut espace ordinaire U+0020 ; le début réel du bloc est aussi autorisé ; `\n` autorise un saut de ligne explicite dans le bloc ; aucune équivalence implicite avec les espaces insécables |
| `startOfLine` | Booléen, défaut `false` ; impose un début réel de bloc |
| `allowSpaces` | Booléen, défaut `false` ; dans ce cas, un espace termine la requête inline et ferme la liste sans modifier le texte |
| `labels` | Objet obligatoire : `suggestions`, `loading`, `empty`, `error`, déjà traduits par le plugin |

Un `Item` comporte `id` et `title` (chaînes obligatoires), éventuellement `subtext`,
`keywords` (liste de chaînes) et `context` (données pour la commande). Le rendu public est
fixe : titre et sous-texte. Le rendu de glyphes du fournisseur emoji reste une adaptation
interne ; pas de `renderItem` public en v1. Toute chaîne provenant d’un service est affichée
comme texte, sans injection de HTML.
Le `title` utilisé comme clé de filtrage reste sans décoration : ponctuation ajoutée et
glyphes appartiennent au rendu. Le fournisseur emoji choisit l’alias pertinent comme titre
et emploie son propre classement, défini dans sa spec ; le filtre commun n’est pas imposé.

Le filtre commun compare titre, sous-texte et mots-clés sans distinction de casse :
correspondance exacte, puis préfixe, puis inclusion. À rang égal, garder l’ordre fourni.
Il n’ajoute aucune traduction, aucun synonyme localisé et aucune équivalence d’accents ou
de ligatures. Les données et les éventuelles règles métier de recherche appartiennent au
fournisseur ; ne modifier ni libellés, ni données, ni texte inséré.
Une requête vide rend toute la liste. Le fournisseur choisit de l’utiliser ou de renvoyer
ses résultats déjà classés ; le menu n’effectue aucun second filtrage implicite.

### Exemple complet de fournisseur tiers

```js
const { registerExtension, ui } = window.tiptapSpip;
const items = [
  { id: 'merci', title: 'Remerciement', keywords: ['merci'], context: 'Merci pour votre aide.' },
  { id: 'bonjour', title: 'Salutation', keywords: ['bonjour'], context: 'Bonjour !' },
];

registerExtension(ui.creerSuggestions({
  name: 'monpluginFormules',
  char: '@',
  minQueryLength: 2,
  items: ({ query }) => ui.filtrerSuggestions(items, query),
  command: ({ editor, range, item }) => editor.chain()
    .focus()
    .insertContentAt(range, { type: 'text', text: item.context })
    .run(),
  labels: {
    suggestions: 'Formules', loading: 'Recherche…',
    empty: 'Aucune formule', error: 'Recherche indisponible',
  },
}), { toolbars: ['edition'] });
```

Les libellés sont littéraux pour cet exemple ; un plugin publié utilise `tiptap_spip_i18n`.
Le script est chargé par `tiptap_spip_extensions` avant le lancement des éditeurs, selon la
[spec 07](../../specs/07-extensibilite.md). La fabrique utilise le Tiptap et ProseMirror du
bundle. Un nouveau contenu éditorial doit aussi déclarer son schéma et sa sérialisation SPIP.

## Adaptateur et cycle de vie

- Créer l’état par instance d’éditeur, dans un `WeakMap` ou dans les closures du plugin.
  Ne pas ajouter un état de session à `editor.tiptapSpip`, partagé avec les sous-éditeurs.
- Résoudre les doublons de `char` au montage, sur les fournisseurs effectivement retenus pour
  chaque éditeur après filtrage par barre et composition des extensions : garder celui du
  cœur s’il existe, sinon le premier dans l’ordre d’enregistrement. Émettre `console.warn`
  avec le caractère et les noms retenu/ignoré, une seule fois par conflit au cours de la page
  (triplet caractère, nom retenu, nom ignoré), puis ignorer le fournisseur supplémentaire
  sans lever d’erreur ni empêcher le montage. Ne pas réserver les caractères globalement :
  deux fournisseurs limités à des barres disjointes peuvent employer le même caractère.
  Appliquer la règle aux sous-éditeurs aussi, sans répéter l’avertissement à chaque ouverture
  d’une note ou d’une partie de multi. Ce dédoublonnage des diagnostics ne réserve aucun
  caractère globalement et ne partage pas les sessions. Les déclencheurs multicaractères et l’arbitrage
  dynamique de fournisseurs concurrents restent reportés.
- La fabrique fixe une priorité Tiptap interne de `10 000`, non configurable par les options
  publiques, pour traiter les touches du menu avant celles des listes, tableaux et paragraphes
  du cœur. Cette priorité règle l’ordre du clavier, pas les collisions de `char`. Un plugin
  tiers doit laisser passer les touches réservées par une suggestion active ; une extension
  qui intercepte avant elle peut rompre ce contrat. Hors touche effectivement consommée,
  renvoyer `false` pour laisser agir les raccourcis ordinaires.
- Fournir un `findSuggestionMatch` qui lit le contexte réel du bloc et garde la correspondance
  avec les positions ProseMirror, en traitant les atomes comme des séparateurs non autorisés,
  sauf le saut de ligne explicite reconnu comme `\n` si le fournisseur autorise ce préfixe.
  Ne pas confondre le début d’un nœud texte après une mark avec le début du bloc.
- Appliquer le seuil et `queryPattern` à l’autorisation d’ouverture (`allow`/`shouldShow`),
  en plus du seuil de recherche Tiptap : son seul `minQueryLength` ne masque pas le menu.
- Recalculer les résultats à chaque modification de la requête complète, y compris après
  effacement. Le seuil est propre au fournisseur : l’emoji le fixe à un caractère, l’exemple
  tiers ci-dessus à deux. Repasser sous le seuil, insérer un caractère interdit ou un espace
  avec `allowSpaces: false` ferme la session sans insérer de résultat ni consommer la frappe.
  La disparition d’une liste faute de résultat ne doit pas marquer la session comme rejetée
  par Échap : une requête ultérieure admissible peut afficher de nouvelles correspondances.
- Une session contient fournisseur, éditeur, requête, plage et numéro de recherche. Revalider
  ces informations avant d’afficher une réponse et avant la commande. Fermer si le contexte
  ou la sélection ne convient plus. Deux éditeurs conservent des sessions indépendantes.
- Utiliser l’`AbortSignal` et la protection contre les réponses obsolètes déjà présents dans
  Suggestion ; les compléter uniquement pour les états propres au panneau et à l’adaptateur.
  Intercepter le rejet du fournisseur pour distinguer l’erreur de « aucun résultat » :
  Tiptap peut autrement la rabattre sur une liste vide. Ne pas afficher d’anciens résultats
  sélectionnables pendant le chargement ou après une erreur.
- Faire correspondre `onStart`, `onUpdate`, `onKeyDown`, `onExit` et la destruction au
  contrôleur interne ; la destruction est idempotente. Les écouteurs de Tab, focus extérieur,
  clic extérieur, défilement et redimensionnement appartiennent à l’adaptateur, sans `mount()`.
- Adapter explicitement `props` de la commande Tiptap en `item` du contrat public. Le code
  d’interface interprète le booléen de retour : succès = fermeture et focus immédiat dans
  l’éditeur ; refus = source intacte et menu encore utilisable. Une commande doit refuser
  avant toute mutation ; les commandes asynchrones sont hors contrat de première version.
- Avant la validation, isoler l’opération de l’historique précédent avec `closeHistory`, puis
  isoler la frappe suivante de la validation. Une annulation restaure exactement la requête
  ou la sélection remplacée. Ouvrir/rechercher/fermer ne crée aucune modification de document.

## Interaction et focus

L’inline ne s’ouvre que lorsque l’éditeur a le focus. Une sélection programmée hors focus
ne lance aucune recherche ; le retour du focus réévalue la plage. Ne pas ouvrir pendant une
composition IME ; après `compositionend` et la mise à jour de ProseMirror, réévaluer par une
transaction sans entrée d’historique. Sur les claviers qui composent un mot entier, l’ouverture
dès le premier caractère attend donc la validation de la composition.
Les raccourcis de la liste ne traitent que les touches sans modificateur. Préserver notamment
Maj+Entrée et Maj+flèche pour l’édition ; Tab/Maj+Tab ferment sans empêcher leur navigation.
Un clic souris sur toute la liste (marge, état vide, options) conserve le focus de l’éditeur,
sans annuler les événements tactiles de défilement ni la molette.

À l’ouverture et après changement de requête, aucun résultat n’est actif. Flèche bas active
le premier, Flèche haut le dernier ; les suivantes parcourent la liste et maintiennent
l’option active visible. Survol ou déplacement tactile ne valide rien ; un clic sur une
option la valide directement. Entrée valide seulement une option active ; sinon elle garde
son comportement d’édition normal dans l’inline et ferme la suggestion si la sélection change.
Sans résultat sélectionnable, en chargement ou en erreur, ne pas intercepter Haut/Bas :
elles restent disponibles pour l’éditeur ou le champ de recherche.

Dans l’inline, Tab ferme sans valider et garde sa fonction normale, dont le piège de focus
du formulaire parent. Échap ferme sans effacer la requête.
La fermeture est maintenue jusqu’à l’insertion d’un espace/retour à la ligne ou au déplacement
vers une nouvelle plage de déclenchement, suivant la règle Tiptap 3.31.4 ; continuer à écrire
dans la même requête ne la rouvre pas, même après un motif invalide ou un passage sous le seuil. Le bouton peut toujours ouvrir son panneau explicitement.
Avec `allowSpaces: true`, adapter `shouldResetDismissed` : le natif conserve sinon le rejet
même après un espace. Garder la même règle commune de réouverture après insertion d’un espace
ou retour à la ligne, sans modifier le texte ni partager l’état de rejet entre éditeurs.

Annuler une validation restaure la requête et peut rouvrir la liste, sans mutation supplémentaire.

La suggestion inline garde le focus dans l’éditeur. Le panneau explicite le donne à sa
recherche ; Échap le rend au bouton s’il a été ouvert depuis la barre, à l’éditeur s’il vient
de « Plus… ». Un succès rend le focus à l’éditeur, un clic extérieur à la cible cliquée.
Empêcher la perte de sélection pendant la sélection au pointeur, sans empêcher un clic extérieur
de recevoir normalement le focus.

Dans le panneau, laisser le sélecteur hébergé gérer son clavier interne et ses options ;
le contrat d’activation de la liste inline ne lui est pas imposé. L’enveloppe empêche tout
effet d’Entrée/Ctrl/Cmd+Entrée sur un formulaire extérieur, sans court-circuiter la sélection
native du picker. Tab/Maj+Tab parcourt ses contrôles ; à la sortie du composant, fermer sans
insérer et poursuivre depuis la position logique du bouton de barre ou du sous-éditeur à
l’origine de « Plus… ». L’adaptateur place explicitement le focus sur la cible voisine ; dans
un popover, garder le bouclage entre ses contrôles. Hors popover, suivre l’ordre normal de la
page. Pour détecter cette sortie, utiliser deux sentinelles focusables avant et après le
picker ; ne pas lister ses contrôles privés. La sentinelle qui reçoit le focus donne le sens
de sortie. Pour le seul focus initial, l’adaptateur emoji peut viser
`picker.shadowRoot?.querySelector('input[type=search]')`, avec repli sur le panneau nommé et
focusable. La cible de repli, l’état d’erreur et le bouton « Réessayer » sont placés entre
les deux sentinelles dans l’ordre de tabulation ; l’enveloppe extérieure ne précède pas la
première sentinelle comme cible de repli. En erreur, depuis la cible de repli, Tab atteint
« Réessayer », puis un autre Tab sort vers l’avant. Tenir compte du chemin composé des
événements. Ne pas laisser le retrait du
panneau envoyer le focus vers `body` ni faire traiter Tab une seconde fois par le parent.

Un Échap consommé appelle `preventDefault` et `stopPropagation`. Le gestionnaire de plein écran
en capture dans `main.js` doit seulement s’abstenir si une suggestion ou un panneau est
ouvert ; il ne doit pas fermer ce panneau lui-même. L’enveloppe écoute Échap en remontée,
jamais en capture : le picker doit d’abord pouvoir fermer sa liste des teintes et arrêter
la propagation. Si Échap parvient à l’enveloppe, elle ferme le panneau et consomme la touche
avant le parent. Depuis l’inline, Échap ferme seulement la liste. Les différentes couches
se ferment donc successivement, sans fermer la note ni quitter le plein écran trop tôt.

Liste nommée `listbox`, options identifiées et `aria-selected`. L’élément qui garde le focus
porte les relations ARIA adaptées et `aria-activedescendant` seulement avec une option active.
Chargement, liste vide et erreur sont annoncés sans voler le focus. Positionnement borné par
la fenêtre, au-dessus si nécessaire, utilisable en plein écran et dans un popover parent.

La liste affiche ses résultats dans une zone à défilement. La virtualisation du DOM n’est
pas imposée en v1. Le bouton emoji ouvre la vue native du picker ; aucune liste vide de
requête ni sélection courte propre au bouton n’est rendue par le socle.
La déclinaison emoji inline présente six résultats et une action « Plus… » ouvrant le picker
complet, selon sa spec ; aucun groupe supplémentaire n’est chargé dans la liste inline.
Cette action reste interne, distincte des options `Item` et placée hors du `listbox` ; elle
ne passe jamais dans `command`. La navigation peut désigner cette action puis Entrée
l’exécuter : annoncer son libellé et retirer `aria-activedescendant` quand aucune option
emoji n’est active. Pas de nouvel export public de pagination ou de picker en v1.
Pour l’emoji, Flèche haut sans option active désigne le dernier emoji visible, pas cette
action ; depuis l’action, elle revient au dernier emoji. Après « Plus… » puis annulation,
appliquer l’état rejeté d’Échap avant de rendre le focus à l’éditeur, pour éviter la réouverture.

Pas d’activation en source, lecture seule, composition IME, code, contenu brut ou attribut.
Fermer au passage en source, à la fermeture du parent et à la destruction : annuler la
recherche, retirer les écouteurs et attributs ARIA, ignorer les retours tardifs.

## Critères de recette

1. L’exemple tiers fonctionne par l’API publique, dans l’éditeur et ses sous-éditeurs autorisés,
   sans dépendance emoji et sans importer un autre Tiptap/ProseMirror.
2. Deux déclencheurs distincts cohabitent ; un doublon avertit et laisse l’éditeur utilisable,
   avec priorité au fournisseur du cœur, sinon au premier enregistré. Deux barres disjointes
   acceptent des fournisseurs de même caractère sans avertissement de conflit.
3. Seuil d’ouverture et préfixes sont vérifiés à travers les limites de marks et les atomes ;
   inclure les sauts de ligne explicites autorisés. Les appels répétés avec un motif fourni
   avec `g` ou `y` restent déterministes. L’espace ferme la liste si `allowSpaces` vaut `false`.
4. Aucun résultat n’est actif spontanément dans l’inline ; Entrée sans navigation conserve
   son usage d’édition normal. Le panneau respecte le clavier de son sélecteur hébergé.
5. Chargement, réponse vide, rejet et réponses inversées restent distincts et cohérents.
6. Échap, Tab, clic extérieur, perte de focus et destruction ferment selon le contrat, y compris
   dans une note et en plein écran. Une réponse tardive ne rouvre rien et n’insère rien.
7. Une commande refusée laisse le contenu intact ; une validation et sa frappe suivante sont
   séparées dans l’historique ; un Ctrl/Cmd+Z restaure uniquement le remplacement validé.
8. Clavier, souris, toucher et lecteur d’écran conservent la bonne sélection, sans nouvelle
   violation axe. Les menus et popovers existants gardent leur comportement.
9. Dans liste, tableau et titre, Entrée avec option active valide la suggestion avant tout
   raccourci du bloc ; sans option active, Entrée garde l’édition normale. Haut/Bas restent
   disponibles en chargement, erreur et liste vide.
10. Le panneau est hors de tout formulaire du popover parent ; ses boutons ne soumettent
    rien, Entrée ne valide pas la note ou le multi, Tab/Maj+Tab traverse les contrôles du picker
    puis rejoint le parcours du parent. Ouvrir un autre popover ferme le panneau sans restaurer l’ancien focus ;
    `Popover.current` reste le parent jusqu’à cette autre ouverture.
11. Le filtre respecte le classement prévu et les variantes de casse, sans enrichissement
    linguistique implicite ni modification des données d’origine.
12. Ajout et effacement refiltrent la requête complète et réinitialisent le résultat actif ;
    une présentation partielle ne filtre jamais seulement les résultats déjà révélés.
13. Dans un parent défilant, les popovers HTML manuels restent visibles et correctement
    placés. Échap ferme d’abord les teintes, puis le panneau, puis laisse agir les couches
    parentes ; le gestionnaire de plein écran n’anticipe pas ces fermetures.
14. Les sentinelles assurent la sortie par Tab/Maj+Tab sans parcourir le Shadow DOM ; le
    focus initial dispose du repli prévu entre les sentinelles. En erreur, Tab atteint
    « Réessayer », puis sort vers l’avant ; annuler après « Plus… » ne rouvre pas l’inline.

Vérification prévue : Vitest pour la fabrique, les sessions, les erreurs et l’historique ;
Playwright sur Chromium, Firefox et WebKit pour focus, placement et propagation des touches.
