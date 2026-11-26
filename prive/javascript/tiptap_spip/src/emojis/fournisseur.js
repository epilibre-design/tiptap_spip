import { creerSuggestionsInternes } from '../suggestions/fabrique.js';
import { chargerCatalogueEmojis, filtrerEmojis } from './catalogue.js';
import { emojiAutorise, insererEmoji } from './insertion.js';
import { config } from '../config.js';
import { label } from '../ui/labels.js';
import { suivrePosition } from '../ui/popover.js';

export function creerFournisseurEmoji({ ui } = {}) {
	return creerSuggestionsInternes({
		name: 'ttsEmojis', char: ':', minQueryLength: 1, queryPattern: /^[a-z0-9_+=-]+$/i,
		allowedPrefixes: [' ', '\n'],
		labels: { suggestions: label('emoji'), loading: label('emoji_chargement'), empty: '', error: label('emoji_erreur') },
		allow: ({ editor, state, range }) => Boolean(config().emojis?.url) && emojiAutorise({ editor, state, range }),
		items: async ({ query }) => filtrerEmojis(await chargerCatalogueEmojis({ url: config().emojis?.url }), query),
		command: ({ editor, range, item }) => insererEmoji({ editor, range, unicode: item.context.unicode }),
	}, {
		maximum: 6, masquerVide: true, historique: false,
		formatItem: (item) => `${item.context.unicode} :${item.title}:`,
		actionLabel: () => label('emoji_plus'),
		onAction: ({ editor, range, anchor }) => {
			if (!ui?.openEmoji || !emojiAutorise({ editor, range })) return;
			const debut = suivrePosition(editor, range.from), fin = suivrePosition(editor, range.to);
			const original = editor.state.doc.slice(range.from, range.to).content;
			let ouvert = true;
			const terminer = () => { ouvert = false; debut.fin(); fin.fin(); };
			const panneau = ui.openEmoji({ range, anchor, returnTarget: editor.view.dom,
				onChoose: (unicode) => {
					const actuelle = { from: debut.pos(), to: fin.pos() };
					if (!ouvert || !emojiAutorise({ editor, range: actuelle })
						|| !editor.state.doc.slice(actuelle.from, actuelle.to).content.eq(original)) return false;
					const fait = insererEmoji({ editor, range: actuelle, unicode });
					if (fait) terminer();
					return fait;
				}, onClose: terminer,
			});
			if (!panneau) terminer();
		},
	});
}
