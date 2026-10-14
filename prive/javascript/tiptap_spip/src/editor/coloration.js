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
 * Alias → fichier de grammaire de Coloration Code (assets/highlightjs/languages/), repris de sa
 * table (coloration_code__on_demand.js, version 1.2.1) pour résoudre les mêmes noms que le site.
 */
const FICHIERS = {
	as: 'angelscript', apacheconf: 'apache', osascript: 'applescript', ino: 'arduino', arm: 'armasm',
	adoc: 'asciidoc', mawk: 'awk', nawk: 'awk', gawk: 'awk', 'x++': 'axapta', sh: 'bash',
	bf: 'brainfuck', capnp: 'capnproto', html: 'xml', xhtml: 'xml', rss: 'xml', atom: 'xml',
	xjb: 'xml', xsd: 'xml', xsl: 'xml', plist: 'xml', svg: 'xml', clj: 'clojure', 'cmake.in': 'cmake',
	h: 'c', coffee: 'coffeescript', cson: 'coffeescript', iced: 'coffeescript', cls: 'cos',
	hpp: 'cpp', cc: 'cpp', hh: 'cpp', 'c++': 'cpp', 'h++': 'cpp', cxx: 'cpp', hxx: 'cpp',
	crm: 'crmsh', pcmk: 'crmsh', cr: 'crystal', cs: 'csharp', dpr: 'delphi', dfm: 'delphi',
	pas: 'delphi', pascal: 'delphi', patch: 'diff', jinja: 'django', zone: 'dns', bind: 'dns',
	docker: 'dockerfile', bat: 'dos', cmd: 'dos', dst: 'dust', erl: 'erlang', xls: 'excel',
	xlsx: 'excel', f90: 'fortran', f95: 'fortran', fs: 'fsharp', gms: 'gams', gss: 'gauss',
	nc: 'gcode', gololang: 'golo', golang: 'go', hbs: 'handlebars', 'html.hbs': 'handlebars',
	'html.handlebars': 'handlebars', hs: 'haskell', hx: 'haxe', https: 'http', hylang: 'hy',
	i7: 'inform7', toml: 'ini', jsp: 'java', js: 'javascript', jsx: 'javascript', kt: 'kotlin',
	lassoscript: 'lasso', tex: 'latex', ls: 'livescript', mk: 'makefile', mak: 'makefile',
	make: 'makefile', md: 'markdown', mkdown: 'markdown', mkd: 'markdown', mma: 'mathematica',
	wl: 'mathematica', moon: 'moonscript', nginxconf: 'nginx', nimrod: 'nim', mm: 'objectivec',
	objc: 'objectivec', 'obj-c': 'objectivec', 'obj-c++': 'objectivec', 'objective-c++': 'objectivec',
	ml: 'sml', scad: 'openscad', pl: 'perl', pm: 'perl', 'pf.conf': 'pf', postgres: 'pgsql',
	postgresql: 'pgsql', txt: 'plaintext', text: 'plaintext', ps: 'powershell', ps1: 'powershell',
	pp: 'puppet', py: 'python', gyp: 'python', re: 'reasonml', graph: 'roboconf',
	instances: 'roboconf', rb: 'ruby', gemspec: 'ruby', podspec: 'ruby', thor: 'ruby', irb: 'ruby',
	rs: 'rust', sci: 'scilab', console: 'shell', st: 'smalltalk', stanfuncs: 'stan', styl: 'stylus',
	tk: 'tcl', craftcms: 'twig', ts: 'typescript', tsx: 'typescript', vb: 'vbnet', vbs: 'vbscript',
	v: 'verilog', tao: 'xl', xpath: 'xquery', xq: 'xquery', yml: 'yaml', zep: 'zephir',
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
		// thème et étiquette comme Coloration Code sur le site : plaintext sans langage
		decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'hljs', 'data-language': langage ?? 'plaintext', style: styleDuTheme() }));
		if (!langage) return false;
		if (!hljs.getLanguage(langage)) {
			demander(langage);
			return false;
		}
		let p = cache.get(node);
		if (!p) {
			p = plages(hljs.highlight(node.textContent, { language: langage, ignoreIllegals: true }).value);
			cache.set(node, p);
		}
		for (const [de, a, classes] of p) decos.push(Decoration.inline(pos + 1 + de, pos + 1 + a, { class: classes }));
		return false;
	});
	return DecorationSet.create(doc, decos);
}

/** Coloration Code actif et son highlight.js dans la page. */
export const colorationActive = () => Boolean(config().coloration_code) && typeof globalThis.hljs?.highlight === 'function';

/** Plugins du bloc de code : aucun sans colorationActive(). */
export function coloration() {
	if (!colorationActive()) return [];
	const hljs = globalThis.hljs;
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
