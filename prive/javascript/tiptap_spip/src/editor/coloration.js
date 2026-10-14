import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { config } from '../config.js';

/**
 * Coloration syntaxique des blocs de code pendant la saisie, seulement avec le plugin Coloration
 * Code : son highlight.js (window.hljs), ses grammaires et son thème, comme sur le site public.
 * Décorations ProseMirror : spans highlight.js à l'affichage, document et source inchangés.
 */

const cle = new PluginKey('coloration');

/**
 * Alias courants → fichier de grammaire de Coloration Code (assets/highlightjs/languages/) ; une fois
 * chargée, la grammaire déclare elle-même ses alias à highlight.js.
 */
const FICHIERS = {
	js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript', ts: 'typescript', tsx: 'typescript',
	html: 'xml', xhtml: 'xml', svg: 'xml', rss: 'xml', atom: 'xml', xsl: 'xml', plist: 'xml',
	sh: 'bash', zsh: 'bash', console: 'shell', shellsession: 'shell', yml: 'yaml', md: 'markdown',
	py: 'python', rb: 'ruby', rs: 'rust', golang: 'go', kt: 'kotlin', cs: 'csharp',
	h: 'c', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', 'c++': 'cpp', postgres: 'pgsql', postgresql: 'pgsql',
	toml: 'ini', ps1: 'powershell', bat: 'dos', cmd: 'dos', patch: 'diff', docker: 'dockerfile',
	tex: 'latex', mk: 'makefile', pl: 'perl', txt: 'plaintext', text: 'plaintext',
};

/** Langage d'un bloc : ```php (attribut language) ou <code class="css"> (balise d'origine), en minuscules. */
function langageDu(node) {
	const classe = /\bclass\s*=\s*["']([^"']*)["']/i.exec(node.attrs.openTag ?? '')?.[1];
	const langage = node.attrs.language || classe?.split(/\s+/).map((c) => c.replace(/^language-/, '')).find(Boolean);
	return langage ? langage.toLowerCase() : null;
}

/** Plages [début, fin, classes] du texte, lues dans le HTML de highlight.js ; portées imbriquées réunies. */
function plages(html) {
	const modele = document.createElement('template');
	modele.innerHTML = html;
	const resultat = [];
	let pos = 0;
	const parcourir = (parent, classes) => {
		for (const enfant of parent.childNodes) {
			if (enfant.nodeType === Node.TEXT_NODE) {
				if (classes.length) resultat.push([pos, pos + enfant.data.length, classes.join(' ')]);
				pos += enfant.data.length;
			} else {
				parcourir(enfant, enfant.className ? [...classes, enfant.className] : classes);
			}
		}
	};
	parcourir(modele.content, []);
	return resultat;
}

/** Grammaire demandée à Coloration Code, une fois par fichier : promesse de réussite. */
const chargements = new Map();
function charger(langage) {
	const fichier = FICHIERS[langage] ?? langage;
	const assets = globalThis.spipConfig?.coloration_code?.assets;
	if (!assets || !/^[\w+-]+$/.test(fichier)) return Promise.resolve(false);
	if (!chargements.has(fichier)) {
		chargements.set(fichier, new Promise((resolve) => {
			const script = document.createElement('script');
			script.src = `${assets}highlightjs/languages/${fichier}.min.js`;
			script.addEventListener('load', () => resolve(true));
			script.addEventListener('error', () => resolve(false));
			document.head.append(script);
		}));
	}
	return chargements.get(fichier);
}

/**
 * Fond et couleur du thème de Coloration Code : sa règle .hljs perd face à .spip_code de l'espace
 * privé ; lus une fois sur un échantillon et posés sur le bloc.
 */
let theme;
function styleDuTheme() {
	if (theme === undefined) {
		const echantillon = document.createElement('code');
		echantillon.className = 'hljs';
		document.body.append(echantillon);
		const { backgroundColor, color } = getComputedStyle(echantillon);
		echantillon.remove();
		theme = backgroundColor && color ? `background-color: ${backgroundColor}; color: ${color}` : '';
	}
	return theme;
}

/** Les nœuds ProseMirror sont immuables : un bloc inchangé garde ses plages. */
const cache = new WeakMap();

function decorations(doc, hljs, demander) {
	const decos = [];
	doc.descendants((node, pos) => {
		if (node.type.name !== 'codeBlock') return node.isBlock;
		const langage = langageDu(node);
		const fin = pos + node.nodeSize;
		if (!langage || !hljs.getLanguage(langage)) {
			// étiquette comme Coloration Code sur le site : plaintext sans langage
			decos.push(Decoration.node(pos, fin, { 'data-language': langage ?? 'plaintext' }));
			if (langage) demander(langage);
			return false;
		}
		let p = cache.get(node);
		if (!p) {
			p = plages(hljs.highlight(node.textContent, { language: langage, ignoreIllegals: true }).value);
			cache.set(node, p);
		}
		decos.push(Decoration.node(pos, fin, { class: 'hljs', 'data-language': langage, style: styleDuTheme() }));
		for (const [de, a, classes] of p) decos.push(Decoration.inline(pos + 1 + de, pos + 1 + a, { class: classes }));
		return false;
	});
	return DecorationSet.create(doc, decos);
}

/** Plugins du bloc de code : aucun sans Coloration Code actif ni highlight.js dans la page. */
export function coloration() {
	const hljs = globalThis.hljs;
	if (!config().coloration_code || typeof hljs?.highlight !== 'function') return [];
	let vue = null;
	const demandes = new Set();
	// grammaire chargée : recoloration ; demandée une seule fois par langage
	const demander = (langage) => {
		if (demandes.has(langage)) return;
		demandes.add(langage);
		charger(langage).then((ok) => {
			if (ok && vue && !vue.isDestroyed) vue.dispatch(vue.state.tr.setMeta(cle, true));
		});
	};
	return [new Plugin({
		key: cle,
		state: {
			init: (_, { doc }) => decorations(doc, hljs, demander),
			apply: (tr, set) => (tr.docChanged || tr.getMeta(cle) ? decorations(tr.doc, hljs, demander) : set),
		},
		view(v) {
			vue = v;
			return {};
		},
		props: { decorations: (state) => cle.getState(state) },
	})];
}
