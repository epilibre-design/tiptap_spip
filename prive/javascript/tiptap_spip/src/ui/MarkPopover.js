import { getMarkRange } from '@tiptap/core';
import { serializeGlossary } from '../spip/glossary.js';
import { text } from '../spip/json.js';
import { seRelitInline } from '../spip/valider.js';
import { label } from './labels.js';
import { idUnique, lireSelection, Popover } from './popover.js';

/** Champ texte : '' → null. */
const ouNull = (v) => (v.trim() === '' ? null : v.trim());

/**
 * Popover d'une mark atomique (glossaire, abréviation : spec 05 §2 et §7, 06 §4). Selon la
 * sélection :
 * - curseur ou sélection dans la mark : modification de la mark entière, ou retrait ;
 * - texte sélectionné dans un même bloc : nouvelle mark sur ce texte ;
 * - curseur seul : champ « Terme », texte inséré avec la mark.
 * Une saisie qui ne s'écrirait pas en un raccourci relu à l'identique est refusée.
 *
 * @param {{ editor, wrapper, parent?: Popover }} contexte
 * @param {{ type: string, titre: string, className: string, invalide: string, retirer: string,
 *           champs: { name: string, label: string, attr: string, lire?: (v: string) => any }[],
 *           avecPopover?: (popover: Popover, valeurs: () => { terme: string, attrs: object }) => void }} desc
 *        champs : attributs de la mark ; lire convertit la saisie (ouNull par défaut)
 */
function openMarkPopover({ editor, wrapper, parent }, desc) {
	lireSelection(editor);
	const { state } = editor;
	const { selection } = state;
	const markType = state.schema.marks[desc.type];
	const plage = getMarkRange(selection.$from, markType);
	const existante = editor.isActive(desc.type) && plage ? plage : null;
	const attrs = existante ? editor.getAttributes(desc.type) : {};
	// un nouveau terme ne couvre que du texte d'un même bloc
	const surTexte = () => {
		const { from, to, $from, $to } = selection;
		if (!$from.sameParent($to)) return false;
		let texte = true;
		state.doc.nodesBetween(from, to, (n) => {
			if (n.isInline && !n.isText) texte = false;
		});
		return texte;
	};
	const insertion = !existante && selection.empty;

	const popover = new Popover({ editor, wrapper, parent, titre: desc.titre, className: desc.className, onSubmit: () => appliquer() });
	const terme = insertion ? popover.input(label('terme'), { name: 'terme' }) : null;
	const champs = desc.champs.map((c) => ({ ...c, input: popover.input(c.label, { value: attrs[c.attr] ?? '', name: c.name }) }));

	const valeurs = () => ({
		terme: terme ? terme.value : existante ? state.doc.textBetween(existante.from, existante.to) : state.doc.textBetween(selection.from, selection.to),
		attrs: Object.fromEntries(champs.map((c) => [c.attr, (c.lire ?? ouNull)(c.input.value)])),
	});

	const appliquer = () => {
		if (!existante && !insertion && !surTexte()) {
			popover.error(label('selection_invalide'));
			return false;
		}
		const v = valeurs();
		if (!v.terme || !seRelitInline([text(v.terme, [{ type: desc.type, attrs: v.attrs }])])) {
			popover.error(desc.invalide);
			return false;
		}
		const chain = editor.chain().focus();
		if (existante) chain.setTextSelection(existante).setMark(desc.type, v.attrs);
		else if (insertion) chain.insertContent({ type: 'text', text: v.terme, marks: [{ type: desc.type, attrs: v.attrs }] });
		else chain.setMark(desc.type, v.attrs);
		chain.run();
		return true;
	};

	popover.button(label('appliquer'), null, { submit: true, name: 'appliquer' });
	if (existante) {
		popover.button(desc.retirer, () => {
			editor.chain().focus().setTextSelection(existante).unsetMark(desc.type).run();
		}, { name: 'retirer' });
	}
	desc.avecPopover?.(popover, valeurs);
	popover.button(label('annuler'), () => {}, { name: 'annuler' });
	popover.open(terme ?? champs[0].input);
	return popover;
}

/**
 * Appel de l'opération glossaire (spec 02 §5) : URL de la définition d'un raccourci, et glossaires
 * du site ; sans raccourci, les glossaires seuls. null sans services ou en cas d'échec.
 */
const glossaire = (services, raccourci) => Promise.resolve(services)
	.then((s) => (s?.available ? s.call('glossaire', raccourci ? { raccourci } : {}) : null))
	.catch(() => null);

/**
 * Popover de glossaire : glossaire nommé (liste des glossaires du site), numéro, bulle, langue ;
 * « Voir la définition » ouvre l'URL calculée par SPIP.
 *
 * @param {{ editor, wrapper, parent?: Popover, services?: object|Promise<?object> }} contexte
 */
export function openGlossaryPopover(contexte) {
	const { services } = contexte;
	return openMarkPopover(contexte, {
		type: 'spipGlossary',
		titre: label('glossaire'),
		className: 'tts-popover--glossaire',
		invalide: label('glossaire_invalide'),
		retirer: label('glossaire_retirer'),
		champs: [
			{ name: 'glossaire', label: label('glossaire_nom'), attr: 'glossaire' },
			{ name: 'numero', label: label('glossaire_numero'), attr: 'numero' },
			{ name: 'bulle', label: label('bulle'), attr: 'bulle', lire: (v) => (v === '' ? null : v) },
			{ name: 'langue', label: label('langue'), attr: 'hreflang' },
		],
		avecPopover: (popover, valeurs) => {
			if (!services) return;
			// glossaires nommés du site, proposés à la saisie
			const nom = popover.form.querySelector('[name=glossaire]');
			const liste = document.createElement('datalist');
			liste.id = idUnique('tts-glossaires');
			nom.setAttribute('list', liste.id);
			nom.after(liste);
			glossaire(services, null).then((r) => {
				liste.replaceChildren(...(r?.glossaires ?? []).map((g) => Object.assign(document.createElement('option'), { value: g })));
			});
			const voir = popover.button(label('glossaire_definition'), () => {
				const { terme, attrs } = valeurs();
				const raccourci = serializeGlossary(terme, attrs);
				// fenêtre ouverte pendant le clic : ouverte au retour du serveur, hors de l'action de
				// l'utilisateur, elle serait bloquée (Firefox si la réponse tarde, Safari toujours).
				// Sans opener (noopener rendrait null), puis envoyée à l'URL, ou refermée sans URL
				const fenetre = globalThis.open?.('', '_blank');
				if (fenetre) fenetre.opener = null;
				glossaire(services, raccourci).then((r) => {
					if (!fenetre) return;
					if (r?.url) fenetre.location = r.url;
					else fenetre.close();
				});
				return false;
			}, { name: 'definition' });
			voir.classList.add('tts-popover__secondaire');
		},
	});
}

/** Popover d'abréviation : explication (obligatoire), langue. */
export function openAbbrPopover(contexte) {
	return openMarkPopover(contexte, {
		type: 'spipAbbr',
		titre: label('abbr'),
		className: 'tts-popover--abbr',
		invalide: label('abbr_invalide'),
		retirer: label('abbr_retirer'),
		champs: [
			{ name: 'explication', label: label('abbr_explication'), attr: 'title', lire: (v) => v },
			{ name: 'langue', label: label('langue'), attr: 'lang' },
		],
	});
}
