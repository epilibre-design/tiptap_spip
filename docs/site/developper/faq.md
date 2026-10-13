# Créer une extension FAQ

Cette page s’adresse aux personnes qui développent des plugins SPIP. Elle part du plugin prêt à
essayer dans [`exemples/tiptap_spip_faq`](https://github.com/epilibre-design/tiptap_spip/tree/main/exemples/tiptap_spip_faq).
Son objectif est d’ajouter un bloc question-réponse à l’éditeur **sans modifier** `tiptap_spip`.

## Essayer l’exemple

1. Installez et activez d’abord **Éditeur visuel pour SPIP**.
2. Copiez le dossier `exemples/tiptap_spip_faq/` dans le répertoire `plugins/` de votre site SPIP.
   Vérifiez que le fichier se trouve à `plugins/tiptap_spip_faq/paquet.xml`.
3. Activez **FAQ pour l’éditeur visuel (exemple)** dans la gestion des plugins.
4. Ouvrez le texte d’un article. Le bouton **FAQ** apparaît dans la barre d’édition. Saisissez une
   question et une réponse, enregistrez, puis vérifiez leur affichage sur le site public.

En mode source, un bloc ressemble à ceci :

```text
<faq|q=Comment fonctionne l’éditeur ?>
La réponse est enregistrée avec le texte de l’article.
</faq>
```

## 1. Déclarer un plugin SPIP dépendant de l’éditeur

Le fichier [`paquet.xml`](https://github.com/epilibre-design/tiptap_spip/blob/main/exemples/tiptap_spip_faq/paquet.xml)
déclare `<necessite nom="tiptap_spip" />`. Il inscrit aussi les pipelines utilisés pour ajouter le
script, le bouton, les libellés et les styles. Un dernier pipeline, `pre_echappe_html_propre`,
transforme le raccourci en HTML pour le site public.

Pour votre propre plugin, choisissez un nouveau préfixe, renommez le dossier et les fonctions PHP
en conséquence, puis adaptez les chaînes de langue dans `lang/`.

## 2. Charger le script et ajouter le bouton

Dans [`tiptap_spip_faq_pipelines.php`](https://github.com/epilibre-design/tiptap_spip/blob/main/exemples/tiptap_spip_faq/tiptap_spip_faq_pipelines.php),
trois pipelines relient le plugin à l’éditeur :

| Pipeline | Ce qu’il fournit |
|---|---|
| `tiptap_spip_extensions` | L’adresse du script JavaScript à charger avant le démarrage des éditeurs |
| `tiptap_spip_toolbars` | Le nom `faq` dans la barre `edition`, après le bloc de code |
| `tiptap_spip_i18n` | Les libellés traduits pour le bouton et la fenêtre de saisie |

Le script est enregistré avec `find_in_path('javascript/tiptap_spip_faq.js')`.
Le CSS est chargé dans l’espace privé et sur le site public par `header_prive_css` et
`insert_head_css`. Le plugin FAQ n’exige pas de reconstruire le JavaScript du plugin principal.

## 3. Lire et écrire le raccourci dans Tiptap

Le fichier [`javascript/tiptap_spip_faq.js`](https://github.com/epilibre-design/tiptap_spip/blob/main/exemples/tiptap_spip_faq/javascript/tiptap_spip_faq.js)
utilise l’API fournie par `window.tiptapSpip`. Il crée un nœud Tiptap `faqItem` avec :

- `spipTokenizer` pour reconnaître `<faq|q=…>` dans la source SPIP ;
- `parseSpip` pour convertir la question et la réponse en nœud éditable ;
- `renderSpip` pour réécrire le raccourci lors de l’enregistrement ;
- `renderHTML` pour afficher la FAQ dans la zone visuelle.

Le nœud est inscrit avec `registerExtension(FaqItem, { toolbars: ['edition'] })`. Le même script
ajoute le bouton via `registerToolbarComponent('faq', …)` ; il ouvre `ui.Popover` pour saisir ou
modifier la question. La réponse reste éditable directement dans le bloc.

Utilisez `window.tiptapSpip.core` pour les classes Tiptap et ProseMirror fournies par l’éditeur.
Charger une seconde copie de ces bibliothèques dans votre plugin peut produire des objets
incompatibles.

## 4. Fournir le rendu public dans SPIP

Le JavaScript de l’éditeur ne détermine **pas** le rendu public. L’exemple ajoute une fonction au
pipeline `pre_echappe_html_propre` qui transforme `<faq|q=…>…</faq>` en bloc HTML avec la question
en tête. La réponse reste traitée par `propre()` de SPIP. Le raccourci ressemble à un modèle SPIP :
sa transformation doit donc intervenir avant que SPIP traite les modèles.

Le [CSS de l’exemple](https://github.com/epilibre-design/tiptap_spip/blob/main/exemples/tiptap_spip_faq/css/tiptap_spip_faq.css)
définit l’aspect du bloc dans l’éditeur et sur le site. Pour votre syntaxe, prévoyez toujours
**les deux côtés** : l’édition visuelle et le rendu SPIP.

## 5. Vérifier l’aller-retour

Essayez au minimum ces étapes sur un site de test :

1. Saisir une FAQ dans l’éditeur, enregistrer l’article et vérifier le rendu public.
2. Rouvrir l’article, changer la question et la réponse, puis enregistrer de nouveau.
3. Passer en **Source**, vérifier le raccourci, revenir en visuel et enregistrer sans modification.
4. Désactiver le plugin FAQ et vérifier que le texte source reste accessible ; le rendu de la FAQ
   dépend en revanche du plugin qui l’interprète.

Le dépôt contient aussi des [tests de l’exemple](https://github.com/epilibre-design/tiptap_spip/blob/main/prive/javascript/tiptap_spip/tests/e2e/faq.e2e.js).
Pour adapter une syntaxe plus complexe, consultez la
[spécification d’extensibilité](https://github.com/epilibre-design/tiptap_spip/blob/main/docs/specs/07-extensibilite.md).
