import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAUTS } from '../../src/ui/labels.js';

// Règle i18n du projet : chaque libellé de l'interface est à trois endroits, labels.js (défaut
// français), le fichier de langue SPIP et la configuration JS qui le transmet traduit.
const racine = new URL('../../../../../', import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, racine), 'utf8');

/** Chaînes du fichier de langue : clé → valeur (apostrophes échappées \' rétablies). */
const langue = Object.fromEntries([...lire('lang/tiptap_spip_fr.php').matchAll(/^\t'(\w+)' => '((?:[^'\\]|\\.)*)',$/gm)]
	.map(([, cle, valeur]) => [cle, valeur.replace(/\\(.)/g, '$1')]));

/** Clés de la configuration JS : `cle: "<:tiptap_spip:cle|texte_script:>"`. */
const config = [...lire('prive/javascript/_inits/09_tiptap_spip_config.js.html').matchAll(/^\t+(\w+): "<:tiptap_spip:(\w+)\|texte_script:>",$/gm)];

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
		expect(transmis.filter((cle) => !(cle in DEFAUTS))).toEqual([]);
		expect(Object.keys(DEFAUTS).filter((cle) => !transmis.includes(cle))).toEqual([]);
	});

	it('chaque label(\'clé\') des sources a un défaut', () => {
		const cles = new Set(sources('../../src/').flatMap((s) => [...s.matchAll(/\blabel\('(\w+)'\)/g)].map((m) => m[1])));
		expect(cles.size).toBeGreaterThan(50);
		expect([...cles].filter((cle) => !(cle in DEFAUTS))).toEqual([]);
	});
});
