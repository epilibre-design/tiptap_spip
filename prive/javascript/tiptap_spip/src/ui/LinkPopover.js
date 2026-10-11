import { NodeSelection } from '@tiptap/pm/state';
import { text } from '../spip/json.js';
import { seRelitInline } from '../spip/valider.js';
import { label } from './labels.js';
import { Popover, suivrePosition } from './popover.js';

const VIDE = { href: '', bulle: null, hreflang: null, newWindow: false };

/**
 * Popover de lien (spec 05 §4, 06 §4) : cible avec recherche d'objets SPIP, bulle, langue,
 * nouvelle fenêtre ; ouvrir, retirer ; « Figer le titre » pour un lien sans texte.
 *
 * Selon la sélection :
 * - lien sans texte sélectionné : modification de ses attributs ;
 * - curseur ou sélection dans un lien : modification du lien entier ;
 * - texte sélectionné : nouveau lien sur ce texte ;
 * - curseur seul : insertion d'un lien sans texte [->cible].
 *
 * @param {{ editor, wrapper, parent?: Popover,
 *           services: ?import('../services/cvt.js').Services|Promise<?import('../services/cvt.js').Services>,
 *           titles: ?import('../services/cache.js').LinkTitles }} context  services : éventuellement une
 *        promesse (formulaire chargé à la demande), lue à chaque recherche ; parent : popover
 *        d'où le lien est ouvert (sous-éditeur d'une note)
 */
export function openLinkPopover({ editor, wrapper, parent, services, titles }) {
	// ProseMirror lit la sélection du navigateur sur « selectionchange », asynchrone dans Chromium : un
	// Ctrl+K qui suit de près Maj+flèches verrait l'ancienne sélection. On la lui fait lire maintenant.
	if (editor.view.hasFocus()) editor.view.domObserver?.flush?.();
	const { state } = editor;
	const { selection } = state;
	const auto = selection instanceof NodeSelection && selection.node.type.name === 'spipLinkAuto' ? selection : null;
	const mark = !auto && editor.isActive('spipLink');
	const attrs = auto ? auto.node.attrs : mark ? editor.getAttributes('spipLink') : VIDE;
	const existant = Boolean(auto || mark);

	const popover = new Popover({ editor, wrapper, parent, titre: label('lien'), className: 'tts-popover--lien', onSubmit: () => appliquer() });
	const cible = popover.input(label('lien_cible'), { value: attrs.href, name: 'cible' });
	const suggestions = document.createElement('ul');
	suggestions.className = 'tts-popover__suggestions';
	suggestions.setAttribute('role', 'listbox');
	suggestions.setAttribute('aria-label', label('lien_rechercher'));
	cible.after(suggestions);
	const bulle = popover.input(label('lien_bulle'), { value: attrs.bulle ?? '', name: 'bulle' });
	const langue = popover.input(label('lien_langue'), { value: attrs.hreflang ?? '', name: 'langue' });
	const fenetre = popover.input(label('lien_nouvelle_fenetre'), { value: attrs.newWindow, type: 'checkbox', name: 'nouvelle_fenetre' });

	const valeurs = () => ({
		href: cible.value.trim(),
		bulle: bulle.value === '' ? null : bulle.value,
		hreflang: langue.value.trim() === '' ? null : langue.value.trim(),
		newWindow: fenetre.checked,
	});

	const appliquer = () => {
		const nouveaux = valeurs();
		if (!nouveaux.href) {
			popover.error(label('lien_cible_obligatoire'));
			return false;
		}
		// cible ou bulle qui couperait le raccourci ([x->a]b], bulle avec ->…)
		if (!seRelitInline([text('x', [{ type: 'spipLink', attrs: nouveaux }])])) {
			popover.error(label('lien_invalide'));
			return false;
		}
		const chain = editor.chain().focus();
		if (auto) {
			chain.command(({ tr }) => {
				tr.setNodeMarkup(auto.from, undefined, nouveaux);
				return true;
			});
		} else if (mark) {
			chain.extendMarkRange('spipLink').setMark('spipLink', nouveaux);
		} else if (selection.empty) {
			chain.insertContent({ type: 'spipLinkAuto', attrs: nouveaux });
		} else {
			chain.setMark('spipLink', nouveaux);
		}
		chain.run();
		return true;
	};

	popover.button(label('appliquer'), null, { submit: true, name: 'appliquer' });
	if (existant) {
		popover.button(label('lien_retirer'), () => {
			if (auto) editor.chain().focus().deleteSelection().run();
			else editor.chain().focus().extendMarkRange('spipLink').unsetMark('spipLink').run();
		}, { name: 'retirer' });
		if (titles) {
			const ouvrir = popover.button(label('lien_ouvrir'), () => {
				titles.get(attrs.href).then((r) => r?.url && globalThis.open?.(r.url, '_blank', 'noopener'), () => {});
				return false;
			}, { name: 'ouvrir' });
			ouvrir.classList.add('tts-popover__secondaire');
		}
	}
	if (auto && titles) {
		popover.button(label('lien_figer'), () => {
			const { href } = auto.node.attrs;
			const attrsLien = valeurs();
			// le titre arrive après un appel au serveur : la position du lien est suivie entre-temps, et
			// le nœud trouvé doit toujours être ce lien sans texte, sinon rien n'est modifié
			const suivi = suivrePosition(editor, auto.from);
			titles.get(href).then((r) => {
				const pos = suivi.fin();
				const node = editor.isDestroyed || pos === null ? null : editor.state.doc.nodeAt(pos);
				if (!r?.titre || node?.type.name !== 'spipLinkAuto' || node.attrs.href !== href) return;
				editor.chain().focus().insertContentAt({ from: pos, to: pos + node.nodeSize }, {
					type: 'text', text: r.titre, marks: [{ type: 'spipLink', attrs: attrsLien }],
				}).run();
			}, () => suivi.fin());
		}, { name: 'figer' });
	}
	popover.button(label('annuler'), () => {}, { name: 'annuler' });

	// recherche d'objets SPIP (opération rechercher), à partir de 2 caractères
	let attente = null;
	let derniere = '';
	const rechercher = () => {
		const q = cible.value.trim();
		suggestions.replaceChildren();
		if (!services || q.length < 2 || /^[a-z_]+\d+$|^\w+:\/\/|^#/.test(q)) return;
		derniere = q;
		Promise.resolve(services).then((s) => {
			if (!s?.available) return [];
			return s.call('rechercher', { q, objets: ['article', 'rubrique', 'breve', 'document', 'auteur', 'mot', 'site'] });
		}).then((resultats) => {
			if (q !== derniere) return;
			suggestions.replaceChildren(...resultats.map((r) => {
				const li = document.createElement('li');
				li.setAttribute('role', 'option');
				li.tabIndex = -1;
				li.dataset.raccourci = r.raccourci;
				li.textContent = `${r.titre} (${r.raccourci})`;
				li.addEventListener('mousedown', (event) => event.preventDefault());
				li.addEventListener('click', () => {
					cible.value = r.raccourci;
					suggestions.replaceChildren();
					cible.focus();
				});
				return li;
			}));
		}, () => {});
	};
	cible.addEventListener('input', () => {
		clearTimeout(attente);
		attente = setTimeout(rechercher, 250);
	});

	popover.open(cible);
	return popover;
}
