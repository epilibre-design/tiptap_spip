import { Editor, getSchema } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { schemaJSON } from '../editor/content.js';
import { langueAffichee, partieExtensions } from '../editor/extensions.js';
import { partieAffichee } from '../editor/texte.js';
import { parseIdiome } from '../spip/multi.js';
import { RE_CODE_LANGUE } from '../spip/regex.js';
import { multiSeRelit } from '../spip/valider.js';
import { label } from './labels.js';
import { openLinkPopover } from './LinkPopover.js';
import { openGlossaryPopover } from './MarkPopover.js';
import { lireSelection, Popover, suivrePosition } from './popover.js';

/** Langue proposée pour une nouvelle partie : celle qu'affichent les multis, sinon celle de l'interface. */
const langueParDefaut = (editor) => (langueAffichee(editor.state) || globalThis.document?.documentElement?.lang || '').replace('-', '_');

/** Codes saisis : valides, et une seule partie sans langue. */
const languesValides = (langues) => langues.every((l) => l === null || RE_CODE_LANGUE.test(l)) && langues.filter((l) => l === null).length <= 1;

/**
 * Multi (spec 05 §5) : selon la sélection,
 * - multi en ligne sélectionné (ou à `pos`) : ses parties, chacune dans un sous-éditeur ;
 * - curseur dans un multi bloc : les langues de ses parties ;
 * - curseur dans un paragraphe vide : nouveau multi bloc, une partie dans la langue affichée ;
 * - sinon : nouveau multi en ligne ; un texte sélectionné dans un même bloc devient sa première partie.
 *
 * @param {{ editor, wrapper, services?, titles?, previews? }} contexte
 * @param {?number} [pos]
 */
export function openMultiPopover(contexte, pos = null) {
	const { editor } = contexte;
	lireSelection(editor);
	if (pos !== null) editor.commands.setNodeSelection(pos);
	const { selection } = editor.state;
	if (selection instanceof NodeSelection && selection.node.type.name === 'spipMultiInline') return multiEnLigne(contexte, selection);
	const { $from } = selection;
	for (let d = $from.depth; d > 0; d--) {
		if ($from.node(d).type.name === 'spipMultiBlock') return languesDuBloc(contexte, $from.before(d));
	}
	if (selection.empty && $from.depth === 1 && $from.parent.type.name === 'paragraph' && $from.parent.content.size === 0) {
		const { schema } = editor;
		const bloc = schema.nodes.spipMultiBlock.create(null, schema.nodes.spipLangBlock.create({ lang: langueParDefaut(editor) || null }, schema.nodes.paragraph.create()));
		const debut = $from.before();
		editor.chain().focus().command(({ tr }) => {
			tr.replaceWith(debut, $from.after(), bloc);
			return true;
		}).setTextSelection(debut + 3).run();
		return languesDuBloc(contexte, debut);
	}
	return multiEnLigne(contexte, null);
}

/** Popover d'un multi en ligne : une ligne par partie (langue, sous-éditeur, retirer). */
function multiEnLigne(contexte, existant) {
	const { editor, wrapper } = contexte;
	const { selection } = editor.state;
	const { $from, $to } = selection;
	// insertion : texte sélectionné dans un même bloc, première partie ; plage suivie
	const morceau = !existant && !selection.empty && $from.sameParent($to) && $from.parent.isTextblock
		? $from.parent.slice($from.parentOffset, $to.parentOffset).content.toJSON()
		: null;
	const suivi = suivrePosition(editor, existant ? existant.from : morceau ? selection.from : selection.to);
	const fin = existant ? null : suivrePosition(editor, selection.to);
	const lignes = [];

	const popover = new Popover({
		editor, wrapper, titre: label('multi'), className: 'tts-popover--multi',
		onSubmit: () => appliquer(),
		onClose: () => {
			suivi.fin();
			fin?.fin();
			lignes.forEach((l) => l.sous.destroy());
		},
	});
	const liste = document.createElement('div');
	liste.className = 'tts-multi__parties';
	popover.actions.before(liste);

	const schema = getSchema(partieExtensions());

	const ajouter = (lang, origine) => {
		const ligne = document.createElement('div');
		ligne.className = 'tts-multi__partie';
		const langue = document.createElement('input');
		langue.name = 'langue';
		langue.size = 6;
		langue.value = lang ?? '';
		langue.setAttribute('aria-label', label('langue'));
		const zone = document.createElement('div');
		zone.className = 'tts-multi__texte';
		const retirer = document.createElement('button');
		retirer.type = 'button';
		retirer.name = 'retirer_langue';
		retirer.textContent = label('multi_retirer_langue');
		ligne.append(langue, zone, retirer);
		liste.append(ligne);
		const content = schemaJSON({ type: 'doc', content: [{ type: 'paragraph', content: origine?.length ? origine : undefined }] }, schema);
		// interface de ce sous-éditeur : lien et glossaire en popovers enfants
		const l = { langue, sous: null, origine, modifie: false, ligne };
		const sousUi = {
			previews: contexte.previews ?? null,
			titles: contexte.titles ?? null,
			openLink: () => openLinkPopover({ ...contexte, editor: l.sous, parent: popover }),
			openGlossary: () => openGlossaryPopover({ ...contexte, editor: l.sous, parent: popover }),
		};
		const sous = new Editor({
			element: zone,
			extensions: partieExtensions({ ui: sousUi }),
			content,
			editorProps: { attributes: { class: 'tts-prosemirror', 'aria-label': label('multi_texte') } },
		});
		l.sous = sous;
		sous.on('update', () => {
			l.modifie = true;
		});
		retirer.addEventListener('click', () => {
			sous.destroy();
			ligne.remove();
			lignes.splice(lignes.indexOf(l), 1);
		});
		lignes.push(l);
		return l;
	};

	if (existant) {
		for (const p of existant.node.attrs.parts ?? []) ajouter(p.lang, p.content);
	} else {
		ajouter(langueParDefaut(editor), morceau);
		ajouter('', null);
	}
	const appliquer = () => {
		const parts = lignes
			.map((l) => ({
				lang: l.langue.value.trim() || null,
				content: l.modifie || !l.origine ? l.sous.getJSON().content?.[0]?.content ?? [] : l.origine,
			}))
			.filter((p) => p.lang || p.content.length);
		if (!parts.length) {
			popover.error(label('multi_vide'));
			return false;
		}
		if (!languesValides(parts.map((p) => p.lang)) || !multiSeRelit(parts)) {
			popover.error(label('multi_invalide'));
			return false;
		}
		const p = suivi.pos();
		if (existant) {
			const node = p === null ? null : editor.state.doc.nodeAt(p);
			if (node?.type.name !== 'spipMultiInline') return true;
			editor.chain().focus().command(({ tr }) => {
				tr.setNodeMarkup(p, undefined, { ...node.attrs, parts });
				return true;
			}).run();
		} else {
			const to = fin.pos() ?? editor.state.selection.to;
			editor.chain().focus().insertContentAt({ from: Math.min(p ?? to, to), to }, { type: 'spipMultiInline', attrs: { parts } }).run();
		}
		return true;
	};

	popover.button(label('appliquer'), null, { submit: true, name: 'appliquer' });
	popover.button(label('multi_ajouter'), () => {
		ajouter('', null).langue.focus();
		return false;
	}, { name: 'ajouter_langue' });
	if (existant) {
		// le multi retiré laisse le texte de la langue affichée
		popover.button(label('multi_supprimer'), () => {
			const p = suivi.pos();
			const node = p === null ? null : editor.state.doc.nodeAt(p);
			if (node?.type.name !== 'spipMultiInline') return;
			const garde = partieAffichee(node.attrs.parts ?? [], langueAffichee(editor.state) || undefined)?.content ?? [];
			editor.chain().focus().insertContentAt({ from: p, to: p + node.nodeSize }, garde).run();
		}, { name: 'supprimer' });
	}
	popover.button(label('annuler'), () => {}, { name: 'annuler' });
	popover.open(lignes[0]?.langue);
	return popover;
}

/** Popover des langues d'un multi bloc : code de chaque partie, ajout, retrait, suppression du multi. */
function languesDuBloc({ editor, wrapper }, pos) {
	const multi = editor.state.doc.nodeAt(pos);
	const suivi = suivrePosition(editor, pos);
	const popover = new Popover({
		editor, wrapper, titre: label('multi_langues'), className: 'tts-popover--multi-langues',
		onSubmit: () => appliquer(),
		onClose: () => suivi.fin(),
	});
	const lignes = [];
	const liste = document.createElement('div');
	liste.className = 'tts-multi__parties';
	popover.actions.before(liste);
	const ajouter = (lang, partie) => {
		const ligne = document.createElement('div');
		ligne.className = 'tts-multi__partie';
		const langue = document.createElement('input');
		langue.name = 'langue';
		langue.size = 6;
		langue.value = lang ?? '';
		langue.setAttribute('aria-label', label('langue'));
		const retirer = document.createElement('button');
		retirer.type = 'button';
		retirer.name = 'retirer_langue';
		retirer.textContent = label('multi_retirer_langue');
		const l = { langue, partie };
		retirer.addEventListener('click', () => {
			ligne.remove();
			lignes.splice(lignes.indexOf(l), 1);
		});
		ligne.append(langue, retirer);
		liste.append(ligne);
		lignes.push(l);
		return l;
	};
	multi.forEach((partie) => ajouter(partie.attrs.lang, partie));

	const courant = () => {
		const p = suivi.pos();
		const node = p === null ? null : editor.state.doc.nodeAt(p);
		return node?.type.name === 'spipMultiBlock' ? { p, node } : null;
	};

	const appliquer = () => {
		const langues = lignes.map((l) => l.langue.value.trim() || null);
		if (!lignes.length) {
			popover.error(label('multi_vide'));
			return false;
		}
		if (!languesValides(langues)) {
			popover.error(label('multi_invalide'));
			return false;
		}
		const c = courant();
		if (!c) return true;
		const { schema } = editor;
		const parties = lignes.map((l, i) => (l.partie
			? schema.nodes.spipLangBlock.create({ lang: langues[i] }, l.partie.content)
			: schema.nodes.spipLangBlock.create({ lang: langues[i] }, schema.nodes.paragraph.create())));
		// le curseur garde sa place dans le multi (le multi entier est remplacé)
		const relatif = editor.state.selection.from - c.p;
		const nouveau = schema.nodes.spipMultiBlock.create(c.node.attrs, parties);
		editor.chain().focus().command(({ tr }) => {
			tr.replaceWith(c.p, c.p + c.node.nodeSize, nouveau);
			const dedans = Math.max(c.p + 1, Math.min(c.p + relatif, c.p + nouveau.nodeSize - 1));
			tr.setSelection(TextSelection.near(tr.doc.resolve(dedans)));
			return true;
		}).run();
		return true;
	};

	popover.button(label('appliquer'), null, { submit: true, name: 'appliquer' });
	popover.button(label('multi_ajouter'), () => {
		ajouter('', null).langue.focus();
		return false;
	}, { name: 'ajouter_langue' });
	// le multi retiré laisse les paragraphes de la langue affichée
	popover.button(label('multi_supprimer'), () => {
		const c = courant();
		if (!c) return;
		const parties = [];
		c.node.forEach((partie) => parties.push({ lang: partie.attrs.lang, partie }));
		const garde = partieAffichee(parties, langueAffichee(editor.state) || undefined).partie;
		editor.chain().focus().command(({ tr }) => {
			tr.replaceWith(c.p, c.p + c.node.nodeSize, garde.content);
			return true;
		}).run();
	}, { name: 'supprimer' });
	popover.button(label('annuler'), () => {}, { name: 'annuler' });
	popover.open(lignes[0]?.langue);
	return popover;
}

/** Idiome (spec 05 §5) : raccourci <:module:cle:> modifié tel quel, validé par le parseur ; suppression. */
export function openIdiomePopover({ editor, wrapper }, pos = null) {
	if (pos !== null) editor.commands.setNodeSelection(pos);
	const { selection } = editor.state;
	if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'spipIdiome') return null;
	const suivi = suivrePosition(editor, selection.from);
	const { module, cle } = selection.node.attrs;
	const popover = new Popover({
		editor, wrapper, titre: label('idiome'), className: 'tts-popover--idiome',
		onSubmit: () => appliquer(),
		onClose: () => suivi.fin(),
	});
	const raccourci = popover.input(label('idiome_raccourci'), { value: `<:${module ? `${module}:` : ''}${cle}:>`, name: 'raccourci' });
	const idiome = () => {
		const p = suivi.pos();
		return p !== null && editor.state.doc.nodeAt(p)?.type.name === 'spipIdiome' ? p : null;
	};
	const appliquer = () => {
		const attrs = parseIdiome(raccourci.value.trim());
		if (!attrs) {
			popover.error(label('idiome_invalide'));
			return false;
		}
		const p = idiome();
		if (p !== null) {
			editor.chain().focus().command(({ tr }) => {
				tr.setNodeMarkup(p, undefined, { module: attrs.module ?? null, cle: attrs.cle });
				return true;
			}).run();
		}
		return true;
	};
	popover.button(label('appliquer'), null, { submit: true, name: 'appliquer' });
	popover.button(label('idiome_retirer'), () => {
		const p = idiome();
		if (p !== null) editor.chain().focus().deleteRange({ from: p, to: p + 1 }).run();
	}, { name: 'retirer' });
	popover.button(label('annuler'), () => {}, { name: 'annuler' });
	popover.open(raccourci);
	return popover;
}
