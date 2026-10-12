// Extensions tierces de test (spec 07) : un bloc FAQ, une mark <sc>, un nœud en ligne :emoji:.
import { Mark, mergeAttributes, Node } from '@tiptap/core';

export const Faq = Node.create({
	name: 'faqItem',
	group: 'block',
	content: 'block+',
	defining: true,
	addAttributes() {
		return { question: { default: '' } };
	},
	parseHTML() {
		return [{ tag: 'div[data-faq]' }];
	},
	renderHTML({ HTMLAttributes }) {
		return ['div', mergeAttributes({ 'data-faq': '', class: 'tts-faq' }, HTMLAttributes), 0];
	},
	spipTokenizer: { level: 'block', priority: 100, start: '<faq', match: /^<faq\|q=([^>]*)>\n([\s\S]*?)\n<\/faq>/ },
	parseSpip(match, helpers) {
		return { type: 'faqItem', attrs: { question: match[1] }, content: helpers.parseBlocks(match[2]) };
	},
	renderSpip(node, helpers) {
		return `<faq|q=${node.attrs.question}>\n${helpers.renderBlocks(node.content)}\n</faq>`;
	},
});

export const Sc = Mark.create({
	name: 'sc',
	parseHTML() {
		return [{ tag: 'span.sc' }];
	},
	renderHTML() {
		return ['span', { class: 'sc' }, 0];
	},
	spipTokenizer: { level: 'inline', start: '<sc>', match: /<sc>(.*?)<\/sc>/ },
	parseSpip(match, helpers) {
		return { content: helpers.parseInline(match[1]) };
	},
	renderSpip: { open: '<sc>', close: '</sc>' },
});

export const Emoji = Node.create({
	name: 'emoji',
	group: 'inline',
	inline: true,
	atom: true,
	addAttributes() {
		return { nom: { default: '' } };
	},
	parseHTML() {
		return [{ tag: 'span[data-emoji]' }];
	},
	renderHTML({ node }) {
		return ['span', { 'data-emoji': node.attrs.nom }, `:${node.attrs.nom}:`];
	},
	spipTokenizer: { level: 'inline', start: ':', match: /:([a-z_]+):/ },
	parseSpip: (match) => ({ type: 'emoji', attrs: { nom: match[1] } }),
	renderSpip: (node) => `:${node.attrs.nom}:`,
});

export const TIERCES = [Faq, Sc, Emoji];
