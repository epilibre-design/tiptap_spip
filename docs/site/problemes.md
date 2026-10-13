# Résoudre un problème

## Je ne vois pas l’éditeur

Vérifiez que le plugin est **actif** dans **Configuration → Gestion des plugins**. Ouvrez ensuite
**Configuration → Éditeur visuel** et vérifiez que le champ concerné est coché. Seuls les champs
qui utilisent les raccourcis typographiques SPIP sont proposés. Sur le site public ou dans les
crayons, vérifiez aussi la case d’activation correspondante.

Si vous voyez les raccourcis SPIP dans une zone de texte avec le bouton **Source**, cliquez dessus
pour revenir au visuel. Le mode choisi est mémorisé dans le navigateur.

## Un passage apparaît comme du code

Le texte peut contenir un raccourci incomplet, du HTML particulier ou une syntaxe ajoutée par un
autre plugin. L’éditeur garde alors ce passage en source afin d’éviter de le modifier à votre insu.
Cliquez dessus pour l’éditer, ou passez en **Source**. Une indication d’**anomalie de syntaxe**
sous l’éditeur signale certains raccourcis incomplets ; cliquez dessus pour voir l’explication.

Si votre site emploie souvent une syntaxe ajoutée par un autre plugin, demandez à son développeur
une [extension de l’éditeur](developper/faq.md), ou désactivez l’éditeur visuel sur les champs
concernés.

## Un modèle ne montre pas de catalogue ou d’aperçu

La saisie du raccourci reste possible sans autre plugin. Le catalogue exige le plugin facultatif
**Insérer modèles**, une configuration correspondante et les droits nécessaires. Il n’est pas
disponible sur SPIP 5 avec la version actuelle de ce plugin facultatif.

L’aperçu peut aussi manquer si le modèle ne peut pas être calculé dans le contexte de l’article ;
le raccourci reste visible et le rendu public reste celui de SPIP.

## Je veux revenir à l’ancien éditeur

Dans **Configuration → Éditeur visuel**, décochez les champs concernés. Vous pouvez aussi désactiver
le plugin dans la gestion des plugins. Les textes enregistrés utilisent toujours les raccourcis
SPIP : ils restent modifiables dans l’éditeur habituel.

Pour un problème reproductible, indiquez la version de SPIP, le champ concerné et les étapes sur
la [page des signalements du projet](https://github.com/epilibre-design/tiptap_spip/issues).
