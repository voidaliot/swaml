import { DefaultLexer, DefaultLexerErrorMessageProvider, DefaultValueConverter, LangiumParserErrorMessageProvider, type CstNode, type GrammarAST, type LexerResult, type TokenizeOptions, type ValueType } from 'langium';
import { CONTEXTUAL_KEYWORDS, RESERVED_WORDS, decodeQuotedName, formatName } from './names.js';
type Token = Parameters<LangiumParserErrorMessageProvider['buildMismatchTokenMessage']>[0]['actual'];
type TokenKind = Token['tokenType'];
/** Decodes quoted names and normalizes the two case keyword spellings. */
export class SwamlValueConverter extends DefaultValueConverter {
    protected override runConverter(rule: GrammarAST.AbstractRule, input: string, cstNode: CstNode): ValueType {
        if (rule.name === 'UNRESTRICTED_NAME')
            return decodeQuotedName(input);
        if (rule.name === 'CaseKind')
            return input === 'usecase' ? 'useCase' : input === 'verificationcase' ? 'verificationCase' : input;
        return super.runConverter(rule, input, cstNode);
    }
}
// Characters skipped by the current tokenization. Parsing follows tokenization
// synchronously, so hints never mistake a skipped character for a space.
const skipped = new Set<number>();
export class SwamlLexer extends DefaultLexer {
    override tokenize(text: string, options?: TokenizeOptions): LexerResult { skipped.clear(); return super.tokenize(text, options); }
}
const nameToken = (type: TokenKind | undefined) => !!type && (type.name === 'ID' || type.name === 'UNRESTRICTED_NAME' || CONTEXTUAL_KEYWORDS.has(type.name));
const shown = (token: Token) => token.tokenType?.name === 'UNRESTRICTED_NAME' ? decodeQuotedName(token.image) : token.image;
/** Explains the common naming and documentation mistakes after the parser's own message. */
function hint(actual: Token | undefined, previous: Token | undefined, expectsName: boolean): string {
    const type = actual?.tokenType?.name;
    if (!actual || !type)
        return '';
    if (type === 'DOC_COMMENT')
        return ' A /** */ documentation comment belongs first inside the braces of its declaration, or immediately before the semicolon of a leaf declaration.';
    if (expectsName && type === 'STRING')
        return ` Names use single quotes, for example ${formatName(actual.image.slice(1, -1).replace(/[.:[\]]/g, ' ').trim() || 'name')}.`;
    if (RESERVED_WORDS.has(actual.image))
        return ` '${actual.image}' is a reserved word. ${expectsName ? 'Write' : 'If it is meant as a name, write'} it as a quoted name ('${actual.image}') or choose another name.`;
    if (!expectsName && nameToken(actual.tokenType) && nameToken(previous?.tokenType) && (previous!.endOffset ?? previous!.startOffset) + 1 < actual.startOffset && ![...skipped].some(offset => offset > previous!.startOffset && offset < actual.startOffset))
        return ` A name containing spaces must be quoted, for example '${shown(previous!)} ${shown(actual)}'.`;
    return '';
}
export class SwamlParserErrorMessageProvider extends LangiumParserErrorMessageProvider {
    override buildMismatchTokenMessage(options: Parameters<LangiumParserErrorMessageProvider['buildMismatchTokenMessage']>[0]): string {
        const expectsName = nameToken(options.expected);
        return (expectsName ? `Expecting a name but found \`${options.actual.image}\`.` : super.buildMismatchTokenMessage(options)) + hint(options.actual, options.previous, expectsName);
    }
    override buildNoViableAltMessage(options: Parameters<LangiumParserErrorMessageProvider['buildNoViableAltMessage']>[0]): string {
        const first = options.expectedPathsPerAlt.flatMap(alternative => alternative.map(path => path[0])), expectsName = first.length > 0 && first.every(nameToken), actual = options.actual[0];
        return (expectsName && actual ? `Expecting a name but found \`${actual.image}\`.` : super.buildNoViableAltMessage(options)) + hint(actual, options.previous, expectsName);
    }
    override buildEarlyExitMessage(options: Parameters<LangiumParserErrorMessageProvider['buildEarlyExitMessage']>[0]): string {
        return super.buildEarlyExitMessage(options) + hint(options.actual[0], options.previous, false);
    }
}
export class SwamlLexerErrorMessageProvider extends DefaultLexerErrorMessageProvider {
    override buildUnexpectedCharactersMessage(fullText: string, startOffset: number, length: number, line?: number, column?: number): string {
        const message = super.buildUnexpectedCharactersMessage(fullText, startOffset, length, line, column), character = fullText.charAt(startOffset);
        for (let offset = startOffset; offset < startOffset + length; offset++)
            skipped.add(offset);
        if (character === "'")
            return message + " A quoted name needs a closing ' on the same line; write \\' for a quote inside it.";
        if (/\p{L}|\p{N}/u.test(character)) {
            let from = startOffset, to = startOffset + length;
            while (from > 0 && /[\p{L}\p{N}_]/u.test(fullText.charAt(from - 1)))
                from--;
            while (to < fullText.length && /[\p{L}\p{N}_]/u.test(fullText.charAt(to)))
                to++;
            return message + ` Letters outside ASCII need a quoted name, for example '${fullText.slice(from, to)}'.`;
        }
        return message;
    }
}
