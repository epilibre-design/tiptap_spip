// Icônes de la barre d'outils : SVG de Remix Icon (Apache-2.0, https://remixicon.com) extraits du
// paquet remixicon dans src/ui/icones.js, versionné.
// Usage : npm run icones
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Nom de l'icône dans la barre → fichier Remix Icon (sans .svg). */
const ICONES = {
	annuler: 'arrow-go-back-line',
	retablir: 'arrow-go-forward-line',
	titre: 'heading',
	paragraphe: 'paragraph',
	liste: 'list-unordered',
	listeNumerotee: 'list-ordered-2',
	indenter: 'indent-increase',
	desindenter: 'indent-decrease',
	citation: 'double-quotes-l',
	poesie: 'quill-pen-line',
	cadre: 'code-block',
	gras: 'bold',
	italique: 'italic',
	barre: 'strikethrough',
	exposant: 'superscript',
	indice: 'subscript',
	code: 'code-line',
	lien: 'link',
	note: 'asterisk',
	glossaire: 'book-2-line',
	abbr: 'text-snippet',
	modele: 'puzzle-line',
	multi: 'translate-2',
	chevronBas: 'arrow-down-s-line',
	alignement: 'align-left',
	alignGauche: 'align-left',
	alignCentre: 'align-center',
	alignDroite: 'align-right',
	alignJustifie: 'align-justify',
	tableau: 'table-2',
	guillemets: 'double-quotes-r',
	caracteres: 'omega',
	source: 'code-view',
	pleinEcran: 'fullscreen-line',
	pleinEcranSortir: 'fullscreen-exit-line',
};

const racine = fileURLToPath(new URL('../node_modules/remixicon/icons/', import.meta.url));
const fichiers = new Map();
for (const dossier of readdirSync(racine)) {
	for (const f of readdirSync(racine + dossier)) fichiers.set(f.replace(/\.svg$/, ''), `${racine}${dossier}/${f}`);
}
const lignes = Object.entries(ICONES).map(([nom, fichier]) => {
	if (!fichiers.has(fichier)) throw new Error(`icône absente de remixicon : ${fichier}`);
	const svg = readFileSync(fichiers.get(fichier), 'utf8').trim()
		.replace(' xmlns="http://www.w3.org/2000/svg"', '')
		.replace('<svg ', '<svg aria-hidden="true" focusable="false" ');
	return `\t${nom}: '${svg}',`;
});
const sortie = fileURLToPath(new URL('../src/ui/icones.js', import.meta.url));
writeFileSync(sortie, `// Généré par scripts/icones.mjs (npm run icones) : ne pas modifier à la main.
// Icônes Remix Icon (https://remixicon.com), licence Apache-2.0.
export const ICONES = {
${lignes.join('\n')}
};
`);
