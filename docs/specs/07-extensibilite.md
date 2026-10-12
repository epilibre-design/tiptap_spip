# 07 — Extensibilité

Objectif : qu'un plugin SPIP qui ajoutait jusqu'ici un raccourci (règle TextWheel + bouton porte-plume)
puisse l'ajouter à l'éditeur **sans modifier tiptap-spip** : FAQ, onglets dans le texte, todolist,
intertitres hiérarchisés, `<sc>`, etc. C'est la dernière todo restée ouverte dans markdown_editor.

## 1. Contrat d'une extension SPIP

Une extension est une extension Tiptap 3 standard enrichie de champs de configuration propres, sur le
modèle de ce que fait `@tiptap/markdown` pour Markdown (champs lus avec `getExtensionField`) :

```js
import { Node } from '@tiptap/core';

export default Node.create({
  name: 'faqItem',
  group: 'block',
  content: 'paragraph+',
  addAttributes() { return { question: { default: '' } }; },
  parseHTML() { return [{ tag: 'div[data-faq]' }]; },
  renderHTML({ HTMLAttributes }) { return ['div', { 'data-faq': '', ...HTMLAttributes }, 0]; },

  // --- champs propres à tiptap-spip ---
  spipTokenizer: {
    level: 'block',              // 'protect' | 'block' | 'inline'
    priority: 100,               // ordre parmi les règles du même niveau (cf. 04 §2)
    start: '<faq',               // test rapide avant regex (comme if_str de TextWheel)
    match: /^<faq\|q=([^>]*)>\n([\s\S]*?)\n<\/faq>/,
  },
  parseSpip(match, helpers) {
    return {
      type: 'faqItem',
      attrs: { question: match[1] },
      content: helpers.parseBlocks(match[2]),
    };
  },
  renderSpip(node, helpers) {
    return `<faq|q=${node.attrs.question}>\n${helpers.renderBlocks(node.content)}\n</faq>`;
  },
});
```

`helpers` expose : `parseBlocks`, `parseInline`, `renderBlocks`, `renderInline`, `escape`, `regex`
(constantes du core) — l'extension réutilise le moteur, elle n'en réimplémente pas une partie.

Les extensions de marks déclarent `renderSpip` sous la forme `{ open, close }` ou d'une fonction.

## 2. Enregistrement côté JS

```js
// dans le JS du plugin tiers, chargé après tiptap_spip.js
window.tiptapSpip.registerExtension(FaqItem);
window.tiptapSpip.registerToolbarComponent('FaqButton', FaqButton);
```

- Les extensions enregistrées avant l'initialisation des éditeurs sont ajoutées à tous les éditeurs ;
  `registerExtension(ext, { toolbars: ['edition'] })` permet de restreindre.
- En SPIP 5, le plugin tiers ajoute son module à l'importmap et importe `tiptap_spip.js` :
  `import { registerExtension } from 'tiptap_spip.js'`.
- Tiptap et ProseMirror ne sont **pas** re-bundlés par les plugins tiers : tiptap-spip ré-exporte
  `Node`, `Mark`, `Extension`, `mergeAttributes`, `nodeInputRule`, `markInputRule`, `Plugin`, `PluginKey`
  depuis son bundle (`window.tiptapSpip.core`), pour éviter deux copies de ProseMirror (erreurs
  « multiple versions » connues).

## 3. Enregistrement côté PHP

| Pipeline | Usage |
|----------|-------|
| `tiptap_spip_extensions` | Liste des scripts JS à charger (chemin, dépendances), injectés dans la config / l'importmap |
| `tiptap_spip_toolbars` | Ajouter le bouton dans une ou plusieurs barres |
| `tiptap_spip_i18n` | Ajouter des chaînes de langue à la config JS |

```php
function faq_tiptap_spip_extensions(array $flux): array {
	$flux['data']['faq'] = ['src' => find_in_path('javascript/faq_tiptap.js')];
	return $flux;
}
```

## 4. Règles de cohabitation

- Le registre garantit l'unicité des `name` ; une extension tierce peut **surcharger** une extension du
  cœur en réutilisant son nom (comme les règles nommées de TextWheel sont surchargeables), avec un
  avertissement console.
- Le rendu SPIP réel reste à la charge du plugin tiers (règle TextWheel ou pipeline) : tiptap-spip ne gère
  que l'édition.
- Chaque extension tierce devrait fournir des cas pour le corpus de tests ([08](08-tests-recette.md)) ;
  le harnais d'aller-retour est exporté pour cela.

## 5. Réalisation (lot L6)

- **Plugin d'exemple :** `exemples/tiptap_spip_faq`, qui fonctionne sans modifier le cœur. Il couvre le
  script, le bouton, les libellés, les styles et le rendu public ; e2e `faq.e2e.js` sous Chromium,
  Firefox et WebKit.
- **Niveaux :** le parseur garde son ordre en dur, et le registre générique de la spec 04 §2 n'est pas
  construit. Une règle s'insère à l'un des trois points de `protect()`, par `priority` croissante :
  - `protect` : après les backticks, avant `<code>`, `<cadre>`… ;
  - `block` : après les échappements, avant les modèles ;
  - `inline` : après les notes, avant les abréviations.

  Le motif s'applique à tout le texte avec les drapeaux `gm` : `^` désigne un début de ligne. Le
  contenu d'une région est masqué, donc une ligne vide intérieure ne coupe pas le segment.
- **Lecture :**
  - un bloc n'est lu que s'il occupe tout son segment ;
  - une mark déclare `parseSpip(match) → { attrs?, content }`, où `content` est fait de nœuds en ligne ;
  - un bloc mal placé, ou un `parseSpip` qui renvoie autre chose qu'un objet ou lève une exception,
    laissent la source brute ;
  - une note n'accepte que ses blocs (spec 03 §5) : une note qui contient un bloc tiers reste brute.
- **Aides :** `parseBlocks`, `parseInline`, `renderBlocks`, `renderInline`, `escape`, `regex`.
- **Règles par éditeur :**
  - `parse(source, { regles })` et `serialize(doc, { regles })` ; les appels imbriqués en héritent ;
  - `createEditor` attache `editor.tiptapSpip = { regles, tierces }` ;
  - les sous-éditeurs de note et de multi reprennent les extensions tierces ;
  - les validations des popovers relisent avec les règles de l'éditeur.
- **Marks tierces :** rangées après celles du cœur, comme dans le schéma de l'éditeur.
- **API :**
  - `window.tiptapSpip` et exports du bundle : `registerExtension(ext, { toolbars })`,
    `registerToolbarComponent(nom, fabrique)`, `core`, `ui` (`boutonOutil`, `menuOutil`, `Popover`),
    `label`, `allerRetour(source, extensions)` ;
  - `allerRetour` est le harnais des cas de corpus. Il renvoie `json` et `canonique`, et trois
    contrôles :
    - `identique` : la source est restituée telle quelle ;
    - `stable` : la forme canonique se relit à l'identique ;
    - `valide` : le schéma accepte le contenu.
  - Une fabrique de composant a la forme `(ctx, options) => { element, cible?, maj?, source? }`.
- **PHP :**
  - `tiptap_spip_extensions` (`nom => ['src', 'dependances']`) : scripts ordonnés selon leurs
    dépendances, URL absolues dans la config JS (`extensions`) ;
  - `chargerExtensions()` les importe avant le premier `tiptap_spip_init()`, en SPIP 4 comme en SPIP 5 ;
  - `tiptap_spip_i18n` : chaînes ajoutées aux libellés.
  - `pipeline()` de SPIP ne rend que `data` d'un flux `['args', 'data']`. Corrigé au passage pour
    `tiptap_spip_toolbars`, que le lot L5.1 ignorait.
- **Limites :**
  - Le texte saisi n'est pas échappé pour la syntaxe d'une extension. Un texte littéral `<sc>x</sc>`
    tapé dans l'éditeur se relit en mark ; c'est à l'extension de choisir une syntaxe qui ne se tape pas
    par mégarde.
  - Le rendu reste à la charge du plugin. Une syntaxe en forme de modèle (`<faq|q=…>`) doit être
    transformée avant les modèles (`pre_echappe_html_propre`), car SPIP les traite avant `pre_propre`.
  - Le chargement SPIP 5 (`_inits/80`) n'est pas testé, faute de site.
