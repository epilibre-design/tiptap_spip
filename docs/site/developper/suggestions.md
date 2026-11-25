# Proposer des suggestions pendant la saisie

Un plugin peut proposer une liste après un caractère, par exemple `@bo` pour insérer
« Bonjour ! ». Le socle fournit la liste, le clavier et les recherches asynchrones ; le plugin
fournit les résultats et la commande d’insertion. Aucun fournisseur n’est activé par défaut.
L’insertion d’emojis appartient à une livraison ultérieure.

## Charger le fournisseur

Déclarez le pipeline dans votre `paquet.xml` :

```xml
<pipeline nom="tiptap_spip_extensions" inclure="monplugin_pipelines.php" />
```

Puis ajoutez le script dans `monplugin_pipelines.php` :

```php
function monplugin_tiptap_spip_extensions($flux) {
    $flux['data']['monplugin_formules'] = [
        'src' => find_in_path('javascript/monplugin_formules.js'),
    ];
    return $flux;
}
```

Le script est chargé avant la création des éditeurs. Il utilise l’API du bundle, également
exportée comme module ; il ne charge aucune autre copie de Tiptap ou de ProseMirror.

```js
const { ui, registerExtension } = window.tiptapSpip;
const catalogue = [
  { id: 'bonjour', title: 'Bonjour', subtext: 'Salutation', context: 'Bonjour !' },
  { id: 'bonsoir', title: 'Bonsoir', context: 'Bonsoir !' },
];

registerExtension(ui.creerSuggestions({
  name: 'monpluginFormules',
  char: '@',
  minQueryLength: 1,
  queryPattern: /[a-z]+/i,
  labels: {
    suggestions: 'Formules', loading: 'Recherche…',
    empty: 'Aucune formule', error: 'Recherche indisponible',
  },
  items: ({ query }) => ui.filtrerSuggestions(catalogue, query),
  command: ({ editor, range, item }) => editor.commands.insertContentAt(
    range, { type: 'text', text: item.context },
  ),
}), { toolbars: ['edition', 'forum'] });
```

Les libellés de cet exemple sont à adapter à la langue de votre interface, par exemple avec
le pipeline `tiptap_spip_i18n` et `window.tiptapSpip.label`, comme dans le
[tutoriel FAQ](faq.md). Le socle n’ajoute ni traduction des requêtes ni synonymes.

## Contrat

`ui.creerSuggestions(options)` renvoie une extension Tiptap à passer à `registerExtension`.
Les mêmes fournisseurs sont repris dans les sous-éditeurs de notes et de multis de l’éditeur.

| Option | Contrat |
|---|---|
| `name`, `char` | Nom unique et caractère de déclenchement unique dans cet éditeur |
| `items({ editor, query, signal })` | Tableau ou promesse de tableau d’items ; transmettre `signal` à `fetch` si nécessaire |
| `command({ editor, range, item })` | Commande synchrone renvoyant `true` après insertion ou `false` avant toute mutation |
| `labels` | Quatre chaînes obligatoires : `suggestions`, `loading`, `empty`, `error` |
| `minQueryLength` | Seuil d’ouverture, entier positif ou nul ; défaut `0` |
| `queryPattern` | Expression régulière validant la requête entière ; drapeaux `g` et `y` neutralisés |
| `allowedPrefixes` | Caractères acceptés avant le déclencheur ; défaut espace ordinaire `[' ']` ; début du bloc toujours accepté |
| `startOfLine` | Limite le déclencheur au début du bloc ; défaut `false` |
| `allowSpaces` | Autorise les espaces dans la requête ; défaut `false` |
| `allow({ editor, state, range })` | Restriction supplémentaire facultative, renvoyant un booléen |

Chaque item a `id` et `title` de type chaîne. `subtext` et `keywords` sont facultatifs ;
`context` peut transporter les données de la commande. Les titres et sous-textes sont rendus
comme texte, jamais interprétés comme HTML. Le résultat de `items` est affiché dans son ordre,
sans filtrage supplémentaire.

`ui.filtrerSuggestions(items, query)` renvoie une nouvelle liste, sans modifier les items.
Il classe les correspondances exactes, puis les préfixes, puis les inclusions sur `title`,
`subtext` et `keywords`, sans tenir compte de la casse ; les égalités gardent l’ordre initial.
Une requête vide conserve tous les résultats. Un fournisseur peut utiliser son propre filtre.

Une exception de recherche est journalisée et affiche l’état d’erreur, distinct de la liste
vide. Les réponses annulées ou obsolètes sont ignorées. Une exception de commande est
journalisée et traitée comme un refus ; le fournisseur doit donc vérifier ses préconditions
avant de modifier le document. La fabrique ne peut pas annuler des mutations partielles.

## Interaction et limites

La liste exige un éditeur éditable avec le focus et une sélection vide. Elle reste fermée
pendant une composition IME et dans le code ou les zones brutes. Après la composition, elle
réévalue la requête : sur un clavier composant tout le mot, l’ouverture dès le premier
caractère attend sa validation.

Aucun choix n’est actif à l’ouverture. Bas active le premier résultat, Haut le dernier,
Entrée valide seulement un choix actif. Sans résultat, Haut/Bas restent disponibles pour
l’édition. Les touches modifiées, notamment Maj+Entrée et Maj+flèche, restent à l’éditeur.
Un clic valide directement une option ; cliquer dans la marge ou dans l’état vide conserve
le focus de l’éditeur. Tab et Maj+Tab ferment sans bloquer la navigation normale.

Échap ferme sans effacer la requête, avant une note ou le plein écran. Le rejet persiste dans
la même plage, même si le motif devient temporairement invalide ou passe sous le seuil ;
un espace inséré ou une nouvelle plage permet de rouvrir. La plage s’arrête au curseur :
dans `@bo|njour`, seule `@bo` est remplacée. Un atome ne compte pas comme début de bloc.

La validation forme une étape d’historique indépendante : après une insertion suivie d’une
frappe, Annuler retire la frappe, puis restaure la requête. Cette restauration peut rouvrir
la liste. Ouvrir, rechercher et fermer n’ajoutent aucune étape d’annulation.

Deux fournisseurs utilisant le même caractère dans un même éditeur ne cohabitent pas :
le cœur est conservé s’il en propose un, sinon le premier tiers. Le second est ignoré avec
un avertissement, une seule fois par conflit. Des fournisseurs limités à des barres disjointes
peuvent partager le caractère. La priorité clavier interne est fixée par la fabrique.

L’API publique se limite à ces deux fonctions : ni le moteur Suggestion, ni la liste interne,
ni l’enveloppe des sélecteurs explicites ne sont exposés.
