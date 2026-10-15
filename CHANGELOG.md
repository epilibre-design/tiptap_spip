## [Non publié]

### Ajouté

- Coller une ou plusieurs images (capture d'écran, image copiée) dans l'éditeur, visuel ou source :
  chaque image devient un document de l'objet, inséré en `<docN>` à l'endroit du collage. Réglage
  « Coller des images » dans la configuration de l'éditeur (actif par défaut).
- Guide d’utilisation des passages multilingues, avec captures du formulaire Multi en français et
  en anglais.
- Nom, slogan et description du plugin dans la liste des plugins (`lang/paquet-tiptap_spip_fr.php`).

### Modifié

- Le bouton **Multi** n'apparaît plus sur un site monolingue (une seule langue dans la
  configuration du multilinguisme), sauf si le texte contient déjà un multi.
- Fenêtre du multi : la langue de chaque version se choisit dans une liste des langues activées
  dans la configuration du multilinguisme, au lieu d'un code à saisir.

### Corrigé

- Crayons : une modification faite sans saisie (insertion d'un document, d'un modèle…) puis enregistrée
  aussitôt est bien enregistrée. Le texte est recopié sur le `form-pre-serialize` de la copie de jQuery
  propre à Crayons (`cQuery`), et plus seulement sur celui de jQuery.
- Code en ligne près d'un backtick ou d'une balise `<code>` restés bruts, même dans un autre
  paragraphe : le texte enregistré relit désormais le même contenu (le code s'écrit en `<code>`,
  éventuellement coupé, ou avec d'autres backticks).
- Une accolade orpheline (`{` ou `}}` sans partenaire) ne compte plus qu'une anomalie : seule
  elle reste brute, et le gras ou l'italique correctement fermés du même paragraphe s'affichent
  normalement.

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
