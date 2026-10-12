// Exemple d'extension tierce de l'éditeur visuel (spec 07) : bloc question-réponse
//   <faq|q=Question>
//   Réponse, sur un ou plusieurs paragraphes.
//   </faq>
// Chargé par l'éditeur avant son lancement (pipeline tiptap_spip_extensions) ; tout vient de
// window.tiptapSpip : Tiptap et ProseMirror du bundle, interface, libellés (pipeline tiptap_spip_i18n).
const { core, ui, label, registerExtension, registerToolbarComponent } = window.tiptapSpip;
const { Node, mergeAttributes } = core;

/** Question valide : non vide, sur une ligne, sans > (qui fermerait la balise). */
const questionValide = (q) => q.trim() !== '' && !/[>\n]/.test(q);

const FaqItem = Node.create({
	name: 'faqItem',
	group: 'block',
	content: 'block+',
	defining: true,
	addAttributes() {
		return {
			question: {
				default: '',
				parseHTML: (el) => el.getAttribute('data-question') ?? '',
				renderHTML: (attrs) => ({ 'data-question': attrs.question }),
			},
		};
	},
	parseHTML() {
		return [{ tag: 'div[data-faq]' }];
	},
	renderHTML({ HTMLAttributes }) {
		return ['div', mergeAttributes({ 'data-faq': '', class: 'faq-tiptap' }, HTMLAttributes), 0];
	},

	// --- champs propres à tiptap_spip ---
	spipTokenizer: {
		level: 'block',
		priority: 100,
		start: '<faq',
		match: /^<faq\|q=([^>\r\n]*)>\r?\n([\s\S]*?)\r?\n<\/faq>/,
	},
	parseSpip(match, helpers) {
		return { type: 'faqItem', attrs: { question: match[1] }, content: helpers.parseBlocks(match[2]) };
	},
	renderSpip(node, helpers) {
		return `<faq|q=${node.attrs.question}>\n${helpers.renderBlocks(node.content)}\n</faq>`;
	},
});

registerExtension(FaqItem, { toolbars: ['edition'] });

/**
 * Bouton « FAQ » : popover de la question ; dans une FAQ, la question est modifiée, sinon les blocs
 * sélectionnés deviennent la réponse d'une nouvelle FAQ.
 */
registerToolbarComponent('faq', ({ editor, instance }) => {
	const ouvrir = () => {
		const actuelle = editor.isActive('faqItem') ? editor.getAttributes('faqItem').question : '';
		const popover = new ui.Popover({
			editor,
			wrapper: instance.wrapper,
			titre: label('faq'),
			className: 'tts-popover--faq',
			onSubmit: () => {
				const question = champ.value.trim();
				if (!questionValide(question)) {
					popover.error(label('faq_question_invalide'));
					return false;
				}
				if (editor.isActive('faqItem')) return editor.commands.updateAttributes('faqItem', { question });
				if (!editor.commands.wrapIn('faqItem', { question })) {
					editor.commands.insertContent({ type: 'faqItem', attrs: { question }, content: [{ type: 'paragraph' }] });
				}
				return true;
			},
		});
		const champ = popover.input(label('faq_question'), { value: actuelle, name: 'question' });
		popover.button(label('appliquer'), null, { submit: true });
		popover.open(champ);
	};
	const element = ui.boutonOutil({ nom: 'faq', libelle: label('faq'), action: ouvrir });
	return { element, maj: () => element.classList.toggle('tts-outil--actif', editor.isActive('faqItem')) };
});
