# Crédits

tiptap_spip est distribué sous licence GPL-3.0-or-later (fichier `LICENSE`). Ce fichier recense le code
d'autres projets qu'il adapte ou embarque, et les projets dont il s'inspire sans en reprendre le code. Chaque
adaptation porte aussi, au plus près du code concerné, une notice de provenance (source, auteurs, licence,
modifications et date).

## Code adapté

| Source | Auteurs | Licence | Repris dans | Ce qui est repris |
|--------|---------|---------|-------------|-------------------|
| Core de SPIP 4.4.21 (`ecrire/`) | Arnaud Martin, Antoine Pitrou, Philippe Rivière, Emmanuel Saint-James | GNU GPL | `src/spip/regex.js`, `src/spip/multi.js`, `src/editor/deposer.js`, `tiptap_spip_fonctions.php` | Expressions des collecteurs (modèles, liens, multis, idiomes), `_PROTEGE_BLOCS`, codes de langue de `lang_liste.php`, découpage de `extraire_trads()`, table de `corriger_extension()` |
| TextWheel (SPIP 4.4.21, `plugins-dist/textwheel/`) | Collectif SPIP | GPL-3.0-or-later | `src/spip/regex.js`, `links.js`, `glossary.js`, `notes.js`, `blocks.js`, `tiptap_spip_fonctions.php` | Expressions de `inc/lien.php`, `inc/notes.php` et des wheels (`spip.json`, `spip-listes.json`, `backticks`) ; logique de `traiter_raccourci_lien_atts()`, du découpage de `traiter_raccourci_glossaire()`, du nom de note de `traiter_raccourci_notes()`, de la légende de `traiter_tableau()` |
| Porte-plume (SPIP 4.4.21, `plugins-dist/porte_plume/`) | Matthieu Marcillaud, Collectif SPIP | GPL-3.0-or-later | `tiptap_spip_fonctions.php` | `traitements_previsu()` et `traitements_previsu_php_modeles_eval()` (prévisualisation des modèles) |
| [Coloration Code](https://git.spip.net/spip-contrib-extensions/coloration_code) 1.2.1 | bricebou | GPL-3 | `src/editor/coloration.js` | Table des alias de langages, elle-même tirée des grammaires de [highlight.js](https://highlightjs.org) (Ivan Sagalaev, BSD-3-Clause) |

Le parseur et le sérialiseur (`src/spip/`) ont leur propre architecture (régions protégées, jetons, nœuds) :
ils reproduisent le rendu de SPIP et en reprennent les expressions et les règles listées ci-dessus, pas la suite
de remplacements de TextWheel.

## Composants embarqués

Le bundle (`prive/javascript/tiptap_spip.js` et `.min.js`) embarque des paquets npm. Leurs licences sont
recopiées dans `prive/javascript/tiptap_spip.LICENSES.txt`, que `scripts/build.mjs` génère à chaque build.

- [Tiptap](https://tiptap.dev) (Tiptap GmbH) et [ProseMirror](https://prosemirror.net) (Marijn Haverbeke),
  avec `orderedmap`, `rope-sequence` et `w3c-keyname` : licence MIT.
- [Remix Icon](https://remixicon.com) 4.8.0 (Remix Design) : licence Apache-2.0. Les 34 icônes de la
  barre d'outils sont recopiées dans `src/ui/icones.js` par `scripts/icones.mjs`. Le paquet est fixé à cette
  version : à partir de 4.9.0, Remix Icon est distribué sous la Remix Icon License v1.0, plus restrictive.
  Le README de la 4.8.0 ajoutait à la licence Apache-2.0 une demande, « these icons are not for sale » ;
  l'éditeur a reconnu l'ambiguïté de ces anciens termes en annonçant le changement de licence. tiptap_spip ne
  vend pas ces icônes. Leur remplacement par un jeu sans réserve (Lucide, ISC) est envisagé.

## Données de test

- `tests/corpus/textwheel/` : textes des tests de TextWheel (SPIP 4.4.21, Collectif SPIP,
  GPL-3.0-or-later), importés par `scripts/importer-textwheel.mjs` ; voir son `LISEZMOI.md`.

## Inspirations, sans reprise de code

- [markdown_editor](https://git.spip.net/spip-contrib-extensions/markdown_editor) (Mukt) : premier éditeur
  Tiptap pour SPIP. tiptap_spip s'en inspire pour la conception de plusieurs éléments : nœud des modèles et
  son attribut, construction de l'interface autour du textarea, composants de la barre d'outils, chargement
  sous SPIP 5. Aucune copie de son code n'a été relevée.
- [InlineAttachment](https://github.com/Rovak/InlineAttachment) (MIT) : contrat de l'envoi des fichiers
  collés (types acceptés, nom d'une capture, texte provisoire, événements), sans son code (spec 10 §2).
