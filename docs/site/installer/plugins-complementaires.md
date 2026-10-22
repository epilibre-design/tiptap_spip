# Plugins complémentaires

**Insérer modèles** et **Coloration Code** sont facultatifs : l’éditeur visuel fonctionne sans eux.
Vous pouvez les activer dans la gestion des plugins de SPIP. Le **porte-plume**, livré avec SPIP,
cohabite avec l’éditeur visuel.

## Porte-plume

Le porte-plume fait partie des plugins livrés avec SPIP. L’éditeur visuel ne s’appuie pas sur lui :
il reconnaît les champs équipés de ses barres d’édition et de forum, retire la barre et prend sa
place. Le porte-plume reste disponible sur les champs que vous excluez dans la
[configuration](../configurer.md).

Le bouton **Source** de l’éditeur visuel affiche les raccourcis SPIP dans une simple zone de texte,
sans la barre du porte-plume.

Documentation du plugin : [Porte-plume sur SPIP-Contrib](https://contrib.spip.net/Porte-plume-3117).

## Insérer modèles

Ce plugin ajoute au bouton **Modèle** un catalogue et des formulaires qui permettent d’insérer un
modèle ou de modifier les paramètres d’un modèle existant. Son catalogue dépend des modèles
configurés dans le plugin et des droits de l’auteur.

Sans Insérer modèles, vous pouvez toujours saisir directement un raccourci comme `<doc12|center>`.
Avec la version actuelle de ce plugin, son catalogue n’est pas disponible sous SPIP 5. Voir aussi
[Contenu SPIP](../utiliser/contenus-spip.md#images-documents-et-autres-modeles).

Documentation du plugin : [Insérer modèles sur SPIP-Contrib](https://contrib.spip.net/Plugin-Inserer-Modeles).

## Coloration Code

Ce plugin colore le code des blocs de code sur le site public. Quand il est actif, l’éditeur
visuel colore aussi les blocs de code pendant la saisie, avec les mêmes langages et le même thème
que le site : tapez par exemple ```` ```php ```` suivi d’une espace, puis votre code.

Le langage vient du bloc (```` ```php ````) ou de la classe de la balise (`<code class="css">`).
Un bloc sans langage reste en texte brut. Sans Coloration Code, l’éditeur ne colore pas le code :
il affiche seulement le langage des blocs ```` ```php ```` en haut à droite, comme SPIP.

Documentation du plugin : [Coloration Code sur SPIP-Contrib](https://contrib.spip.net/Coloration-Code).
