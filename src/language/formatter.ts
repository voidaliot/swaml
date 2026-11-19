import { CstUtils, DefaultLexer, DefaultLexerErrorMessageProvider, DefaultTokenBuilder, type LangiumCoreServices, type LeafCstNode, type LangiumDocument, type Lexer } from 'langium';
import type { Formatter } from 'langium/lsp';
import type { TextEdit } from 'vscode-languageserver';
import { isArrayLiteral, isAssociation, isInterruptible, isUnaryExpression, type Association } from './generated/ast.js';
/** Whether an associate statement uses the list form (3.0). */
const isAssociationListNode = (n: unknown): boolean => isAssociation(n) && ((n as Association).moreOccurrences.length > 0 || (n as Association).moreTargets.length > 0);
import { SwamlGrammar } from './generated/grammar.js';
import { SwamlLanguageMetaData } from './generated/module.js';

let languageLexer: Lexer | undefined;
/** The language's lexer, built from the grammar alone, so hosts without language services get the full check. */
export function swamlLexer(): Lexer {
    return languageLexer ??= new DefaultLexer({ Grammar: SwamlGrammar(), LanguageMetaData: SwamlLanguageMetaData, parser: { TokenBuilder: new DefaultTokenBuilder(), LexerErrorMessageProvider: new DefaultLexerErrorMessageProvider() } } as unknown as LangiumCoreServices);
}

/** Raised when canonical formatting would change anything but whitespace; the caller must keep the source unchanged. */
export class FormattingSafetyError extends Error {
    constructor(detail: string) { super('Internal formatter error: canonical formatting would change the source beyond whitespace (' + detail + '); the source was left unchanged.'); this.name = 'FormattingSafetyError'; }
}

const isComment = (leaf: LeafCstNode) => leaf.hidden || leaf.tokenType.name === 'DOC_COMMENT';
/**
 * A line comment may lose trailing blanks and a multi-line comment takes the file's line ending; every other
 * token keeps its exact text.
 */
const canonicalText = (leaf: { text: string, tokenType: { name: string } }, eol = '\n') => leaf.tokenType.name === 'SL_COMMENT' ? leaf.text.trimEnd() : /COMMENT$/.test(leaf.tokenType.name) ? leaf.text.replace(/\r?\n/g, eol) : leaf.text;
/** The dominant line ending of a text: CRLF when most of its line breaks are CRLF, otherwise LF. */
export function lineEnding(text: string): '\r\n' | '\n' {
    const crlf = text.split('\r\n').length - 1, lf = text.split('\n').length - 1;
    return crlf * 2 > lf ? '\r\n' : '\n';
}

/**
 * Output lines under construction. Mutable state lives in fields rather than in variables captured by
 * nested closures: on Node.js 26.12.0 (V8 Maglev on-stack replacement), a closure that read a captured
 * line variable right after the loop assigned it intermittently saw the old value, so comments vanished.
 */
class Printer {
    private readonly lines: string[] = [];
    line = '';
    indent = 0;
    flush(): void {
        const text = this.line.trim();
        if (text)
            this.lines.push('  '.repeat(Math.max(0, this.indent)) + text);
        this.line = '';
    }
    space(): void {
        if (this.line && !this.line.endsWith(' '))
            this.line += ' ';
    }
    attach(text: string): void { this.line = this.line.trimEnd() + text; }
    append(text: string): void { this.line += text; }
    /** Writes a comment on its own line at the current indentation, keeping its text. */
    standalone(text: string): void {
        this.flush();
        this.lines.push('  '.repeat(Math.max(0, this.indent)) + text);
    }
    text(eol: string): string { this.flush(); return this.lines.length ? this.lines.join(eol) + eol : ''; }
    /** Writes finished lines, the first at the current indentation and the others one level deeper. */
    continued(lines: string[]): void {
        this.line = '';
        lines.forEach((text, i) => this.lines.push('  '.repeat(Math.max(0, this.indent) + (i ? 1 : 0)) + text));
    }
}

/** An association list longer than this, indentation included, prints one occurrence or case per continuation line (WP2-M05). */
export const ASSOCIATION_LINE_WIDTH = 100;
/**
 * The continuation lines of an association list (WP2-M05): associate and the first occurrence, then each further
 * occurrence, then to with the first case, then each further case, each line ending at its comma.
 */
function associationLines(tokens: readonly LeafCstNode[]): string[] {
    const lines: string[] = [];
    let line = '';
    for (const token of tokens) {
        if (token.text === 'to' && !line.endsWith(',')) {
            lines.push(line);
            line = '';
        }
        line += token.text === ',' || token.text === ';' || !line ? token.text : ' ' + token.text;
        if (token.text === ',') {
            lines.push(line);
            line = '';
        }
    }
    return [...lines, line];
}

/** Tokens after which an opening parenthesis is spaced rather than attached as a call. */
// wait, after, every and deadline precede the parentheses of a computed duration (WP4-M08).
const SPACED_BEFORE_PARENTHESIS = ['if', 'else', 'while', 'until', 'for', 'connect', 'wait', 'after', 'every', 'deadline', 'or', '=', '==', '!=', '<', '<=', '>', '>=', '+', '-', '*', '/', '%', 'and', 'return', 'not'];

/** Whether the comment at index i stands between else and if, with only comments around it. */
function betweenElseAndIf(tokens: readonly LeafCstNode[], i: number): boolean {
    let before = i - 1, after = i + 1;
    while (before >= 0 && isComment(tokens[before]))
        before--;
    while (after < tokens.length && isComment(tokens[after]))
        after++;
    return tokens[before]?.text === 'else' && tokens[after]?.text === 'if';
}

function canonical(tokens: LeafCstNode[], eol: string): string {
    const p = new Printer();
    let parens = 0, previous = '', glue = false, association = -1;
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i], text = canonicalText(token, eol), following = tokens[i + 1], next = following?.text;
        if (isComment(token)) {
            // A leaf declaration's documentation stays before its semicolon on the declaration line.
            if (token.tokenType.name !== 'SL_COMMENT' && next === ';') {
                p.space();
                p.append(text);
                previous = text;
            }
            else if (betweenElseAndIf(tokens, i) && !/[\r\n]/.test(text)) {
                // SIF-G01: else if stays on one line; a comment between the two words stays on it too, and a line
                // comment ends that line, so if starts the next one.
                p.space();
                p.append(text);
                if (token.tokenType.name === 'SL_COMMENT')
                    p.flush();
                previous = 'else';
            }
            else {
                p.standalone(text);
                previous = '';
            }
            glue = false;
            continue;
        }
        if (text === 'associate' && isAssociation(token.astNode) && !p.line.trim())
            association = i;
        if (text === '{') {
            p.space();
            p.append('{');
            p.flush();
            p.indent++;
        }
        else if (text === '}') {
            p.flush();
            p.indent--;
            p.line = '}';
            // Only else, or and the handler of an interruptible region continue after a closing brace.
            const continues = [';', ',', ')', ']', 'else', 'or'].includes(next ?? '') || next === 'on' && isInterruptible(following!.astNode);
            if (!continues)
                p.flush();
        }
        else if (text === ';') {
            p.attach(';');
            // An association list that does not fit prints one occurrence or case per continuation line (WP2-M05).
            const listed = association >= 0 && isAssociation(token.astNode) && token.astNode === tokens[association].astNode ? tokens.slice(association, i + 1) : undefined;
            association = -1;
            if (listed && !listed.some(isComment) && (isAssociationListNode(token.astNode)) && 2 * Math.max(0, p.indent) + p.line.trim().length > ASSOCIATION_LINE_WIDTH)
                p.continued(associationLines(listed));
            else if (parens)
                p.space();
            else
                p.flush();
        }
        else if (text === '(') {
            // A parenthesized branch of a conditional is spaced after its condition: if (c) (a + b) else (a - b).
            if (!glue && (SPACED_BEFORE_PARENTHESIS.includes(previous) || previous === ')' || p.line.trimStart().startsWith('connect ')))
                p.space();
            p.append('(');
            parens++;
        }
        else if (text === ')') {
            p.attach(')');
            parens--;
        }
        else if (text === '[' && isArrayLiteral(token.astNode)) {
            // An array literal is a value and is spaced like one; an index or a type size attaches.
            if (!glue && !['(', '['].includes(previous))
                p.space();
            p.append('[');
        }
        else if (['.', '::', '['].includes(text))
            p.attach(text);
        else if (text === ']')
            p.attach(']');
        else if (text === ':') {
            p.attach(':');
            p.space();
        }
        else if (text === ',') {
            p.attach(',');
            p.space();
        }
        else {
            const duration = /^(ns|us|ms|s)$/.test(text) && /^\d+$/.test(previous);
            if (!glue && !['(', '[', '.', '::'].includes(previous) && !duration)
                p.space();
            p.append(text);
        }
        // A unary minus attaches to its operand.
        glue = text === '-' && isUnaryExpression(token.astNode);
        previous = text;
    }
    return p.text(eol);
}

/** Lexes text into its non-whitespace tokens in source order. */
function lexed(lexer: Lexer, text: string): { name: string, text: string }[] | string {
    const result = lexer.tokenize(text);
    if (result.errors.length)
        return 'lexing error ' + (result.errors[0].message ?? '');
    return [...result.tokens, ...(result.hidden ?? [])].filter(t => t.tokenType.name !== 'WS').sort((a, b) => a.startOffset - b.startOffset).map(t => ({ name: t.tokenType.name, text: canonicalText({ text: t.image, tokenType: t.tokenType }) }));
}

/**
 * Proves that formatted text differs from its source only in whitespace: every parsed token, comments
 * and documentation included, appears in order with its exact text, separated only by whitespace, and
 * no other non-whitespace character is added or lost. Both texts must also lex to the same token stream,
 * so no two tokens merge; without a lexer argument the language's own lexer is used. Line endings inside
 * comments may change to the source's dominant line ending.
 */
export function verifyFormatting(source: string, tokens: readonly LeafCstNode[], formatted: string, lexer: Lexer = swamlLexer()): void {
    const eol = lineEnding(source);
    let at = 0;
    for (const token of tokens) {
        while (at < formatted.length && /\s/.test(formatted[at]))
            at++;
        const text = canonicalText(token, eol);
        if (!formatted.startsWith(text, at))
            throw new FormattingSafetyError(`token ${JSON.stringify(text.slice(0, 40))} at source offset ${token.offset} is missing or changed`);
        at += text.length;
    }
    if (formatted.slice(at).trim())
        throw new FormattingSafetyError('text was added after the last token');
    const strip = (s: string) => s.replace(/\s+/g, '');
    if (strip(source) !== strip(formatted))
        throw new FormattingSafetyError('non-whitespace characters outside the parsed tokens differ');
    const before = lexed(lexer, source), after = lexed(lexer, formatted);
    if (typeof after === 'string')
        throw new FormattingSafetyError(after);
    if (typeof before !== 'string') {
        const index = before.findIndex((t, i) => after[i]?.name !== t.name || after[i]?.text !== t.text);
        if (index >= 0 || before.length !== after.length)
            throw new FormattingSafetyError(`token stream differs at token ${index >= 0 ? index : Math.min(before.length, after.length)}`);
    }
}

/**
 * Token-preserving canonical whitespace. Formatting is independent of validation. Lines end with the
 * source's dominant line ending (CRLF when most line breaks are CRLF, otherwise LF), also inside multi-line
 * comments. The result is verified against the source and re-lexed (with the language's own lexer when no
 * lexer is passed), and a FormattingSafetyError is thrown instead of returning text that loses, reorders or
 * changes a comment, documentation or any other token. A host that catches it must keep the source as is
 * and report the error; it indicates a formatter defect, not a problem in the model.
 */
export function formatDocument(document: LangiumDocument, lexer: Lexer = swamlLexer()): string {
    if (document.parseResult.lexerErrors.length || document.parseResult.parserErrors.length)
        throw new Error('Fix syntax errors before formatting.');
    const root = document.parseResult.value.$cstNode, source = document.textDocument.getText();
    const tokens = root ? CstUtils.flattenCst(root).filter(n => n.tokenType.name !== 'WS').toArray() : [];
    const formatted = canonical(tokens, lineEnding(source));
    verifyFormatting(source, tokens, formatted, lexer);
    return formatted;
}
export class SwamlFormatter implements Formatter {
    readonly formatOnTypeOptions = undefined;
    constructor(private readonly lexer?: Lexer) { }
    formatDocument(document: LangiumDocument): TextEdit[] {
        if (document.parseResult.lexerErrors.length || document.parseResult.parserErrors.length)
            return [];
        const old = document.textDocument.getText(), next = formatDocument(document, this.lexer);
        return old === next ? [] : [{ range: { start: { line: 0, character: 0 }, end: document.textDocument.positionAt(old.length) }, newText: next }];
    }
    formatDocumentRange(): TextEdit[] { return []; }
    formatDocumentOnType(): TextEdit[] { return []; }
}
