import { canon } from './json.js';
import { canBacktick, encodeCode } from './protect.js';

/**
 * Document JSON → source SPIP.
 * Sérialisation conservatrice : un segment dont les blocs ont gardé leur forme canonique est
 * restitué à l'identique (spipSep + spipSrc), les autres blocs sont sérialisés.
 *
 * @param {object} doc
 * @param {{ conservative?: boolean }} options  conservative:false donne la forme canonique
 * @returns {string}
 */
export function serialize(doc, { conservative = true } = {}) {
	const blocks = doc.content ?? [];
	let out = conservative ? (doc.attrs?.spipLead ?? '') : '';
	let i = 0;
	while (i < blocks.length) {
		const b = blocks[i];
		const a = b.attrs ?? {};
		if (conservative && a.spipGroup && typeof a.spipSrc === 'string' && canon(blocks.slice(i, i + a.spipGroup)) === a.spipHash) {
			out += a.spipSep + a.spipSrc;
			i += a.spipGroup;
			continue;
		}
		const sep = conservative && typeof a.spipSep === 'string' ? a.spipSep : (i === 0 ? '' : '\n\n');
		out += sep + serializeBlock(b);
		i++;
	}
	return out + (conservative ? (doc.attrs?.spipTrail ?? '') : '');
}

const textOf = (n) => (n.content ?? []).map((c) => c.text ?? '').join('');
const blocks = (content = []) => content.map(serializeBlock).join('\n\n');

export function serializeBlock(b) {
	const a = b.attrs ?? {};
	switch (b.type) {
		case 'paragraph':
			return serializeInline(b.content, { lineStart: true });
		case 'heading':
			return a.level === 2
				? `{{{${serializeInline(b.content, { html: true })}}}}`
				: `<h${a.level}>${serializeInline(b.content)}</h${a.level}>`;
		case 'horizontalRule':
			return '----';
		case 'bulletList':
		case 'orderedList':
			return serializeList(b, 1);
		case 'blockquote':
			return `<quote>\n${blocks(b.content)}\n</quote>`;
		case 'spipPoesie':
			return `<${a.tag ?? 'poesie'}>\n${blocks(b.content)}\n</${a.tag ?? 'poesie'}>`;
		case 'spipAlign':
			return `<div class="text-${a.align}">\n\n${blocks(b.content)}\n\n</div>`;
		case 'codeBlock':
			return serializeCodeBlock(b);
		case 'spipCadre':
		case 'spipHtml':
		case 'spipMath':
			return a.openTag + encodeCode(textOf(b)) + a.closeTag;
		case 'spipRaw':
			return a.source;
		case 'table':
			return serializeTable(b);
		default:
			throw new Error(`serialize: type de bloc inconnu « ${b.type} »`);
	}
}

function serializeCodeBlock(b) {
	const a = b.attrs ?? {};
	const code = textOf(b);
	if (a.openTag || !canBacktick(code)) return `${a.openTag ?? '<code>'}\n${encodeCode(code)}\n</code>`;
	let fence = '```';
	while (code.includes(fence)) fence += '`';
	return `${fence}${a.language ?? ''}\n${code}${fence}`;
}

function serializeList(list, depth) {
	const marker = (list.type === 'bulletList' ? '*' : '#').repeat(depth);
	return list.content.map((item) => {
		const [para, nested] = item.content;
		const line = `-${marker} ${serializeInline(para.content)}`;
		return nested ? `${line}\n${serializeList(nested, depth + 1)}` : line;
	}).join('\n');
}

function serializeTable(table) {
	const a = table.attrs ?? {};
	const lines = [];
	if (a.caption != null || a.summary != null) {
		lines.push(`||${a.caption ?? ''}${a.summary != null ? `|${a.summary}` : ''}||`);
	}
	const occ = [];
	table.content.forEach((row, r) => {
		occ[r] ??= [];
		let c = 0;
		for (const cell of row.content) {
			while (occ[r][c] !== undefined) c++;
			const { colspan = 1, rowspan = 1 } = cell.attrs ?? {};
			for (let dr = 0; dr < rowspan; dr++) {
				occ[r + dr] ??= [];
				for (let dc = 0; dc < colspan; dc++) {
					occ[r + dr][c + dc] = dr > 0 ? '^' : dc > 0 ? '<' : cell;
				}
			}
			c += colspan;
		}
	});
	for (const row of occ) {
		const cells = row.map((x) => {
			if (typeof x === 'string') return x;
			const inline = serializeInline(x.content?.[0]?.content);
			return x.type === 'tableHeader' && inline !== '' ? `{{${inline}}}` : inline;
		});
		lines.push(`|${cells.join('|')}|`);
	}
	return lines.join('\n');
}

const OPEN = { bold: ['{{', '}}'], italic: ['{', '}'], strike: ['<del>', '</del>'], superscript: ['<sup>', '</sup>'], subscript: ['<sub>', '</sub>'] };
const HTML = { bold: ['<strong>', '</strong>'], italic: ['<i>', '</i>'] };

/**
 * Contenu inline → SPIP.
 * Gras et italique imbriqués (ou italique dans un intertitre) : la mark intérieure est écrite en
 * HTML (<strong>, <i>, même rendu) pour ne jamais produire {{{ ou }}}.
 *
 * @param {object[]} nodes
 * @param {{ lineStart?: boolean, html?: boolean }} options
 */
export function serializeInline(nodes = [], { lineStart = false, html = false } = {}) {
	let out = '';
	const stack = [];
	let atLineStart = lineStart;
	const closeTo = (k) => {
		while (stack.length > k) out += stack.pop().close;
	};
	for (const n of nodes) {
		const marks = (n.marks ?? []).filter((m) => m.type !== 'code');
		let k = 0;
		while (k < stack.length && k < marks.length && stack[k].type === marks[k].type) k++;
		closeTo(k);
		for (const m of marks.slice(k)) {
			const useHtml = HTML[m.type] && (html || stack.some((s) => OPEN[s.type][0].startsWith('{')));
			const [open, close] = useHtml ? HTML[m.type] : OPEN[m.type];
			out += open;
			stack.push({ type: m.type, close });
			atLineStart = false;
		}
		if (n.type === 'text') {
			const code = n.marks?.find((m) => m.type === 'code');
			out += code ? serializeCode(n.text) : escapeText(n.text, atLineStart);
			atLineStart = false;
		} else if (n.type === 'hardBreak') {
			const autobr = n.attrs?.syntax === 'autobr';
			out += autobr ? '\n' : '\n_ ';
			atLineStart = autobr;
		} else if (n.type === 'spipRawInline') {
			out += n.attrs.source;
			atLineStart = false;
		} else {
			throw new Error(`serialize: type inline inconnu « ${n.type} »`);
		}
	}
	closeTo(0);
	return out;
}

/**
 * Code inline : backticks par défaut (`` si le code contient un backtick) ; <code> si le code a
 * des blancs aux bords (SPIP les retire entre backticks) ou ne tient pas entre backticks.
 */
function serializeCode(code) {
	const backtick = code === code.trim() && canBacktick(code) && !/^`|`$|``/.test(code);
	if (!backtick) return `<code>${encodeCode(code)}</code>`;
	return code.includes('`') ? `\`\`${code}\`\`` : `\`${code}\``;
}

/** Échappe dans du texte ce que SPIP interpréterait comme un raccourci. */
export function escapeText(value, atLineStart) {
	let s = value
		.replace(/\\/g, '\\\\')
		.replace(/[{}`~]/g, (c) => `\\${c}`)
		.replace(/ /g, '~')
		.replace(/&(?=#?[a-z0-9]+;)/gi, '&amp;')
		.replace(/<(?=[a-z/!:])/gi, '&lt;')
		// notes et glossaire sont traités avant les échappements \[ : on passe par des entités
		.replace(/\[\?/g, '[&#63;')
		.replace(/\[\[/g, '[&#91;')
		.replace(/\[(?=#|$|[^\]]*?(?:->|<-|\|)[^\]]*\])/g, '&#91;');
	if (atLineStart) s = s.replace(/^([-|]|_(?= |_))/, '\\$1');
	return s;
}
