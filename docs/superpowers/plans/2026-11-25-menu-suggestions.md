# Menu de suggestions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer une API de suggestions utilisable par un plugin tiers, sans dépendance emoji.

**Architecture:** Une fabrique Tiptap adapte `@tiptap/suggestion` à une liste accessible et à des sessions par éditeur. Une enveloppe interne distincte reçoit les sélecteurs explicites ; liste et enveloppe utilisent la couche supérieure HTML sans devenir des instances de `Popover`.

**Tech Stack:** JavaScript ESM, Tiptap/ProseMirror 3.31.4, `@tiptap/suggestion` 3.31.4, `@floating-ui/dom`, esbuild, Vitest, Playwright et axe.

**Spec:** [Menu de suggestions](../specs/2026-11-25-menu-suggestions-design.md). Lire aussi la [spec emoji](../specs/2026-11-25-emojis-design.md) pour les contraintes de l’enveloppe, sans ajouter le picker dans cette livraison.

## Global Constraints

- Deux fonctions publiques seulement : `ui.creerSuggestions(options)` et `ui.filtrerSuggestions(items, query)` ; signatures et défauts de la spec, aucun export du contrôleur ou de Suggestion.
- Priorité Tiptap interne de `10 000`, non configurable ; un fournisseur actif par caractère et par éditeur ; doublon averti et ignoré, cœur conservé s’il existe.
- Aucun résultat actif à l’ouverture ou au changement de requête ; Entrée sans option active reste une touche d’édition.
- Pas de React, de `mount()` de Suggestion, de nouveau schéma ou de normalisation du contenu.
- Liste et panneau : `popover="manual"` ; panneau hors du formulaire parent ; aucun changement de `Popover.current` ou de `parent.enfant`.
- États par éditeur, jamais sur l’objet partagé `editor.tiptapSpip`. Commande synchrone et booléenne ; refus avant mutation ; validation isolée dans l’historique.
- API et filtrage commun sans traduction ni synonymes implicites ; chaînes rendues comme texte.
- Après le socle et le picker, surcoût JS/CSS cumulé au plus **40 Kio gzip**, mesure `gzip -n -6 -c` ; conserver la référence avant socle.

## Review Focus

1. Focus de repli en erreur : Tab atteint « Réessayer » avant la sentinelle de sortie avant — tâche 2, puis essai avec le picker réel dans le deuxième plan.
2. Suggestion dans une note en plein écran : Échap ne ferme pas le parent et ne quitte pas le plein écran — tâches 2 et 5.
3. Requête coupée par une mark ou un atome : aucun faux début de bloc ; hardBreak reconnu seulement si autorisé — tâche 1.
4. Réponse lente après fermeture ou destruction : ni réouverture ni commande ; éditeurs indépendants — tâche 3.
5. Validation suivie d’une frappe : une annulation ne supprime que la frappe, la suivante restaure exactement la requête — tâche 3.

État au 25 novembre 2026 : préalable et tâches 1–4 terminés ; C1/C2 et D1–D3 corrigés.
La validation et la documentation de livraison (tâche 5) sont préparées : 1 574 tests unitaires,
174 E2E (58 par navigateur, SPIP 4.4.21), build et documentation FR/EN validés.
Surcoût de production du socle exporté : 14 047 octets avec `gzip -n -6` (+13,72 Kio).
La relecture finale de Claude est approuvée : aucun nouveau défaut. La publication et la
fusion du socle sont autorisées ; les emojis ne sont pas commencés.
Le complément E2E SPIP 5 est empêché par une migration de base requise sur le site jetable,
avant tout formulaire d’édition ; cette recette n’est pas validée. Les preuves et les
anciens rapports intermédiaires sont archivés localement dans l’espace de travail du plan.

## Livraison et préparation

Les documents sont préparés sur `docs/suggestions-emojis`, dans `/src/tiptap-spip-suggestions-emojis`, à partir d’`origin/main` (`0da5edc` lors de la préparation). La branche locale `main` était plus ancienne ; ne pas repartir de `spec-faq-4.1.0` ni de son historique propre. **L’implémentation et les E2E se feront dans `/src/tiptap-spip`**, sur `feat/suggestions`, issue du commit de préparation des documents. Les sites jetables pointent déjà vers ce checkout : ne pas rediriger leurs liens vers le worktree documentaire.

La première demande de fusion livre ce socle, ses documents et une entrée CHANGELOG pour la nouvelle API. Les références à l’emoji restent annoncées comme futures. La deuxième demande de fusion, décrite dans le [plan emoji](2026-11-25-emojis.md), partira du `main` contenant le socle fusionné. Ne publier aucune demande de fusion automatiquement pendant la préparation des plans.

Ne transférer ni `.gitignore`, ni `.graphifyignore`, ni `graphify-out/`. Les données Graphify restent dans le checkout initial. Stager explicitement les fichiers de chaque tâche ; ne pas employer `git add .`.

Les chemins ci-dessous partent de la racine du dépôt. Les commandes `npm` se lancent dans `prive/javascript/tiptap_spip/`. Les messages de commit suivent l’usage du dépôt : impératif français accentué (« Ajouter… », « Corriger… »), sans préfixe conventionnel ni trailer.

### Préalable obligatoire : checkout et preuve du code servi

- [x] Vérifier que les sept documents ont été committés sur `docs/suggestions-emojis` avec `Ajouter les spécifications et les plans des suggestions et emojis` ; le faire si nécessaire. N’inclure aucun fichier Graphify ni `.gitignore`.
- [x] Avant de déplacer le travail, vérifier qu’aucune passe E2E n’est active, que le worktree documentaire est propre et que `/src/tiptap-spip` ne contient que les changements locaux déjà identifiés. Conserver `.gitignore` et les fichiers Graphify tels quels. Retirer le worktree documentaire propre avec `git worktree remove /src/tiptap-spip-suggestions-emojis`, sans `--force`, puis créer `feat/suggestions` dans `/src/tiptap-spip` depuis `docs/suggestions-emojis`. Si la branche existe déjà, l’inspecter et la reprendre plutôt que l’écraser. Ne pas changer de branche pendant une passe.
- [x] Contrôler les liens avec `readlink -f` sur `plugins/tiptap_spip` et `plugins/tts_test` des sites `/src/jetables/v4.2.16`, `/src/jetables/v4.4.21`, `/src/jetables/v4.4.31` et `/src/jetables/v5.0-dev` : ils doivent viser `/src/tiptap-spip` et son `tests/e2e/plugin/tts_test`. Préserver les quatre sites et leurs bases ; ne supprimer ni réinitialiser aucun site.
- [x] Après le changement de branche et avant la première navigation, vider **seulement le contenu** des répertoires `tmp/cache/skel` et `tmp/cache/calcul` de ces quatre sites. Ne pas suivre un lien de cache vers un autre chemin ni effacer `tmp/` globalement. Après tout autre changement de branche hors passe, refaire ce nettoyage.
- [x] Dans le checkout d’implémentation : `npm ci`, `npm test`, `npm run build`. Noter les tailles gzip des ressources JS/CSS servies, le commit de référence, Node/npm et le lockfile. Pas de baseline comparant deux versions d’esbuild.
- [x] Ajouter dans `prive/javascript/tiptap_spip/tests/e2e/site.js` l’aide `verifierBundleServi(page) => Promise<void>`, qui commence à observer la réponse du bundle dès son appel, lit **la même variante** locale (`tiptap_spip.min.js` ou `tiptap_spip.js`) et compare les octets. Dans `tests/e2e/suggestions.e2e.js`, créer cette promesse avant `editer`, puis l’attendre après la navigation. Faire échouer la passe sur absence de réponse, mauvais chemin ou différence, avant d’interpréter le focus ou les suggestions. Pas d’interception remplaçant le bundle par le bon fichier : cela masquerait P1. Relancer ce contrôle après chaque build et sur chaque site utilisé, sans branche, fusion, build ni modification d’un fichier servi pendant la passe.

Ce préalable est à exécuter avant la tâche 1 ; la correction des plans seule ne vaut ni bascule de checkout ni validation E2E.

## Répartition des fichiers

| Fichiers | Responsabilité |
|----------|----------------|
| `src/suggestions/filtre.js`, `match.js` | Filtrage pur et recherche du déclencheur dans le bloc ProseMirror |
| `src/suggestions/sessions.js` | Contextes d’interface et état des couches par éditeur, fermeture et nettoyage |
| `src/suggestions/ListeSuggestions.js` | Liste, option active, clavier et ARIA |
| `src/suggestions/PanneauSuggestions.js` | Enveloppe sans formulaire, sentinelles, sortie et retour du focus |
| `src/suggestions/fabrique.js` | Extension Tiptap, concurrence des recherches, commande et arbitrage des fournisseurs |
| `src/ui/placement.js`, `popover.js`, `interface.js`, `main.js` | Intégration au placement, aux parents et au plein écran existants |

Dans ce tableau, `src/` désigne `prive/javascript/tiptap_spip/src/`. Ne pas déplacer les modules existants pour créer cette arborescence.

### Tâche 1 : Filtre et déclenchement sur le bloc réel

**Files:** Create `prive/javascript/tiptap_spip/src/suggestions/{filtre,match}.js` ; Test `prive/javascript/tiptap_spip/tests/editor/suggestions-match.test.js`.

**Interfaces:** Produire `filtrerSuggestions(items, query) => Item[]` et `trouverSuggestion(config) => SuggestionMatch | null`, ce dernier respectant la signature `findSuggestionMatch` de Tiptap 3.31.4. `Item` et options sont exactement ceux de la spec.

- [x] Écrire les tests purs : `exact_avant_prefixe_avant_inclusion`, `ordre_stable_sans_mutation`, `aucun_synonyme_francais`, `frontiere_mark_sans_espace`, `atome_non_autorise`, `hardBreak_autorise`, `nbsp_refuse`, `motif_g_y_deterministe`. Assertions : `filtrerSuggestions(items, '')` rend toute la liste sans modifier l’entrée ; un mot marqué suivi de `:h` n’est pas un début de bloc ; U+0020 et hardBreak autorisé fonctionnent, U+00A0/U+202F échouent ; deux appels successifs avec `/^[a-z]+$/g` ou `/^[a-z]+$/y` donnent le même résultat.
- [x] Lancer `npm test -- tests/editor/suggestions-match.test.js` ; constater l’échec sur les nouveaux modules absents.
- [x] Implémenter le filtre stable exact/préfixe/inclusion sans distinction de casse, puis le matcher lisant tout le bloc avec correspondance aux positions ProseMirror. Les atomes interrompent la requête sans devenir un début de bloc ; le hardBreak peut représenter `\n`. La requête s’arrête au curseur.
- [x] Relancer la commande ciblée ; exiger tous les cas au vert.
- [x] Committer ces modules et ce test avec `Ajouter le filtrage et le déclenchement des suggestions`.

### Tâche 2 : Couches, placement et enveloppe avec sentinelles

**Files:** Create `prive/javascript/tiptap_spip/src/suggestions/{sessions,PanneauSuggestions}.js` ; Modify `prive/javascript/tiptap_spip/src/ui/{placement,popover,interface,NotePopover,MultiPopover}.js`, `prive/javascript/tiptap_spip/src/main.js`, `css/tiptap_spip.css` ; Test `prive/javascript/tiptap_spip/tests/ui/suggestions-panneau.test.js` et `prive/javascript/tiptap_spip/tests/e2e/suggestions.e2e.js`.

**Interfaces:** Produire les aides internes `lierContexteSuggestions(editor, { wrapper, parent = null }) => disposer`, `contexteSuggestions(editor) => contexte | null`, `suggestionsOuvertes(wrapper) => boolean`, `fermerSuggestions({ parent, wrapper, refocus = false }) => void`. Une seule des deux cibles parent/wrapper est nécessaire pour une fermeture ciblée. Produire `placerDepuisRect(element, lireRect) => void` dans `placement.js` et `ouvrirPanneauSuggestions({ editor, anchor, origin, content, label, onClose }) => { element, corps, fermer }`. `origin` contient le déclencheur et la cible logique de retour ; `content` est un HTMLElement hébergé. `fermer({ reason, refocus })` est idempotent. Dans `creerInterface`, ajouter **dès cette tâche** `openSuggestionsPanel(options)`, qui fournit l’éditeur et le contexte à cette enveloppe. Proposer la même méthode dans `sousUi` et l’exposer par `popover.sousUi`, à côté de `popover.sous` déjà présent. Tout ceci reste interne, sans ajout à l’objet `ui` de `api.js`.

Point d’entrée E2E disponible avant toute fixture tierce : appeler `module(page)` de `tests/e2e/site.js`, puis utiliser `[...window.__tts.instances][0].ui.openSuggestionsPanel(options)`. Dans une note, récupérer `const note = instance.ui.editNote(null)` ; `note.sous` cible le sous-éditeur et `note.sousUi.openSuggestionsPanel(options)` son panneau. Pour un multi en ligne, exposer `popover.lignes` ; chaque ligne conserve `l.sous` et sa propre `l.sousUi.openSuggestionsPanel(options)`, sans `popover.sousUi` partagé. Les options de test contiennent un HTMLElement construit dans `page.evaluate`, pas un élément sérialisé entre Node et le navigateur. Aucune importation directe du contrôleur depuis les E2E, aucune API publique de test.

- [x] Écrire les tests `panneau_hors_formulaire`, `repli_entre_sentinelles`, `erreur_tab_reessayer_puis_sortie_avant`, `sortie_arriere`, `autre_popover_sans_ancien_refocus`, `destruction_idempotente`. Construire un contenu factice sans Shadow DOM : cible nommée avec `tabindex="-1"`, état d’erreur et bouton type button entre deux sentinelles. Vérifier le DOM et, en E2E, focus repli → Tab « Réessayer » → Tab contrôle suivant, avec fermeture seulement au dernier passage.
- [x] Lancer `npm test -- tests/ui/suggestions-panneau.test.js` ; constater l’échec initial.
- [x] Extraire le placement par rectangle sans imposer la parenté DOM de `placerMenu`. Conserver les comportements existants de placement des menus et popovers. Créer le conteneur HTML manual sans formulaire ; la cible de repli est un enfant du corps entre les sentinelles, jamais l’enveloppe extérieure située avant elles. `corps` contient aussi l’erreur et « Réessayer ». Sortir vers le voisin logique et respecter le bouclage du formulaire parent, sans parcourir un éventuel Shadow DOM.
- [x] Lier les contextes après création des éditeurs principal/note/multi et les délier à la destruction. Brancher `openSuggestionsPanel` dans les interfaces principale et note et exposer `popover.sousUi` ; démontrer l’ouverture du contenu factice par les points d’entrée E2E ci-dessus avant tout test de focus. Ajouter les notifications de fermeture au début de `Popover.open()` et à la fermeture du parent. En capture, le plein écran s’abstient si `suggestionsOuvertes(wrapper)` ; traiter Échap du panneau en remontée uniquement. Clic extérieur et ouverture d’une autre couche ne restaurent pas l’ancien focus.
- [x] Relancer Vitest ciblé ; puis `npm run build` et `npm run e2e -- tests/e2e/suggestions.e2e.js` sur le site jetable configuré selon [la documentation](../../site/developper/tests.md). Exiger trois projets réellement exécutés, pas sautés. Vérifier note ouverte, plein écran actif, panneau visible pendant le défilement, Tab/Échap sans soumission du parent.
- [x] Committer les fichiers explicitement avec `Ajouter une enveloppe de suggestions avec focus isolé`. Préparer à ce jalon une relecture ciblée Tab/Échap avec les résultats réels ; ne pas annoncer un avis de Claude sans l’avoir reçu.

### Tâche 3 : Fabrique Tiptap, sessions et historique

**Files:** Create `prive/javascript/tiptap_spip/src/suggestions/{fabrique,ListeSuggestions}.js` ; Modify `prive/javascript/tiptap_spip/package.json`, `prive/javascript/tiptap_spip/package-lock.json`, `css/tiptap_spip.css` ; Test `prive/javascript/tiptap_spip/tests/editor/suggestions.test.js` et `prive/javascript/tiptap_spip/tests/ui/suggestions-liste.test.js`.

**Interfaces:** Produire `creerSuggestions(options) => Extension` et l’aide interne `retenirFournisseurs(extensions, { duCoeur }) => Extension[]`, où `duCoeur` est un ensemble des instances provenant du cœur avant composition. La liste interne reçoit des résultats déjà classés, un état et un callback de validation ; elle ne refiltre rien. Les sessions consomment le contexte de la tâche 2. L’extension porte une métadonnée interne permettant d’identifier ses fournisseurs sans modifier les extensions ordinaires.

Décision d’exécution : le branchement interne de `retenirFournisseurs` dans `src/editor/extensions.js` est fait dès cette tâche pour éprouver les conflits dans les vrais éditeurs parent/note/multi. Les exports publics et la fixture restent dans la tâche 4. `allowSpaces` reçoit une adaptation ciblée de `shouldResetDismissed` pour respecter la réouverture après espace ; la vue native est enveloppée pour fermer aussi après `setEditable`, qui ne produit pas de transaction.

- [x] Ajouter les tests `priorite_10000`, `seuil_empeche_ouverture_et_recherche`, `entree_sans_option`, `fleches_sans_resultat`, `requete_reinitialise_actif`, `commande_false_sans_mutation`, `reponses_inversees`, `erreur_distincte_vide`, `deux_editeurs_isoles`, `reponse_apres_destroy`, `echap_rejete_jusqua_espace`, `undo_validation_et_frappe`, `conflit_averti_une_fois_notes_multis`. Pour l’historique : taper `@bo`, choisir un item, taper `x`, annuler → insertion sans `x`, annuler → `@bo` exact. Ouvrir/rechercher/annuler garde doc et profondeur d’annulation inchangés. Pour le conflit : monter le parent puis ouvrir plusieurs notes et parties de multi avec le même conflit ; un seul avertissement, arbitrage appliqué à chaque éditeur ; des barres disjointes ne produisent aucun avertissement.
- [x] Lancer `npm test -- tests/editor/suggestions.test.js tests/ui/suggestions-liste.test.js` ; constater l’échec initial.
- [x] Ajouter `@tiptap/suggestion` **3.31.4** et une version exacte compatible de `@floating-ui/dom` au manifeste/lockfile. Utiliser le matcher de la tâche 1, `PluginKey` propre, priorité **10000**, `allow`/`shouldShow` pour l’ouverture et le seuil natif pour la recherche ; ne pas appeler `mount()`.
- [x] Implémenter les hooks et la liste. Aucun item actif initialement ; Haut active le dernier, Bas le premier, Entrée ne consomme que le choix actif. En état vide/chargement/erreur, Haut/Bas restent libres. Gérer Tab, blur/clic extérieur, IME, mode source/lecture seule/contenu exclu et nettoyage. Annonces/ARIA sans prendre le focus inline ; rendre les chaînes par `textContent`.
- [x] Intercepter les rejets du fournisseur avant leur rabattement natif en liste vide. Utiliser le signal et la protection native contre l’obsolescence ; revalider plage/contexte/éditeur avant commande. Adapter `props` en `item`, interpréter le booléen, et poser `closeHistory` avant puis après la commande réussie. Le refus garde le menu utilisable et le document intact.
- [x] Implémenter l’arbitrage des caractères sur la liste finale des extensions : cœur présent d’abord, sinon premier enregistré ; `console.warn` nommant retenu/ignoré ; aucune exception de montage. Dédupliquer uniquement le diagnostic, une fois par triplet `(char, nomRetenu, nomIgnore)` au cours de la page ; ne pas réavertir lors des appels à `coreExtensions` des notes/multis. Garder l’arbitrage et les sessions propres à chaque éditeur, sans réservation globale d’un caractère. Prévoir une remise à zéro interne des diagnostics pour les tests. Ne pas modifier le remplacement par nom des extensions ordinaires.
- [x] Relancer les deux fichiers Vitest ; exiger tous les cas au vert, puis committer avec `Adapter les fournisseurs de suggestions à Tiptap`. Préparer la relecture ciblée de l’historique à ce jalon.

### Tâche 4 : API publique et preuve par un fournisseur tiers

**Files:** Modify `prive/javascript/tiptap_spip/src/{api,editor/extensions}.js` ; Test `prive/javascript/tiptap_spip/tests/editor/api.test.js`, `prive/javascript/tiptap_spip/tests/editor/suggestions.test.js` ; Modify `tests/e2e/plugin/tts_test/{paquet.xml,tts_test_pipelines.php}`, `prive/javascript/tiptap_spip/tests/e2e/{site,suggestions.e2e}.js` ; Create `tests/e2e/plugin/tts_test/javascript/suggestions.js` pour le fournisseur de fixture chargé par le pipeline `tiptap_spip_extensions`.

**Interfaces:** `ui` exporte les deux fonctions des tâches 1 et 3 ; `coreExtensions` applique `retenirFournisseurs` après `avecTierces`, avec les instances du cœur. `noteExtensions`/`partieExtensions` conservent ce mécanisme et les fournisseurs retenus, sans état partagé.

- [x] Écrire les tests du fournisseur `@` de la spec via `registerExtension`, les exports module/global identiques, deux caractères distincts, doublon non fatal avec préférence au cœur, premier tiers retenu sans cœur, barres disjointes sans avertissement, et héritage note/multi. Le fournisseur factice reste dans le plugin de test, jamais dans le cœur livré.
- [x] Lancer `npm test -- tests/editor/api.test.js tests/editor/suggestions.test.js` et constater les nouveaux échecs.
- [x] Exporter la fabrique et le filtre, brancher l’arbitrage final et la fixture tierce. Déclarer explicitement le pipeline `tiptap_spip_extensions` dans `tts_test/paquet.xml` ; il n’y figure pas encore. Le fournisseur `@` n’est chargé que pour une page demandant `tts_suggestions=oui` : ajouter à `editer` une option de test `suggestions: false` par défaut et transmettre ce paramètre seulement si elle vaut `true` ; le pipeline de `tts_test` vérifie cette condition avant de renvoyer le script. Ajouter un test sans option qui vérifie l’absence du script et du fournisseur, même quand `tts_test` est actif. Ne pas exposer Suggestion, la classe de liste ou le panneau. Le cœur de cette livraison ne fournit encore aucun déclencheur emoji.
- [x] Relancer Vitest ciblé et les E2E suggestions après build. Ajouter/assertionner Entrée sur option active dans liste, tableau et titre ; sans option active, comportement natif ; texte HTML de fournisseur affiché littéralement ; contrôle axe sans nouvelle violation.
- [x] Committer avec `Exposer les suggestions aux extensions tierces`.

### Tâche 5 : Vérification et livraison du socle

**Files:** Modify `docs/specs/{06-interface,07-extensibilite,08-tests-recette,09-lots-roadmap}.md`, `CHANGELOG.md` ; Create `docs/site/developper/suggestions.md`, `docs/site/developper/suggestions.en.md` ; régénérer les bundles et `prive/javascript/tiptap_spip.LICENSES.txt` avec le build existant. Prévoir les liens de navigation depuis `docs/site/developper/documentation{,.en}.md`.

**Interfaces:** La première demande de fusion constitue le prérequis publié du plan emoji ; API, enveloppe interne et baseline de poids disponibles.

- [x] Exécuter `npm test`, `npm run build`, puis `npm run e2e -- tests/e2e/suggestions.e2e.js tests/e2e/menus.e2e.js tests/e2e/interface.e2e.js tests/e2e/barre.e2e.js`. Sur le site jetable, confirmer Chromium/Firefox/WebKit exécutés et conserver les résultats Tab/Échap, historique et axe. Ne pas annoncer des tests sautés comme réussis.
- [x] Mesurer avec `gzip -n -6 -c` le minifié servi et le CSS, comparer à la baseline avant socle ; noter le delta socle qui sera inclus dans les **40 Kio** finaux. Ne compter le gros bundle de développement comme une seconde ressource de production que si une page le charge réellement.
- [x] Documenter l’exemple public, limites et arbitrage de caractères sur les nouvelles pages suggestions français/anglais, avec liens depuis les pages de documentation développeur ; ne pas détourner le tutoriel FAQ. Mettre à jour l’état du socle seulement, laisser emojis à implémenter. Ajouter une entrée CHANGELOG pour l’API visible des intégrateurs ; régénérer les licences avec `npm run build`.
- [x] Retirer les deux rapports intermédiaires `docs/superpowers/reviews/2026-11-25-suggestions-taches-1-2.md` et `docs/superpowers/reviews/2026-11-25-suggestions-tache-3.md`, ainsi que les liens vers eux dans le présent plan. Conserver les preuves locales et résumer les résultats définitifs dans la demande de fusion, sans publier des mesures d’états intermédiaires comme état final.
- [x] Vérifier `git diff --check`, les chemins documentaires et la liste des fichiers ; commit `Documenter et valider le socle de suggestions`. Préparer la demande de fusion **socle → main** avec les vérifications réellement exécutées.
- [x] Faire relire en priorité la sortie Tab/Échap et l’isolation de l’historique avant fusion. Après fusion du socle, commencer le deuxième plan depuis le `main` actualisé.

## Contrôle de couverture avant exécution

API, filtrage, matcher et options : tâches 1/3/4. Contextes et couches : tâche 2. Sessions, refus et asynchronisme : tâche 3. Héritage et doublons par barre : tâche 4. Propagation des touches dans les blocs, axe et non-régression : tâches 4/5. Le vrai picker, son catalogue, les teintes et les boutons appartiennent exclusivement au deuxième plan ; leur prototype est son premier jalon.
