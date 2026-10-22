# Contenu SPIP

L’éditeur garde les fonctions propres à SPIP. Les fenêtres de saisie vous évitent de retenir leur
syntaxe, tout en laissant l’[accès à la source](../premiers-pas.md#passer-en-source-et-revenir).

## Mise en forme

Sélectionnez les mots à modifier, puis choisissez un outil dans la barre.

| Ce que vous voulez faire | Outil à utiliser |
|---|---|
| Mettre quelques mots en valeur | **Gras**, **Italique** ou **Barré** |
| Écrire un exposant ou un indice | **Exposant** ou **Indice** |
| Aligner un ou plusieurs paragraphes | Menu **Alignement** : gauche, centre, droite ou justifié |
| Insérer des guillemets ou des caractères spéciaux | Menus **Guillemets** et **Caractères** |

Pour retirer un effet, sélectionnez le passage et cliquez de nouveau sur le même bouton.
Le menu **Alignement** propose aussi **Sans alignement** pour revenir à la présentation habituelle.
L’alignement porte sur les blocs de texte concernés, pas sur quelques mots ni sur une cellule de tableau.

## Titres et listes

Placez le curseur dans le paragraphe à transformer, puis ouvrez **Titre**. **Intertitre** correspond
au titre SPIP habituel. Les niveaux supplémentaires dépendent de la
[configuration du site](../configurer.md). Choisissez **Paragraphe** pour revenir au texte courant.

Le menu **Liste** transforme le paragraphe ou les paragraphes sélectionnés en liste à puces ou
numérotée. **Entrée** crée l’élément suivant. **Tab** indente un élément ; **Maj+Tab** le désindente.
Vous pouvez aussi utiliser les commandes d’indentation du menu. Cliquez de nouveau sur le type
de liste actif pour retirer la liste.

Pour créer ou modifier un tableau, consultez la page [Tableaux](tableaux.md).

## Citations et poésie

Placez le curseur dans un paragraphe ou sélectionnez plusieurs paragraphes, puis cliquez sur
**Citation**. Cliquez de nouveau pour retirer la citation.

**Poésie** conserve les retours à la ligne d’un passage. Sélectionnez les paragraphes concernés,
puis cliquez sur **Poésie** ; cliquez de nouveau pour revenir au texte courant.

## Édition de code

Ces outils servent à montrer un exemple de code dans votre article. Le bouton **Source**, lui,
sert à modifier les raccourcis SPIP de l’article entier.

### Quelques mots de code dans une phrase

Sélectionnez le nom d’une fonction, une commande ou un autre court extrait, puis cliquez sur
**Code** (**Ctrl+E**, ou **⌘+E** sur Mac). Cliquez de nouveau pour retirer cet effet.
Le texte reste dans le paragraphe ; les raccourcis SPIP de l’extrait ne sont pas interprétés.

### Un bloc de plusieurs lignes

1. Placez le curseur dans un paragraphe vide, ou dans le paragraphe à convertir.
2. Cliquez sur **Bloc de code**.
3. Saisissez ou collez votre code dans le bloc. **Entrée** y ajoute un retour à la ligne.
4. Pour reprendre le texte après le bloc, utilisez **Ctrl+Entrée** (**⌘+Entrée** sur Mac).

En fin de bloc, trois pressions successives sur **Entrée** permettent aussi d’en sortir.
Pour reconvertir le bloc en paragraphe, placez le curseur dedans et cliquez de nouveau sur
**Bloc de code**. Dans un bloc de code, le gras, les liens et les autres mises en forme ne
s’appliquent pas ; utilisez des espaces pour l’indentation, **Tab** n’indente pas le code.

### Choisir le langage et activer la coloration

Il n’y a pas de sélecteur de langage dans la barre. Pour créer directement un bloc avec un
langage en mode visuel, tapez par exemple trois accents graves suivis de `php` (soit
`` ```php ``) au début d’un paragraphe vide, puis appuyez sur **Espace**.
Le paragraphe devient un bloc de code PHP.

Pour définir ou changer le langage d’un bloc existant, passez en **Source** et indiquez-le
après les trois accents graves ouvrants, puis revenez au visuel :

````text
```php
$message = 'Bonjour';
echo $message;
```
````

Une autre écriture reconnue est une balise `<code>` avec une classe de langage :

```text
<code class="php">
echo 'Bonjour';
</code>
```

Le code d’un tel bloc reste modifiable en mode visuel ; pour changer sa classe, revenez en
**Source**. Évitez de mélanger les deux écritures dans un même bloc.

La coloration pendant la saisie nécessite le plugin facultatif **Coloration Code**, actif avec
son script et le langage correspondant disponibles. Le langage doit être précisé, par exemple
`php`, `js` ou `css` : sans langage, le code reste du texte simple ; un langage indisponible
reste également éditable sans coloration. Le bloc de code fonctionne aussi sans ce plugin.

![Édition d’un article SPIP contenant des blocs de code colorés](../medias/edit_coloration_code.png)

La capture montre des blocs de code avec **Coloration Code** activé.

## Quelques raccourcis clavier

Sur Mac, utilisez **⌘** à la place de **Ctrl**.

| Action | Raccourci |
|---|---|
| Gras / italique | Ctrl+B / Ctrl+I |
| Code dans une phrase | Ctrl+E |
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
