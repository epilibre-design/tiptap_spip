# Installer depuis Git

Cette méthode s’adresse aux personnes qui ont accès au serveur et souhaitent suivre le dépôt du plugin. Placez-vous à la racine de votre installation SPIP, puis clonez le dépôt dans `plugins/`.

En SSH, avec un accès configuré à `git.spip.net` :

```sh
git clone git@git.spip.net:spip-contrib-extensions/tiptap_spip.git plugins/tiptap_spip
```

Ou en HTTPS :

```sh
git clone https://git.spip.net/spip-contrib-extensions/tiptap_spip.git plugins/tiptap_spip
```

Le fichier `paquet.xml` doit se trouver à `plugins/tiptap_spip/paquet.xml`. Dans l’espace privé, ouvrez **Configuration → Gestion des plugins** et activez **Éditeur visuel pour SPIP**.

Pour récupérer les changements ultérieurs, lancez `git pull` dans `plugins/tiptap_spip/`, puis vérifiez que le plugin reste actif. Si vous avez besoin d’une version figée, choisissez un [tag du dépôt](https://git.spip.net/spip-contrib-extensions/tiptap_spip/-/tags).

Après l’activation, suivez les [premiers pas](../premiers-pas.md).
