# Notes de version (ébauche)

À compléter à la publication. Les limites ci-dessous viennent de la syntaxe SPIP elle-même : aucune
écriture ne permet de les représenter. Le détail est dans la spec 04 §5.

## Limites connues

- **Fins de ligne Mac OS 9** : un retour chariot seul (`\r` non suivi de `\n`) n'est pas géré. Le
  paragraphe qui en contient reste en source brute, modifiable seulement en mode source. Les fins de ligne
  Windows (`\r\n`) et Unix (`\n`) sont gérées.
- **Code contenant un marqueur de langue dans un multi** : dans un `<multi>`, du code qui contient
  `[xx]` (par exemple `` `[mot]` ``) est lu par SPIP comme un marqueur de langue, et le code n'a pas
  d'échappement. À la relecture, ce multi devient un bloc brut, modifiable seulement en mode source.
- **Balise fermante dans un bloc verbatim** : `</cadre>` dans un cadre, `</html>`, `</math>`, ou
  `</code>` dans un bloc de code écrit `<code>`, ferme le bloc plus tôt ; SPIP n'a pas d'échappement à
  cet endroit. Un bloc de code écrit entre backticks n'est pas concerné.
- **Langue d'un bloc de code** : seuls les backticks la portent (```` ```php ````). Un code qui doit
  passer par `<code>` (`\\`, `` \` ``, `\` final, saut de ligne en tête, `` ` `` final) la perd.
- **Début d'une note automatique** : une note qui commence par un idiome (`<:cle:>`) ou par du barré,
  de l'exposant ou de l'indice dont la balise revient plus loin sur la ligne est lue par SPIP comme une
  note nommée ; ce début s'affiche alors en texte.

## Comportements à connaître

- **Première ligne de tableau vide** : SPIP affiche une première ligne de cellules vides comme une ligne
  d'en-tête. Un tableau inséré vide se relit donc avec un en-tête vide, jusqu'à ce qu'une cellule de sa
  première ligne reçoive du texte.
