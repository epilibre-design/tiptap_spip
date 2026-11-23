# tiptap_faq — édition visuelle des blocs du plugin FAQ

## Décision

Un plugin de liaison `tiptap_faq`, distinct de `tiptap_spip`, édite la syntaxe du plugin
[FAQ](https://git.spip.net/spip-contrib-extensions/faq). Critère : le cœur intègre ce qui évite de mal
lire la source (Markdown) ou améliore un nœud existant (coloration) ; un nouveau contenu éditorial
passe par l'API d'extension (spec 07). Le code pourra être proposé au plugin FAQ une fois stable.

Hors périmètre : rendu public (plugin FAQ), choix visuel de `format`, modèle `faqcsv`, SPIP 5 (FAQ
déclare `[4.1.0;4.*]`). La démo `exemples/tiptap_spip_faq` reste un tutoriel, avec une autre syntaxe ;
sa documentation renvoie à `tiptap_faq` pour un usage réel.

## Livraison 1 : tiptap_spip

Ajout de `helpers.lignes(source)`, passé à `parseSpip` et à `renderSpip`. Il renvoie les lignes logiques de
la source : un saut de ligne situé dans du code ou un bloc protégé ne sépare pas deux lignes. Les
lignes rejointes par `\n` redonnent la source. Tests, spec 07 et CHANGELOG `[Non publié]`.

## Livraison 2 : tiptap_faq

Dépôt séparé. `paquet.xml` : compatibilité `[4.2.0;4.*]`, `necessite` `faq` (version
qui corrige le rendu des réponses, [ticket 5](https://git.spip.net/spip-contrib-extensions/faq/-/work_items/5))
et `tiptap_spip` (version qui apporte `helpers.lignes`). Script sans bundle (`window.tiptapSpip`), CSS, langues fr et en,
pipelines `tiptap_spip_extensions`, `tiptap_spip_toolbars`, `tiptap_spip_i18n`, `header_prive_css` et
`insert_head_css`. Noms d'extension, de composant et clés de langue préfixés : pas de collision avec
la démo.

### Modèle

    tiptapFaqBloc (attribut : balise d'ouverture d'origine)
    ├─ tiptapFaqTitre       « :Titre », texte en ligne
    └─ tiptapFaqItem
       ├─ tiptapFaqQuestion « ? Question », texte en ligne
       └─ tiptapFaqReponse  blocs sauf citation, poésie, alignement et multi, éventuellement un paragraphe vide

Titres et items dans n'importe quel ordre, au moins un item : FAQ 4.2.0 échoue (erreur fatale) sur un
bloc sans question. FAQ imbriquée interdite. `#tag` et
`type:valeur` restent du texte de la question.

### Lecture

Règle de niveau `block`, motif calqué sur `wheels/faq.json`, CRLF accepté. Le bloc est découpé par
`helpers.lignes` ; comme le plugin FAQ, chaque ligne est d'abord débarrassée de ses espaces de bord, et
`?` ou `:` en tête ouvre une question ou un titre.

Reste en source brute un bloc sans question, ou avec un contenu que le plugin FAQ ignore : texte
avant la première question, ou entre un titre et la question suivante. De même un bloc qui contient une
citation (`<quote>` est perdu au rendu), une poésie (son contenu n'est pas protégé par
`helpers.lignes`), un alignement ou un `<multi>` sur plusieurs paragraphes, une FAQ imbriquée, ou `</faq>`
dans du code (le motif relu sur la source s'arrêterait là).

### Écriture

Bloc non modifié : source d'origine. Bloc modifié : réécrit en entier sous forme canonique.
Une question ou un titre tient sur une ligne : pas de saut de ligne forcé.

Sont refusés, avec l'événement `refus` (message en barre d'état) : une ligne de réponse commençant par
`?` ou `:` (ni code, ni note, ni modèle : SPIP les met de côté avant la wheel), et `</faq>` dans tout le
bloc, code compris. Une ligne qui commence ainsi à l'intérieur d'un lien est écrite en entité.

Pour un contenu JSON qui contient ces formes malgré le refus, `renderSpip` écrit le caractère de
tête (`&#63;`, `&#58;`) ou le `<` de `</faq>` (`&lt;`) en entité HTML, vérifiées au rendu.

### Interface

- Menu « FAQ » dans la barre `edition` : insérer une FAQ, ajouter une question, ajouter un titre.
  Hors FAQ, les blocs sélectionnés deviennent la réponse d'une première question.
- Entrée dans une question ou un titre passe à la suite ; Entrée sur un paragraphe vide en fin de
  réponse crée une question ; Retour arrière dans une question vide fusionne ou supprime l'item.
- Réponses toujours dépliées, textes d'aide dans les champs vides, sans le script d'accordéon du
  plugin FAQ.

## Tests, dans l'ordre

1. Rendu réel du plugin FAQ : fait sur 4.2.0 avec SPIP 4.4.31. Les tests sont dans la branche
   `tests-rendu` du plugin FAQ ; les contenus exclus ci-dessus en résultent.
2. Corpus `allerRetour` : code contenant `?`, plusieurs titres, CRLF, `format`, tags, réponses vides,
   contenus à garder bruts.
3. Interface : commandes, clavier, refus.
4. e2e sur SPIP 4.4 avec FAQ et `tw`.
