import { CstUtils, type LangiumDocument } from 'langium';
import type { Formatter } from 'langium/lsp';
import type { TextEdit } from 'vscode-languageserver';
/** Token-preserving canonical whitespace. Formatting is independent of validation. */
export function formatDocument(document: LangiumDocument): string {
    if (document.parseResult.lexerErrors.length || document.parseResult.parserErrors.length)
        throw new Error('Fix syntax errors before formatting.');
    const root = document.parseResult.value.$cstNode;
    if (!root)
        return '';
    const tokens = CstUtils.flattenCst(root).filter(n => n.tokenType.name !== 'WS').toArray();
    let indent = 0, parens = 0, line = '', output = '', previous = '';
    const flush = () => { if (line.trim())
        output += '  '.repeat(Math.max(0, indent)) + line.trim() + '\n'; line = ''; };
    const space = () => { if (line && !line.endsWith(' '))
        line += ' '; };
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i], text = token.text, next = tokens[i + 1]?.text;
        if (token.hidden || text.startsWith('/**')) {
            flush();
            line = text;
            flush();
            previous = '';
            continue;
        }
        if (text === '{') {
            space();
            line += '{';
            flush();
            indent++;
        }
        else if (text === '}') {
            flush();
            indent--;
            line = '}';
            if (![';', ',', ')', ']', 'else', 'or', 'on'].includes(next ?? ''))
                flush();
        }
        else if (text === ';') {
            line = line.trimEnd() + ';';
            if (parens)
                space();
            else
                flush();
        }
        else if (text === '(') {
            if (['if', 'while', 'until', 'for', 'connect', 'or', '=', '+', '-', '*', '/', '%', 'and', 'return', 'not'].includes(previous) || line.trimStart().startsWith('connect '))
                space();
            line += '(';
            parens++;
        }
        else if (text === ')') {
            line = line.trimEnd() + ')';
            parens--;
        }
        else if (['.', '::', '['].includes(text))
            line = line.trimEnd() + text;
        else if (text === ']')
            line = line.trimEnd() + ']';
        else if (text === ':') {
            line = line.trimEnd() + ':';
            space();
        }
        else if (text === ',') {
            line = line.trimEnd() + ',';
            space();
        }
        else {
            const duration = /^(ns|us|ms|s)$/.test(text) && /^\d+$/.test(previous);
            if (line && !['(', '[', '.', '::'].includes(previous) && !duration)
                space();
            line += text;
        }
        previous = text;
    }
    flush();
    return output;
}
export class SwamlFormatter implements Formatter {
    readonly formatOnTypeOptions = undefined;
    formatDocument(document: LangiumDocument): TextEdit[] {
        if (document.parseResult.lexerErrors.length || document.parseResult.parserErrors.length)
            return [];
        const old = document.textDocument.getText(), next = formatDocument(document);
        return old === next ? [] : [{ range: { start: { line: 0, character: 0 }, end: document.textDocument.positionAt(old.length) }, newText: next }];
    }
    formatDocumentRange(): TextEdit[] { return []; }
    formatDocumentOnType(): TextEdit[] { return []; }
}
