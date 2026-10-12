import { Extension, getSchema, Mark, markInputRule, mergeAttributes, Node, nodeInputRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { schemaJSON } from './editor/content.js';
import { coreExtensions } from './editor/extensions.js';
import { reglesSpip } from './editor/regles.js';
import { canon, parse, serialize } from './spip/index.js';
import { boutonOutil, menuOutil } from './ui/boutons.js';
import { Popover } from './ui/popover.js';
import { Toolbar } from './ui/Toolbar.js';

/**
 * API des plugins tiers (spec 07 §2), exportée par le bundle et posée sur window.tiptapSpip : un
 * plugin enregistre ses extensions et ses composants de barre avant le lancement des éditeurs, et
 * prend Tiptap et ProseMirror ici (core) pour ne pas en embarquer une seconde copie.
 */

/** Extensions enregistrées : nom → { extension, toolbars } (toolbars null : toutes les barres). */
const enregistrees = new Map();

/**
 * Enregistre une extension Tiptap (avec spipTokenizer, parseSpip, renderSpip pour la source SPIP) :
 * ajoutée aux éditeurs lancés ensuite, ou à ceux de ces barres seulement. Un second
 * enregistrement du même nom remplace le premier, avec un avertissement.
 *
 * @param {import('@tiptap/core').AnyExtension} extension
 * @param {{ toolbars?: string[] }} options  toolbars : noms des barres (edition, forum, minimale…)
 */
export function registerExtension(extension, { toolbars = null } = {}) {
	if (!extension?.name || !['node', 'mark', 'extension'].includes(extension.type)) {
		throw new TypeError('tiptap_spip : registerExtension attend une extension Tiptap (Node, Mark ou Extension de window.tiptapSpip.core)');
	}
	if (enregistrees.has(extension.name)) console.warn(`tiptap_spip : l'extension « ${extension.name} » déjà enregistrée est remplacée`);
	enregistrees.set(extension.name, { extension, toolbars: toolbars ? [...toolbars] : null });
}

/** Extensions tierces d'un éditeur selon sa barre. */
export const extensionsTierces = (barre) => [...enregistrees.values()]
	.filter((e) => !e.toolbars || e.toolbars.includes(barre))
	.map((e) => e.extension);

/** Oublie les extensions enregistrées (tests). */
export const oublierExtensions = () => enregistrees.clear();

/**
 * Enregistre un composant de barre : fabrique `(ctx, options) => { element, cible?, maj?, source? }`,
 * ctx = { editor, ui, instance } (cf. src/ui/Toolbar.js). Son nom se place dans une barre par le
 * pipeline tiptap_spip_toolbars.
 */
export const registerToolbarComponent = (nom, fabrique) => Toolbar.registerComponent(nom, fabrique);

/** Tiptap et ProseMirror du bundle. */
export const core = Object.freeze({ Node, Mark, Extension, mergeAttributes, nodeInputRule, markInputRule, Plugin, PluginKey });

/** Briques d'interface : boutons et menus de barre, popovers (mêmes styles et accessibilité). */
export const ui = Object.freeze({ boutonOutil, menuOutil, Popover });

/**
 * Harnais d'aller-retour (spec 07 §4) pour les cas de corpus d'une extension tierce :
 *   identique : la source non modifiée est restituée à l'identique (sérialisation conservatrice) ;
 *   stable : la forme canonique se relit en le même contenu ;
 *   valide : le contenu lu est accepté par le schéma de l'éditeur (cœur + extensions).
 *
 * @param {string} source
 * @param {import('@tiptap/core').AnyExtension[]} extensions  extensions tierces
 * @returns {{ json: object, canonique: string, identique: boolean, stable: boolean, valide: boolean }}
 */
export function allerRetour(source, extensions = []) {
	const toutes = coreExtensions({ tierces: extensions });
	const regles = reglesSpip(toutes);
	const json = parse(source, { regles });
	const canonique = serialize(json, { conservative: false, regles });
	let valide = true;
	try {
		schemaJSON(json, getSchema(toutes));
	} catch {
		valide = false;
	}
	return {
		json,
		canonique,
		identique: serialize(json, { regles }) === source,
		stable: canon(parse(canonique, { regles }).content) === canon(json.content),
		valide,
	};
}
