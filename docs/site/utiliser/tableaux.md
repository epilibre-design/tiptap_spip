# Tableaux

Le menu **Tableau** permet de construire et de modifier un tableau en mode visuel. Les données
restent enregistrées sous forme de raccourcis SPIP : vous pouvez les retrouver avec **Source**.

## Créer un tableau et remplir les cellules

1. Placez le curseur à l’endroit voulu dans le texte, en dehors d’un tableau.
2. Ouvrez **Tableau → Insérer un tableau**. L’éditeur crée **trois lignes et trois colonnes**,
   sans ligne d’en-tête au moment de l’insertion.
3. Cliquez dans une cellule et saisissez son contenu.
4. Utilisez **Tab** pour passer à la cellule suivante et **Maj+Tab** pour revenir à la précédente.
   Dans la dernière cellule, **Tab** ajoute une ligne et place le curseur dans sa première cellule.

Vous pouvez sélectionner du texte dans une cellule pour le mettre en gras, en italique ou y
insérer un lien, comme dans un paragraphe. Chaque cellule contient un seul paragraphe : les listes,
intertitres et blocs de code ne peuvent pas être placés à l’intérieur.

![Modification d’un tableau dans l’éditeur visuel](../medias/editeur_tableau.png)

## Ajouter ou supprimer des lignes et des colonnes

Placez le curseur dans une cellule, puis rouvrez **Tableau**. Les commandes agissent par rapport
à cette cellule ; celles qui ne s’appliquent pas à la sélection sont désactivées.

| Action | Commande du menu Tableau |
|---|---|
| Ajouter une ligne avant la ligne courante | **Insérer une ligne au-dessus** |
| Ajouter une ligne après la ligne courante | **Insérer une ligne en dessous** |
| Ajouter une colonne avant la colonne courante | **Insérer une colonne à gauche** |
| Ajouter une colonne après la colonne courante | **Insérer une colonne à droite** |
| Retirer la ligne ou la colonne courante, avec son contenu | **Supprimer la ligne** ou **Supprimer la colonne** |
| Retirer tout le tableau et son contenu | **Supprimer le tableau** |

En cas d’erreur, utilisez **Annuler** (**Ctrl+Z**, ou **⌘+Z** sur Mac).

## Définir la ligne d’en-tête

Placez le curseur dans le tableau et choisissez **Tableau → Ligne d’en-tête**. Cette commande
transforme **la première ligne existante** en en-tête ; elle n’ajoute pas de ligne. Cliquez de
nouveau pour retirer l’en-tête.

L’en-tête concerne toute la première ligne. L’éditeur ne propose pas d’en-têtes limités à une
colonne ou à quelques cellules : il suit la syntaxe native des tableaux SPIP. Les nouvelles
colonnes reprennent le type de cellule de cette première ligne ; les lignes suivantes restent
des lignes de données.

Une première ligne entièrement vide peut être reconnue comme un en-tête lors du retour depuis
la source. Remplissez les cellules de cette ligne pour préciser le contenu du tableau.

## Fusionner et scinder des cellules

1. Cliquez dans la première cellule, puis maintenez **Maj** et cliquez dans la dernière cellule
   du rectangle à fusionner. Vous pouvez aussi faire glisser la souris d’une cellule à l’autre.
2. Vérifiez que les cellules elles-mêmes sont sélectionnées, pas seulement leur texte.
3. Choisissez **Tableau → Fusionner les cellules**.

La fusion peut être horizontale ou verticale. Elle réunit les textes des cellules dans un seul
paragraphe, séparés par des espaces. La commande est désactivée si la sélection ne permet pas
une fusion.

Pour défaire la structure d’une cellule fusionnée, placez le curseur dedans puis choisissez
**Tableau → Scinder la cellule**. Le texte reste dans la première cellule ; les autres sont
vides. Pour retrouver la répartition initiale des textes juste après une fusion, utilisez plutôt
**Annuler**.

## Quand passer en source

La création du tableau, la saisie, l’en-tête, les ajouts ou suppressions et les fusions se font
en mode visuel. Le mode **Source** sert notamment à ajouter ou modifier la **légende** et le
**résumé** : aucune commande de la barre ne les édite actuellement.

### Ajouter une légende et un résumé

Cliquez sur **Source**, puis ajoutez une ligne `||Légende|Résumé||` juste avant les lignes du
tableau, sans ligne vide entre elles :

```text
||Horaires d’ouverture|Jours et heures d’accueil||
|{{Jour}}|{{Matin}}|{{Après-midi}}|
|Lundi|9 h – 12 h|14 h – 17 h|
|Mardi|9 h – 12 h|14 h – 17 h|
```

Pour une légende seule, écrivez `||Horaires d’ouverture||`.
La légende et le résumé sont conservés lorsque vous revenez au visuel et modifiez les cellules,
mais ils ne sont pas affichés dans la grille de l’éditeur. Leur rendu public dépend de SPIP
et des styles du site ; le résumé n’est pas nécessairement un texte visible.

### Comprendre ou corriger les raccourcis

Chaque ligne du tableau commence et finit par `|` ; les cellules sont séparées par `|`.
Toutes les lignes de données doivent avoir le même nombre de positions de cellule. Une cellule
fusionnée compte aussi les positions qu’elle couvre : `<` prolonge la cellule de gauche et `^`
prolonge celle du dessus. Les commandes visuelles écrivent ces marqueurs pour vous.

Un tableau aux lignes incohérentes ou aux fusions invalides peut apparaître comme un fragment
brut. Cliquez sur ce fragment pour corriger son texte, ou passez en **Source**. Voir aussi
[Erreurs de syntaxe](erreurs-de-syntaxe.md).

### Limites du tableau visuel

La largeur des colonnes ne se règle pas en faisant glisser leurs bordures. Le tableau SPIP natif
ne décrit pas non plus les couleurs de cellule, leurs bordures ou un contenu composé de
plusieurs blocs. Passer en source ne rend pas ces options disponibles dans la grille visuelle.
Pour une présentation particulière, privilégiez les styles du site ; un tableau HTML écrit
en source n’offre pas les mêmes commandes d’édition visuelle qu’un tableau SPIP.
