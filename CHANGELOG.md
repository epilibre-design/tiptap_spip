## [Non publié]

### Ajouté

- Guide d’utilisation des passages multilingues, avec captures du formulaire Multi en français et
  en anglais.

### Modifié

- Le bouton **Multi** n'apparaît plus sur un site monolingue (une seule langue dans la
  configuration du multilinguisme), sauf si le texte contient déjà un multi (#1).

### Corrigé

- Une accolade orpheline (`{` ou `}}` sans partenaire) ne compte plus qu'une anomalie : seule
  elle reste brute, et le gras ou l'italique correctement fermés du même paragraphe s'affichent
  normalement (#3).

## [1.1.0] - 2026-10-14

### Ajouté

- Coloration syntaxique des blocs de code pendant la saisie, uniquement quand le plugin
  Coloration Code est actif : mêmes langages et même thème que sur le site public.
- Version anglaise du guide utilisateur, accessible sous `/en/`.
- Documentation des plugins complémentaires Porte-plume, Insérer modèles et Coloration Code, avec
  des liens vers leur documentation sur SPIP-Contrib.

### Modifié

- Code inline dans l'éditeur : espacement, bordure et fond proches du rendu SPIP.
- Tailles distinctes pour les intertitres `h2` et `h3` dans l'éditeur.
- Mise en forme des blocs de poésie dans l'éditeur.
- Langue affichée par les multis : un bouton de menu « [fr] » remplace la liste déroulante,
  comme les autres menus de la barre d'outils.
- Blocs de code : le langage (```` ```php ````) s'affiche en étiquette à droite, comme dans
  l'espace privé de SPIP.

### Corrigé

- Texte de l'éditeur aligné selon le sens de la langue dans une page centrée, par exemple
  dans le formulaire des crayons.
- Affichage de l'icône du menu de configuration dans l'espace privé.

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

[Non publié]: https://github.com/epilibre-design/tiptap_spip/compare/1.1.0...HEAD
[1.1.0]: https://github.com/epilibre-design/tiptap_spip/compare/1.0.0...1.1.0
[1.0.0]: https://github.com/epilibre-design/tiptap_spip/releases/tag/1.0.0
