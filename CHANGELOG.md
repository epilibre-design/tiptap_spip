## [Non publié]

### Corrigé

- Le panneau « Notes (0) » ne s'affiche plus sous l'éditeur d'un texte sans note : il n'apparaît
  que lorsque le texte contient des notes.
- Le formulaire d'une note n'a plus de boutons au-dessus de sa zone de texte (gras, italique, lien,
  glossaire, modèle) : seulement la zone de texte, avec Appliquer, Supprimer la note et Annuler.

## [1.2.0] - 2026-10-15

### Ajouté

- Coller une ou plusieurs images (capture d'écran, image copiée), ou glisser-déposer des fichiers de tout
  type accepté par SPIP, dans l'éditeur, visuel ou source : chaque fichier devient un document de l'objet,
  inséré en `<docN>` à l'endroit du collage ou du dépôt. Réglage « Coller des images et déposer des
  documents » dans la configuration de l'éditeur (actif par défaut). Dans un crayon où l'envoi de
  documents de Crayons est activé, un dépôt sur l'éditeur, visuel ou source, passe aussi par l'éditeur
  (un seul envoi, `<docN>` inséré) ; le panneau latéral de Crayons garde sa propre zone de dépôt.
- Guide d’utilisation des passages multilingues, avec captures du formulaire Multi en français et
  en anglais.
- Nom, slogan et description du plugin dans la liste des plugins (`lang/paquet-tiptap_spip_fr.php`).

### Modifié

- Le bouton **Multi** n'apparaît plus sur un site monolingue (une seule langue dans la
  configuration du multilinguisme), sauf si le texte contient déjà un multi.
- Fenêtre du multi : la langue de chaque version se choisit dans une liste des langues activées
  dans la configuration du multilinguisme, au lieu d'un code à saisir.
- Remix Icon est fixé à la version 4.8.0, la dernière distribuée sous licence Apache-2.0 (les icônes
  ne changent pas). Les reprises de code de SPIP, de TextWheel, du porte-plume et de Coloration Code
  portent une notice de provenance, et sont recensées avec les autres crédits dans `CREDITS.md`.

### Corrigé

- Champs équipés : les champs cochés dans la configuration (descriptif, chapeau, post-scriptum,
  biographie…) s'ouvrent bien dans l'éditeur, et pas seulement le Texte. Ils étaient ignorés
  faute de porter les classes du porte-plume.
- Crayons : un texte modifié sans saisie au clavier (document ou modèle inséré, fichier déposé…) puis
  enregistré aussitôt, sans quitter l'éditeur, partait avec l'ancien texte. Il est maintenant bien
  enregistré.
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

[Non publié]: https://github.com/epilibre-design/tiptap_spip/compare/1.2.0...HEAD
[1.2.0]: https://github.com/epilibre-design/tiptap_spip/compare/1.1.0...1.2.0
[1.1.0]: https://github.com/epilibre-design/tiptap_spip/compare/1.0.0...1.1.0
[1.0.0]: https://github.com/epilibre-design/tiptap_spip/releases/tag/1.0.0
