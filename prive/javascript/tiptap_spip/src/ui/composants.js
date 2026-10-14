import { config } from '../config.js';
import { ALIGNEMENTS, alignementActif, selectionAlignee } from '../editor/edition.js';
import { langueAffichee, languesDuDocument } from '../editor/extensions.js';
import { boutonOutil, habiller, menuOutil } from './boutons.js';
import { ICONES } from './icones.js';
import { label } from './labels.js';
import { Toolbar } from './Toolbar.js';

/**
 * Composants de la barre d'outils du cœur (spec 06 §2), enregistrés dans le registre de Toolbar.
 * ctx : { editor, ui, instance } ; instance : { mode(), toggleMode(), pleinEcran(), togglePleinEcran(),
 * langue() } (langue de l'objet édité, pour les guillemets).
 */

/**
 * Commande Tiptap lancée sur l'éditeur, focus rendu au texte tout de suite (la commande focus de
 * Tiptap attend l'image suivante : une touche pressée juste après agirait encore sur la barre).
 */
const lancer = (editor, commande) => {
	const fait = commande(editor.chain().focus()).run();
	editor.view.focus();
	return fait;
};

/** Bouton à deux états lié à une commande : actif et possible selon la sélection. */
const bascule = ({ nom, cle = `outil_${nom}`, raccourci, commande, actif, possible }) => ({ editor }) => {
	const element = boutonOutil({ nom, libelle: label(cle), raccourci, bascule: true, action: () => lancer(editor, commande) });
	return {
		element,
		maj() {
			element.setAttribute('aria-pressed', String(actif(editor)));
			element.disabled = !possible(editor);
		},
	};
};

/** Bascule d'une mark. */
const mark = (nom, type, raccourci, cle) => bascule({
	nom,
	cle,
	raccourci,
	commande: (c) => c.toggleMark(type),
	actif: (editor) => editor.isActive(type),
	possible: (editor) => editor.can().toggleMark(type),
});

/** Bouton qui ouvre un popover de l'interface. */
const popover = (nom, action, { cle = nom, raccourci, possible } = {}) => ({ editor, ui }) => {
	const element = boutonOutil({ nom, libelle: label(cle), raccourci, action: () => ui[action](null) });
	return { element, maj: possible ? () => { element.disabled = !possible(editor); } : undefined };
};

/** Bouton à commande simple (annuler, rétablir). */
const commande = (nom, cmd, raccourci) => ({ editor }) => {
	const element = boutonOutil({ nom, libelle: label(`outil_${nom}`), raccourci, action: () => lancer(editor, (c) => c[cmd]()) });
	return { element, maj: () => { element.disabled = !editor.can()[cmd](); } };
};

/** Élément de menu lié à une commande. */
const element = (editor, cle, cmd, extra = {}) => ({
	libelle: label(cle),
	action: () => lancer(editor, cmd),
	possible: () => cmd(editor.can()),
	...extra,
});

/** Niveaux de titre du schéma (extension heading). */
const niveauxDuSchema = (editor) => editor.extensionManager.extensions.find((e) => e.name === 'heading')?.options.levels ?? [];

/** Guillemets du porte-plume (barre_outils/edition.php) selon la langue : [doubles, simples]. */
const GUILLEMETS = [
	{ langues: ['fr', 'eo', 'cpf', 'ar', 'es'], paires: [['«', '»'], ['“', '”']] },
	{ langues: ['bg', 'de', 'pl', 'hr', 'src'], paires: [['„', '“'], ['‚', '‘']] },
];
const GUILLEMETS_AUTRES = [['“', '”'], ['‘', '’']];
export const guillemetsDe = (langue) => {
	const code = (langue ?? '').toLowerCase().split(/[_-]/)[0];
	return GUILLEMETS.find((g) => g.langues.includes(code))?.paires ?? GUILLEMETS_AUTRES;
};

/** Caractères du porte-plume (barre_outils/edition.php). */
const CARACTERES = ['À', 'É', 'È', 'æ', 'Æ', 'œ', 'Œ', 'Ç'];

const COMPOSANTS = {
	annuler: commande('annuler', 'undo', 'Mod-z'),
	retablir: commande('retablir', 'redo', 'Mod-Shift-z'),

	// niveaux : ceux de la barre, sinon ceux de la configuration (page configurer_tiptap_spip)
	titre: ({ editor }, { niveaux = config().niveaux ?? [2, 3, 4] }) => {
		const schema = niveauxDuSchema(editor);
		const proposes = niveaux.filter((n) => schema.includes(n));
		const menu = menuOutil({
			nom: 'titre',
			libelle: label('outil_titre'),
			elements: () => [
				element(editor, 'outil_paragraphe', (c) => c.setParagraph(), { coche: 'radio', icone: 'paragraphe', actif: () => editor.isActive('paragraph') }),
				...proposes.map((level) => ({
					...element(editor, 'outil_titre', (c) => c.setHeading({ level }), { coche: 'radio', actif: () => editor.isActive('heading', { level }) }),
					libelle: level === 2 ? label('outil_intertitre') : label('outil_titre_niveau').replace('@niveau@', level),
				})),
			],
		});
		return { ...menu, maj: () => menu.cible.classList.toggle('tts-outil--actif', editor.isActive('heading')) };
	},

	liste: ({ editor }) => menuOutil({
		nom: 'liste',
		libelle: label('outil_liste'),
		elements: () => [
			element(editor, 'outil_liste_puces', (c) => c.toggleBulletList(), { coche: 'case', icone: 'liste', actif: () => editor.isActive('bulletList') }),
			element(editor, 'outil_liste_numerotee', (c) => c.toggleOrderedList(), { coche: 'case', icone: 'listeNumerotee', actif: () => editor.isActive('orderedList') }),
			{ separateur: true },
			element(editor, 'outil_indenter', (c) => c.sinkListItem('listItem'), { icone: 'indenter' }),
			element(editor, 'outil_desindenter', (c) => c.liftListItem('listItem'), { icone: 'desindenter' }),
		],
	}),

	citation: bascule({
		nom: 'citation',
		commande: (c) => c.toggleBlockquote(),
		actif: (editor) => editor.isActive('blockquote'),
		possible: (editor) => editor.can().toggleBlockquote(),
	}),
	poesie: bascule({
		nom: 'poesie',
		commande: (c) => c.togglePoesie(),
		actif: (editor) => editor.isActive('spipPoesie'),
		possible: (editor) => editor.can().togglePoesie(),
	}),
	cadre: bascule({
		nom: 'cadre',
		commande: (c) => c.toggleCodeBlock(),
		actif: (editor) => editor.isActive('codeBlock'),
		possible: (editor) => editor.can().toggleCodeBlock(),
	}),

	gras: mark('gras', 'bold', 'Mod-b', 'gras'),
	italique: mark('italique', 'italic', 'Mod-i', 'italique'),
	barre: mark('barre', 'strike', 'Mod-Shift-s'),
	exposant: mark('exposant', 'superscript', 'Mod-.'),
	indice: mark('indice', 'subscript', 'Mod-,'),
	code: mark('code', 'code', 'Mod-e'),

	lien: popover('lien', 'openLink', { raccourci: 'Mod-k' }),
	note: popover('note', 'editNote', { raccourci: 'Mod-Alt-n' }),
	// pas de [ ] < > dans un terme de glossaire (spec 05 §2) : désactivé sur une telle sélection
	glossaire: popover('glossaire', 'openGlossary', {
		raccourci: 'Mod-Alt-g',
		possible: (editor) => {
			const { from, to } = editor.state.selection;
			return !/[[\]<>]/.test(editor.state.doc.textBetween(from, to, ' '));
		},
	}),
	abbr: popover('abbr', 'openAbbr'),
	// avec le catalogue du plugin Insérer modèles : menu catalogue ou saisie brute (spec 05 §3)
	modele: (ctx) => (ctx.ui.catalogue
		? menuOutil({
			nom: 'modele',
			libelle: label('modele'),
			elements: () => [
				{ libelle: label('modele_catalogue'), action: () => ctx.ui.openCatalogue() },
				{ libelle: label('modele_saisir'), action: () => ctx.ui.editModel(null) },
			],
		})
		: popover('modele', 'editModel', { raccourci: 'Mod-Alt-m' })(ctx)),
	multi: popover('multi', 'editMulti'),

	// langue affichée par les multis (spec 05 §5) : présente quand le texte a des multis. Bouton
	// « [fr] ⌄ » qui déplie la liste des langues du texte.
	langues: ({ editor }) => {
		let doc = null;
		let options = [];
		let etiquette = null;
		const menu = menuOutil({
			nom: 'langues',
			libelle: label('langue_affichee'),
			elements: () => options.map((l) => ({
				libelle: l,
				coche: 'radio',
				actif: () => langueAffichee(editor.state) === l,
				action: () => lancer(editor, (c) => c.setLangueAffichee(l)),
			})),
		});
		const bouton = menu.cible;
		bouton.classList.add('tts-outil--texte');
		return {
			...menu,
			maj() {
				const affichee = langueAffichee(editor.state);
				if (editor.state.doc !== doc) {
					doc = editor.state.doc;
					const langues = languesDuDocument(doc);
					options = [...new Set([...(affichee ? [affichee] : []), ...langues])];
					menu.element.hidden = langues.length === 0;
					if (menu.element.hidden) menu.fermer();
				}
				if (affichee === etiquette) return;
				etiquette = affichee;
				const libelle = `${label('langue_affichee')} : ${affichee}`;
				bouton.setAttribute('aria-label', libelle);
				bouton.title = libelle;
				const code = document.createElement('span');
				code.textContent = `[${affichee || '…'}]`;
				bouton.replaceChildren(code);
				bouton.insertAdjacentHTML('beforeend', ICONES.chevronBas);
			},
		};
	},

	alignement: ({ editor }) => {
		// sélection mixte (alignementActif undefined) : aucun choix coché
		const menu = menuOutil({
			nom: 'alignement',
			libelle: label('outil_alignement'),
			elements: () => [
				...ALIGNEMENTS.map((a, i) => element(editor, `outil_align_${a}`, (c) => c.setAlignement(a), {
					coche: 'radio',
					icone: ['alignGauche', 'alignCentre', 'alignDroite', 'alignJustifie'][i],
					actif: () => alignementActif(editor.state) === a,
				})),
				element(editor, 'outil_align_aucun', (c) => c.setAlignement(null), {
					coche: 'radio',
					actif: () => alignementActif(editor.state) === null,
					possible: () => selectionAlignee(editor.state),
				}),
			],
		});
		return { ...menu, maj: () => menu.cible.classList.toggle('tts-outil--actif', selectionAlignee(editor.state)) };
	},

	tableau: ({ editor }) => {
		const t = (cle, cmd) => element(editor, `outil_tableau_${cle}`, cmd);
		return menuOutil({
			nom: 'tableau',
			libelle: label('outil_tableau'),
			elements: () => [
				{ ...t('inserer', (c) => c.insererTableau()), possible: () => !editor.isActive('table') && editor.can().insererTableau() },
				t('en_tete', (c) => c.toggleHeaderRow()),
				{ separateur: true },
				t('ligne_avant', (c) => c.addRowBefore()),
				t('ligne_apres', (c) => c.addRowAfter()),
				t('colonne_avant', (c) => c.addColumnBefore()),
				t('colonne_apres', (c) => c.addColumnAfter()),
				t('supprimer_ligne', (c) => c.deleteRow()),
				t('supprimer_colonne', (c) => c.deleteColumn()),
				{ separateur: true },
				t('fusionner', (c) => c.fusionnerCellules()),
				t('scinder', (c) => c.splitCell()),
				t('supprimer', (c) => c.deleteTable()),
			],
		});
	},

	guillemets: ({ editor, instance }) => menuOutil({
		nom: 'guillemets',
		libelle: label('outil_guillemets'),
		elements: () => guillemetsDe(instance?.langue?.()).map(([o, f], i) => ({
			libelle: `${o}…${f}`,
			ariaLabel: `${label(i === 0 ? 'outil_guillemets' : 'outil_guillemets_simples')} ${o}…${f}`,
			action: () => lancer(editor, (c) => c.entourer(o, f)),
			possible: () => editor.can().entourer(o, f),
		})),
	}),

	caracteres: ({ editor }) => menuOutil({
		nom: 'caracteres',
		libelle: label('outil_caracteres'),
		elements: () => [
			...CARACTERES.map((car) => ({ libelle: car, action: () => lancer(editor, (c) => c.insertContent(car)) })),
			{ separateur: true },
			element(editor, 'outil_majuscules', (c) => c.changerCasse('majuscules')),
			element(editor, 'outil_minuscules', (c) => c.changerCasse('minuscules')),
		],
	}),

	source: ({ instance }) => {
		const element = boutonOutil({ nom: 'source', libelle: label('mode_source'), raccourci: 'Mod-Shift-e', bascule: true, action: () => instance.toggleMode() });
		return {
			element,
			source: true,
			maj: () => {
				element.setAttribute('aria-pressed', String(instance.mode() === 'source'));
			},
		};
	},

	pleinEcran: ({ instance }) => {
		const element = boutonOutil({ nom: 'pleinEcran', libelle: label('outil_plein_ecran'), raccourci: 'F11', bascule: true, action: () => instance.togglePleinEcran() });
		let etat = null;
		return {
			element,
			source: true,
			maj: () => {
				const plein = instance.pleinEcran();
				if (plein === etat) return;
				etat = plein;
				element.setAttribute('aria-pressed', String(plein));
				habiller(element, plein
					? { icone: 'pleinEcranSortir', libelle: label('outil_plein_ecran_sortir'), raccourci: 'Esc' }
					: { icone: 'pleinEcran', libelle: label('outil_plein_ecran'), raccourci: 'F11' });
			},
		};
	},
};

for (const [nom, fabrique] of Object.entries(COMPOSANTS)) Toolbar.registerComponent(nom, fabrique);
