// Icônes de la barre d'outils : SVG de Remix Icon (Apache-2.0, https://remixicon.com) extraits du
// paquet remixicon dans src/ui/icones.js, versionné.
// remixicon reste fixé à 4.8.0 : à partir de 4.9.0, il est distribué sous la Remix Icon License v1.0,
// plus restrictive (CREDITS.md). Ne pas le mettre à jour sans revoir sa licence.
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
// Emoji Add de Microsoft, MIT (SVG Repo 309597) : géométrie originale, couleur héritée,
// métadonnées et identifiants supprimés pour éviter les doublons entre boutons.
const emoji = readFileSync(new URL('../src/ui/svg-add-emoji.svg', import.meta.url), 'utf8');
const path = emoji.match(/<path d="([^"]+)"/)[1];
lignes.push(`\temoji: '<svg class="svg-add-emoji" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="currentColor"><path d="${path}"/></svg>',`);
const sortie = fileURLToPath(new URL('../src/ui/icones.js', import.meta.url));
writeFileSync(sortie, `// Généré par scripts/icones.mjs (npm run icones) : ne pas modifier à la main.
// Remix Icon : Apache-2.0 ; Emoji Add de Microsoft (SVG Repo 309597) : MIT.
export const ICONES = {
${lignes.join('\n')}
};
`);
