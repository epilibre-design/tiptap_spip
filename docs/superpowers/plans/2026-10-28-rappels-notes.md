# Rappels de notes — plan de correction

**Objectif :** permettre une seconde entrée de même nom, sans texte, comme SPIP.

**Conception validée :** conserver les champs actuels du popover. Une note dont
le nom est non vide et le texte vide est un rappel ; aucun sélecteur ni case
supplémentaire. Les rappels restent des appels dans le texte mais ne produisent
pas d’entrée dans le panneau des définitions. Le format et les ancres restent
ceux de SPIP, avec retour vers le premier appel.

**Contraintes :** ne pas exiger une cible dans le champ courant ; ne pas
renuméroter les références numériques ; préserver les définitions homonymes,
les multi et la modification préexistante de `.gitignore`.

## Étapes

- [x] Ajouter des tests d’interface : création par nom identique et texte vide,
  réédition d’un rappel, références numériques et absentes, refus maintenu des
  notes vides sans nom ou sans appel, noms invalides ; observer les échecs.
- [x] Autoriser le contenu vide uniquement pour un nom non vide dans
  `src/ui/NotePopover.js`, en conservant la validation par relecture.
- [x] Ajouter des tests du panneau : trois appels/une définition, homonymes,
  suppression/annulation, retour de source et changement de langue des multi ;
  observer les échecs puis filtrer les rappels dans `src/ui/NotesPanel.js`.
- [x] Documenter la saisie et les limites des références numériques dans les
  guides français et anglais ; mettre à jour le diagnostic et le changelog.
- [x] Exécuter la suite JavaScript, reconstruire les bundles, vérifier le diff
  et vérifier le parcours dans un navigateur ; faire relire le correctif.

Les chemins `src/` sont relatifs à `prive/javascript/tiptap_spip/`.

## Résultats

- Tests ajoutés observés en échec avant correction puis réussis.
- Relecture indépendante : un défaut avec les blancs seuls relevé et corrigé,
  avec trois régressions observées en échec puis réussies. Les objets, espaces
  insécables et espaces mis en forme restent des contenus de définition.
- Suite complète : 1 457 tests réussis, deux échecs préexistants dans
  `tests/ui/i18n.test.js`, reproduits depuis une archive de `HEAD` sans correctif.
  Ils concernent les différences de libellés français et la traduction anglaise
  manquante `abbr_explication` ; aucun fichier de traduction n’est modifié ici.
- Bundles reconstruits ; parcours création/réédition/enregistrement vérifié
  dans Chromium, Firefox et WebKit sur le site SPIP jetable.
