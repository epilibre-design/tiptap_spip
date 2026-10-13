# Barre d'outils toujours visible — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** dans le formulaire d'édition de l'espace privé, la barre d'outils reste visible en haut de la fenêtre quand on fait défiler un long texte.

**Constat (demande de l'utilisateur, diagnostic vérifié) :**
- la barre est déjà en `position: sticky; top: 0` (`css/tiptap_spip.css`) ;
- `.cadre-formulaire-editer .formulaire_spip` a `overflow: hidden` dans le CSS de l'espace privé (SPIP 4.2,
  4.4 et 5) : le formulaire devient le conteneur de défilement de la barre, qui reste collée à lui et
  part avec la page ;
- pas de bandeau fixe en haut de l'espace privé (`.bando-haut` est en `position: relative`) : `top: 0`
  convient.

**Architecture :**
- `css/tiptap_spip.css` : `.cadre-formulaire-editer .formulaire_spip:has(.tts-toolbar)` passe en
  `overflow: clip`. Ce qui dépasse reste masqué (mise en page de SPIP inchangée), mais `clip` ne crée pas
  de conteneur de défilement : la barre colle à la fenêtre ;
- `overflow: hidden` crée aussi un contexte de formatage de bloc, que SPIP utilise (« sinon problème avec
  marge supérieure qui déborde ») ; `clip` n'en crée pas : `display: flow-root` le rétablit ;
- le placement des menus (PR #4) compte `clip` comme un ancêtre qui coupe : inchangé.

**Tech Stack :** inchangée. `overflow: clip` : Chrome 90, Firefox 81, Safari 16 ; `:has()` déjà employé par
le plein écran.

## Global Constraints

- Commentaires en français, tabulations ; commits sans trailer.
- Mise en page du formulaire de SPIP inchangée (marges, entête).
- Pas de `git switch` pendant un e2e ; caches de squelettes et de CSS vidés après un changement de branche.

## Tâches

1. **e2e** : article long dans `editer_article`, page défilée : la barre est en haut de la fenêtre et c'est
   elle que le navigateur affiche à ce point (`elementFromPoint`) ; la position de l'entête du
   formulaire n'a pas changé (marge supérieure).
2. **CSS** ; spec 06.

## Réalisation

- **Reproduction** : sans la règle, la barre est à −565 px après un défilement de 1 200 px.
- **`display: flow-root` non retenu** : prévu pour rétablir le contexte de formatage de bloc de `hidden`,
  il est inutile ici. Le formulaire a une bordure supérieure (le premier enfant ne peut pas déborder) et
  l'e2e mesure les mêmes positions et hauteurs, enfants compris, avec `clip` et avec `hidden`.
- **Fond et superposition** : la barre a déjà un fond opaque et `z-index: 5` ; l'e2e vérifie que c'est
  elle que le navigateur affiche en haut de la fenêtre.
- **Compatibilité** : `overflow: clip` (Chrome 90, Firefox 81, Safari 16) ; `:has()` (Firefox 121, donc
  ESR 128) déjà requis par le plein écran. Sans eux, la barre reste comme avant.
- `barre.e2e.js` et `menus.e2e.js` verts sur SPIP 4.2, 4.4 et 5, sous Chromium, Firefox et WebKit ; suite
  e2e Chromium complète sur 4.4 : 52 réussis, 1 sauté.
