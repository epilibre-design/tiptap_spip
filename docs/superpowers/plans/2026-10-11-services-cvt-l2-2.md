# Formulaire CVT de services (lot L2.2) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** les services serveur de l'éditeur — prévisualisation d'un modèle, titre d'un lien, recherche d'objets — passent par un formulaire CVT signé, rendu après chaque formulaire d'édition et appelé en AJAX par `src/services/cvt.js` ; sans droit, sans session ou en cas de falsification, l'éditeur reste en mode dégradé.

**Architecture :** `#FORMULAIRE_TIPTAP_SPIP{objet, id_objet, champ}` (`charger` / `verifier` / `traiter`, autorisation dans `charger` et `verifier`) ; le pipeline `formulaire_fond` l'ajoute après le `</form>` de chaque `editer_*`, dans un conteneur `.tts-services` relié au formulaire d'édition par un identifiant d'instance aléatoire ; le résultat revient en JSON dans `message_ok`, les erreurs de `verifier()` dans un bloc `tts-erreurs`. Côté JS, `Services` trouve le conteneur de son textarea, sérialise les appels et remplace le formulaire par celui de la réponse.

**Tech Stack :** inchangée ; PHPUnit pour les fonctions pures et le pipeline, Playwright sur le site jetable pour les opérations réelles et la sécurité, Vitest + jsdom sur des réponses réelles enregistrées.

**Spec de référence :** `docs/specs/02-architecture.md` §5 ; skill `spip-formulaires` (contrat CVT).

## Global Constraints

- Mêmes contraintes que les lots précédents (commentaires en français, tabulations, commits sans trailer, site jetable uniquement, serveur `php -d opcache.revalidate_freq=0 -S …` sur un port vérifié libre).
- L'opération `glossaire` de la spec 02 §5 relève du lot L3 (notes et glossaire) : hors de ce plan.
- Comportements de SPIP 4.4 vérifiés pendant la préparation (ne pas « corriger ») :
  - pour un formulaire d'objet (`editer_article`…), `formulaire_fond` reçoit `args = ['type' => 'article', 'id' => 1]`, pas les arguments de la balise ;
  - `editer_article` n'équipe que `texte` (seul ce champ est pris par le lancement JS) : un formulaire de services par champ équipé, `texte` par défaut ;
  - réponse AJAX d'un CVT traité : `<br class='bugajaxie ajax-form-is-ok' …>` puis le formulaire recalculé (nouvelle signature) ; SPIP enveloppe chaque erreur de `verifier()` dans `<span role='alert'>` : le JS en retire les balises ;
  - arguments signés ou signature de session falsifiés : SPIP ne traite pas le formulaire et renvoie la page complète, sans `ajax-form-is-ok` ; sans session : un script de redirection vers la page de connexion ;
  - `<doc>`, `<img>`, `<emb>` n'ont pas de squelette `modeles/doc.html` : `styliser_modele()` les résout selon le document. Un modèle « existe » s'il est déclaré par un objet (`modeles` de `lister_tables_objets_sql()`) ou si `trouve_modele()` le trouve.

## Structure des fichiers

| Fichier | Responsabilité |
|---------|----------------|
| `tiptap_spip_fonctions.php` | JSON sûr, reconnaissance d'un modèle, listes JSON, traitements de prévisualisation |
| `formulaires/tiptap_spip.php`, `.html` | formulaire CVT de services : autorisation, opérations |
| `inclure/tiptap_spip_services.html` | conteneur `.tts-services` d'un champ |
| `tiptap_spip_pipelines.php` | + `formulaire_fond`, autorisation `tiptapspipmodele_previsualiser` |
| `paquet.xml`, `lang/tiptap_spip_fr.php` | pipelines déclarés, messages d'erreur |
| `prive/javascript/tiptap_spip/src/services/cvt.js` | client : `Services`, `parseResponse`, erreurs |
| `prive/javascript/tiptap_spip/src/main.js` | `instance.services` |
| `tests/unit/FonctionsTest.php`, `FormulaireFondTest.php` | PHPUnit |
| `prive/javascript/tiptap_spip/tests/services/cvt.test.js`, `tests/fixtures/cvt/*.html` | client sur réponses réelles |
| `tests/e2e/site.php`, `prive/javascript/tiptap_spip/tests/e2e/site.js`, `services.e2e.js`, `fixtures-cvt.e2e.js` | bout en bout |

---

### Task 1 : Fonctions utilitaires

**Files:**
- Create: `tiptap_spip_fonctions.php`
- Test: `tests/unit/FonctionsTest.php`

**Interfaces:**
- Produces : `tiptap_spip_json($valeur): string` (vide si valeur vide), `tiptap_spip_operations()`, `tiptap_spip_objets_recherche()`, `tiptap_spip_est_modele(string): bool`, `tiptap_spip_nom_modele(string): string`, `tiptap_spip_modele_existe(string): bool`, `tiptap_spip_liste(?string $json, int $max, int $longueur): ?array`, `tiptap_spip_traitements_previsu(string $texte, string $nom_champ, string $type_objet, array $contexte): string`.

- [ ] **Step 1 : test qui échoue**

`tests/unit/FonctionsTest.php` :

```php
<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once dirname(__DIR__, 2) . '/tiptap_spip_fonctions.php';

final class FonctionsTest extends TestCase
{
	public function testJsonSansCaractereHtmlLitteral(): void {
		$json = tiptap_spip_json(['html' => "<p class='a'>x & \"y\"</p></script>"]);

		$this->assertDoesNotMatchRegularExpression('/[<>&\'"]\w|<\/script/', str_replace(['{"html":"', '"}'], '', $json));
		$this->assertSame(['html' => "<p class='a'>x & \"y\"</p></script>"], json_decode($json, true));
		$this->assertSame('', tiptap_spip_json([]));
		$this->assertSame('', tiptap_spip_json(''));
	}

	public function testUnSeulModeleAvecIdOuParametres(): void {
		foreach (['<doc12>', '<doc12|center>', '<img3 | left />', '<emb5|legende=<i>x</i>>', '<monmodele|a=b>'] as $modele) {
			$this->assertTrue(tiptap_spip_est_modele($modele), $modele);
		}
		foreach (['<span>', '<doc>', '<doc1> <doc2>', 'texte <doc1>', '<doc1>x', '<a href="x">', ''] as $modele) {
			$this->assertFalse(tiptap_spip_est_modele($modele), $modele);
		}
		$this->assertSame('doc', tiptap_spip_nom_modele('<DOC12|center>'));
	}

	public function testListeJsonDeChaines(): void {
		$this->assertSame(['art1', 'rub2'], tiptap_spip_liste('["art1","rub2"]', 50, 500));
		$this->assertNull(tiptap_spip_liste('[]', 50, 500));
		$this->assertNull(tiptap_spip_liste('{"a":"b"}', 50, 500));
		$this->assertNull(tiptap_spip_liste('["a", 3]', 50, 500));
		$this->assertNull(tiptap_spip_liste('[""]', 50, 500));
		$this->assertNull(tiptap_spip_liste('["a","b","c"]', 2, 500));
		$this->assertNull(tiptap_spip_liste('["abcdef"]', 50, 5));
		$this->assertNull(tiptap_spip_liste('pas du json', 50, 500));
		$this->assertNull(tiptap_spip_liste(null, 50, 500));
	}
}
```

Run : `vendor/bin/phpunit` → erreur, `tiptap_spip_fonctions.php` introuvable.

- [ ] **Step 2 : implémenter**

`tiptap_spip_fonctions.php` :

```php
<?php

/**
 * Fonctions du plugin Éditeur visuel pour SPIP.
 */

if (!defined('_ECRIRE_INC_VERSION')) {
	return;
}

/** Options d'encodage JSON : aucun < > & ' " littéral, donc ni </script> ni balise dans un bloc JSON. */
const TIPTAP_SPIP_JSON = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE;

/**
 * Filtre : encode une valeur en JSON insérable dans un <script type="application/json">.
 * Valeur vide → chaîne vide (le bloc n'est alors pas affiché).
 *
 * @param mixed $valeur
 */
function tiptap_spip_json($valeur): string {
	return empty($valeur) ? '' : (string) json_encode($valeur, TIPTAP_SPIP_JSON);
}

/** Opérations du formulaire de services. */
function tiptap_spip_operations(): array {
	return ['previsu_modele', 'titre_lien', 'rechercher'];
}

/** Objets proposés par la recherche (filtrés ensuite par les tables présentes). */
function tiptap_spip_objets_recherche(): array {
	return ['article', 'rubrique', 'breve', 'document', 'auteur', 'mot', 'site'];
}

/**
 * Vrai si $modele est exactement un raccourci de modèle (regex du core, ancrée), avec id ou
 * paramètres (sinon c'est une balise HTML).
 */
function tiptap_spip_est_modele(string $modele): bool {
	return (bool) preg_match('/^<([a-z_-]{3,})\s*([0-9]*)\s*([|](?:<[^<>]*>|[^>])*?)?\s*\/?>$/i', $modele, $m)
		&& ($m[2] !== '' || ($m[3] ?? '') !== '');
}

/** Nom du modèle d'un raccourci valide (tiptap_spip_est_modele()). */
function tiptap_spip_nom_modele(string $modele): string {
	preg_match('/^<([a-z_-]{3,})/i', $modele, $m);
	return strtolower($m[1]);
}

/**
 * Vrai si un modèle de ce nom peut être calculé : modèle d'un objet (doc, img, emb des documents,
 * stylisés par styliser_modele()) ou squelette modeles/<nom>.html.
 */
function tiptap_spip_modele_existe(string $nom): bool {
	include_spip('base/objets');
	foreach (lister_tables_objets_sql() as $desc) {
		if (in_array($nom, $desc['modeles'] ?? [], true)) {
			return true;
		}
	}
	return (bool) trouve_modele($nom);
}

/**
 * Liste JSON de chaînes, de 1 à $max éléments d'au plus $longueur caractères chacun ; null sinon.
 *
 * @return string[]|null
 */
function tiptap_spip_liste(?string $json, int $max, int $longueur): ?array {
	$liste = json_decode((string) $json, true);
	if (!is_array($liste) || !array_is_list($liste) || !$liste || count($liste) > $max) {
		return null;
	}
	foreach ($liste as $valeur) {
		if (!is_string($valeur) || $valeur === '' || mb_strlen($valeur) > $longueur) {
			return null;
		}
	}
	return $liste;
}

/**
 * Applique à un texte les traitements SPIP d'un champ, puis safehtml().
 * Reprise de traitements_previsu() du porte-plume (et de markdown_editor), qui peut être absent, avec un
 * contexte de modèle limité à l'objet édité : $contexte vient des arguments signés du formulaire.
 *
 * @param array $contexte  ['objet' => …, 'id_objet' => …] et id_<objet>
 */
function tiptap_spip_traitements_previsu(string $texte, string $nom_champ, string $type_objet, array $contexte = []): string {
	include_spip('public/interfaces');
	include_spip('inc/texte');

	global $table_des_traitements;
	$Pile = [0 => $contexte];
	$ps = $table_des_traitements[$nom_champ] ?? null;
	if (is_array($ps)) {
		include_spip('base/abstract_sql');
		$table = table_objet($type_objet);
		$ps = $ps[(strlen($table) && isset($ps[$table])) ? $table : 0] ?? null;
	}
	if (!$ps) {
		$texte = propre($texte, null, $contexte);
	} else {
		eval('$texte=' . str_replace('%s', '$texte', $ps) . ';');
	}

	// PHP issu des modèles : pas d'eval final ici, contrairement aux pages SPIP
	if (defined('_PROTEGE_PHP_MODELES') && autoriser('previsualiser', 'modelesphp')) {
		$texte = echappe_retour($texte, 'php' . _PROTEGE_PHP_MODELES, 'tiptap_spip_eval_php_modeles');
	}

	// toujours sécuriser : le contenu ne vient pas forcément de l'auteur connecté
	return safehtml($texte);
}

/** Évalue le PHP d'un modèle prévisualisé (cf. tiptap_spip_traitements_previsu()). */
function tiptap_spip_eval_php_modeles($php) {
	ob_start();
	try {
		eval('?>' . $php);
		$texte = ob_get_contents();
	} catch (\Throwable $e) {
		$texte = '<!-- Erreur -->';
	}
	ob_end_clean();
	return $texte;
}
```

- [ ] **Step 3 : vérifier et commiter**

Run : `vendor/bin/phpunit` → `OK (8 tests, …)`.

```bash
git add tiptap_spip_fonctions.php tests/unit/FonctionsTest.php
git commit -m "feat: fonctions du formulaire de services (JSON sûr, modèles, listes)"
```

---

### Task 2 : Formulaire CVT et intégration après les formulaires d'édition

**Files:**
- Create: `formulaires/tiptap_spip.php`, `formulaires/tiptap_spip.html`, `inclure/tiptap_spip_services.html`
- Modify: `tiptap_spip_pipelines.php`, `paquet.xml`, `lang/tiptap_spip_fr.php`, `tests/bootstrap.php` (`recuperer_fond` simulé accepte une fonction du contexte)
- Test: `tests/unit/FormulaireFondTest.php` (les opérations sont testées sur un vrai SPIP, Task 4)

**Interfaces:**
- Consumes : Task 1.
- Produces : balise `#FORMULAIRE_TIPTAP_SPIP{objet, id_objet, champ}` ; opérations `previsu_modele {modele}` → HTML ; `titre_lien {cibles: JSON}` → `[{cible, titre, url, objet, id}]` ; `rechercher {q, objets: JSON}` → `[{objet, id, titre, raccourci}]` (20 au plus, plus récents d'abord) ; DOM : `<form data-tts-instance="tts-xxxxxxxxxxxx">` et, après lui, `<div class="tts-services" hidden data-tts-instance data-tts-objet data-tts-id data-tts-champ>`.

- [ ] **Step 1 : test qui échoue**

`tests/unit/FormulaireFondTest.php` :

```php
<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once dirname(__DIR__, 2) . '/tiptap_spip_pipelines.php';

final class FormulaireFondTest extends TestCase
{
	protected function setUp(): void {
		test_reset_globals();
		$GLOBALS['_test_fonds']['inclure/tiptap_spip_services'] = static fn (array $c) => sprintf(
			'<div class="tts-services" hidden data-tts-instance="" data-tts-objet="%s" data-tts-id="%d" data-tts-champ="%s"><form></form></div>',
			$c['objet'],
			$c['id_objet'],
			$c['champ']
		);
	}

	private static function flux(string $form, array $args): array {
		return ['args' => ['form' => $form, 'args' => $args], 'data' => '<div><form action="x"><textarea name="texte"></textarea></form></div>'];
	}

	public function testServicesApresLeFormulaireAvecLeMemeIdentifiantDInstance(): void {
		$data = tiptap_spip_formulaire_fond(self::flux('editer_article', ['type' => 'article', 'id' => 12]))['data'];

		$this->assertMatchesRegularExpression('/^<div><form data-tts-instance="(tts-[0-9a-f]{12})" action="x">/', $data);
		preg_match('/data-tts-instance="(tts-[0-9a-f]{12})"/', $data, $m);
		$apres = substr($data, strpos($data, '</form></div>') + strlen('</form></div>'));
		$this->assertStringStartsWith('<div class="tts-services" hidden data-tts-instance="' . $m[1] . '" data-tts-objet="article" data-tts-id="12" data-tts-champ="texte">', $apres);
	}

	public function testIdentifiantDifferentAChaqueCalcul(): void {
		$a = tiptap_spip_formulaire_fond(self::flux('editer_article', ['type' => 'article', 'id' => 12]))['data'];
		$b = tiptap_spip_formulaire_fond(self::flux('editer_article', ['type' => 'article', 'id' => 12]))['data'];

		preg_match('/tts-[0-9a-f]{12}/', $a, $ma);
		preg_match('/tts-[0-9a-f]{12}/', $b, $mb);
		$this->assertNotSame($ma[0], $mb[0]);
	}

	public function testNouvelObjetIdZero(): void {
		$data = tiptap_spip_formulaire_fond(self::flux('editer_article', ['type' => 'article', 'id' => 'oui']))['data'];

		$this->assertStringContainsString('data-tts-id="0"', $data);
	}

	public function testAutresFormulairesInchanges(): void {
		$flux = self::flux('forum', ['article', 3]);

		$this->assertSame($flux, tiptap_spip_formulaire_fond($flux));
	}

	public function testSansServicesRendusRienNeChange(): void {
		$GLOBALS['_test_fonds']['inclure/tiptap_spip_services'] = '  ';
		$flux = self::flux('editer_article', ['type' => 'article', 'id' => 12]);

		$this->assertSame($flux, tiptap_spip_formulaire_fond($flux));
	}
}
```

Dans `tests/bootstrap.php`, remplacer la simulation de `recuperer_fond` par :

```php
if (!function_exists('recuperer_fond')) {
	/** Simulation : chaîne fixe, ou fonction du contexte. */
	function recuperer_fond(string $fond, array $contexte = [], array $options = []): string {
		$rendu = $GLOBALS['_test_fonds'][$fond] ?? '';
		return is_callable($rendu) ? $rendu($contexte) : $rendu;
	}
}
```

Run : `vendor/bin/phpunit` → erreurs, `tiptap_spip_formulaire_fond()` non définie.

- [ ] **Step 2 : implémenter**

`formulaires/tiptap_spip.php` :

```php
<?php

/**
 * Formulaire CVT de services de l'éditeur (spec 02 §5) : #FORMULAIRE_TIPTAP_SPIP{objet, id_objet, champ}.
 *
 * Les arguments sont signés par SPIP au calcul (formulaire_action_args) et le POST est lié à la
 * session (formulaire_action_sign) : le JS ne peut viser ni un autre objet ni un autre champ.
 * L'éditeur poste en AJAX une opération et ses paramètres ; le résultat revient en JSON dans
 * message_ok, les erreurs de verifier() dans erreurs (cf. formulaires/tiptap_spip.html).
 */

if (!defined('_ECRIRE_INC_VERSION')) {
	return;
}

include_spip('tiptap_spip_fonctions');

/**
 * Vrai si l'auteur connecté peut utiliser les services pour ce champ.
 * Avec objet : droit de modifier l'objet (de le créer s'il est nouveau) et champ texte de sa table.
 * Sans objet (réglages…) : droit de prévisualiser les modèles.
 */
function tiptap_spip_autoriser_services(string $objet, $id_objet, string $champ): bool {
	if ($objet === '') {
		return autoriser('previsualiser', 'tiptapspipmodele');
	}
	include_spip('base/objets');
	$trouver_table = charger_fonction('trouver_table', 'base');
	$desc = $trouver_table(table_objet_sql($objet));
	if (!$desc || !preg_match('/text/i', (string) ($desc['field'][$champ] ?? ''))) {
		return false;
	}
	return intval($id_objet) > 0
		? autoriser('modifier', $objet, intval($id_objet))
		: autoriser('creer', $objet);
}

function formulaires_tiptap_spip_charger_dist($objet = '', $id_objet = 0, $champ = 'texte') {
	if (!tiptap_spip_autoriser_services((string) $objet, $id_objet, (string) $champ)) {
		return false;
	}
	return [
		'operation' => '',
		'modele' => '',
		'cibles' => '',
		'q' => '',
		'objets' => '',
		'editable' => true,
	];
}

function formulaires_tiptap_spip_verifier_dist($objet = '', $id_objet = 0, $champ = 'texte') {
	// verifier() passe avant charger() au POST : l'autorisation est refaite ici
	if (!tiptap_spip_autoriser_services((string) $objet, $id_objet, (string) $champ)) {
		return ['message_erreur' => _T('tiptap_spip:erreur_autorisation')];
	}
	$erreurs = [];
	switch (_request('operation')) {
		case 'previsu_modele':
			$modele = (string) _request('modele');
			if (mb_strlen($modele) > 2000 || !tiptap_spip_est_modele($modele)) {
				$erreurs['modele'] = _T('tiptap_spip:erreur_modele');
			} elseif (!tiptap_spip_modele_existe(tiptap_spip_nom_modele($modele))) {
				$erreurs['modele'] = _T('tiptap_spip:erreur_modele_inconnu');
			}
			break;
		case 'titre_lien':
			if (tiptap_spip_liste(_request('cibles'), 50, 500) === null) {
				$erreurs['cibles'] = _T('tiptap_spip:erreur_cibles');
			}
			break;
		case 'rechercher':
			$q = trim((string) _request('q'));
			if (mb_strlen($q) < 2 || mb_strlen($q) > 100) {
				$erreurs['q'] = _T('tiptap_spip:erreur_recherche');
			}
			$objets = tiptap_spip_liste(_request('objets'), 10, 30);
			if ($objets === null || array_diff($objets, tiptap_spip_objets_recherche())) {
				$erreurs['objets'] = _T('tiptap_spip:erreur_objets');
			}
			break;
		default:
			$erreurs['operation'] = _T('tiptap_spip:erreur_operation');
	}
	return $erreurs;
}

function formulaires_tiptap_spip_traiter_dist($objet = '', $id_objet = 0, $champ = 'texte') {
	$operation = _request('operation');
	$resultat = match ($operation) {
		'previsu_modele' => tiptap_spip_previsu_modele((string) $objet, intval($id_objet), (string) $champ, (string) _request('modele')),
		'titre_lien' => array_map('tiptap_spip_titre_lien', tiptap_spip_liste(_request('cibles'), 50, 500)),
		'rechercher' => tiptap_spip_rechercher(trim((string) _request('q')), tiptap_spip_liste(_request('objets'), 10, 30)),
	};
	return [
		'message_ok' => tiptap_spip_json(['operation' => $operation, 'resultat' => $resultat]),
		'editable' => true,
	];
}

/** HTML d'un modèle, calculé avec le contexte de l'objet édité (arguments signés) seulement. */
function tiptap_spip_previsu_modele(string $objet, int $id_objet, string $champ, string $modele): string {
	$contexte = [];
	if ($objet !== '') {
		include_spip('base/objets');
		$contexte = ['objet' => $objet, 'id_objet' => $id_objet, id_table_objet($objet) => $id_objet];
	}
	// pas d'indirection PHP dans les modèles de formulaire
	$GLOBALS['_FORCER_EXECUTER_DIRECTEMENT_BALISE_DYNAMIQUE'] = true;
	$html = tiptap_spip_traitements_previsu($modele, strtoupper($champ), $objet, $contexte);
	unset($GLOBALS['_FORCER_EXECUTER_DIRECTEMENT_BALISE_DYNAMIQUE']);
	return $html;
}

/**
 * Titre et URL qu'aura un lien [->cible]. Pour un objet SPIP, le titre n'est donné que si l'auteur
 * peut voir l'objet.
 *
 * @return array{cible: string, titre: ?string, url: ?string, objet: ?string, id: ?int}
 */
function tiptap_spip_titre_lien(string $cible): array {
	include_spip('inc/lien');
	include_spip('base/objets');
	$r = ['cible' => $cible, 'titre' => null, 'url' => null, 'objet' => null, 'id' => null];
	$match = typer_raccourci($cible);
	if ($match && !empty($match[0])) {
		$objet = objet_type($match[0]);
		$id = intval($match[2] ?? 0);
		$r['objet'] = $objet;
		$r['id'] = $id;
		if ($id && autoriser('voir', $objet, $id)) {
			$titre = traiter_raccourci_titre($id, $objet);
			$r['titre'] = $titre ? supprimer_tags(typo($titre['titre'])) : null;
			$r['url'] = generer_objet_url($id, $objet) ?: null;
		}
		return $r;
	}
	if (str_starts_with($cible, '#')) {
		return $r;
	}
	$lien = calculer_url($cible, '', 'tout', '', false);
	if (is_array($lien) && $lien['url'] !== '') {
		$r['titre'] = supprimer_tags((string) $lien['titre']);
		$r['url'] = (string) $lien['url'];
	}
	return $r;
}

/**
 * Objets dont le titre contient $q, visibles par l'auteur, 20 au plus, les plus récents d'abord.
 *
 * @param string[] $objets
 * @return list<array{objet: string, id: int, titre: string, raccourci: string}>
 */
function tiptap_spip_rechercher(string $q, array $objets): array {
	include_spip('base/objets');
	include_spip('base/abstract_sql');
	$trouver_table = charger_fonction('trouver_table', 'base');
	$trouves = [];
	foreach ($objets as $objet) {
		$table = table_objet_sql($objet);
		$desc = $trouver_table($table);
		if (!$desc) {
			continue;
		}
		// champ titre déclaré par l'objet (« titre, lang », « nom_site AS titre »…) : on garde le premier
		$champ_titre = trim(preg_split('/[\s,]/', (string) ($desc['titre'] ?? 'titre'))[0]);
		if (!isset($desc['field'][$champ_titre])) {
			continue;
		}
		$id_table = id_table_objet($objet);
		$where = [$champ_titre . ' LIKE ' . sql_quote('%' . addcslashes($q, '%_\\') . '%')];
		if (isset($desc['field']['statut'])) {
			$where[] = "statut != 'poubelle'";
		}
		foreach (sql_allfetsel("$id_table AS id, $champ_titre AS titre", $table, $where, '', "$id_table DESC", '0,40') as $ligne) {
			$id = intval($ligne['id']);
			if (autoriser('voir', $objet, $id)) {
				$trouves[] = [
					'objet' => $objet,
					'id' => $id,
					'titre' => supprimer_tags(typo($ligne['titre'])),
					'raccourci' => $objet . $id,
				];
				if (count($trouves) >= 20) {
					return $trouves;
				}
			}
		}
	}
	return $trouves;
}
```
`formulaires/tiptap_spip.html` :

```html
<div class="formulaire_spip formulaire_tiptap_spip">
	[(#ENV{editable}|oui)
	<form method="post" action="#ENV{action}"><div>
		#ACTION_FORMULAIRE
	</div></form>
	]
	[<script type="application/json" class="tts-resultat">(#ENV*{message_ok})</script>]
	[<script type="application/json" class="tts-erreurs">(#ENV*{erreurs}|tiptap_spip_json)</script>]
</div>
```
`inclure/tiptap_spip_services.html` :

```html
[(#REM) Formulaire de services d'un champ, ajouté après le formulaire d'édition (pipeline formulaire_fond)
]<div class="tts-services" hidden data-tts-instance="" data-tts-objet="#ENV{objet}" data-tts-id="#ENV{id_objet}" data-tts-champ="#ENV{champ}">
#FORMULAIRE_TIPTAP_SPIP{#ENV{objet}, #ENV{id_objet}, #ENV{champ}}
</div>
```
`tiptap_spip_pipelines.php` :

```php
<?php

/**
 * Pipelines du plugin Éditeur visuel pour SPIP.
 */

if (!defined('_ECRIRE_INC_VERSION')) {
	return;
}

/**
 * SPIP 4 : charge la configuration, la feuille de style et le bundle de l'éditeur.
 * SPIP 5 passe par l'importmap et les scripts prive/javascript/_inits/.
 */
function tiptap_spip_header_prive($flux) {
	if ((int) substr($GLOBALS['spip_version_branche'] ?? '4', 0, 1) >= 5) {
		return $flux;
	}
	$config = recuperer_fond('prive/javascript/_inits/09_tiptap_spip_config.js');
	$lib = find_in_path('prive/javascript/tiptap_spip.min.js') ?: find_in_path('prive/javascript/tiptap_spip.js');
	if (!$config || !$lib) {
		return $flux;
	}
	if ($css = find_in_path('css/tiptap_spip.css')) {
		$flux .= '<link rel="stylesheet" href="' . timestamp($css) . '" type="text/css" />' . "\n";
	}
	$flux .= "<script>\n" . $config . "\n</script>\n";
	$flux .= "<script type=\"module\">\n"
		. "import { tiptap_spip_init } from '" . protocole_implicite(url_absolue(timestamp($lib))) . "';\n"
		. "tiptap_spip_init();\n"
		. "onAjaxLoad(function () { tiptap_spip_init(this); });\n"
		. "</script>\n";

	return $flux;
}

/**
 * SPIP 5 : déclare le bundle dans l'importmap.
 */
function tiptap_spip_importmap($flux) {
	$flux['data'][] = 'tiptap_spip.js';

	return $flux;
}

/**
 * Champs équipés de l'éditeur pour un objet : un formulaire de services par champ.
 * Le lancement JS équipe le champ texte des formulaires SPIP (spec 02 §6).
 *
 * @return string[]
 */
function tiptap_spip_champs(string $objet): array {
	return ['texte'];
}

/**
 * Ajoute après le </form> d'un formulaire d'édition (editer_<objet>) les formulaires de services de
 * l'éditeur, un par champ équipé, reliés au formulaire d'édition par un identifiant d'instance
 * aléatoire (spec 02 §5 « Intégration ») : deux formulaires d'édition du même objet dans une page
 * gardent chacun leurs services.
 */
function tiptap_spip_formulaire_fond($flux) {
	$form = $flux['args']['form'] ?? '';
	if (!str_starts_with($form, 'editer_') || !str_contains($flux['data'], '<form')) {
		return $flux;
	}
	// formulaires d'objet (editer_objet) : SPIP transmet ['type' => objet, 'id' => id] comme args
	$args = $flux['args']['args'] ?? [];
	$objet = (string) ($args['type'] ?? substr($form, 7));
	$id_objet = intval($args['id'] ?? $args[0] ?? 0);
	$id_objet = $id_objet > 0 ? $id_objet : 0;
	$services = '';
	foreach (tiptap_spip_champs($objet) as $champ) {
		$services .= recuperer_fond('inclure/tiptap_spip_services', [
			'objet' => $objet,
			'id_objet' => $id_objet,
			'champ' => $champ,
		]);
	}
	if (trim($services) === '') {
		return $flux;
	}
	$instance = 'tts-' . bin2hex(random_bytes(6));
	$flux['data'] = preg_replace('/<form\b/i', '<form data-tts-instance="' . $instance . '"', $flux['data'], 1);
	$flux['data'] .= str_replace('data-tts-instance=""', 'data-tts-instance="' . $instance . '"', $services);

	return $flux;
}

/** Déclaration des autorisations. */
function tiptap_spip_autoriser() {
}

/**
 * Prévisualiser un modèle sans objet (réglages…) : accès à l'espace privé, ou administrateur non
 * restreint dans le site public (comme le porte-plume et markdown_editor).
 */
function autoriser_tiptapspipmodele_previsualiser_dist($faire, $type, $id, $qui, $opt) {
	return test_espace_prive()
		? (($qui['statut'] ?? '') === '0minirezo' || ($qui['statut'] ?? '') === '1comite')
		: (($qui['statut'] ?? '') === '0minirezo' && empty($qui['restreint']));
}
```
`paquet.xml` :

```xml
<paquet
	prefix="tiptap_spip"
	categorie="edition"
	version="0.1.0"
	etat="dev"
	compatibilite="[4.2.0;5.*]"
	documentation=""
>
	<nom>Éditeur visuel pour SPIP</nom>
	<!-- Éditeur visuel Tiptap qui lit et écrit les raccourcis SPIP -->

	<credit lien="https://tiptap.dev">Tiptap</credit>
	<licence lien="http://www.gnu.org/licenses/gpl-3.0.html">GPL 3</licence>

	<utilise nom="porte_plume" />

	<pipeline nom="header_prive" inclure="tiptap_spip_pipelines.php" />
	<pipeline nom="importmap" inclure="tiptap_spip_pipelines.php" />
	<pipeline nom="formulaire_fond" inclure="tiptap_spip_pipelines.php" />
	<pipeline nom="autoriser" inclure="tiptap_spip_pipelines.php" />

	<chemin path="" />
	<chemin path="prive" />
</paquet>
```
`lang/tiptap_spip_fr.php` :

```php
<?php

// Ceci est un fichier langue de SPIP -- This is a SPIP language file

return [
	'erreur_autorisation' => 'Vous n’avez pas le droit d’utiliser ces services.',
	'erreur_cibles' => 'Liste de cibles de liens invalide.',
	'erreur_modele' => 'Raccourci de modèle invalide.',
	'erreur_modele_inconnu' => 'Ce modèle n’existe pas.',
	'erreur_objets' => 'Types d’objets invalides.',
	'erreur_operation' => 'Opération inconnue.',
	'erreur_recherche' => 'La recherche doit compter de 2 à 100 caractères.',
	'mode_source' => 'Source',
];
```

- [ ] **Step 3 : vérifier et commiter**

Run : `vendor/bin/phpunit` → `OK (13 tests, 41 assertions)` ; `php -l` sur chaque fichier PHP.

```bash
git add formulaires inclure tiptap_spip_pipelines.php paquet.xml lang/tiptap_spip_fr.php tests/bootstrap.php tests/unit/FormulaireFondTest.php
git commit -m "feat: formulaire CVT de services, ajouté après les formulaires d'édition"
```

---

### Task 3 : Client JS des services

**Files:**
- Create: `prive/javascript/tiptap_spip/src/services/cvt.js`, `prive/javascript/tiptap_spip/tests/fixtures/cvt/{formulaire,titre_lien,erreurs,sans_session}.html`
- Modify: `prive/javascript/tiptap_spip/src/main.js` (`this.services = Services.forTextarea(textarea)`)
- Test: `prive/javascript/tiptap_spip/tests/services/cvt.test.js`, `prive/javascript/tiptap_spip/tests/editor/main.test.js`

**Interfaces:**
- Consumes : DOM de la Task 2.
- Produces : `Services.forTextarea(textarea, { fetch }?) : Services|null`, `services.call(operation, params): Promise<resultat>` (rejet `ServiceError {erreurs}` ou `ServiceUnavailable`), `services.available`, `parseResponse(html)`, `instance.services`.

- [ ] **Step 1 : fixtures (réponses réelles)**

Enregistrées sur le site jetable par `tests/e2e/fixtures-cvt.e2e.js` (Task 4) ; contenu au moment de la préparation :

`prive/javascript/tiptap_spip/tests/fixtures/cvt/formulaire.html` :

```html
<div class="tts-services" hidden="" data-tts-instance="tts-55e973ada713" data-tts-objet="article" data-tts-id="60" data-tts-champ="texte">
<div class="formulaire_spip formulaire_tiptap_spip">
	 
	<form method="post" action="/ecrire/?exec=article_edit&amp;id_article=60" class="verifformok"><div>
		<span class="form-hidden"><input name="exec" value="article_edit" type="hidden"><input name="id_article" value="60" type="hidden"><input name="formulaire_action" type="hidden" value="tiptap_spip"><input name="formulaire_action_args" type="hidden" value="/RCIBoTRXWTL8tHq9+lnYcsa+NZ7c0aC7HUKD0oTrwHv8MRhsSvhNFpN17sKTiLWuhP9XumSxWopumPYmPufhGmfp8UtO6s5EFTsjmBgoDjFjsNUFGG+XTo2BY7a7Sa+7BW3kiwPrw=="><input name="formulaire_action_sign" type="hidden" value="5a29a14e44f8183256fa527d5739c56dff89496e5393018d3e85a10c97321576"></span>
	</div></form>
	
	
	
</div>
</div>
```
`prive/javascript/tiptap_spip/tests/fixtures/cvt/titre_lien.html` :

```html
<br class='bugajaxie ajax-form-is-ok' style='display:none;'><div class="formulaire_spip formulaire_tiptap_spip">
	 
	<form method="post" action="/ecrire/?exec=article_edit&amp;id_article=60"><div>
		<span class="form-hidden"><input name="exec" value="article_edit" type="hidden"
><input name="id_article" value="60" type="hidden"
><input name='formulaire_action' type='hidden'
		value='tiptap_spip'><input name='formulaire_action_args' type='hidden'
		value='/RCIBoTRXWTL8tHq9+lnYcsa+NZ7c0aC7HUKD0oTrwHv8MRhsSvhNFpN17sKTiLWuhP9XumSxWopumPYmPufhGmfp8UtO6s5EFTsjmBgoDjFjsNUFGG+XTo2BY7a7Sa+7BW3kiwPrw=='><input name='formulaire_action_sign' type='hidden'
		value='5a29a14e44f8183256fa527d5739c56dff89496e5393018d3e85a10c97321576'></span>
	</div></form>
	
	<script type="application/json" class="tts-resultat">{"operation":"titre_lien","resultat":[{"cible":"art60","titre":"Test tiptap_spip","url":"http:\/\/127.0.0.1:18931\/ecrire\/?exec=article\u0026amp;id_article=60","objet":"article","id":60},{"cible":"https:\/\/www.spip.net\/fr","titre":"https:\/\/www.spip.net\/fr","url":"https:\/\/www.spip.net\/fr","objet":null,"id":null},{"cible":"art999999","titre":null,"url":"http:\/\/127.0.0.1:18931\/ecrire\/?exec=article\u0026amp;id_article=999999","objet":"article","id":999999}]}</script>
	
</div>
```
`prive/javascript/tiptap_spip/tests/fixtures/cvt/erreurs.html` :

```html
<br class='bugajaxie ajax-form-is-ok' style='display:none;'><div class="formulaire_spip formulaire_tiptap_spip">
	 
	<form method="post" action="/ecrire/?exec=article_edit&amp;id_article=60"><div>
		<span class="form-hidden"><input name="exec" value="article_edit" type="hidden"
><input name="id_article" value="60" type="hidden"
><input name='formulaire_action' type='hidden'
		value='tiptap_spip'><input name='formulaire_action_args' type='hidden'
		value='/RCIBoTRXWTL8tHq9+lnYcsa+NZ7c0aC7HUKD0oTrwHv8MRhsSvhNFpN17sKTiLWuhP9XumSxWopumPYmPufhGmfp8UtO6s5EFTsjmBgoDjFjsNUFGG+XTo2BY7a7Sa+7BW3kiwPrw=='><input name='formulaire_action_sign' type='hidden'
		value='5a29a14e44f8183256fa527d5739c56dff89496e5393018d3e85a10c97321576'></span>
	</div></form>
	
	
	<script type="application/json" class="tts-erreurs">{"modele":"\u003Cspan role=\u0027alert\u0027\u003ECe modèle n’existe pas.\u003C\/span\u003E","message_erreur":"\u003Cspan role=\u0027alert\u0027\u003EYour entry contains an error, please check your information.\u003C\/span\u003E"}</script>
</div>
```
`prive/javascript/tiptap_spip/tests/fixtures/cvt/sans_session.html` :

```html
<script>if (parent.window){parent.window.document.location.replace("../spip.php?page=login&url=%2Fecrire%2F%3Fexec%3Darticle_edit%26id_article%3D60");} else {document.location.replace("../spip.php?page=login&url=%2Fecrire%2F%3Fexec%3Darticle_edit%26id_article%3D60");}</script><img src='../prive/images/loader.svg?1786525896' alt='' class='loader' width='24' height='24' /><br><a href="../spip.php?page=login&amp;url=%2Fecrire%2F%3Fexec%3Darticle_edit%26id_article%3D60">If you are not automatically redirected, click here to continue.</a>
```

- [ ] **Step 2 : tests qui échouent**

`prive/javascript/tiptap_spip/tests/services/cvt.test.js` :

```js
// @vitest-environment jsdom
// Réponses réelles du formulaire de services, enregistrées sur un site SPIP 4.4 jetable
// (tests/fixtures/cvt/, réenregistrées par tests/e2e/fixtures-cvt.e2e.js).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseResponse, ServiceError, Services, ServiceUnavailable } from '../../src/services/cvt.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/cvt');
const fixture = (name) => readFileSync(join(dir, `${name}.html`), 'utf8');
const conteneur = fixture('formulaire');
const instance = conteneur.match(/data-tts-instance="([^"]+)"/)[1];

const page = (formInstance = instance) => {
	document.body.innerHTML = `<form data-tts-instance="${formInstance}"><textarea name="texte"></textarea><textarea name="ps"></textarea></form>${conteneur}`;
	return document.querySelector('textarea[name=texte]');
};

/** fetch simulé : renvoie les réponses données dans l'ordre et garde les requêtes. */
const fakeFetch = (...reponses) => {
	const requetes = [];
	const fn = vi.fn(async (url, init) => {
		requetes.push({ url, body: init.body });
		const r = reponses.shift();
		if (r instanceof Error) throw r;
		return { status: 200, text: async () => r };
	});
	fn.requetes = requetes;
	return fn;
};

afterEach(() => {
	document.body.innerHTML = '';
});

describe('parseResponse', () => {
	it('résultat JSON et nouveau formulaire', () => {
		const r = parseResponse(fixture('titre_lien'));
		expect(r.operation).toBe('titre_lien');
		expect(r.resultat[0]).toMatchObject({ titre: 'Test tiptap_spip', objet: 'article' });
		expect(r.resultat[0].cible).toBe(`art${r.resultat[0].id}`);
		expect(r.resultat[1]).toMatchObject({ cible: 'https://www.spip.net/fr', url: 'https://www.spip.net/fr' });
		expect(r.resultat[2]).toMatchObject({ cible: 'art999999', titre: null });
		expect(r.form.tagName).toBe('FORM');
		expect(r.erreurs).toBeNull();
	});

	it('erreurs de verifier(), sans balises', () => {
		const r = parseResponse(fixture('erreurs'));
		expect(r.erreurs.modele).toBe('Ce modèle n’existe pas.');
		expect(r.resultat).toBeUndefined();
	});

	it('réponse sans ajax-form-is-ok (session expirée) : null', () => {
		expect(parseResponse(fixture('sans_session'))).toBeNull();
		expect(parseResponse('')).toBeNull();
	});
});

describe('Services.forTextarea', () => {
	it('trouve le formulaire de services par identifiant d\'instance et champ', () => {
		const services = Services.forTextarea(page());
		expect(services).toBeInstanceOf(Services);
		expect(services.container.dataset.ttsChamp).toBe('texte');
	});

	it('aucun service : autre instance, autre champ, ou formulaire sans instance', () => {
		expect(Services.forTextarea(page('tts-000000000000'))).toBeNull();
		page();
		expect(Services.forTextarea(document.querySelector('textarea[name=ps]'))).toBeNull();
		document.body.innerHTML = `<form><textarea name="texte"></textarea></form>${conteneur}`;
		expect(Services.forTextarea(document.querySelector('textarea'))).toBeNull();
	});
});

describe('Services.call', () => {
	it('poste le formulaire signé en AJAX et renvoie le résultat', async () => {
		const fetch = fakeFetch(fixture('titre_lien'));
		const services = Services.forTextarea(page(), { fetch });
		const signature = services.container.querySelector('[name=formulaire_action_sign]').value;
		const action = services.container.querySelector('form').getAttribute('action');
		const resultat = await services.call('titre_lien', { cibles: ['art1', 'https://www.spip.net/fr', 'art999999'] });
		expect(resultat).toHaveLength(3);
		const { url, body } = fetch.requetes[0];
		expect(url).toBe(action);
		expect(url).toMatch(/^\/ecrire\/\?exec=article_edit&id_article=\d+$/);
		expect(body.get('var_ajax')).toBe('form');
		expect(body.get('operation')).toBe('titre_lien');
		expect(JSON.parse(body.get('cibles'))).toEqual(['art1', 'https://www.spip.net/fr', 'art999999']);
		expect(body.get('formulaire_action')).toBe('tiptap_spip');
		expect(body.get('formulaire_action_sign')).toBe(signature);
		// le formulaire est remplacé par celui de la réponse (champs cachés à jour)
		expect(services.container.querySelector('[name=formulaire_action_sign]').value)
			.toBe(parseResponse(fixture('titre_lien')).form.querySelector('[name=formulaire_action_sign]').value);
	});

	it('erreurs de verifier() : ServiceError, le service reste disponible', async () => {
		const services = Services.forTextarea(page(), { fetch: fakeFetch(fixture('erreurs'), fixture('titre_lien')) });
		const erreur = await services.call('previsu_modele', { modele: '<zzz1>' }).catch((e) => e);
		expect(erreur).toBeInstanceOf(ServiceError);
		expect(erreur.erreurs.modele).toBe('Ce modèle n’existe pas.');
		expect(services.available).toBe(true);
		await expect(services.call('titre_lien', { cibles: ['art1'] })).resolves.toHaveLength(3);
	});

	it('session expirée ou réseau coupé : indisponible, sans nouvel appel', async () => {
		for (const reponse of [fixture('sans_session'), new TypeError('Failed to fetch')]) {
			const fetch = fakeFetch(reponse);
			const services = Services.forTextarea(page(), { fetch });
			await expect(services.call('titre_lien', { cibles: ['art1'] })).rejects.toBeInstanceOf(ServiceUnavailable);
			expect(services.available).toBe(false);
			await expect(services.call('titre_lien', { cibles: ['art1'] })).rejects.toBeInstanceOf(ServiceUnavailable);
			expect(fetch).toHaveBeenCalledTimes(1);
		}
	});

	it('les appels sont sérialisés : le suivant part avec le formulaire renouvelé', async () => {
		const ordre = [];
		let liberer;
		const fetch = vi.fn((url, init) => {
			ordre.push(init.body.get('operation'));
			if (ordre.length === 1) {
				return new Promise((resolve) => {
					liberer = () => resolve({ status: 200, text: async () => fixture('titre_lien') });
				});
			}
			return Promise.resolve({ status: 200, text: async () => fixture('titre_lien') });
		});
		const services = Services.forTextarea(page(), { fetch });
		const a = services.call('titre_lien', { cibles: ['art1'] });
		const b = services.call('rechercher', { q: 'Test', objets: ['article'] });
		await new Promise((r) => setTimeout(r, 0));
		expect(ordre).toEqual(['titre_lien']);
		liberer();
		await Promise.all([a, b]);
		expect(ordre).toEqual(['titre_lien', 'rechercher']);
	});
});
```

Ajouter à la fin du `describe` de `prive/javascript/tiptap_spip/tests/editor/main.test.js` :

```js
	it('relie chaque éditeur au formulaire de services de son champ (identifiant d\'instance)', () => {
		const services = (instance, champ) => `<div class="tts-services" hidden data-tts-instance="${instance}" data-tts-champ="${champ}"><form action="/ecrire/"></form></div>`;
		page(`<div class="formulaire_spip"><form data-tts-instance="tts-aaa"><textarea name="texte">a</textarea></form></div>${services('tts-aaa', 'texte')}
			<div class="formulaire_spip"><form data-tts-instance="tts-bbb"><textarea name="texte">b</textarea></form></div>${services('tts-bbb', 'texte')}
			<div class="formulaire_spip"><form><textarea name="texte">c</textarea></form></div>`);
		tiptap_spip_init();
		const [a, b, c] = instances;
		expect(a.services.container.dataset.ttsInstance).toBe('tts-aaa');
		expect(b.services.container.dataset.ttsInstance).toBe('tts-bbb');
		expect(c.services).toBeNull();
	});
```

Run : `npx vitest run tests/services tests/editor/main.test.js` → FAIL (`cvt.js` introuvable, `services` indéfini).

- [ ] **Step 3 : implémenter**

`prive/javascript/tiptap_spip/src/services/cvt.js` :

```js
/**
 * Appels au formulaire CVT de services de l'éditeur (spec 02 §5).
 *
 * Le formulaire `#FORMULAIRE_TIPTAP_SPIP{objet, id_objet, champ}` est rendu par SPIP dans un conteneur
 * masqué `.tts-services`, hors du formulaire d'édition. Un appel poste ce formulaire en AJAX
 * (var_ajax=form) avec l'opération et ses paramètres ; SPIP répond
 * `<br class='… ajax-form-is-ok'>` suivi du formulaire recalculé, qui porte le résultat
 * (script.tts-resultat) ou les erreurs de verifier() (script.tts-erreurs) en JSON.
 */

/** Le service ne répond plus (session expirée, droit retiré, réseau) : mode dégradé. */
export class ServiceUnavailable extends Error {
	constructor(message = 'services de l\'éditeur indisponibles') {
		super(message);
		this.name = 'ServiceUnavailable';
	}
}

/** verifier() a refusé la demande : erreurs par paramètre, texte sans balises. */
export class ServiceError extends Error {
	constructor(erreurs) {
		super(erreurs.message_erreur || Object.values(erreurs).join(' '));
		this.name = 'ServiceError';
		this.erreurs = erreurs;
	}
}

const texte = (html) => new DOMParser().parseFromString(String(html), 'text/html').body.textContent.trim();

const lireJSON = (doc, selecteur) => {
	const script = doc.querySelector(selecteur);
	return script ? JSON.parse(script.textContent) : null;
};

/**
 * Lit la réponse AJAX d'un CVT.
 * @param {string} html
 * @returns {{ form: HTMLFormElement, operation?: string, resultat?: any, erreurs: object|null } | null}
 *          null si la réponse n'est pas celle d'un formulaire traité (session expirée…)
 */
export function parseResponse(html) {
	if (!html || !html.includes('ajax-form-is-ok')) return null;
	const doc = new DOMParser().parseFromString(html, 'text/html');
	const form = doc.querySelector('form');
	if (!form) return null;
	const ok = lireJSON(doc, 'script.tts-resultat');
	const brutes = lireJSON(doc, 'script.tts-erreurs');
	const erreurs = brutes ? Object.fromEntries(Object.entries(brutes).map(([k, v]) => [k, texte(v)])) : null;
	return { form, operation: ok?.operation, resultat: ok?.resultat, erreurs };
}

export class Services {
	/**
	 * Formulaire de services d'un textarea : conteneur dont l'identifiant d'instance est celui du
	 * formulaire d'édition du textarea, et le champ son name.
	 * @param {HTMLTextAreaElement} textarea
	 * @param {{ fetch?: typeof fetch }} [options]
	 * @returns {Services|null} null : pas de services (mode dégradé)
	 */
	static forTextarea(textarea, options) {
		const id = textarea.form?.dataset.ttsInstance;
		if (!id) return null;
		const container = [...document.querySelectorAll('.tts-services')]
			.find((c) => c.dataset.ttsInstance === id && c.dataset.ttsChamp === textarea.name);
		return container?.querySelector('form') ? new Services(container, options) : null;
	}

	/** @param {HTMLElement} container  élément .tts-services */
	constructor(container, { fetch = globalThis.fetch?.bind(globalThis) } = {}) {
		this.container = container;
		this.fetch = fetch;
		this.available = true;
		this.queue = Promise.resolve();
	}

	/**
	 * Appelle une opération ; les appels sont sérialisés (chacun repart du formulaire renouvelé
	 * par la réponse précédente).
	 * @param {string} operation  previsu_modele, titre_lien, rechercher
	 * @param {object} params  valeurs non chaînes envoyées en JSON
	 * @returns {Promise<any>} résultat de l'opération
	 */
	call(operation, params = {}) {
		const run = () => this.send(operation, params);
		const promise = this.queue.then(run, run);
		this.queue = promise.catch(() => {});
		return promise;
	}

	async send(operation, params) {
		if (!this.available) throw new ServiceUnavailable();
		const form = this.container.querySelector('form');
		const body = new FormData(form);
		body.set('var_ajax', 'form');
		body.set('operation', operation);
		for (const [key, value] of Object.entries(params)) {
			body.set(key, typeof value === 'string' ? value : JSON.stringify(value));
		}
		let reponse;
		try {
			const res = await this.fetch(form.getAttribute('action'), { method: 'POST', body, credentials: 'same-origin' });
			reponse = parseResponse(await res.text());
		} catch {
			reponse = null;
		}
		if (!reponse) {
			this.available = false;
			throw new ServiceUnavailable();
		}
		form.replaceWith(document.importNode(reponse.form, true));
		if (reponse.erreurs) throw new ServiceError(reponse.erreurs);
		return reponse.resultat;
	}
}
```

Dans `prive/javascript/tiptap_spip/src/main.js` : importer `Services` (`import { Services } from './services/cvt.js';`) et, après `this.bridge = new TextareaBridge(…)` :

```js
		// formulaire de services du champ (null : mode dégradé, sans services serveur)
		this.services = Services.forTextarea(textarea);
```

- [ ] **Step 4 : vérifier, bundle, commit**

Run : `npm test` → PASS, 259 tests ; `npm run build`.

```bash
git add prive/javascript/tiptap_spip/src/services prive/javascript/tiptap_spip/src/main.js prive/javascript/tiptap_spip/tests/services prive/javascript/tiptap_spip/tests/fixtures prive/javascript/tiptap_spip/tests/editor/main.test.js prive/javascript/tiptap_spip.js prive/javascript/tiptap_spip.min.js
git commit -m "feat(services): client JS du formulaire de services, mode dégradé"
```

---

### Task 4 : Bout en bout sur le site jetable

**Files:**
- Modify: `tests/e2e/site.php` (commande `document`, titre optionnel de `preparer`), `prive/javascript/tiptap_spip/tests/e2e/article.e2e.js` (outils déplacés dans `site.js`)
- Create: `prive/javascript/tiptap_spip/tests/e2e/site.js`, `prive/javascript/tiptap_spip/tests/e2e/services.e2e.js`, `prive/javascript/tiptap_spip/tests/e2e/fixtures-cvt.e2e.js`

- [ ] **Step 1 : outils et pilote**

`tests/e2e/site.php` :

```php
<?php

/**
 * Pilote d'un site SPIP JETABLE pour les tests de bout en bout (jamais un site réel : la
 * commande active le plugin et ouvre une session d'administrateur).
 *
 * Usage :
 *   SPIP_ROOT=<site> php tests/e2e/site.php preparer <agent> [titre] < texte.spip
 *     active le plugin tiptap_spip, crée un article avec le texte lu sur l'entrée standard et
 *     une session pour l'auteur 1 ; écrit {"id_article": …, "cookie": …} sur la sortie.
 *     <agent> : User-Agent du navigateur de test (la session SPIP en dépend).
 *   SPIP_ROOT=<site> php tests/e2e/site.php texte <id_article>
 *     écrit le texte de l'article, octet pour octet.
 *   SPIP_ROOT=<site> php tests/e2e/site.php document <id_article>
 *     crée une image (PNG 1×1) liée à l'article ; écrit son id_document.
 */

$root = rtrim((string) getenv('SPIP_ROOT'), '/');
$commande = $argv[1] ?? '';
if ($root === '' || !is_dir($root . '/ecrire') || !in_array($commande, ['preparer', 'texte', 'document'], true)) {
	fwrite(STDERR, "Usage : SPIP_ROOT=<site jetable> php tests/e2e/site.php preparer <agent> | texte <id_article> | document <id_article>\n");
	exit(2);
}

// la session SPIP est liée à l'IP et au User-Agent du navigateur
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['HTTP_USER_AGENT'] = $commande === 'preparer' ? (string) ($argv[2] ?? '') : '';

chdir($root);
if (is_file($root . '/vendor/autoload.php')) {
	require_once $root . '/vendor/autoload.php';
	include_once $root . '/' . \SpipLeague\Component\Kernel\param('spip.dirs.core') . 'inc_version.php';
} else {
	include_once $root . '/ecrire/inc_version.php';
}
include_spip('base/abstract_sql');

if ($commande === 'texte') {
	echo (string) sql_getfetsel('texte', 'spip_articles', 'id_article=' . (int) ($argv[2] ?? 0));
	exit(0);
}

if ($commande === 'document') {
	$id_article = (int) ($argv[2] ?? 0);
	$fichier = 'png/tts-' . bin2hex(random_bytes(4)) . '.png';
	@mkdir(_DIR_IMG . 'png', 0777, true);
	file_put_contents(_DIR_IMG . $fichier, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='));
	$id_document = (int) sql_insertq('spip_documents', [
		'extension' => 'png',
		'titre' => 'Image de test',
		'fichier' => $fichier,
		'taille' => filesize(_DIR_IMG . $fichier),
		'largeur' => 1,
		'hauteur' => 1,
		'media' => 'image',
		'mode' => 'document',
		'distant' => 'non',
		'statut' => 'publie',
		'date' => date('Y-m-d H:i:s'),
	]);
	sql_insertq('spip_documents_liens', ['id_document' => $id_document, 'objet' => 'article', 'id_objet' => $id_article, 'vu' => 'non']);
	echo $id_document, "\n";
	exit(0);
}

include_spip('inc/plugin');
ecrire_plugin_actifs(['tiptap_spip'], false, 'ajoute');

$id_rubrique = (int) sql_getfetsel('id_rubrique', 'spip_rubriques', '', '', 'id_rubrique', '0,1');
if (!$id_rubrique) {
	$id_rubrique = (int) sql_insertq('spip_rubriques', ['titre' => 'Tests', 'statut' => 'publie', 'id_secteur' => 0]);
	sql_updateq('spip_rubriques', ['id_secteur' => $id_rubrique], 'id_rubrique=' . $id_rubrique);
}
$id_article = (int) sql_insertq('spip_articles', [
	'titre' => (string) ($argv[3] ?? 'Test tiptap_spip'),
	'texte' => stream_get_contents(STDIN),
	'id_rubrique' => $id_rubrique,
	'id_secteur' => $id_rubrique,
	'statut' => 'prepa',
	'date' => date('Y-m-d H:i:s'),
	'lang' => 'fr',
]);
sql_insertq('spip_auteurs_liens', ['id_auteur' => 1, 'objet' => 'article', 'id_objet' => $id_article]);

include_spip('inc/session');
$auteur = sql_fetsel('*', 'spip_auteurs', 'id_auteur=1');
unset($_COOKIE['spip_session']);
$cookie = ajouter_session($auteur);

echo json_encode(['id_article' => $id_article, 'cookie' => $cookie]), "\n";
```
`prive/javascript/tiptap_spip/tests/e2e/site.js` :

```js
// Outils des tests de bout en bout : pilote du site SPIP JETABLE (tests/e2e/site.php) et page
// d'édition d'un article.
import { expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const repo = fileURLToPath(new URL('../../../../../', import.meta.url));
const driver = `${repo}tests/e2e/site.php`;
const env = { ...process.env, SPIP_ROOT: process.env.TTS_SITE };

export const php = (args, input) => execFileSync('php', [driver, ...args], { env, input, encoding: 'utf8' });
export const texte = (id) => php(['texte', String(id)]);
export const creerDocument = (id) => Number(php(['document', String(id)]));

/** Fins de ligne telles que le navigateur les soumet. */
export const crlf = (s) => s.replace(/\r?\n/g, '\r\n');

export const configure = (test) => test.skip(!process.env.TTS_SITE || !process.env.TTS_URL, 'TTS_SITE et TTS_URL requis');

/**
 * Crée un article, ouvre une session et charge sa page d'édition.
 * @param {{ sansEditeur?: boolean, avant?: (id: number) => void, titre?: string }} options  sansEditeur :
 *        bundle bloqué, textarea natif ; avant : préparation après la création de l'article (document
 *        lié…) ; titre : titre de l'article (défaut « Test tiptap_spip »)
 */
export async function editer(page, source, { sansEditeur = false, avant, titre = 'Test tiptap_spip' } = {}) {
	const { id_article: id, cookie } = JSON.parse(php(['preparer', 'tts-e2e', titre], source));
	avant?.(id);
	const url = new URL(process.env.TTS_URL);
	await page.context().addCookies([{ name: 'spip_session', value: cookie, domain: url.hostname, path: '/' }]);
	if (sansEditeur) await page.route(/tiptap_spip(\.min)?\.js/, (route) => route.abort());
	await page.goto(`/ecrire/?exec=article_edit&id_article=${id}`);
	if (!sansEditeur) await expect(page.locator('.tts-editor .ProseMirror')).toBeVisible();
	return id;
}

export const enregistrer = async (page) => {
	await Promise.all([
		page.waitForURL(/exec=article&/),
		page.locator('.formulaire_editer_article .boutons [type=submit]').first().click(),
	]);
};

/** Le module de l'éditeur chargé par la page (même URL, donc même instance de module). */
export const module = (page) => page.evaluate(async () => {
	const source = [...document.scripts].map((s) => s.textContent).join('\n');
	window.__tts = await import(source.match(/from '([^']*tiptap_spip(?:\.min)?\.js[^']*)'/)[1]);
});
```
`prive/javascript/tiptap_spip/tests/e2e/article.e2e.js` :

```js
// Bout en bout dans l'espace privé d'un site SPIP JETABLE : un article est édité avec l'éditeur
// puis enregistré, et le texte en base est comparé octet pour octet à ce que SPIP enregistre pour
// le même formulaire soumis SANS l'éditeur (le navigateur convertit les fins de ligne d'un
// textarea en CRLF à la soumission : c'est la référence, pas la source brute).
// Usage : TTS_SITE=<racine du site jetable> TTS_URL=http://127.0.0.1:<port> npm run e2e
// Serveur : php -d opcache.revalidate_freq=0 -S 127.0.0.1:<port> -t <racine du site jetable>
// (site.php active le plugin en ligne de commande, ce qui réécrit les caches de plugins de SPIP ;
// sans cette option, OPcache du serveur PHP sert encore l'ancien charger_pipelines.php pendant
// 2 secondes et la première page s'affiche sans l'éditeur)
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { configure, crlf, editer, enregistrer, repo, texte } from './site.js';

configure(test);

for (const fichier of ['base.spip', 'melanges.spip', 'blancs.spip', 'liens.spip', 'modeles.spip']) {
	test(`${fichier} : enregistré sans modification, le texte est inchangé`, async ({ page }) => {
		const source = readFileSync(`${repo}tests/corpus/${fichier}`, 'utf8');
		const id = await editer(page, source);
		await expect(page.locator('textarea[name=texte]')).toBeHidden();
		await expect(page.locator('.markItUp')).toHaveCount(0);
		await enregistrer(page);

		const temoin = await editer(page, source, { sansEditeur: true });
		await enregistrer(page);
		// pas texte(temoin) === crlf(source) : un saut de ligne en tête de <textarea> est ignoré
		// par le navigateur (règle HTML), SPIP le perd avec ou sans éditeur
		expect(texte(id)).toBe(texte(temoin));
	});
}

test('une modification ne réécrit que son paragraphe', async ({ page }) => {
	const source = '{{{Titre}}}\n\n\nUn  paragraphe {{gras}}.\n\n\n-* liste\n-* suite\n';
	const id = await editer(page, source);
	await page.locator('.ProseMirror p').first().click();
	await page.keyboard.press('End');
	await page.keyboard.type(' Ajout');
	await enregistrer(page);
	expect(texte(id)).toBe(crlf('{{{Titre}}}\n\n\nUn  paragraphe {{gras}}. Ajout\n\n\n-* liste\n-* suite\n'));
});

test('mode source : la saisie dans le textarea est reprise par l\'éditeur', async ({ page }) => {
	const id = await editer(page, 'Avant');
	await page.locator('.tts-mode').click();
	const textarea = page.locator('textarea[name=texte]');
	await expect(textarea).toBeVisible();
	await textarea.fill('{{Après}}');
	await page.locator('.tts-mode').click();
	await expect(page.locator('.ProseMirror strong')).toHaveText('Après');
	await enregistrer(page);
	expect(texte(id)).toBe('{{Après}}');
});
```

- [ ] **Step 2 : tests des services**

`prive/javascript/tiptap_spip/tests/e2e/services.e2e.js` :

```js
// Formulaire de services de l'éditeur (spec 02 §5) sur un site SPIP JETABLE : appels AJAX réels
// depuis la page d'édition d'un article. Usage et serveur : cf. article.e2e.js.
import { expect, test } from '@playwright/test';
import { configure, creerDocument, editer, module } from './site.js';

configure(test);

/** Appelle une opération des services du premier éditeur de la page. */
const appeler = (page, operation, params) => page.evaluate(async ([operation, params]) => {
	const { services } = [...window.__tts.instances][0];
	try {
		return { resultat: await services.call(operation, params) };
	} catch (e) {
		return { erreur: e.name, erreurs: e.erreurs ?? null, disponible: services.available };
	}
}, [operation, params]);

let id;
let idDocument;

test.beforeEach(async ({ page }) => {
	id = await editer(page, 'Texte de test', { avant: (idArticle) => { idDocument = creerDocument(idArticle); } });
	await module(page);
});

test('l\'éditeur est relié au formulaire de services de son champ', async ({ page }) => {
	const lien = await page.evaluate(() => {
		const { services, textarea } = [...window.__tts.instances][0];
		return { services: services?.container.dataset.ttsInstance, form: textarea.form.dataset.ttsInstance, champ: services?.container.dataset.ttsChamp };
	});
	expect(lien.services).toMatch(/^tts-[0-9a-f]{12}$/);
	expect(lien.services).toBe(lien.form);
	expect(lien.champ).toBe('texte');
});

test('titre_lien : titre des objets visibles, rien pour un objet absent', async ({ page }) => {
	const { resultat } = await appeler(page, 'titre_lien', { cibles: [`art${id}`, 'art999999', 'https://www.spip.net/fr', '#ancre'] });
	expect(resultat[0]).toMatchObject({ cible: `art${id}`, titre: 'Test tiptap_spip', objet: 'article', id });
	expect(resultat[1]).toMatchObject({ titre: null, objet: 'article', id: 999999 });
	expect(resultat[2]).toMatchObject({ url: 'https://www.spip.net/fr' });
	expect(resultat[3]).toMatchObject({ titre: null, url: null });
});

test('previsu_modele : HTML du modèle calculé par SPIP', async ({ page }) => {
	const { resultat } = await appeler(page, 'previsu_modele', { modele: `<doc${idDocument}|left>` });
	expect(resultat).toMatch(/<img[^>]+tts-[0-9a-f]{8}\.png/);
	expect(resultat).not.toMatch(/<script/i);
});

test('rechercher : objets dont le titre correspond, les plus récents d\'abord', async ({ page }) => {
	const titre = `Recherche ${Date.now()}`;
	const autre = await editer(page, 'x', { titre });
	await module(page);
	const { resultat } = await appeler(page, 'rechercher', { q: titre.slice(3), objets: ['article', 'rubrique'] });
	expect(resultat).toEqual([{ objet: 'article', id: autre, titre, raccourci: `article${autre}` }]);
	const tous = (await appeler(page, 'rechercher', { q: 'Test tiptap', objets: ['article'] })).resultat;
	expect(tous[0].id).toBe(id);
	expect(tous.length).toBeLessThanOrEqual(20);
});

test('verifier() refuse une demande invalide, le service reste disponible', async ({ page }) => {
	const r = await appeler(page, 'previsu_modele', { modele: '<doc1> <doc2>' });
	expect(r).toMatchObject({ erreur: 'ServiceError', disponible: true });
	expect(r.erreurs.modele).toBe('Raccourci de modèle invalide.');
	expect((await appeler(page, 'operation_inconnue', {})).erreur).toBe('ServiceError');
	expect((await appeler(page, 'titre_lien', { cibles: [`art${id}`] })).resultat).toHaveLength(1);
});

for (const champ of ['formulaire_action_args', 'formulaire_action_sign']) {
	test(`${champ} falsifié : SPIP ne traite pas la demande, mode dégradé`, async ({ page }) => {
		await page.evaluate((champ) => {
			const input = document.querySelector(`.tts-services [name=${champ}]`);
			input.value = `${input.value.slice(0, -4)}${input.value.endsWith('AAAA') ? 'BBBB' : 'AAAA'}`;
		}, champ);
		expect(await appeler(page, 'titre_lien', { cibles: [`art${id}`] })).toMatchObject({ erreur: 'ServiceUnavailable', disponible: false });
	});
}
```
`prive/javascript/tiptap_spip/tests/e2e/fixtures-cvt.e2e.js` :

```js
// Enregistre les réponses réelles du formulaire de services utilisées par tests/services/cvt.test.js.
// Usage : TTS_FIXTURES=1 TTS_SITE=… TTS_URL=… npx playwright test fixtures-cvt
import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { configure, editer } from './site.js';

configure(test);
test.skip(!process.env.TTS_FIXTURES, 'TTS_FIXTURES=1 pour réenregistrer les fixtures');

const dossier = new URL('../fixtures/cvt/', import.meta.url);

/** Poste le formulaire de services comme cvt.js, sans passer par lui, et renvoie la réponse brute. */
const poster = (page, params, { sansSession = false } = {}) => page.evaluate(async ([params, sansSession]) => {
	const form = document.querySelector('.tts-services form');
	const data = new FormData(form);
	data.set('var_ajax', 'form');
	for (const [k, v] of Object.entries(params)) data.set(k, v);
	const res = await fetch(form.action, { method: 'POST', body: data, credentials: sansSession ? 'omit' : 'same-origin' });
	const html = await res.text();
	const nouveau = new DOMParser().parseFromString(html, 'text/html').querySelector('form');
	if (nouveau) form.replaceWith(document.importNode(nouveau, true));
	return html;
}, [params, sansSession]);

test('fixtures de cvt.js', async ({ page }) => {
	const id = await editer(page, 'Texte');
	mkdirSync(dossier, { recursive: true });
	const ecrire = (nom, html) => writeFileSync(new URL(`${nom}.html`, dossier), html);
	ecrire('formulaire', await page.evaluate(() => document.querySelector('.tts-services').outerHTML));
	ecrire('titre_lien', await poster(page, { operation: 'titre_lien', cibles: JSON.stringify([`art${id}`, 'https://www.spip.net/fr', 'art999999']) }));
	ecrire('erreurs', await poster(page, { operation: 'previsu_modele', modele: '<zzz1>' }));
	ecrire('sans_session', await poster(page, { operation: 'titre_lien', cibles: JSON.stringify([`art${id}`]) }, { sansSession: true }));
});
```

- [ ] **Step 3 : lancer**

Site jetable neuf relié au dépôt, `php -d opcache.revalidate_freq=0 -S 127.0.0.1:18931 -t <site>` (port vérifié libre), puis :
Run : `TTS_SITE=<site> TTS_URL=http://127.0.0.1:18931 npm run e2e` → `14 passed, 1 skipped` (le générateur de fixtures). Réenregistrer les fixtures : `TTS_FIXTURES=1 … npx playwright test fixtures-cvt`, puis `npm test` (les tests de `cvt.js` ne dépendent pas des identifiants du site).

- [ ] **Step 4 : commit**

```bash
git add tests/e2e/site.php prive/javascript/tiptap_spip/tests/e2e
git commit -m "test(e2e): services de l'éditeur sur un site jetable, sécurité, fixtures"
```

---

### Task 5 : Specs

- [ ] **Step 1 : reporter dans les specs**

- 02 §5 : `formulaire_fond` reçoit `type`/`id` pour les formulaires d'objet ; champs équipés par défaut : `texte` (`tiptap_spip_champs()`) ; erreurs enveloppées par SPIP (`<span role='alert'>`), texte extrait par le JS ; recherche : 20 résultats, plus récents d'abord, objets `article, rubrique, breve, document, auteur, mot, site` limités aux tables présentes ; existence d'un modèle (objets stylisés + `trouve_modele`) ; falsification et session absente → pas d'`ajax-form-is-ok` → mode dégradé ; `glossaire` au lot L3.
- 08 §2 : intégration CVT réalisée par `services.e2e.js` (site jetable) et `cvt.test.js` sur réponses réelles (`fixtures-cvt.e2e.js` les réenregistre) ; le cas « deux formulaires d'édition du même objet » est couvert au niveau unitaire (identifiant d'instance différent à chaque calcul, association par instance).
- 09 : L2.2 fait.

- [ ] **Step 2 : commit**

```bash
git add docs/specs
git commit -m "docs: specs du lot L2.2 (formulaire de services)"
```
