# Contenu SPIP

L’éditeur garde les fonctions propres à SPIP. Les fenêtres de saisie vous évitent de retenir leur
syntaxe, tout en laissant l’[accès à la source](../premiers-pas.md#passer-en-source-et-revenir).

## Mise en forme

Sélectionnez le texte à modifier, puis choisissez un outil dans la barre. Pour un nouveau
paragraphe ou un nouvel élément de liste, placez simplement le curseur à l’endroit voulu.

| Ce que vous voulez faire | Outil à utiliser |
|---|---|
| Mettre quelques mots en valeur | **Gras**, **Italique**, **Barré**, **Exposant** ou **Indice** |
| Créer un titre dans le texte | Menu **Titre**, puis un niveau proposé |
| Faire une liste | Menu **Liste** : puces, numéros, indentation |
| Insérer une citation ou un extrait de code | **Citation** ou **Bloc de code** |
| Aligner un paragraphe | Menu **Alignement** |
| Insérer des guillemets ou des caractères spéciaux | Menus **Guillemets** et **Caractères** |
| Créer un tableau | Menu **Tableau**, puis **Insérer un tableau** |

### Titres, listes et tableaux

Le niveau **Intertitre** correspond au titre SPIP habituel. Les niveaux supplémentaires sont
disponibles si l’administrateur les a conservés dans la [configuration](../configurer.md).

Dans une liste, **Tab** indente un élément et **Maj+Tab** le désindente.

Pour un tableau, placez le curseur dans une cellule avant de rouvrir **Tableau** :
vous pouvez ajouter ou supprimer une ligne ou une colonne, ajouter une ligne d’en-tête,
fusionner ou séparer des cellules.

![Édition d’un tableau](../medias/editeur_tableau.png)

### Édition de code

![Édition d’un article SPIP contenant des blocs de code colorés](../medias/edit_coloration_code.png)

!!! note
    Exemple d’édition d’un article lorsque le plugin **Coloration Code** est activé.

### Quelques raccourcis clavier

Sur Mac, utilisez **⌘** à la place de **Ctrl**.

| Action | Raccourci |
|---|---|
| Gras / italique | Ctrl+B / Ctrl+I |
| Insérer un lien | Ctrl+K |
| Annuler / rétablir | Ctrl+Z / Ctrl+Maj+Z |
| Passer en source ou revenir au visuel | Ctrl+Maj+E |
| Agrandir l’éditeur | F11 quand le curseur est dans l’éditeur |

Les autres raccourcis sont indiqués dans l’infobulle de leur bouton.

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

Le bouton **Multilingue** crée des versions d’un passage selon la langue. Consultez
[Utiliser les multis](multilinguisme.md) pour activer le bouton, changer la langue affichée pendant
l’édition et remplir la fenêtre du multi.

Dans la fenêtre du multi, choisissez la langue de chaque version dans la liste. Elle propose les
langues activées dans **Configuration → Multilinguisme** ; une langue déjà présente dans le multi reste
proposée. **Sans langue** correspond à la version affichée quand aucune autre ne convient.

## Si un passage s’affiche comme du code

Un raccourci mal formé ou une syntaxe ajoutée par un autre plugin peut rester sous forme brute.
Cliquez dessus pour voir sa source et, si besoin, la corriger ; vous pouvez aussi utiliser
**Source**. L’éditeur évite ainsi de réécrire un fragment qu’il ne sait pas représenter. Pour une
syntaxe propre à votre site, un développeur peut créer une
[extension de l’éditeur](../developper/faq.md).
