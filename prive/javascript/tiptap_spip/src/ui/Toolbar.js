import { label } from './labels.js';

/**
 * Barre d'outils déclarative (spec 06 §2) : une liste de noms de composants ('|' : séparateur) ou
 * d'objets { composant, …options }, déclarée par src/ui/barres.json et le pipeline PHP
 * tiptap_spip_toolbars. Chaque nom désigne une fabrique du registre :
 *
 *   (ctx, options) => { element, cible?, maj?(), source? }
 *
 * ctx : { editor, ui, instance } ; element : ce qui est posé dans la barre ; cible : l'élément qui
 * prend le focus (element par défaut) ; maj : met l'état à jour (transaction, changement de mode) ;
 * source : reste actif en mode source.
 *
 * Accessibilité (spec 06 §7) : role=toolbar, roving tabindex (un seul élément tabulable, flèches,
 * Début, Fin ; les éléments désactivés ou masqués sont sautés).
 */
export class Toolbar {
	/** @type {Map<string, (ctx: object, options: object) => object>} */
	static registre = new Map();

	/** Ajoute (ou remplace) un composant au registre. */
	static registerComponent(nom, fabrique) {
		Toolbar.registre.set(nom, fabrique);
	}

	/**
	 * @param {{ ctx: { editor: import('@tiptap/core').Editor, ui: object, instance: object },
	 *           barre: (string|object)[], element: HTMLElement }} options
	 */
	constructor({ ctx, barre, element }) {
		this.ctx = ctx;
		this.element = element;
		this.element.setAttribute('role', 'toolbar');
		this.element.setAttribute('aria-label', label('barre_outils'));
		this.composants = [];
		for (const item of barre) {
			if (item === '|') {
				const separateur = document.createElement('span');
				separateur.className = 'tts-separateur';
				separateur.setAttribute('role', 'separator');
				this.element.append(separateur);
				continue;
			}
			const { composant: nom, ...options } = typeof item === 'string' ? { composant: item } : item;
			const fabrique = Toolbar.registre.get(nom);
			if (!fabrique) {
				console.warn(`tiptap_spip : composant de barre inconnu « ${nom} »`);
				continue;
			}
			const composant = fabrique(ctx, options);
			composant.cible ??= composant.element;
			this.composants.push(composant);
			this.element.append(composant.element);
		}
		this.courant = null;
		this.element.addEventListener('keydown', (event) => this.naviguer(event));
		this.element.addEventListener('focusin', (event) => {
			const cible = this.cibles().find((c) => c === event.target);
			if (cible) this.activer(cible);
		});
		this.maj();
	}

	/** État des composants ; en mode source, seuls ceux marqués `source` restent actifs. */
	maj() {
		const source = this.ctx.instance?.mode?.() === 'source';
		for (const c of this.composants) {
			c.cible.disabled = false;
			c.maj?.();
			if (source && !c.source) c.cible.disabled = true;
		}
		this.activer(this.cibles().includes(this.courant) ? this.courant : this.cibles()[0] ?? null);
	}

	/** Éléments atteignables aux flèches : ni désactivés, ni masqués. */
	cibles() {
		return this.composants
			.filter((c) => !c.element.hidden && !c.cible.hidden && !c.cible.disabled)
			.map((c) => c.cible);
	}

	/** Seul `cible` est tabulable. */
	activer(cible) {
		this.courant = cible;
		for (const c of this.composants) c.cible.tabIndex = c.cible === cible ? 0 : -1;
	}

	naviguer(event) {
		const cibles = this.cibles();
		const i = cibles.indexOf(event.target);
		if (i < 0) return;
		const suivant = {
			ArrowRight: cibles[(i + 1) % cibles.length],
			ArrowLeft: cibles[(i - 1 + cibles.length) % cibles.length],
			Home: cibles[0],
			End: cibles.at(-1),
		}[event.key];
		if (!suivant) return;
		event.preventDefault();
		this.activer(suivant);
		suivant.focus();
	}
}
