import { DefaultLexer, DefaultLexerErrorMessageProvider, DefaultValueConverter, LangiumParserErrorMessageProvider, type CstNode, type GrammarAST, type LexerResult, type TokenizeOptions, type ValueType } from 'langium';
import { CONTEXTUAL_KEYWORDS, RESERVED_WORDS, decodeQuotedName, formatName } from './names.js';
type Token = Parameters<LangiumParserErrorMessageProvider['buildMismatchTokenMessage']>[0]['actual'];
type TokenKind = Token['tokenType'];
/** Decodes quoted names and normalizes the two-word use case keyword to useCase. */
export class SwamlValueConverter extends DefaultValueConverter {
    protected override runConverter(rule: GrammarAST.AbstractRule, input: string, cstNode: CstNode): ValueType {
        if (rule.name === 'UNRESTRICTED_NAME')
            return decodeQuotedName(input);
        if (rule.name === 'CaseKind')
            return input === 'usecase' ? 'useCase' : input;
        return super.runConverter(rule, input, cstNode);
    }
}
// Characters skipped by the current tokenization. Parsing follows tokenization
// synchronously, so hints never mistake a skipped character for a space.
const skipped = new Set<number>();
// The tokens of the current tokenization, so that a syntax message can look past the failing token.
let tokens: readonly Token[] = [];
export class SwamlLexer extends DefaultLexer {
    override tokenize(text: string, options?: TokenizeOptions): LexerResult { skipped.clear(); const result = super.tokenize(text, options); tokens = result.tokens; return result; }
}
/** WP2-D04: the message for if (c) a else b in statement position, where the if statement needs a block. */
export const CONDITIONAL_STATEMENT_MESSAGE = 'A conditional expression is not a statement; use an if block.';
/**
 * Whether the if statement whose block is missing at actual has the shape of a conditional expression
 * (WP2-G02, WP2-D04): an else follows at nesting depth 0 before the next ;, { or }.
 */
function conditionalStatement(actual: Token, previous: Token | undefined): boolean {
    const at = tokens.findIndex(t => t.startOffset === actual.startOffset);
    if (previous?.image !== ')' || at < 1)
        return false;
    // The block is the then block of an if statement: if ( … ) precedes it.
    let open = at - 1;
    for (let depth = 0; open >= 0; open--) {
        depth += tokens[open].image === ')' ? 1 : tokens[open].image === '(' ? -1 : 0;
        if (depth === 0)
            break;
    }
    if (tokens[open - 1]?.image !== 'if')
        return false;
    let depth = 0;
    for (let i = at; i < tokens.length; i++) {
        const text = tokens[i].image;
        if (depth === 0 && [';', '{', '}'].includes(text))
            return false;
        if (depth === 0 && text === 'else')
            return true;
        depth += ['(', '['].includes(text) ? 1 : [')', ']'].includes(text) ? -1 : 0;
        if (depth < 0)
            return false;
    }
    return false;
}
/** Expression rules in which a conditional can only be an operand (WP2-S03). */
const OPERAND_RULES = new Set(['OrExpression', 'AndExpression', 'EqualityExpression', 'RelationalExpression', 'AdditiveExpression', 'MultiplicativeExpression', 'UnaryExpression', 'PrimaryExpression']);
const OPERAND_HINT = ' A conditional expression is a whole expression; as an operand it is written in parentheses, as in (if (c) a else b).';
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
        if (ruleName(options.ruleName) === 'Block' && options.expected.name === '{' && conditionalStatement(options.actual, options.previous))
            return CONDITIONAL_STATEMENT_MESSAGE;
        return (expectsName ? `Expecting a name but found \`${options.actual.image}\`.` : super.buildMismatchTokenMessage(options)) + hint(options.actual, options.previous, expectsName);
    }
    override buildNoViableAltMessage(options: Parameters<LangiumParserErrorMessageProvider['buildNoViableAltMessage']>[0]): string {
        const first = options.expectedPathsPerAlt.flatMap(alternative => alternative.map(path => path[0])), expectsName = first.length > 0 && first.every(nameToken), actual = options.actual[0];
        if (actual?.image === 'if' && OPERAND_RULES.has(ruleName(options.ruleName) ?? ''))
            return super.buildNoViableAltMessage(options) + OPERAND_HINT;
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

/** A Chevrotain grammar production, as far as statement recovery needs it. */
type Production = { idx?: number; definition?: Production[]; nonTerminalName?: string; constructor: { name: string } };
type Decision = { prodOccurrence: number; prodType?: number; rule: { name: string; definition: Production[] } };
type Lookahead = { LA(i: number): { tokenType: TokenKind; image: string } };
/** The lookahead strategy of a Chevrotain parser: the two decision builders statement recovery wraps. */
export type LookaheadStrategy = {
    buildLookaheadForAlternation(options: Decision): (this: Lookahead, alternatives?: unknown) => number | undefined;
    buildLookaheadForOptional(options: Decision): (this: Lookahead) => boolean;
};
/** The productions of a decision: the one of its rule with the given kind and occurrence index. */
function production(rule: Decision['rule'], kind: string, occurrence: number): Production | undefined {
    const stack = [...rule.definition];
    while (stack.length) {
        const p = stack.pop()!;
        if (p.constructor.name === kind && (p.idx ?? 0) === occurrence)
            return p;
        stack.push(...(p.definition ?? []));
    }
    return undefined;
}
/** Langium suffixes Chevrotain rule names with a zero-width space. */
const ruleName = (name: string | undefined) => name?.replace(/​$/u, '');
const startsWith = (p: Production | undefined, name: string) => p?.definition?.[0]?.constructor.name === 'NonTerminal' && ruleName(p.definition[0].nonTerminalName) === name;
/**
 * Statement recovery (WP1). An assignment and an expression statement share a value path prefix of any
 * length (statuses[i].confirmed), so the adaptive lookahead finds no viable alternative while such a
 * statement is still being typed, and a statement list would end there, dropping the rest of its
 * component. When the adaptive prediction fails for a statement that starts with a name, this guess
 * keeps the list going: an assignment when the statement is a place (names joined by . or :: and
 * bracketed indexes) followed by =, otherwise an expression statement; the statement's own error recovery then reports the error and
 * resynchronizes. Valid sources never reach the guess, so their parse is unchanged.
 */
export function recoverStatements(inner: LookaheadStrategy): LookaheadStrategy {
    const strategy = Object.create(inner) as LookaheadStrategy;
    strategy.buildLookaheadForAlternation = options => {
        const base = inner.buildLookaheadForAlternation.call(strategy, options);
        const alternatives = ruleName(options.rule.name) === 'Statement' ? production(options.rule, 'Alternation', options.prodOccurrence)?.definition ?? [] : [];
        const assign = alternatives.findIndex(x => startsWith(x, 'Assign')), expression = alternatives.findIndex(x => startsWith(x, 'ExpressionStatement'));
        if (assign < 0 || expression < 0)
            return base;
        return function (this: Lookahead, choices?: unknown) {
            const predicted = base.call(this, choices);
            if (predicted !== undefined || !nameToken(this.LA(1).tokenType))
                return predicted;
            // Outside brackets, a place is names joined by . or :: and bracketed indexes; anything else ends it.
            let depth = 0, operand = false;
            for (let i = 1; ; i++) {
                const token = this.LA(i), text = token.tokenType.name === 'EOF' ? undefined : token.image;
                if (text === undefined)
                    return expression;
                if (depth === 0) {
                    if (text === '=')
                        return assign;
                    const name = nameToken(token.tokenType);
                    if (name ? operand : !['.', '::', '['].includes(text))
                        return expression;
                    operand = name;
                }
                depth += ['(', '[', '{'].includes(text) ? 1 : [')', ']', '}'].includes(text) ? -1 : 0;
                if (depth < 0)
                    return expression;
                if (depth === 0 && text === ']')
                    operand = true;
            }
        };
    };
    strategy.buildLookaheadForOptional = options => {
        const base = inner.buildLookaheadForOptional.call(strategy, options);
        // PROD_TYPE.REPETITION: the statements of a block, an operation body or a case.
        if (options.prodType !== 1 || !startsWith(production(options.rule, 'Repetition', options.prodOccurrence), 'Statement'))
            return base;
        return function (this: Lookahead) {
            return base.call(this) || nameToken(this.LA(1).tokenType);
        };
    };
    return strategy;
}

/** Marks a lookahead strategy wrapped by recoverStatements, so that a test can see the wrapper in place. */
export const RECOVERS_STATEMENTS: unique symbol = Symbol('swaml.recoverStatements');
/**
 * Installs statement recovery on a prepared, not yet finalized Langium parser. It relies on an internal of the
 * parser library (the Chevrotain wrapper's lookahead strategy); when a library upgrade moves it, this fails
 * with a clear message instead of silently parsing without recovery.
 */
export function applyStatementRecovery(parser: unknown): void {
    const wrapper = (parser as { wrapper?: { lookaheadStrategy?: Partial<LookaheadStrategy> } }).wrapper;
    const inner = wrapper?.lookaheadStrategy;
    if (!wrapper || typeof inner?.buildLookaheadForAlternation !== 'function' || typeof inner.buildLookaheadForOptional !== 'function')
        throw new Error('swa.ml statement recovery needs the Chevrotain lookahead strategy of the Langium parser (parser.wrapper.lookaheadStrategy with buildLookaheadForAlternation and buildLookaheadForOptional); the parser library changed. Update recoverStatements in src/language/swaml-syntax.ts.');
    const strategy = recoverStatements(inner as LookaheadStrategy);
    Object.defineProperty(strategy, RECOVERS_STATEMENTS, { value: true });
    wrapper.lookaheadStrategy = strategy;
}
