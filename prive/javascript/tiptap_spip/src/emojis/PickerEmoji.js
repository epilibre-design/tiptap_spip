import { emojiAutorise } from './insertion.js';
import { config } from '../config.js';
import { label } from '../ui/labels.js';
import { suivrePosition } from '../ui/popover.js';
import { ouvrirPanneauSuggestions } from '../suggestions/PanneauSuggestions.js';

/** Le composant DOM est enregistré par ui/interface.js, jamais par le fournisseur. */
export function ouvrirPickerEmoji({ editor, anchor, origin = {}, range = editor.state.selection, onChoose, onClose, i18n }) {
	const valide = (plage) => emojiAutorise({ editor, range: plage });
	if (!valide(range)) return null;
	const debut = suivrePosition(editor, range.from), fin = suivrePosition(editor, range.to);
	const initial = editor.state.doc.slice(range.from, range.to).content;
	const doc = editor.view.dom.ownerDocument;
	let ouvert = true, accepte = false, essai = 0, pret = false, retirerChoix, attente;
	let panneau;
	const cibleFocus = (picker) => {
		if (!ouvert) return;
		(picker?.shadowRoot?.querySelector('input[type="search"]') ?? panneau.corps).focus();
	};
	const terminer = (raison) => {
		ouvert = false; essai++; clearTimeout(attente); retirerChoix?.(); debut.fin(); fin.fin();
		onClose?.(raison);
	};
	const fragment = doc.createElement('div');
	panneau = ouvrirPanneauSuggestions({ editor, anchor, origin, content: fragment, label: label('emoji'), onClose: terminer });
	if (!panneau) { terminer({ reason: 'unavailable' }); return null; }
	const erreur = () => {
		if (!ouvert) return;
		pret = false; essai++; clearTimeout(attente); retirerChoix?.();
		const contenu = doc.createElement('div');
		const message = doc.createElement('p'); message.setAttribute('role', 'alert'); message.textContent = label('emoji_erreur');
		const retry = doc.createElement('button'); retry.type = 'button'; retry.textContent = label('emoji_reessayer');
		retry.addEventListener('click', charger);
		contenu.append(message, retry); panneau.remplacer(contenu);
	};
	function charger() {
		const numero = ++essai;
		clearTimeout(attente);
		pret = false; retirerChoix?.();
		const donnees = config().emojis;
		if (!donnees?.url || !donnees.locale) { erreur(); return; }
		const contenu = doc.createElement('div'); contenu.className = 'tts-emoji';
		const status = doc.createElement('p'); status.setAttribute('role', 'status'); status.textContent = label('emoji_chargement');
		try {
			const picker = doc.createElement('emoji-picker');
			if (!['dataSource', 'locale', 'i18n', 'database'].every((prop) => prop in picker)) throw new Error('Picker emoji incompatible');
			picker.dataSource = donnees.url; picker.locale = donnees.locale; picker.i18n = i18n;
			const choix = (event) => {
				if (!ouvert || numero !== essai || !pret || accepte || !picker.isConnected) return;
				const unicode = event.detail?.unicode;
				if (typeof unicode !== 'string' || !unicode.trim()) return;
				const plage = { from: debut.pos(), to: fin.pos() };
				if (!valide(plage) || !editor.state.doc.slice(plage.from, plage.to).content.eq(initial)) {
					panneau.fermer({ reason: 'invalid' }); return;
				}
				accepte = true;
				let succes = false;
				try { succes = onChoose?.(unicode) === true; }
				catch (error) { console.error('tiptap_spip : choix emoji refusé', error); }
				if (!succes) { accepte = false; return; }
				// Le succès revient à l’éditeur ; Échap reste lié au bouton d’origine.
				panneau.fermer({ reason: 'choose', refocus: false });
				if (!editor.isDestroyed) editor.view.focus();
			};
			picker.addEventListener('emoji-click', choix);
			retirerChoix = () => picker.removeEventListener('emoji-click', choix);
			contenu.append(status, picker); panneau.remplacer(contenu);
			const database = picker.database;
			if (typeof database?.ready !== 'function') throw new Error('Base du picker incompatible');
			attente = setTimeout(erreur, 10_000);
			Promise.resolve(database.ready()).then(() => {
				if (!ouvert || numero !== essai) return;
				clearTimeout(attente); pret = true; status.remove(); panneau.placer();
				// Le rendu du composant finit dans la même file de microtâches que ready().
				queueMicrotask(() => { if (ouvert && numero === essai) cibleFocus(picker); });
			}, () => { if (ouvert && numero === essai) erreur(); });
		} catch { erreur(); }
	}
	charger();
	return { fermer: panneau.fermer };
}
