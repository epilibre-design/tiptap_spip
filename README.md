# tiptap-spip

Éditeur WYSIWYG pour SPIP, basé sur [Tiptap 3](https://tiptap.dev) / ProseMirror, qui lit et écrit
**les raccourcis typographiques SPIP natifs** (`{{gras}}`, `{{{intertitre}}}`, `[texte->art12]`,
`[[note]]`, `[?glossaire]`, `<doc12|center>`…). Il remplace le porte-plume sur les champs en syntaxe SPIP,
comme le plugin [markdown_editor](../plugins/markdown_editor) le fait pour les champs en Markdown.

## Documentation

Le [guide utilisateur](https://epilibre-design.github.io/tiptap_spip/) explique l'installation par ZIP ou
FTP, la prise en main, les réglages et l'utilisation de l'éditeur. Une page dédiée montre comment
créer une extension à partir du plugin FAQ fourni dans `exemples/`.

Les sources du site MkDocs sont dans `docs/site/`. Pour le construire localement, voir
[Maintenir cette documentation](docs/site/developper/documentation.md).

## Spécifications

| # | Document | Contenu |
|---|----------|---------|
| 01 | [Contexte et objectifs](docs/specs/01-contexte-objectifs.md) | Besoin, périmètre, décisions, analyse de markdown_editor |
| 02 | [Architecture](docs/specs/02-architecture.md) | Plugin SPIP, modules JS, flux de données, build |
| 03 | [Schéma et représentation JSON](docs/specs/03-schema-json.md) | Nodes, marks, attributs, correspondance avec les raccourcis |
| 04 | [Parseur et sérialiseur SPIP](docs/specs/04-parseur-serialiseur.md) | SPIP → JSON → SPIP, aller-retour, échappements |
| 05 | [Extensions SPIP](docs/specs/05-extensions-spip.md) | Notes, glossaire, modèles, liens, multi, blocs protégés… |
| 06 | [Interface](docs/specs/06-interface.md) | Barre d'outils, modes, popovers, accessibilité, i18n |
| 07 | [Extensibilité](docs/specs/07-extensibilite.md) | API pour les plugins tiers |
| 08 | [Tests et recette](docs/specs/08-tests-recette.md) | Corpus, équivalence de rendu, critères d'acceptation |
| 09 | [Lots et feuille de route](docs/specs/09-lots-roadmap.md) | Découpage, priorités, questions ouvertes |
