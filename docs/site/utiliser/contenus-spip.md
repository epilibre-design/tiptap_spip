# Insérer des contenus SPIP

L’éditeur garde les fonctions propres à SPIP. Les fenêtres de saisie vous évitent de retenir leur
syntaxe, tout en laissant l’[accès à la source](../premiers-pas.md#passer-en-source-et-revenir).

## Liens vers une page ou un document

Sélectionnez le texte du lien et cliquez sur **Lien**. Saisissez une adresse web ou recherchez un
objet du site, comme un article ou une rubrique. La fenêtre permet aussi d’ajouter une bulle d’aide,
une langue ou l’ouverture dans une nouvelle fenêtre. Pour modifier un lien existant, placez le
curseur dedans et rouvrez **Lien**.

En source, un lien interne peut par exemple s’écrire `[Lire l’article->art12]`.

## Notes et glossaires

**Note** insère un appel numéroté dans le texte. La fenêtre de la note possède sa propre petite zone
d’édition et accepte notamment le gras, les liens et les listes. Un panneau sous l’éditeur réunit les
notes du texte ; cliquez sur l’une d’elles pour la modifier. Il est aussi possible de nommer une
note ou de la placer sans appel dans le texte.

Voir [Saisir des notes de bas de page](notes-de-bas-de-page.md) pour les étapes et les options du
formulaire.

**Glossaire** associe un terme à une définition : sélectionnez le mot, puis ouvrez **Glossaire**.
Vous pouvez choisir un glossaire, préciser une bulle ou une langue, et vérifier la destination avec
**Voir la définition**.

## Images, documents et autres modèles

Un raccourci tel que `<doc12|center>` est un **modèle** SPIP. L’éditeur peut en montrer un aperçu,
mais l’affichage final est calculé par SPIP. Le bouton **Modèle** permet au minimum de saisir le
raccourci. Si le plugin facultatif **Insérer modèles** est présent et compatible avec votre version
de SPIP, son catalogue et ses formulaires sont proposés. Sur SPIP 5, ce catalogue n’est pas
disponible avec la version actuelle de ce plugin facultatif : utilisez la saisie du raccourci.

Pour envoyer des fichiers depuis l’éditeur, voir [Coller des images et déposer des fichiers](images-documents.md).

## Plusieurs langues dans un même texte

Le bouton **Multi** crée des versions d’un passage selon la langue. Consultez
[Utiliser les multis](multilinguisme.md) pour activer le bouton, changer la langue affichée pendant
l’édition et remplir la fenêtre du multi.

Dans la fenêtre du multi, choisissez la langue de chaque version dans la liste. Elle propose les
langues activées dans cette configuration ; une langue déjà présente dans le multi reste
proposée. **Sans langue** correspond à la version affichée quand aucune autre ne convient.

## Si un passage s’affiche comme du code

Un raccourci mal formé ou une syntaxe ajoutée par un autre plugin peut rester sous forme brute.
Cliquez dessus pour voir sa source et, si besoin, la corriger ; vous pouvez aussi utiliser
**Source**. L’éditeur évite ainsi de réécrire un fragment qu’il ne sait pas représenter. Pour une
syntaxe propre à votre site, un développeur peut créer une
[extension de l’éditeur](../developper/faq.md).
