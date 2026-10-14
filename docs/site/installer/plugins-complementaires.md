# Plugins complémentaires

**Porte-plume**, **Insérer modèles** et **Coloration Code** sont facultatifs : l’éditeur visuel fonctionne sans eux.
Vous pouvez les activer dans la gestion des plugins de SPIP.

## Porte-plume

Tiptap reconnaît les champs équipés des barres d’édition et de forum du porte-plume. Sur un champ
où l’éditeur visuel est actif, il prend sa place. Le porte-plume reste disponible sur les champs que
vous excluez dans la [configuration](../configurer.md).

Le bouton **Source** de Tiptap affiche les raccourcis SPIP, mais ne rétablit pas la barre du
porte-plume sur le champ équipé de l’éditeur visuel.

Documentation du plugin : [Porte-plume sur SPIP-Contrib](https://contrib.spip.net/Porte-plume-3117).

## Insérer modèles

Ce plugin ajoute au bouton **Modèle** un catalogue et des formulaires qui permettent d’insérer un
modèle ou de modifier les paramètres d’un modèle existant. Son catalogue dépend des modèles
configurés dans le plugin et des droits de l’auteur.

Sans Insérer modèles, vous pouvez toujours saisir directement un raccourci comme `<doc12|center>`.
Avec la version actuelle de ce plugin, son catalogue n’est pas disponible sous SPIP 5. Voir aussi
[Insérer des contenus SPIP](../utiliser/contenus-spip.md#images-documents-et-autres-modeles).

Documentation du plugin : [Insérer modèles sur SPIP-Contrib](https://contrib.spip.net/Plugin-Inserer-Modeles).

## Coloration Code

Ce plugin colore le code des blocs de code sur le site public. Quand il est actif, l’éditeur
visuel colore aussi les blocs de code pendant la saisie, avec les mêmes langages et le même thème
que le site : tapez par exemple ```` ```php ```` suivi d’une espace, puis votre code.

Le langage vient du bloc (```` ```php ````) ou de la classe de la balise (`<code class="css">`).
Un bloc sans langage reste en texte brut. Sans Coloration Code, l’éditeur ne colore pas le code :
il affiche seulement le langage des blocs ```` ```php ```` en haut à droite, comme SPIP.

Documentation du plugin : [Coloration Code sur SPIP-Contrib](https://contrib.spip.net/Coloration-Code).
