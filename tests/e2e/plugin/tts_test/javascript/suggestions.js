// Fixture tierce : uniquement l’API publique du bundle, aucun import interne.
const { ui, registerExtension } = window.tiptapSpip;
const catalogue = [
	{ id: 'bonjour', title: 'Bonjour', context: 'Bonjour !' },
	{ id: 'bonsoir', title: 'Bonsoir', context: 'Bonsoir !' },
	{ id: 'html', title: '<img src=x onerror=alert(1)>', context: 'Texte inerte' },
	...Array.from({ length: 40 }, (_, i) => ({ id: `autre${i}`, title: `Formule ${i}`, context: `Formule ${i}` })),
];
registerExtension(ui.creerSuggestions({
	name: 'ttsFormules', char: '@', minQueryLength: 1, queryPattern: /[a-z]+/i,
	labels: { suggestions: 'Formules', loading: 'Recherche…', empty: 'Aucune formule', error: 'Indisponible' },
	items: async ({ query, signal }) => {
		if (query === 'lent') await new Promise((resolve) => setTimeout(resolve, 300));
		if (signal.aborted) return [];
		if (query === 'tout') return catalogue;
		if (query === 'html') return [catalogue[2]];
		if (query === 'erreur') throw new Error('Erreur de fixture');
		if (query === 'refus') return [{ id: 'refus', title: 'Refuser' }];
		return ui.filtrerSuggestions(catalogue, query);
	},
	command: ({ editor, range, item }) => item.id !== 'refus'
		&& editor.commands.insertContentAt(range, { type: 'text', text: item.context }),
}));
registerExtension(ui.creerSuggestions({
	name: 'ttsAutreFormule', char: '#', minQueryLength: 1,
	labels: { suggestions: 'Autres formules', loading: 'Recherche…', empty: 'Vide', error: 'Erreur' },
	items: () => [{ id: 'autre', title: 'Autre', context: 'Autre !' }],
	command: ({ editor, range, item }) => editor.commands.insertContentAt(range, { type: 'text', text: item.context }),
}));
