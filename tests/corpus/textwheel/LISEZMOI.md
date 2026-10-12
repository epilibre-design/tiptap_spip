# Cas du cœur : tests de TextWheel

Textes des tests de `propre()` du plugin TextWheel de SPIP 4.4.21
(`plugins-dist/textwheel/tests/data/{base,typo,modeles_block,modeles_inline}/*.txt`), renommés en `.spip`.
Un texte identique à un texte d'un jeu précédent n'est pas recopié.

- Licence : GNU GPL, comme SPIP et ce plugin.
- Import : `node scripts/importer-textwheel.mjs /chemin/vers/plugins-dist/textwheel` (depuis
  `prive/javascript/tiptap_spip`).
- Les rendus attendus (`.html`) de TextWheel ne sont pas repris : l'oracle est le site SPIP de l'équivalence
  de rendu (spec 08 §2). Les modèles de test (`<textwheel1|block>`) n'existent pas sur ce site : ils
  y sont rendus comme des modèles inconnus, ce qui suffit pour comparer la source et sa forme canonique.
