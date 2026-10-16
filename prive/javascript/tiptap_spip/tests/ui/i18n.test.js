import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAUTS } from '../../src/ui/labels.js';

// Règle i18n du projet (spec 11) : chaque libellé de l'interface est à trois endroits, labels.js
// (défaut français), les fichiers de langue SPIP (fr de référence, en complet) et la configuration JS
// qui le transmet traduit.
const racine = new URL('../../../../../', import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, racine), 'utf8');

/** Chaînes d'un fichier de langue : clé → valeur (apostrophes échappées \' rétablies). */
const chaines = (fichier) => Object.fromEntries([...lire(fichier).matchAll(/^\t'(\w+)' => '((?:[^'\\]|\\.)*)',$/gm)]
	.map(([, cle, valeur]) => [cle, valeur.replace(/\\(.)/g, '$1')]));
const langue = chaines('lang/tiptap_spip_fr.php');
const anglais = chaines('lang/tiptap_spip_en.php');

/** Paramètres @nom@ d'une chaîne, triés. */
const parametres = (texte) => [...texte.matchAll(/@(\w+)@/g)].map((m) => m[1]).sort();

/** Fond de la configuration JS. */
const fond = lire('prive/javascript/tiptap_spip_config.js.html');

/** Clés de la configuration JS : `cle: <:tiptap_spip:cle|tiptap_spip_js_string:>`, virgule finale ou non (dernière). */
const config = [...fond.matchAll(/^\t+(\w+): <:tiptap_spip:(\w+)\|tiptap_spip_js_string:>,?$/gm)];

/** Fichiers sources du bundle. */
const sources = (dossier) => readdirSync(new URL(dossier, import.meta.url), { withFileTypes: true }).flatMap((f) => (
	f.isDirectory() ? sources(`${dossier}${f.name}/`) : f.name.endsWith('.js') ? [readFileSync(new URL(dossier + f.name, import.meta.url), 'utf8')] : []
));

describe('libellés de l\'interface', () => {
	it('chaque libellé de labels.js est dans le fichier de langue, avec le même texte', () => {
		const absents = Object.keys(DEFAUTS).filter((cle) => !(cle in langue));
		expect(absents).toEqual([]);
		const differents = Object.entries(DEFAUTS).filter(([cle, texte]) => langue[cle] !== texte).map(([cle]) => cle);
		expect(differents).toEqual([]);
	});

	it('la configuration JS transmet chaque libellé, sous sa propre clé, et rien d\'autre', () => {
		expect(config.filter(([, cle, idiome]) => cle !== idiome).map(([, cle]) => cle)).toEqual([]);
		const transmis = config.map(([, cle]) => cle);
		expect(transmis.filter((cle, i) => transmis.indexOf(cle) !== i)).toEqual([]);
		expect(transmis.filter((cle) => !(cle in DEFAUTS))).toEqual([]);
		expect(Object.keys(DEFAUTS).filter((cle) => !transmis.includes(cle))).toEqual([]);
	});

	it('la configuration JS n\'écrit aucune chaîne de langue entre guillemets (encodage JSON)', () => {
		expect(fond).not.toMatch(/"<:|texte_script/);
	});

	it('les chaînes des plugins tiers viennent après celles du cœur et peuvent les remplacer', () => {
		const i18n = fond.slice(fond.indexOf('i18n: {'));
		expect(i18n.indexOf('...[(#VAL|tiptap_spip_i18n_json)]')).toBeGreaterThan(i18n.lastIndexOf('|tiptap_spip_js_string:>'));
	});

	it('le fichier de langue anglais traduit chaque clé du français, avec les mêmes paramètres', () => {
		expect(Object.keys(langue).length).toBeGreaterThan(100);
		expect(Object.keys(langue).filter((cle) => !(cle in anglais))).toEqual([]);
		expect(Object.keys(anglais).filter((cle) => !(cle in langue))).toEqual([]);
		expect(Object.keys(langue).filter((cle) => parametres(langue[cle]).join() !== parametres(anglais[cle] ?? '').join())).toEqual([]);
		expect(Object.keys(langue).filter((cle) => anglais[cle] === '' || (anglais[cle] === langue[cle] && /[àâçéèêëîïôûùüÿœ’]/i.test(langue[cle])))).toEqual([]);
	});

	it('chaque label(\'clé\') des sources a un défaut', () => {
		const cles = new Set(sources('../../src/').flatMap((s) => [...s.matchAll(/\blabel\('(\w+)'\)/g)].map((m) => m[1])));
		expect(cles.size).toBeGreaterThan(50);
		expect([...cles].filter((cle) => !(cle in DEFAUTS))).toEqual([]);
	});
});
