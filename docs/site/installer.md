# Installer l’éditeur

Le plugin fonctionne avec **SPIP 4.2, 4.3, 4.4 et 5**. Il faut un accès de webmestre pour
installer un plugin et l’activer dans la gestion des plugins de SPIP. Si vous n’avez pas cet accès,
transmettez cette page à la personne qui administre le site.

Pour installer une version dont le contenu ne change pas, ouvrez la
[liste des versions (tags)](https://github.com/epilibre-design/tiptap_spip/tags) et choisissez
le ZIP du tag le plus récent. La version la plus récente, `1.1.0`, est disponible directement :

```text
https://github.com/epilibre-design/tiptap_spip/archive/refs/tags/1.1.0.zip
```

GitHub marque actuellement les releases comme **préversions** : leur contenu est figé, mais
elles ne sont pas annoncées comme stables. Si vous souhaitez essayer les changements les plus
récents, utilisez plutôt l’archive de la branche `main` :

```text
https://github.com/epilibre-design/tiptap_spip/archive/refs/heads/main.zip
```

L’archive de `main` suit les changements du projet ; son contenu peut donc varier. Pour retrouver
la même version plus tard, conservez le numéro du tag que vous avez installé.

## Méthode 1 : installer depuis l’URL dans SPIP

1. Connectez-vous à l’espace privé en tant que webmestre.
2. Ouvrez **Configuration → Gestion des plugins → Ajouter des plugins**.
3. Dans **Télécharger un plugin depuis son archive**, collez l’URL directe du ZIP choisi dans
   **URL de l’archive** : par exemple celle du tag `1.1.0` ci-dessus. Pour une version plus récente,
   ouvrez la page des tags et copiez l’adresse de son ZIP.
4. Lancez le téléchargement, puis activez **Éditeur visuel pour SPIP** dans la gestion des plugins.
   SPIP peut demander votre mot de passe de webmestre.

Le [guide officiel de SPIP sur la gestion des plugins](https://www.spip.net/fr_article6841.html#Methodes-alternatives-pour-gerer-les-plugins)
décrit l’installation manuelle par SVP et les droits nécessaires.

## Méthode 2 : envoyer les fichiers par FTP

1. Téléchargez l’archive ZIP du tag choisi, ou celle de `main` pour un essai, puis
   décompressez-la sur votre ordinateur.
2. Renommez le dossier obtenu en `tiptap_spip`.
3. Envoyez **ce dossier** dans le répertoire `plugins/` à la racine de votre site SPIP.
   Le fichier `paquet.xml` doit alors se trouver à `plugins/tiptap_spip/paquet.xml`.
4. Dans l’espace privé, ouvrez **Configuration → Gestion des plugins** et activez
   **Éditeur visuel pour SPIP**.

La méthode FTP ne met pas les fichiers à jour automatiquement. Pour une mise à jour, récupérez
une nouvelle archive, sauvegardez d’abord le site, remplacez les fichiers du plugin, puis vérifiez
qu’il reste actif. Consultez aussi la [documentation de SPIP sur le FTP](https://www.spip.net/fr_article6841.html#Methodes-alternatives-pour-gerer-les-plugins).

**Porte-plume**, **Insérer modèles** et **Coloration Code** peuvent compléter l’éditeur. Consultez la page
[Plugins complémentaires](installer/plugins-complementaires.md) pour savoir ce qu’ils apportent.

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
