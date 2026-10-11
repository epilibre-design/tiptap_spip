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
