import { DefaultLexer, DefaultLexerErrorMessageProvider, DefaultValueConverter, LangiumParserErrorMessageProvider, type CstNode, type GrammarAST, type LexerResult, type TokenizeOptions, type ValueType } from 'langium';
import { CONTEXTUAL_KEYWORDS, MESSAGE_SPELLING, RESERVED_WORDS, decodeQuotedName, formatName, quoteName } from './names.js';
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
/** WP2-D05 (a): open bracket nesting a statement may reach; above every depth the 2.2 reference implementation parses. */
export const BRACKET_NESTING_LIMIT = 200;
/** WP2-D05 (b): open bracket nesting a statement that ends unbalanced may reach before its recovery is bounded. */
export const UNCLOSED_NESTING_LIMIT = 32;
/** The start of the message of the lexing error that stops a statement at the bracket nesting limit (SW2013). */
export const BRACKET_NESTING_MESSAGE = `Bracket nesting exceeds the reference parser limit of ${BRACKET_NESTING_LIMIT} levels`;
/** The leading clause shared by every parser nesting stop, which the document validator reports as SW2013. */
export const BRACKET_NESTING_CLAUSE = 'Bracket nesting exceeds the reference parser limit';
export class SwamlLexer extends DefaultLexer {
    override tokenize(text: string, options?: TokenizeOptions): LexerResult {
        skipped.clear();
        const result = super.tokenize(text, options);
        guardNesting(result);
        guardStateForms(result, (this as unknown as { tokenTypes: Record<string, TokenKind> }).tokenTypes?.['if']);
        tokens = result.tokens;
        return result;
    }
}
/** A condition written when (c) { … } as an item of a state (a 2.2 or draft habit): 3.0 writes if (c). */
export const WHEN_IN_STATE_MESSAGE = 'when is no word of swa.ml 3.0: a condition in a state is written if (c) { … }, and the state looks at it again each time something happens to it.';
/**
 * Half-typed or misplaced state forms after which the parser cannot resynchronise, found on the tokens before parsing so
 * that one message says what is wrong and the rest of the package is kept (final-package review, M1):
 * - after D { … } (or a short leave) outside a state's braces and outside a schedule: not parsed, one error;
 * - an event line of a state joined to another by or (on receive p.m() or receive p.k() { … }, or a block followed by
 *   or receive … { … }): the joined part is not parsed, one error, the first line is kept;
 * - when (c) { … } as an item of a state: read as if (c) { … }, with one error that says when is gone;
 * - a state written directly inside on entry or on exit: not parsed, one error.
 * Only braces are tracked: a { after state <name> opens a state, after schedule a schedule, after on entry / on exit an
 * action, any other { a block. A valid source never contains these shapes, so its tokens are unchanged.
 */
function guardStateForms(result: LexerResult, ifType: TokenKind | undefined): void {
    const all = result.tokens, kinds: string[] = [], drop: [number, number][] = [];
    const report = (t: Token, message: string) => result.errors.push({ offset: t.startOffset, line: t.startLine, column: t.startColumn, length: t.image.length, message });
    const leave = (t: Token | undefined) => t?.tokenType.name === 'exit' || t?.tokenType.name === 'to';
    /** The index just after the } that closes the { at i. */
    const closing = (i: number) => { for (let j = i, d = 0; j < all.length; j++) { if (all[j].image === '{') d++; else if (all[j].image === '}' && --d === 0) return j + 1; } return all.length; };
    /** From i, the first { or leave word outside parentheses: where a body starts; -1 at a ; or } first. */
    const bodyStart = (i: number) => {
        for (let j = i, d = 0; j < all.length; j++) {
            const x = all[j].image;
            d += x === '(' ? 1 : x === ')' ? -1 : 0;
            if (d === 0 && (x === '{' || leave(all[j])))
                return j;
            if (d <= 0 && (x === ';' || x === '}'))
                return -1;
        }
        return -1;
    };
    /** The end (exclusive) of the body that starts at j: its block, or a short leave up to its ;. */
    const bodyEnd = (j: number) => {
        if (j < 0)
            return -1;
        if (all[j].image === '{')
            return closing(j);
        let k = j;
        while (k < all.length && !['{', '}', ';'].includes(all[k].image))
            k++;
        return all[k]?.image === ';' ? k + 1 : -1;
    };
    const skip = (i: number, end: number, t: Token, message: string) => { report(t, message); drop.push([i, end]); return end - 1; };
    for (let i = 0; i < all.length; i++) {
        const t = all[i], text = t.image, type = t.tokenType.name;
        if (text === '{') {
            const before = all[i - 1]?.tokenType.name, twoBefore = all[i - 2]?.tokenType.name;
            kinds.push(twoBefore === 'state' && nameToken(all[i - 1]?.tokenType) ? 'state' : before === 'schedule' ? 'schedule' : (before === 'entry' || before === 'exit') && twoBefore === 'on' ? 'action' : 'block');
            continue;
        }
        if (text === '}') {
            kinds.pop();
            continue;
        }
        const atStart = i === 0 || [';', '{', '}'].includes(all[i - 1].image), inner = kinds[kinds.length - 1];
        if (type === 'after' && atStart && kinds.length > 0 && inner !== 'state' && inner !== 'schedule') {
            const end = bodyEnd(bodyStart(i + 1));
            if (end > 0) {
                i = skip(i, end, t, AFTER_OUTSIDE_STATE_MESSAGE);
                continue;
            }
        }
        if (type === 'state' && atStart && inner === 'action' && nameToken(all[i + 1]?.tokenType) && all[i + 2]?.image === '{') {
            i = skip(i, closing(i + 2), t, STATE_IN_ACTION_MESSAGE);
            continue;
        }
        if (text === 'when' && atStart && inner === 'state' && all[i + 1]?.image === '(' && ifType && bodyEnd(bodyStart(i + 1)) > 0) {
            report(t, WHEN_IN_STATE_MESSAGE);
            (t as { tokenType: TokenKind }).tokenType = ifType;
            (t as unknown as { tokenTypeIdx?: number }).tokenTypeIdx = (ifType as unknown as { tokenTypeIdx?: number }).tokenTypeIdx;
            continue;
        }
        if (type === 'or' && inner === 'state' && (['receive', 'call', 'after'].includes(all[i + 1]?.tokenType.name ?? '') || all[i - 1]?.image === ')' && nameToken(all[i + 1]?.tokenType) && all[i + 2]?.image === '.')) {
            const start = bodyStart(i + 1);
            // Joined heads: the first head keeps the body. A joined branch after a body: dropped with its own body.
            const end = all[i - 1]?.image === ')' ? start : all[i - 1]?.image === '}' ? bodyEnd(start) : -1;
            if (end > 0) {
                i = skip(i, end, t, OR_IN_STATE_MESSAGE);
                continue;
            }
        }
    }
    if (drop.length) {
        const gone = new Set<number>();
        for (const [s, e] of drop)
            for (let k = s; k < e; k++)
                gone.add(k);
        result.tokens = all.filter((_, k) => !gone.has(k));
    }
}
/**
 * WP2-D05: the reference parser's bracket nesting limits (SW2013). The guard scans the tokens of every statement or
 * declaration: the tokens between two ;, { or } that appear while no bracket is open. Within it, an open bracket
 * is a ( or [, a { that opens a record literal (after record and a qualified name), and any other { while a
 * bracket is open; ) ] } close the innermost one when it is of their kind. The statement ends at the next ;, { or
 * } with no bracket open, or, unbalanced, at a ) ] } that does not match the innermost open bracket, at a ; while
 * a ( or [ other than the parenthesis of a for statement is innermost, or at the end of the file.
 * (a) Open nesting deeper than BRACKET_NESTING_LIMIT anywhere in a statement stops it at the first bracket beyond
 *     the limit. The limit is above every depth the 2.2 reference implementation parses (WP2-D05).
 * (b) A statement that ends unbalanced and whose open nesting exceeded UNCLOSED_NESTING_LIMIT is stopped at its
 *     first token, because the parser's recovery from unclosed brackets costs superlinear time and stack.
 * A stopped statement's tokens, from its first token to its end (including an ending ;, excluding an ending
 * bracket or brace), are not parsed and one lexing error is reported for it; the tokens after it are parsed as
 * usual. A statement that never ends unbalanced and never returns to depth 0 extends to the end of the file.
 */
function guardNesting(result: LexerResult): void {
    const all = result.tokens, dropped: [number, number][] = [], open: string[] = [];
    let start = 0, deepest = 0, over = -1, record = false;
    const finish = (to: number, unclosed: boolean) => {
        const limit = over >= 0 ? BRACKET_NESTING_LIMIT : unclosed && deepest > UNCLOSED_NESTING_LIMIT ? UNCLOSED_NESTING_LIMIT : 0;
        if (limit) {
            const token = all[over >= 0 ? over : start];
            result.errors.push({ offset: token.startOffset, line: token.startLine, column: token.startColumn, length: token.image.length, message: over >= 0
                ? `${BRACKET_NESTING_MESSAGE}; this statement is not parsed. Split the expression into local variables.`
                : `${BRACKET_NESTING_CLAUSE} of ${UNCLOSED_NESTING_LIMIT} levels for a statement that leaves brackets unclosed; this statement is not parsed. Close the brackets.` });
            dropped.push([start, to]);
        }
        open.length = deepest = 0;
        over = -1;
    };
    for (let i = 0; i < all.length; i++) {
        const text = all[i].image;
        if (text.length !== 1 || !'([{}]);'.includes(text)) {
            // A record literal's brace follows record and a qualified name.
            record = text === 'record' ? all[i].tokenType.name === 'record' : record && (text === '::' || nameToken(all[i].tokenType));
            continue;
        }
        const recordBrace = text === '{' && record, top = open[open.length - 1];
        record = false;
        if (text === '(' || text === '[' || recordBrace || text === '{' && top) {
            open.push(text === '(' && all[i - 1]?.image === 'for' ? 'for' : text);
            if (open.length > deepest)
                deepest = open.length;
            if (open.length > BRACKET_NESTING_LIMIT && over < 0)
                over = i;
        } else if (!top) {
            if (text === ';' || text === '{' || text === '}') {
                finish(text === ';' ? i + 1 : i, false);
                start = i + 1;
            }
        } else if (text === ')' || text === ']' || text === '}') {
            if (top === (text === ')' ? '(' : text === ']' ? '[' : '{') || text === ')' && top === 'for')
                open.pop();
            else {
                finish(i, true);
                start = i + 1;
            }
        } else if (text === ';' && (top === '(' || top === '[')) {
            finish(i + 1, true);
            start = i + 1;
        }
    }
    finish(all.length, open.length > 0);
    if (dropped.length) {
        const kept: typeof all = [];
        for (let i = 0, range = 0; i < all.length; i++) {
            while (range < dropped.length && i >= dropped[range][1])
                range++;
            if (range === dropped.length || i < dropped[range][0])
                kept.push(all[i]);
        }
        result.tokens = kept;
    }
}
/** WP2-D04: the message for if (c) a else b in statement position, where the if statement needs a block. */
/** SIF-S08: the one hint for a body without braces that is not a leave. */
export const SHORT_BODY_HINT = ' Only exit; and to S; may be written without braces.';
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
        return ` Names use single quotes, for example ${quoteName(actual.image.slice(1, -1).replace(/[.:[\]]/g, ' ').trim() || 'name')}.`;
    if (RESERVED_WORDS.has(actual.image))
        return ` '${actual.image}' is a reserved word. ${expectsName ? 'Write' : 'If it is meant as a name, write'} it as a quoted name ('${actual.image}') or choose another name.`;
    // state <name> { after a name starts a state after a statement whose ; is missing; it is never a name with a space.
    const at = tokens.findIndex(x => x.startOffset === actual.startOffset), stateStart = type === 'state' && nameToken(tokens[at + 1]?.tokenType) && tokens[at + 2]?.image === '{';
    if (!expectsName && !stateStart && nameToken(actual.tokenType) && nameToken(previous?.tokenType) && (previous!.endOffset ?? previous!.startOffset) + 1 < actual.startOffset && ![...skipped].some(offset => offset > previous!.startOffset && offset < actual.startOffset))
        return ` A name containing spaces must be quoted, for example '${shown(previous!)} ${shown(actual)}'.`;
    return '';
}
/**
 * WP4: a computed duration that is missing its expression, such as wait ( or after ( followed by something that
 * cannot start an expression, is explained in one line instead of the list of every expression start. Only the
 * keyword forms new in 3.0 (wait, after, every and deadline directly followed by an opening parenthesis) qualify,
 * so no 2.2 message changes.
 */
function computedDurationHint(actual: Token | undefined, previous: Token | undefined): string | undefined {
    if (!actual || previous?.image !== '(')
        return undefined;
    const index = tokens.findIndex(t => t.startOffset === previous.startOffset), keyword = index > 0 ? tokens[index - 1].image : undefined;
    return keyword && ['wait', 'after', 'every', 'deadline'].includes(keyword) && tokens[index - 1].tokenType?.name === keyword
        ? `Expecting a duration expression after ${keyword} (, such as ${keyword} (n * 1ms), but found \`${actual.image}\`.`
        : undefined;
}
/**
 * A block that the member-start recovery ended (stateMemberStart) at on receive p.m(…) to is missing its }. The
 * message says so instead of calling on a reserved word. 2.2 never reports a missing } at these tokens: it reads
 * on receive p.m(…) as a receive statement, so no 2.2 message changes.
 */
const MISSING_BRACE_HINT = ' The block before it is not closed: add } before this state member.';
/** A timer line written outside a state's braces (SIF-S08): it is a line of a state, and the flow waits with wait D;. */
export const AFTER_OUTSIDE_STATE_MESSAGE = 'after D { … } is a line of a state and stands only directly in a state\'s braces; to wait in the flow, write wait D;.';
/** A receive line of a state joined to another by or: a state takes one line per member and looks at all of them. */
export const OR_IN_STATE_MESSAGE = 'An event line of a state takes one member and is not joined by or: write one on receive line per member (the state looks at all its lines); or joins the branches of a receive statement in the flow.';
/** A state written inside on entry or on exit (the member-start recovery ends the block there). */
export const STATE_IN_ACTION_MESSAGE = 'A state does not stand inside on entry or on exit: close the block with } before it. A state stands in the flow or directly in a parent state\'s braces.';
/**
 * The innermost state whose braces are still open at actual, when a } is missing before a member or element: an unclosed
 * state takes everything after it. Only a source with states (new in 3.0) gets this hint, so no 2.2 message changes.
 */
function unclosedState(actual: Token | undefined): string | undefined {
    const index = actual ? tokens.findIndex(t => t.startOffset === actual.startOffset) : -1;
    // The column a line starts at, from the first token on it (tokens carry lines and columns).
    const indent = (i: number) => { let j = i; while (j > 0 && tokens[j - 1].startLine === tokens[i].startLine) j--; return tokens[j].startColumn ?? 0; };
    const open: { name?: string; at: number }[] = [];
    let dedented: string | undefined;
    for (let i = 0; i < index; i++) {
        const text = tokens[i].image;
        if (text === '{')
            open.push({ name: tokens[i - 2]?.tokenType?.name === 'state' && nameToken(tokens[i - 1]?.tokenType) ? shown(tokens[i - 1]) : undefined, at: i });
        else if (text === '}') {
            const o = open.pop();
            // A } that starts its line left of the state it closes was written for an outer block: that state is unclosed.
            if (o?.name !== undefined && dedented === undefined && indent(i) === tokens[i].startColumn && (tokens[i].startColumn ?? 0) < indent(o.at))
                dedented = o.name;
        }
    }
    return open.filter(x => x.name !== undefined).at(-1)?.name ?? dedented;
}
function memberAfterUnclosedBlock(actual: Token | undefined): boolean {
    const index = actual ? tokens.findIndex(t => t.startOffset === actual.startOffset) : -1;
    if (index < 0)
        return false;
    const at = (i: number) => tokens[index + i];
    if (actual!.tokenType?.name !== 'on' || at(1)?.tokenType?.name !== 'receive')
        return false;
    for (let i = 2, depth = 0; at(i); i++) {
        const text = at(i).image;
        if ([';', '{', '}'].includes(text))
            return false;
        depth += text === '(' ? 1 : text === ')' ? -1 : 0;
        if (depth < 0)
            return false;
        if (depth === 0 && text === ')')
            return at(i + 1)?.tokenType?.name === 'to';
    }
    return false;
}
/**
 * SIF-G01: a release guard is written if (g); the WP7 candidate spelling when (g) is not accepted (when is no word of
 * 3.0). The parser's message keeps its fixed leading text and explains the spelling. A guard written after
 * deadline or concurrent gets the same explanation instead of calling if a reserved word.
 */
export const RELEASE_GUARD_HINT = ' A release guard is written if (condition) after the call, as in f() if (ready) deadline 2ms.';
/** Whether the if at actual follows the deadline or concurrent of its own schedule entry: a guard written too late (review F2). */
function guardAfterModifier(actual: Token): boolean {
    if (actual.tokenType?.name !== 'if')
        return false;
    for (let i = tokens.findIndex(t => t.startOffset === actual.startOffset) - 1, depth = 0; i >= 0; i--) {
        const text = tokens[i].image;
        depth += text === ')' ? 1 : text === '(' ? -1 : 0;
        if (depth < 0 || depth === 0 && [';', '{', '}'].includes(text))
            return false;
        if (depth === 0 && ['deadline', 'concurrent'].includes(tokens[i].tokenType?.name ?? ''))
            return true;
    }
    return false;
}
export class SwamlParserErrorMessageProvider extends LangiumParserErrorMessageProvider {
    override buildMismatchTokenMessage(options: Parameters<LangiumParserErrorMessageProvider['buildMismatchTokenMessage']>[0]): string {
        const expectsName = nameToken(options.expected);
        if (ruleName(options.ruleName) === 'Block' && options.expected.name === '{' && conditionalStatement(options.actual, options.previous))
            return CONDITIONAL_STATEMENT_MESSAGE;
        if (ruleName(options.ruleName) === 'ScheduleEntry' && (options.actual.image === 'when' || guardAfterModifier(options.actual)))
            return super.buildMismatchTokenMessage(options) + RELEASE_GUARD_HINT;
        if (options.expected.name === '}' && memberAfterUnclosedBlock(options.actual))
            return super.buildMismatchTokenMessage(options) + MISSING_BRACE_HINT;
        if (options.expected.name === '}') {
            const rule = ruleName(options.ruleName), actual = options.actual.tokenType?.name;
            if (actual === 'after' && ['OperationBody', 'Block', 'Scenario'].includes(rule ?? ''))
                return AFTER_OUTSIDE_STATE_MESSAGE;
            if (actual === 'or' && rule === 'StateStep' && tokens[tokens.findIndex(t => t.startOffset === options.actual.startOffset) - 1]?.image === '}')
                return OR_IN_STATE_MESSAGE;
            if (actual === 'state' && rule === 'Block')
                return STATE_IN_ACTION_MESSAGE;
            const state = RESERVED_WORDS.has(options.actual.image) ? unclosedState(options.actual) : undefined;
            if (state !== undefined)
                return `${super.buildMismatchTokenMessage(options)} The state ${formatName(state, MESSAGE_SPELLING)} is not closed: add its } (a state takes everything up to its } as its items and inner states).`;
        }
        return (expectsName ? `Expecting a name but found \`${options.actual.image}\`.` : super.buildMismatchTokenMessage(options)) + hint(options.actual, options.previous, expectsName);
    }
    override buildNoViableAltMessage(options: Parameters<LangiumParserErrorMessageProvider['buildNoViableAltMessage']>[0]): string {
        const first = options.expectedPathsPerAlt.flatMap(alternative => alternative.map(path => path[0])), expectsName = first.length > 0 && first.every(nameToken), actual = options.actual[0];
        const duration = computedDurationHint(actual, options.previous);
        if (duration)
            return duration;
        if (actual?.image === 'if' && OPERAND_RULES.has(ruleName(options.ruleName) ?? ''))
            return super.buildNoViableAltMessage(options) + OPERAND_HINT;
        // A body after if (…), else or an event line head: a block, or without braces only exit; or to S; (SIF-S08). The
        // message stays the block message of 2.2, with the conditional statement message where that shape is written.
        const block = options.expectedPathsPerAlt.flat().find(path => path[0]?.name === '{')?.[0];
        if (block && actual && first.every(t => ['{', 'exit', 'to'].includes(t.name)) && ['If', 'EventLine'].includes(ruleName(options.ruleName) ?? '')) {
            if (ruleName(options.ruleName) === 'If' && conditionalStatement(actual, options.previous))
                return CONDITIONAL_STATEMENT_MESSAGE;
            return super.buildMismatchTokenMessage({ expected: block, actual, previous: options.previous, ruleName: options.ruleName }) + SHORT_BODY_HINT + hint(actual, options.previous, false);
        }
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
        // A NonTerminal's definition is the called rule's: stay within this rule.
        if (p.constructor.name !== 'NonTerminal')
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
 * component. When the adaptive prediction of the Statement alternation fails for a statement that starts
 * with a name, its hook keeps the list going: an assignment when the statement is a place (names joined by
 * . or :: and bracketed indexes) followed by =, otherwise an expression statement; the statement's own error
 * recovery then reports the error and resynchronizes. The hook on the optional statement repetition only ends
 * an unclosed reaction block at the next state member (WP5, stateMemberStart). After else, a token that starts
 * neither a block nor an if predicts the block, so the missing { is reported and recovered as in 2.2 (SIF-G01).
 * Valid sources never reach these cases, so their parse is unchanged.
 */
export function recoverStatements(inner: LookaheadStrategy): LookaheadStrategy {
    const strategy = Object.create(inner) as LookaheadStrategy;
    strategy.buildLookaheadForAlternation = options => {
        const base = inner.buildLookaheadForAlternation.call(strategy, options);
        if (ruleName(options.rule.name) === 'Expression') {
            // A conditional's branch never starts with {: if (…) { is an if statement (WP2 review H2). An
            // incomplete line typed above an if statement then fails at if, as in 2.2, and the statement list
            // resynchronises instead of losing the rest of the component. Valid sources never reach this case.
            const choices = production(options.rule, 'Alternation', options.prodOccurrence)?.definition ?? [];
            const conditional = choices.findIndex(x => startsWith(x, 'ConditionalExpression')), operator = choices.findIndex((_, i) => i !== conditional);
            if (conditional >= 0 && operator >= 0)
                return function (this: Lookahead, alternatives?: unknown) {
                    const predicted = base.call(this, alternatives);
                    if (predicted !== conditional || this.LA(2).image !== '(')
                        return predicted;
                    for (let i = 3, depth = 1; ; i++) {
                        const token = this.LA(i);
                        if (token.tokenType.name === 'EOF')
                            return predicted;
                        depth += token.image === '(' ? 1 : token.image === ')' ? -1 : 0;
                        if (depth === 0)
                            return this.LA(i + 1).image === '{' ? operator : predicted;
                    }
                };
        }
        if (ruleName(options.rule.name) === 'If') {
            // SIF-G01: else is followed by a block or, from 3.0, by an if. Anything else predicts the block, so the
            // block's { is reported and recovered exactly as by the 2.2 parser, whose else took a block only, instead
            // of a list of both alternatives that would also recover differently. Valid sources never reach this case.
            const choices = production(options.rule, 'Alternation', options.prodOccurrence)?.definition ?? [];
            const block = choices.findIndex(x => startsWith(x, 'Block'));
            if (block >= 0 && choices.some(x => startsWith(x, 'ElseIf')))
                return function (this: Lookahead, choices?: unknown) {
                    return base.call(this, choices) ?? block;
                };
        }
        // The items of a state's braces (StateMember) recover as statements do: a half-typed jump such as a bare to before
        // the next item reads as an expression statement whose ; is missing, so the following items, states and members
        // are kept (SIF-G01).
        const alternatives = ['Statement', 'StateMember'].includes(ruleName(options.rule.name) ?? '') ? production(options.rule, 'Alternation', options.prodOccurrence)?.definition ?? [] : [];
        const assign = alternatives.findIndex(x => startsWith(x, 'Assign')), expression = alternatives.findIndex(x => startsWith(x, 'ExpressionStatement'));
        if (assign < 0 || expression < 0)
            return base;
        const stateStep = alternatives.findIndex(x => startsWith(x, 'StateStep'));
        return function (this: Lookahead, choices?: unknown) {
            // A state written without its name, state { … }, is a state: its missing name is reported and inserted, and
            // the state, its items and the rest of the package are kept (state is a contextual word and would otherwise
            // read as an expression statement whose ; is missing). A valid source never writes state {.
            if (stateStep >= 0 && this.LA(1).tokenType.name === 'state' && this.LA(2).image === '{')
                return stateStep;
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
        // The statements of a block, an operation body or a case (Chevrotain names the production type 'Repetition').
        const prodType = options.prodType as unknown;
        if (prodType !== 'Repetition' || !startsWith(production(options.rule, 'Repetition', options.prodOccurrence), 'Statement'))
            return base;
        return function (this: Lookahead) {
            // Only on and state can start a state member that ends an unclosed entry or exit block; other tokens add no call.
            const first = this.LA(1).tokenType.name;
            if ((first === 'on' || first === 'state') && stateMemberStart(this))
                return false;
            return base.call(this);
        };
    };
    return strategy;
}
/**
 * Recovery of an unclosed on entry or on exit block of a state. The block that is still being typed ends where the next
 * item of the state clearly starts, so that the following event lines and states are kept instead of becoming
 * statements of the block: on receive p.m(…) followed by to (a short event line; a receive statement continues with a
 * block or or), and state <name> {. The parser then reports the missing } and inserts it. An event line with a block
 * after an unclosed block, on receive p.m(…) {, reads as a receive statement of that block. Valid sources never reach
 * this case: their blocks are closed before the next item.
 */
function stateMemberStart(parser: Lookahead): boolean {
    const first = parser.LA(1);
    let member = false;
    if (first.tokenType.name === 'state')
        member = nameToken(parser.LA(2).tokenType) && parser.LA(3).image === '{';
    else if (first.tokenType.name === 'on' && parser.LA(2).tokenType.name === 'receive') {
        for (let i = 3, depth = 0; ; i++) {
            const token = parser.LA(i);
            if (token.tokenType.name === 'EOF' || [';', '{', '}'].includes(token.image))
                break;
            depth += token.image === '(' ? 1 : token.image === ')' ? -1 : 0;
            if (depth < 0)
                break;
            if (depth === 0 && token.image === ')') {
                member = parser.LA(i + 1).tokenType.name === 'to';
                break;
            }
        }
    }
    if (!member)
        return false;
    const stack = (parser as Lookahead & { getHumanReadableRuleStack?: () => string[] }).getHumanReadableRuleStack?.() ?? [];
    return stack.some(rule => ruleName(rule) === 'StateAction');
}

/** The message of the lexing error that replaces a parse the host stack could not hold (WP2-D05 (c), SW2013). */
export const PARSER_STACK_MESSAGE = `${BRACKET_NESTING_CLAUSE}: the parser ran out of stack space at this nesting, so this file is not parsed. Reduce the nesting of blocks and brackets.`;
type ParseResult = { value: unknown; lexerErrors: LexerResult['errors']; parserErrors: unknown[] };
/** V8's wording ("Maximum call stack size exceeded"), as in every supported Node host; other engines report differently. */
const isStackOverflow = (error: unknown) => error instanceof RangeError && /call stack/i.test(error.message);
/**
 * WP2-D05 (c): a parse that overflows the host's stack (nesting below the bracket limits that the host's stack still
 * cannot hold, such as deeply nested unclosed blocks) yields the parse of an empty file and one lexing error at the
 * first most deeply nested token, instead of a host exception. The document then reports SW2013 and the rest of
 * the workspace is unaffected.
 *
 * An overflow unwinds the parser through its finally blocks, which can replace the RangeError on the way out, with a
 * TypeError when the AST stack runs empty or a RangeError ("Invalid array length") when the rule stack index does. So
 * the overflow is recorded where the parser first catches it: Chevrotain hands every exception thrown inside a rule
 * to invokeRuleCatch before any of those finally blocks runs above it. An exception counts as an overflow only when it
 * is a stack-overflow RangeError or a stack-overflow RangeError passed through invokeRuleCatch during the same parse;
 * any other exception, such as a failing value converter at any depth, propagates unchanged, after the parser state a
 * parse leaves behind is cleared, so that the next parse on the same parser starts clean. The overflow test matches
 * V8's message; the guard needs the Chevrotain wrapper's invokeRuleCatch and fails at service creation without it.
 */
export function guardParserStack(parser: unknown): void {
    const target = parser as { parse(text: string, options?: unknown): ParseResult; stack?: unknown[]; unorderedGroups?: Map<unknown, unknown>; lexerResult?: unknown; wrapper?: { invokeRuleCatch?: (error: unknown, ...rest: unknown[]) => unknown } };
    const parse = target.parse.bind(target);
    // The first RangeError the parser caught in this parse. The hook runs near the end of the stack, so it only stores
    // the error (no call that could overflow again); the message is tested after the parse has unwound.
    let caught: RangeError | undefined;
    const wrapper = target.wrapper, catcher = wrapper?.invokeRuleCatch;
    if (!wrapper || typeof catcher !== 'function')
        throw new Error('swa.ml parser stack guard needs the Chevrotain rule catch of the Langium parser (parser.wrapper.invokeRuleCatch); the parser library changed. Update guardParserStack in src/language/swaml-syntax.ts.');
    // Installed on the instance, called only on an exception: the normal parse gains no frame.
    wrapper.invokeRuleCatch = function (this: unknown, error: unknown, ...rest: unknown[]) {
        if (error instanceof RangeError && !caught)
            caught = error;
        return catcher.call(this, error, ...rest);
    };
    // An exception unwinds the parser midway; clear the state a parse leaves behind before the next parse.
    const reset = () => {
        target.stack?.splice(0);
        target.unorderedGroups?.clear();
        target.lexerResult = undefined;
    };
    target.parse = (text, options) => {
        caught = undefined;
        try {
            return parse(text, options);
        } catch (error) {
            const overflow = isStackOverflow(error) || isStackOverflow(caught);
            caught = undefined;
            reset();
            if (!overflow)
                throw error;
            let depth = 0, deepest = -1, at: Token | undefined;
            for (const token of tokens) {
                depth = Math.max(0, depth + (['(', '[', '{'].includes(token.image) ? 1 : [')', ']', '}'].includes(token.image) ? -1 : 0));
                if (depth > deepest) {
                    deepest = depth;
                    at = token;
                }
            }
            const empty = parse('', options);
            return { ...empty, lexerErrors: [{ offset: at?.startOffset ?? 0, line: at?.startLine ?? 1, column: at?.startColumn ?? 1, length: at?.image.length ?? 0, message: PARSER_STACK_MESSAGE }] };
        }
    };
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
