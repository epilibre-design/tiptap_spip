# Installer l’éditeur

Le plugin fonctionne avec **SPIP 4.2, 4.3, 4.4 et 5**. Il faut un accès de webmestre pour
installer un plugin et l’activer dans la gestion des plugins de SPIP. Si vous n’avez pas cet accès,
transmettez cette page à la personne qui administre le site.

Pour une installation durable, récupérez l’archive ZIP de la
[dernière version publiée](https://github.com/epilibre-design/tiptap_spip/releases/latest)
sur la page **Releases** du projet. La première version est en préparation. En attendant, ou pour
essayer les changements récents, l’archive ZIP de la branche `main` est disponible à cette adresse :

```text
https://github.com/epilibre-design/tiptap_spip/archive/refs/heads/main.zip
```

Cette archive suit les changements de `main` ; son contenu peut donc changer. Une archive de
release identifiée par un numéro de version est préférable pour un site en production.

## Méthode 1 : installer depuis l’URL dans SPIP

1. Connectez-vous à l’espace privé en tant que webmestre.
2. Ouvrez **Configuration → Gestion des plugins → Ajouter des plugins**.
3. Dans **Télécharger un plugin depuis son archive**, collez l’URL directe du ZIP choisi dans
   **URL de l’archive**. Pour un essai avant la première release, utilisez l’URL ci-dessus.
4. Lancez le téléchargement, puis activez **Éditeur visuel pour SPIP** dans la gestion des plugins.
   SPIP peut demander votre mot de passe de webmestre.

Le [guide officiel de SPIP sur la gestion des plugins](https://www.spip.net/fr_article6841.html#Methodes-alternatives-pour-gerer-les-plugins)
décrit l’installation manuelle par SVP et les droits nécessaires.

## Méthode 2 : envoyer les fichiers par FTP

1. Téléchargez l’archive ZIP de la release choisie, ou celle de `main` pour un essai, puis
   décompressez-la sur votre ordinateur.
2. Renommez le dossier obtenu en `tiptap_spip`.
3. Envoyez **ce dossier** dans le répertoire `plugins/` à la racine de votre site SPIP.
   Le fichier `paquet.xml` doit alors se trouver à `plugins/tiptap_spip/paquet.xml`.
4. Dans l’espace privé, ouvrez **Configuration → Gestion des plugins** et activez
   **Éditeur visuel pour SPIP**.

La méthode FTP ne met pas les fichiers à jour automatiquement. Pour une mise à jour, récupérez
une nouvelle archive, sauvegardez d’abord le site, remplacez les fichiers du plugin, puis vérifiez
qu’il reste actif. Consultez aussi la [documentation de SPIP sur le FTP](https://www.spip.net/fr_article6841.html#Methodes-alternatives-pour-gerer-les-plugins).

## Vérifier l’installation

Ouvrez la modification d’un article contenant un champ **Texte** : une barre d’outils et une zone
d’écriture visuelle doivent apparaître. Essayez de mettre quelques mots en gras, puis enregistrez
l’article avec le bouton habituel de SPIP. Votre texte existant doit rester présent.

L’éditeur s’active par défaut dans les champs compatibles de l’espace privé. Son affichage dans les
formulaires du site public et dans les crayons se règle séparément ; il est désactivé par défaut.
Voir [Configurer l’éditeur](configurer.md) si un champ attendu n’affiche pas la barre.

!!! tip "Le porte-plume reste disponible"
    Le bouton **Source** affiche les raccourcis SPIP, et les champs que vous décochez dans la
    configuration conservent leur éditeur habituel.
