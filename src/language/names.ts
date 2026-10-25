/** Portable name spelling shared by the language core and hosts. No host I/O. */
export const BASIC_NAME = /^[_a-zA-Z]\w*$/;
/** Grammar words that remain legal names outside their syntactic positions. */
export const CONTEXTUAL_KEYWORDS: ReadonlySet<string> = new Set(['actor', 'case', 'extend', 'from', 'kind', 'name', 'path', 'request', 'reversed', 'subject', 'times', 'to', 'use', 'verification']);
/** Reserved words need a quoted name, for example 'state'. Checked against the grammar by the test suite. */
export const RESERVED_WORDS: ReadonlySet<string> = new Set(['after', 'and', 'assert', 'attribute', 'bool', 'byte', 'call', 'component', 'concurrent', 'connect', 'const', 'datatype', 'deadline', 'def', 'deploy', 'deployment', 'else', 'entry', 'enum', 'event', 'every', 'exit', 'fail', 'false', 'final', 'for', 'idempotent', 'if', 'import', 'in', 'include', 'initial', 'int', 'interruptible', 'ms', 'not', 'ns', 'of', 'on', 'operation', 'optional', 'or', 'out', 'package', 'port', 'provides', 'publish', 'qos', 'real', 'receive', 'record', 'recursive', 'redefines', 'reply', 'requirement', 'requires', 'return', 'returns', 's', 'satisfy', 'schedule', 'send', 'specializes', 'start', 'state', 'string', 'true', 'try', 'uint', 'until', 'us', 'useCase', 'var', 'verificationCase', 'verify', 'via', 'view', 'void', 'wait', 'when', 'where', 'while']);
/** True when a name can be written without quotes. */
export function isBasicName(name: string): boolean { return BASIC_NAME.test(name) && !RESERVED_WORDS.has(name); }
/** Source spelling of one name: basic when possible, otherwise single-quoted with escapes. */
export function formatName(name: string): string { return isBasicName(name) ? name : `'${name.replace(/[\\']/g, c => '\\' + c)}'`; }
/** Source spelling of a package or qualified name such as Shop::'Order Service'. */
export function formatQualifiedName(name: string): string { return name.split('::').map(formatName).join('::'); }
/** Source spelling of an occurrence or member path; literal indexes stay unquoted. */
export function formatPath(path: string): string {
    const colon = path.lastIndexOf('::'), head = colon < 0 ? '' : formatQualifiedName(path.slice(0, colon)) + '::';
    return head + path.slice(colon < 0 ? 0 : colon + 2).split('.').map(part => { const [, name, index] = /^(.*?)((?:\[\d+\])?)$/.exec(part)!; return formatName(name) + index; }).join('.');
}
/** Decodes one quoted name token, for example 'Order Service' or 'it\'s'. */
export function decodeQuotedName(token: string): string { return token.slice(1, -1).replace(/\\(['\\])/g, '$1'); }
/** Reads a name typed by a person or tool. A surrounding quote pair is optional. */
export function parseNameInput(text: string): string { const value = text.trim(); return /^'(?:[^'\\]|\\['\\])*'$/.test(value) ? decodeQuotedName(value) : value; }
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
