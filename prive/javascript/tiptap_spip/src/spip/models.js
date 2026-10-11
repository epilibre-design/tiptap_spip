import { RE_MODELE_SEUL } from './regex.js';

/**
 * Raccourci de modèle → attribut `model` (spec 03 §4) : nom, id, paramètres ordonnés, source.
 * Les paramètres sont coupés sur chaque | comme inclure_modele() (ecrire/public/assembler.php),
 * même à l'intérieur d'une balise.
 *
 * @param {string} source
 * @returns {{ name: string, id: string, params: { key: string|null, value: string }[], source: string } | null}
 *          null si ce n'est pas un modèle (ni id ni paramètres : c'est une balise HTML)
 */
export function parseModel(source) {
	const m = source.match(RE_MODELE_SEUL);
	if (!m || (!m[2] && !m[3])) return null;
	const params = (m[3] ?? '').split('|').slice(1).map((piece) => {
		const kv = piece.match(/^([\w-]+)=([\s\S]*)$/);
		return kv ? { key: kv[1], value: kv[2] } : { key: null, value: piece };
	});
	return { name: m[1], id: m[2], params, source };
}

const sameShape = (a, b) => a && b && a.name === b.name && a.id === b.id && JSON.stringify(a.params) === JSON.stringify(b.params);

/** Source d'origine si le modèle n'a pas changé, sinon forme normalisée <nomID|p|cle=valeur>. */
export function serializeModel(model) {
	if (typeof model.source === 'string' && sameShape(parseModel(model.source), model)) return model.source;
	const params = model.params.map(({ key, value }) => `|${key === null ? value : `${key}=${value}`}`).join('');
	return `<${model.name}${model.id ?? ''}${params}>`;
}
