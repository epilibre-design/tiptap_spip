import { label } from '../ui/labels.js';

/**
 * Soumission du formulaire d'édition retenue tant qu'une image est en cours d'envoi (spec 10 §3) :
 * sinon le texte enregistré contiendrait <!-- envoi… --> (mode source) ou n'aurait pas l'image
 * (visuel). Deux voies, comme pour la synchronisation du textarea (TextareaBridge) :
 * - soumission native : écouteur submit en capture ;
 * - soumission AJAX (jquery.form) : événement jQuery form-pre-serialize, reçu avec
 *   (event, $form, options, veto) ; veto.veto arrête ajaxSubmit(). Crayons a sa propre copie de
 *   jQuery (cQuery) : l'écouteur est posé avec les deux.
 * La soumission repart d'elle-même après le dernier envoi, par le bouton utilisé.
 */
export class SoumissionRetenue {
	/**
	 * @param {{ form: HTMLFormElement, enCours: () => boolean,
	 *           signaler: (texte: string, action: { libelle: string, faire: () => void }) => void,
	 *           effacer: () => void, abandonner: () => void }} options
	 */
	constructor({ form, enCours, signaler, effacer, abandonner }) {
		Object.assign(this, { form, enCours, signaler, effacer, abandonner });
		this.attente = false;
		this.bouton = null;
		this.onSubmit = (event) => {
			if (!this.retenir(event.submitter)) return;
			event.preventDefault();
			event.stopImmediatePropagation();
		};
		form.addEventListener('submit', this.onSubmit, true);
		// jquery.form garde le bouton cliqué dans form.clk
		this.onPreSerialize = (event, $form, options, veto) => {
			if (this.retenir(form.clk) && veto) veto.veto = true;
		};
		const bibliotheques = [...new Set([globalThis.jQuery, globalThis.cQuery].filter(Boolean))];
		this.$forms = bibliotheques.map(($) => $(form));
		for (const $form of this.$forms) $form.on('form-pre-serialize.ttsimages', this.onPreSerialize);
	}

	/** Vrai si la soumission est retenue (envois en cours) ; le bouton est gardé pour la relance. */
	retenir(bouton) {
		if (!this.enCours()) return false;
		this.attente = true;
		this.bouton = bouton ?? null;
		this.signaler(label('envoi_en_cours'), { libelle: label('enregistrer_sans_attendre'), faire: () => this.sansAttendre() });
		return true;
	}

	/** À chaque fin d'envoi : la soumission retenue repart après le dernier. */
	verifier() {
		if (this.attente && !this.enCours()) this.relancer();
	}

	/**
	 * « Enregistrer sans attendre » : abandonner() prévient l'instance (surChangement), dont le
	 * verifier() relance déjà la soumission ; le relancer() qui suit ne fait alors plus rien. Il ne sert
	 * que s'il n'y avait plus d'envoi à abandonner.
	 */
	sansAttendre() {
		this.abandonner();
		this.relancer();
	}

	/**
	 * Relance unique de la soumission retenue. requestSubmit reprend la voie d'origine : le submit relance
	 * ajaxSubmit() d'un formulaire AJAX. jquery.form ne sérialise le bouton que s'il est form.clk, que
	 * son écouteur de clic remet à null 100 ms après le clic : il est rétabli le temps de la relance
	 * (ajaxSubmit sérialise de façon synchrone, dans l'écouteur submit).
	 */
	relancer() {
		if (!this.attente || this.detruite) return;
		this.attente = false;
		this.effacer();
		const bouton = this.bouton?.isConnected && this.bouton.form === this.form ? this.bouton : null;
		this.bouton = null;
		if (!bouton) {
			// requestSubmit(null) lève une TypeError
			this.form.requestSubmit();
			return;
		}
		this.form.clk = bouton;
		try {
			this.form.requestSubmit(bouton);
		} finally {
			if (this.form.clk === bouton) this.form.clk = null;
		}
	}

	/**
	 * Éditeur détruit (crayon fermé, rechargement AJAX) : la soumission retenue est annulée, aucune
	 * relance ne part ensuite, même quand l'abandon des envois appelle encore verifier().
	 */
	destroy() {
		this.detruite = true;
		this.attente = false;
		this.bouton = null;
		this.form.removeEventListener('submit', this.onSubmit, true);
		for (const $form of this.$forms) $form.off('form-pre-serialize.ttsimages', this.onPreSerialize);
	}
}
