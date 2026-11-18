/** Portable name spelling shared by the language core and hosts. No host I/O. */
import { SWAML_LANGUAGE_VERSION } from './edition.js';
export const BASIC_NAME = /^[_a-zA-Z]\w*$/;
/** Grammar words that remain legal names outside their syntactic positions. From 2.3, view, state, in and out are contextual (WP2-S01). */
export const CONTEXTUAL_KEYWORDS: ReadonlySet<string> = new Set(['associate', 'by', 'case', 'in', 'kind', 'ms', 'name', 'ns', 'out', 'path', 'reversed', 's', 'state', 'test', 'times', 'to', 'us', 'use', 'view']);
/** Reserved words need a quoted name, for example 'operation'. Checked against the grammar by the test suite. */
export const RESERVED_WORDS: ReadonlySet<string> = new Set(['after', 'and', 'assert', 'attribute', 'bool', 'byte', 'call', 'component', 'concurrent', 'connect', 'const', 'datatype', 'deadline', 'def', 'deploy', 'deployment', 'else', 'entry', 'enum', 'event', 'every', 'exit', 'fail', 'false', 'final', 'for', 'idempotent', 'if', 'import', 'include', 'initial', 'int', 'interruptible', 'not', 'of', 'on', 'operation', 'optional', 'or', 'package', 'port', 'provides', 'publish', 'qos', 'real', 'receive', 'record', 'recursive', 'redefines', 'requirement', 'requires', 'return', 'returns', 'satisfy', 'schedule', 'send', 'specializes', 'start', 'string', 'true', 'try', 'uint', 'until', 'var', 'verify', 'void', 'wait', 'when', 'where', 'while']);
/** The words that were reserved in 2.2 and are contextual from 2.3 (WP2-S01). */
export const CONTEXTUAL_FROM_2_3: ReadonlySet<string> = new Set(['in', 'out', 'state', 'view']);
/** The reserved words of a 2.2 (or earlier 2.x) workspace, which still quote view, state, in and out (WP2-M01). Checked against the kept 2.2 grammar by the test suite. */
export const RESERVED_WORDS_2_2: ReadonlySet<string> = new Set([...RESERVED_WORDS, ...CONTEXTUAL_FROM_2_3]);
/** The contextual words of a 2.2 workspace. */
export const CONTEXTUAL_KEYWORDS_2_2: ReadonlySet<string> = new Set([...CONTEXTUAL_KEYWORDS].filter(word => !CONTEXTUAL_FROM_2_3.has(word)));
/**
 * The swa.ml edition a name is spelled for, as MAJOR.MINOR. Name services are edition-aware (WP2-M01): a 2.3
 * workspace writes the contextual words as basic names, an earlier one keeps quoting the words reserved there.
 * The default is the edition this host selects.
 */
export type NameEdition = string;
/**
 * The spelling of names inside diagnostic messages: the 2.2 quoting, which is valid source in every 2.x edition, so a
 * 2.2 source keeps its 2.2 messages byte for byte (WP2 review H1). Every name has a 2.2 spelling (a contextual word
 * such as state is quoted, 'state', and both spellings are the same name), so diagnostics on every source, 2.3
 * sources included, spell every name this way.
 */
export const MESSAGE_SPELLING: NameEdition = '2.2';
// A non-string edition is the default: the name functions stay safe as callbacks, as in names.map(formatName) (WP2 review M1).
const editionOf = (edition: unknown): NameEdition => typeof edition === 'string' ? edition : SWAML_LANGUAGE_VERSION;
const before2_3 = (edition: unknown) => { const [major, minor] = editionOf(edition).split('.').map(Number); return major < 2 || major === 2 && minor < 3; };
/** The words that need quotes in a workspace of the given edition. */
export function reservedWords(edition: NameEdition | number = SWAML_LANGUAGE_VERSION): ReadonlySet<string> { return before2_3(edition) ? RESERVED_WORDS_2_2 : RESERVED_WORDS; }
/** True when a name can be written without quotes in a workspace of the given edition. */
export function isBasicName(name: string, edition: NameEdition | number = SWAML_LANGUAGE_VERSION): boolean { return BASIC_NAME.test(name) && !reservedWords(edition).has(name); }
/** Source spelling of one name: basic when possible, otherwise single-quoted with escapes. */
export function formatName(name: string, edition: NameEdition | number = SWAML_LANGUAGE_VERSION): string { return isBasicName(name, edition) ? name : `'${name.replace(/[\\']/g, c => '\\' + c)}'`; }
/** Source spelling of a package or qualified name such as Shop::'Order Service'. */
export function formatQualifiedName(name: string, edition: NameEdition | number = SWAML_LANGUAGE_VERSION): string { const e = editionOf(edition); return name.split('::').map(part => formatName(part, e)).join('::'); }
/** A name in single quotes with escapes, whatever its spelling, for example 'Pump'. */
export function quoteName(name: string): string { return `'${name.replace(/[\\']/g, c => '\\' + c)}'`; }
/** Source spelling of an occurrence or member path; literal indexes stay unquoted. */
export function formatPath(path: string, edition: NameEdition | number = SWAML_LANGUAGE_VERSION): string {
    edition = editionOf(edition);
    const colon = path.lastIndexOf('::'), head = colon < 0 ? '' : formatQualifiedName(path.slice(0, colon), edition) + '::';
    return head + path.slice(colon < 0 ? 0 : colon + 2).split('.').map(part => { const [, name, index] = /^(.*?)((?:\[\d+\])?)$/.exec(part)!; return formatName(name, edition) + index; }).join('.');
}
/** Name services bound to one edition, for hosts that pass them as callbacks: namesFor('2.2').formatName. */
export function namesFor(edition: NameEdition) {
    const e = editionOf(edition);
    return { isBasicName: (name: string) => isBasicName(name, e), formatName: (name: string) => formatName(name, e), formatQualifiedName: (name: string) => formatQualifiedName(name, e), formatPath: (path: string) => formatPath(path, e), reservedWords: reservedWords(e) };
}
/** Decodes one quoted name token, for example 'Order Service' or 'it\'s'. */
export function decodeQuotedName(token: string): string { return token.slice(1, -1).replace(/\\(['\\])/g, '$1'); }
/** Reads a name typed by a person or tool. A surrounding quote pair is optional. */
export function parseNameInput(text: string): string { const value = text.trim(); return /^'(?:[^'\\]|\\['\\])*'$/.test(value) ? decodeQuotedName(value) : value; }
/** Reads a typed path such as Shop::'Order Service'.port[2] into its decoded form. Quotes delimit names. */
export function parsePathInput(text: string): string {
    let out = '';
    const value = text.trim();
    for (let i = 0; i < value.length; i++) {
        if (value[i] !== "'") {
            out += value[i];
            continue;
        }
        for (i++; i < value.length && value[i] !== "'"; i++)
            out += value[i] === '\\' && i + 1 < value.length ? value[++i] : value[i];
    }
    return out.replace(/\s*(::|\.|\[)\s*/g, '$1').replace(/\s*\]/g, ']');
}
/** Why a decoded name cannot be written, or undefined when it is legal. */
export function nameProblem(name: string): string | undefined {
    if (!name)
        return 'A name cannot be empty.';
    if (/[\x00-\x1F\x7F]/.test(name))
        return 'A name cannot contain control characters or line breaks.';
    if (/[.:[\]]/.test(name))
        return `A name cannot contain '.', ':', '[' or ']' because they separate paths.`;
    if (!/^\S+(?: \S+)*$/u.test(name))
        return 'A name cannot start or end with a space, repeat spaces or use other whitespace.';
    return undefined;
}
