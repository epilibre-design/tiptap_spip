# Les principes de l’éditeur

Cette page explique ce qui se passe derrière l’interface. Elle n’est pas nécessaire pour rédiger
un article.

## Le texte SPIP reste la référence

Un article existant contient des raccourcis comme `{{gras}}`, `[[une note]]` ou `<doc12|center>`.
À l’ouverture, l’éditeur **lit ce texte** et en construit une représentation visuelle. Quand vous
modifiez le contenu, il **réécrit les raccourcis SPIP** dans le champ du formulaire. L’enregistrement
reste celui de SPIP ; la base de données ne passe pas à un autre format.

```text
Texte SPIP enregistré → lecture → édition visuelle → écriture → texte SPIP enregistré
```

La représentation intermédiaire utilise Tiptap et ProseMirror dans le navigateur. Le bouton
**Source** permet de revenir au texte SPIP et de l’éditer directement.

## Le rendu public appartient à SPIP

L’éditeur ne remplace pas les traitements de SPIP sur le site public. SPIP continue de calculer les
liens, les notes, les modèles et les autres raccourcis quand une page est affichée. L’aperçu d’un
modèle dans l’éditeur demande son rendu au serveur ; le résultat définitif reste celui de la page.

## Ne pas perdre ce que l’éditeur ne comprend pas

Un fragment inconnu, mal formé ou propre à un autre plugin peut rester sous forme brute dans la
vue visuelle. Son texte est conservé tant qu’il n’est pas corrigé ou modifié explicitement. Le mode
**Source** reste disponible pour le traiter. Il est donc préférable de vérifier le rendu public
après une modification importante d’un contenu complexe.

## Étendre l’éditeur sans changer son cœur

Un plugin SPIP tiers peut déclarer comment lire et écrire **son** raccourci, ajouter un bouton et
fournir le rendu public correspondant. L’[exemple FAQ](developper/faq.md) montre les deux côtés :
le JavaScript pour l’édition et PHP pour le rendu SPIP. Les détails du parseur et des points
d’extension figurent dans les [spécifications du projet](https://github.com/epilibre-design/tiptap_spip/tree/main/docs/specs).
