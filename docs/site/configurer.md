# Configurer l’éditeur

Après activation du plugin, ouvrez **Configuration → Éditeur visuel** dans l’espace privé.
Les réglages ci-dessous concernent le site ; chaque rédacteur peut ensuite choisir le mode visuel
ou source dans son navigateur.

## Choisir où l’éditeur apparaît

La rubrique **Champs équipés** liste les champs compatibles de vos objets éditoriaux, par exemple
le texte, le chapeau ou le post-scriptum d’un article. Décochez un champ pour y conserver l’éditeur
habituel de SPIP. Certains champs courts, tels que le titre, ne figurent pas dans cette liste.

L’éditeur fonctionne dans l’espace privé dès qu’un champ est coché. Les cases **Dans le site public**
et **Dans les crayons** sont indépendantes et désactivées par défaut. Activez-les seulement si vous
souhaitez aussi l’éditeur dans ces contextes. Le plugin **Crayons** doit bien sûr être présent pour
utiliser la seconde option.

## Régler l’édition

- **Mode à l’ouverture** : choisissez **Visuel** ou **Source**. Si une personne a déjà changé de
  mode dans son navigateur, son choix mémorisé prévaut à l’ouverture suivante.
- **Niveaux de titres proposés** : sélectionnez les niveaux qui apparaîtront dans le menu **Titre**.
  Le niveau **Intertitre** utilise le raccourci SPIP classique ; les niveaux suivants utilisent
  des balises HTML de titre.
- **Glossaires proposés** : choisissez les glossaires nommés à afficher dans la fenêtre du
  glossaire. Les raccourcis déjà présents dans vos textes restent lisibles.
- **Modèles proposés** : si le plugin **Insérer modèles** est installé, son catalogue se règle
  dans sa propre configuration. Sinon, la saisie directe du raccourci reste disponible.

Enregistrez le formulaire, puis rouvrez une page d’édition pour vérifier les champs concernés.

## Quand un champ manque

L’éditeur équipe les champs éditables dont SPIP traite le contenu avec les raccourcis typographiques,
comme le champ **Texte**. Un champ personnalisé peut nécessiter une intégration par le plugin qui
l’ajoute. Voir [Résoudre un problème](problemes.md) et, pour les développeurs,
[Créer une extension](developper/faq.md).
