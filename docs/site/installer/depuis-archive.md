# Installer depuis une archive

Cette méthode permet d’installer le plugin à partir d’un fichier ZIP. Pour une installation habituelle avec le catalogue de SPIP, suivez l’[installation standard](../installer.md).

## Choisir l’archive

L’[archive de la branche `main`](https://git.spip.net/spip-contrib-extensions/tiptap_spip/-/archive/main/tiptap_spip-main.zip) est le téléchargement recommandé pour cette méthode. Elle contient les derniers changements du projet ; son contenu peut donc évoluer.

Pour retrouver exactement la même version plus tard, choisissez une version dans la [liste des tags sur GitLab](https://git.spip.net/spip-contrib-extensions/tiptap_spip/-/tags), téléchargez son ZIP et conservez son numéro.

## Installer depuis l’URL de l’archive dans SPIP

1. Connectez-vous à l’espace privé en tant que webmestre.
2. Ouvrez **Configuration → Gestion des plugins → Ajouter des plugins**.
3. Dans **Télécharger un plugin depuis son archive**, collez l’URL directe du ZIP choisi dans **URL de l’archive**. Pour la branche `main`, utilisez :

   ```text
   https://git.spip.net/spip-contrib-extensions/tiptap_spip/-/archive/main/tiptap_spip-main.zip
   ```

4. Lancez le téléchargement, puis activez **Éditeur visuel pour SPIP** dans la gestion des plugins. SPIP peut demander votre mot de passe de webmestre.

Le [guide officiel de SPIP sur la gestion des plugins](https://www.spip.net/fr_article6841.html#Methodes-alternatives-pour-gerer-les-plugins) décrit l’installation manuelle par SVP et les droits nécessaires.

## Envoyer les fichiers par FTP

1. Téléchargez l’archive ZIP choisie, puis décompressez-la sur votre ordinateur.
2. Renommez le dossier obtenu en `tiptap_spip`.
3. Envoyez **ce dossier** dans le répertoire `plugins/` à la racine de votre site SPIP. Le fichier `paquet.xml` doit alors se trouver à `plugins/tiptap_spip/paquet.xml`.
4. Dans l’espace privé, ouvrez **Configuration → Gestion des plugins** et activez **Éditeur visuel pour SPIP**.

Une installation par FTP ne met pas les fichiers à jour automatiquement. Pour une mise à jour, récupérez une nouvelle archive, sauvegardez d’abord le site, remplacez les fichiers du plugin, puis vérifiez qu’il reste actif. Consultez aussi la [documentation de SPIP sur le FTP](https://www.spip.net/fr_article6841.html#Methodes-alternatives-pour-gerer-les-plugins).

Après l’activation, suivez les [premiers pas](../premiers-pas.md).
