import { Extension } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import { PluginKey } from '@tiptap/pm/state';
import { exitSuggestion, Suggestion } from '@tiptap/suggestion';
import { ListeSuggestions } from './ListeSuggestions.js';
import { trouverSuggestion } from './match.js';
import { contexteSuggestions } from './sessions.js';

const avertis = new Set();
const exclus = new Set(['codeBlock', 'spipCadre', 'spipHtml', 'spipMath', 'spipMarkdown', 'spipRaw', 'spipRawInline']);
export const oublierDiagnosticsSuggestions = () => avertis.clear();

/** Arbitrage après composition des extensions de cet éditeur ; seul le diagnostic est global. */
export function retenirFournisseurs(extensions, { duCoeur = new Set() } = {}) {
	const retenus = new Map();
	for (const e of extensions) {
		const char = e.config.tiptapSpipSuggestion?.char;
		if (!char) continue;
		if (!retenus.has(char) || (duCoeur.has(e) && !duCoeur.has(retenus.get(char)))) retenus.set(char, e);
	}
	return extensions.filter((e) => {
		const char = e.config.tiptapSpipSuggestion?.char;
		if (!char || retenus.get(char) === e) return true;
		const garde = retenus.get(char);
		const cle = JSON.stringify([char, garde.name, e.name]);
		if (!avertis.has(cle)) {
			avertis.add(cle);
			console.warn(`tiptap_spip : suggestions « ${char} » : ${garde.name} conservé, ${e.name} ignoré`);
		}
		return false;
	});
}

function autorise(editor, state, range) {
	if (!contexteSuggestions(editor) || !editor.isEditable || editor.view.composing
		|| !state.selection.empty || editor.view.dom.closest('[hidden]')) return false;
	const $from = state.doc.resolve(range.from);
	for (let d = 0; d <= $from.depth; d++) if (exclus.has($from.node(d).type.name)) return false;
	let code = $from.marks().some((m) => m.type.name === 'code');
	state.doc.nodesBetween(range.from, range.to, (n) => { code ||= n.marks.some((m) => m.type.name === 'code'); });
	return !code;
}

/** Une extension par fournisseur ; les closures de plugin sont créées pour chaque éditeur. */
export function creerSuggestions(options) {
	const { name, char, items, command, labels, allow, minQueryLength = 0, queryPattern,
		allowedPrefixes = [' '], startOfLine = false, allowSpaces = false } = options;
	if (typeof name !== 'string' || !name || typeof char !== 'string' || [...char].length !== 1
		|| typeof items !== 'function' || typeof command !== 'function'
		|| !Number.isInteger(minQueryLength) || minQueryLength < 0
		|| !['suggestions', 'loading', 'empty', 'error'].every((s) => typeof labels?.[s] === 'string')) {
		throw new TypeError('tiptap_spip : fournisseur de suggestions invalide');
	}
	return Extension.create({
		name, priority: 10000, tiptapSpipSuggestion: { char },
		addProseMirrorPlugins() {
			const editor = this.editor;
			const key = new PluginKey(name);
			let liste = null;
			let courante = null;
			let erreur = false;
			let recherche = 0;
			const effacer = () => { liste?.destroy(); liste = null; courante = null; };
			const sortir = () => {
				if (!editor.isDestroyed && key.getState(editor.state)?.active) exitSuggestion(editor.view, key);
				else effacer();
			};
			const executer = ({ range, item }) => {
				const etat = key.getState(editor.state);
				if (!etat?.active || !courante || !liste?.items.includes(item)
					|| etat.range.from !== range.from || etat.range.to !== range.to || etat.query !== courante.query
					|| !autorise(editor, editor.state, range) || (allow && !allow({ editor, state: editor.state, range }))) return false;
				editor.view.dispatch(closeHistory(editor.state.tr));
				const succes = command({ editor, range, item });
				if (succes !== true) return false;
				editor.view.dispatch(closeHistory(editor.state.tr));
				sortir(); editor.view.focus();
				return true;
			};
			const afficher = (props) => {
				if (!contexteSuggestions(editor) || editor.isDestroyed) return;
				courante = props;
				liste ??= new ListeSuggestions({ editor, labels,
					onChoose: (item) => courante?.command(item), onDismiss: sortir });
				liste.update({ ...props, error: !props.loading && erreur });
			};
			const plugin = Suggestion({
				editor, pluginKey: key, char, allowedPrefixes, startOfLine, allowSpaces, minQueryLength,
				findSuggestionMatch: (config) => trouverSuggestion({ ...config, minQueryLength, queryPattern }),
				allow: ({ state, range }) => autorise(editor, state, range) && (!allow || allow({ editor, state, range })),
				shouldShow: ({ query }) => query.length >= minQueryLength,
				shouldResetDismissed: ({ transaction, allowSpaces: espaces }) => espaces && transaction.docChanged
					&& transaction.steps.some((step) => {
						const fragment = step.slice?.content;
						return fragment && /\s/.test(fragment.textBetween(0, fragment.size, '\n'));
					}),
				items: async ({ query, signal }) => {
					const numero = ++recherche; erreur = false;
					try {
						const resultat = await items({ editor, query, signal });
						if (!Array.isArray(resultat) || resultat.some((i) => typeof i?.id !== 'string' || typeof i?.title !== 'string')) throw new TypeError('Items invalides');
						return resultat;
					} catch {
						if (!signal.aborted && numero === recherche) erreur = true;
						return [];
					}
				},
				command: ({ range, props: item }) => executer({ range, item }),
				render: () => ({
					onStart: afficher, onUpdate: afficher, onExit: effacer,
					onKeyDown: ({ event }) => {
						if (event.isComposing) return false;
						if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); return true; }
						if (event.key === 'Tab') { sortir(); return false; }
						const fait = liste?.keydown(event) ?? false;
						if (fait) { event.preventDefault(); event.stopPropagation(); }
						return fait;
					},
				}),
			});
			// Le handler natif consomme toujours Échap : protéger l'IME avant de l'appeler.
			const clavier = plugin.props.handleKeyDown;
			plugin.props.handleKeyDown = (view, event) => event.isComposing || view.composing ? false : clavier(view, event);
			// setEditable met la vue à jour sans transaction : l'état natif ne s'y recalcule pas.
			const creerVue = plugin.spec.view;
			plugin.spec.view = (view) => {
				const native = creerVue(view);
				return { ...native, update(vue, precedent) {
					if (!editor.isEditable && key.getState(vue.state)?.active) { sortir(); return; }
					return native.update(vue, precedent);
				} };
			};
			return [plugin];
		},
	});
}
