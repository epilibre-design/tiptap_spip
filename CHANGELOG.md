# Journal des modifications

Les changements notables de ce projet sont consignés dans ce fichier.

Le format suit [Keep a Changelog 1.1.0](https://keepachangelog.com/fr/1.1.0/).
Les versions portent un numéro `MAJOR.MINOR.PATCH` ; le projet ne déclare pas, à ce jour,
de politique formelle de compatibilité selon le [versionnement sémantique](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

- Version anglaise du guide utilisateur, accessible sous `/en/`.
- Documentation des plugins complémentaires Porte-plume et Insérer modèles.

### Corrigé

- Affichage de l'icône du menu de configuration dans l'espace privé.
- Distinction visuelle des intertitres `h2` et `h3` dans l'éditeur.
- Mise en forme des blocs de poésie dans l'éditeur.

## [1.0.0] - 2026-10-13

### Ajouté

- Première version publiée de l'éditeur visuel pour SPIP 4.2 à 5, fondé sur Tiptap et
  ProseMirror. Le contenu est enregistré avec les raccourcis typographiques SPIP.
- Édition visuelle et mode source pour les champs compatibles, avec configuration des champs
  équipés et des contextes d'affichage.
- Outils de mise en forme, liens, notes, glossaires, tableaux, modèles SPIP et passages
  multilingues.
- API d'extension pour les plugins tiers et exemple d'un bloc FAQ.
- Guide utilisateur en français et documentation des points d'extension.

[Non publié]: https://github.com/epilibre-design/tiptap_spip/compare/1.0.0...HEAD
[1.0.0]: https://github.com/epilibre-design/tiptap_spip/releases/tag/1.0.0
