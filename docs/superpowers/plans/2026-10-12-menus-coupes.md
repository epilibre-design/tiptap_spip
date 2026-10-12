# Menus de la barre coupés — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** un menu de la barre d'outils reste entièrement visible quand son conteneur le couperait.

**Constat (signalé par l'utilisateur, diagnostic vérifié) :**
- la liste d'un menu (`.tts-menu__liste`) est en `position: absolute; left: 0` sous son bouton ;
- `.cadre-formulaire-editer .formulaire_spip` a `overflow: hidden` dans le CSS de l'espace privé
  (`prive/themes/spip/forms.css`) : ce qui dépasse du formulaire est masqué ;
- un menu ouvert près du bord droit du formulaire est coupé à droite ; un long menu (Tableau) est
  coupé en bas.

**Architecture :**
- `src/ui/placement.js` :
  - `bornes(element)` : intersection de la fenêtre et des ancêtres qui coupent (`overflow` autre que
    `visible`) ;
  - `placerMenu(liste)` : remet le placement par défaut ; si la liste dépasse à droite des bornes,
    l'aligne sur le bord droit du bouton, puis la décale si elle dépasse alors à gauche ; si elle dépasse
    en bas, limite sa hauteur (minimum lisible) avec défilement.
- `menuOutil()` (`src/ui/boutons.js`) appelle `placerMenu()` à l'ouverture, et au redimensionnement de la
  fenêtre tant que le menu est ouvert.
- Pas de modification du CSS du cœur SPIP (la solution `overflow: visible` toucherait une règle commentée
  de l'espace privé).

**Tech Stack :** inchangée.

## Global Constraints

- Commentaires en français, tabulations ; commits sans trailer ; bundle reconstruit et versionné.
- Navigation au clavier du menu inchangée (spec 06).
- Pas de `git switch` pendant un e2e ; caches de squelettes vidés après un changement de branche.

## Tâches

1. **Placement** : `placement.js` (Vitest, géométrie simulée par `getBoundingClientRect` et
   `getComputedStyle`) ; appel dans `menuOutil()` ; redimensionnement.
2. **e2e** : sur `editer_article`, fenêtre étroite, chaque menu de la barre ouvert est entièrement dans les
   bornes de son formulaire (coins et dernier élément atteignables par `elementFromPoint`).
3. **Specs** 06 ; bundle.

## Réalisation

- **Bornes** : la fenêtre ne compte qu'en largeur ; en hauteur, seuls les ancêtres qui coupent (la page
  défile, le menu avec elle). Sans cela, un menu ouvert près du bas de l'écran était réduit à tort.
- **Reproduction e2e** : balayage de 480 à 1600 px, correctif désactivé ; le menu Modèle dépasse à 640,
  1440 et 1600 px. Le test garde 640 et 1440 px ; il échoue sans le correctif, passe avec.
- **Non reproduit** : la coupure en bas du menu Tableau (formulaire assez haut sur les sites jetables) ;
  couverte par le test unitaire de `placerMenu`.
- Vitest 1337/1337 ; `menus.e2e.js` vert sur SPIP 4.2, 4.4 et 5, sous Chromium, Firefox et WebKit.
