# Ticket #13 — Rappeler une note de bas de page

Ticket : https://git.spip.net/spip-contrib-extensions/tiptap_spip/-/work_items/13

Branche : `fix/13-rappels-notes`.

## Origine et reproduction

Source reproduite dans l’éditeur sous jsdom :

```spip
Premier[[<A>Une explication commune.]] Autre[[<A>]] Encore[[<A>]]
```

- Le parseur et le sérialiseur conservent exactement cette source.
- Le panneau affiche `Notes (3)` avec une entrée pleine et deux entrées vides.
- Ouvrir un rappel puis appliquer sans changement produit `La note est vide.`

Le problème n’est donc pas une perte à l’import. Le modèle `spipNote` peut déjà
représenter un nom associé à un contenu vide, mais l’interface traite chaque
occurrence comme une définition indépendante.

Dans `src/ui/NotePopover.js`, `appliquer()` refuse tout contenu vide avant de
valider sa sérialisation. Dans `src/editor/extensions.js`, `notesDuDocument()`
énumère les occurrences sans distinguer les définitions des rappels.
`src/ui/NotesPanel.js` transforme ensuite chaque occurrence en entrée de liste.
Les chemins JavaScript sont relatifs à `prive/javascript/tiptap_spip/`.

Le code de référence TextWheel confirme la distinction :
https://git.spip.net/spip/textwheel/-/blob/master/inc/notes.php
Dans `traiter_raccourci_notes()`, un appel nommé est produit même sans texte,
mais une entrée de bas de page n’est ajoutée que si `$note_texte` est non vide.
Un rappel numérique ne consomme pas de nouveau numéro automatique.

## Pistes de correction

1. **Lever uniquement le refus de contenu vide pour un nom non vide.** Petite
   modification, mais laisse les fausses entrées de bas de page et ne permet
   pas de choisir clairement une note existante.
2. **Distinguer définitions et rappels dans les données dérivées et la saisie.**
   Conserver les nœuds et la syntaxe actuels ; résoudre les références pour les
   besoins de l’interface et lister seulement les définitions dans le panneau.
   Cette solution corrige les deux défauts sans migration du document.
3. **Créer des identifiants persistants et réécrire les références.** Pourrait
   permettre des renommages et renumérotations automatiques, mais introduit des
   transformations supplémentaires à l’import, à l’export et au copier-coller.
   Une référence numérique existante n’indique pas une identité stable.

## Piste recommandée : 2

Correction retenue :

- Conserver les champs actuels du popover : un même nom et un texte vide
  suffisent à créer un rappel. Le rappel écrit seulement `[[<nom>]]`, sans
  recopier le contenu. Aucun sélecteur ni case supplémentaire.
- Conserver la possibilité de réappliquer un rappel importé, y compris si sa
  cible est absente du champ édité : SPIP peut composer des notes de plusieurs
  champs. Ne pas bloquer l’import ni supprimer ces références.
- Garder le refus des nouvelles notes automatiques ou sans appel dépourvues
  de texte ; valider les noms avec le mécanisme de relecture existant.
- Distinguer les appels des définitions : trois appels vers A, une seule
  définition dans le panneau pour l’exemple du ticket.
- Conserver les références numériques telles qu’elles sont écrites. Une
  insertion antérieure peut changer leur cible, comme dans SPIP ; ne pas
  promettre une renumérotation automatique.
- Respecter la langue affichée des blocs multi lors de la recherche de cibles.
- Ne pas fusionner silencieusement deux définitions ayant le même nom : leurs
  contenus existent dans la source et le cœur peut les restituer tous les deux.

Cliquer sur un rappel ouvre ce rappel pour modification ou suppression ;
cliquer sur une définition dans le panneau permet de modifier son contenu.

## Vérifications effectuées

Commande depuis `prive/javascript/tiptap_spip/` :

```sh
npm test -- tests/spip/notes.test.js tests/editor/notes.test.js tests/ui/notes.test.js
```

Résultat initial : **57 tests réussis**, répartis dans trois fichiers. Une
reproduction directe sous jsdom confirme les deux défauts ci-dessus.

Après correction : **1 457 tests réussis sur 1 459** dans la suite JavaScript.
Les deux échecs de `tests/ui/i18n.test.js` sont également reproduits sur une
archive de la version initiale : différences de libellés français entre le
JavaScript et le fichier de langue, et clé anglaise `abbr_explication` absente.
Ils sont indépendants de ce correctif.

Le parcours création/réédition/enregistrement d’un rappel est testé avec
Playwright sur Chromium, Firefox et WebKit. Les bundles sont reconstruits.

## Vérifications à ajouter lors de l’implémentation

- Création et réédition d’un rappel nommé sans duplication de contenu.
- Refus maintenu d’une note automatique vide ou sans appel vide.
- Sérialisation conservative et canonique des rappels nommés et numériques.
- Trois appels, une entrée dans le panneau pour l’exemple du ticket.
- Référence numérique n’incrémentant pas le compteur des notes automatiques.
- Référence absente ou antérieure à sa définition conservée.
- Définitions homonymes, suppression de cible, annulation/rétablissement.
- Notes dans les parties affichées des multi, changements de langue et retour
  du mode source ; copier-coller des rappels.
- Suite JavaScript complète, construction des bundles et validation navigateur.

## État

Le correctif autorise les notes nommées sans texte et filtre les rappels dans
le panneau. Le parseur, le format de document et la numérotation sont conservés.
