// Public guidance is independent of editor products, private companion projects and
// the author's machine. Protocol-library dependency names (the language-server
// protocol packages) and ordinary file/language extensions are valid. Patterns are
// written so that this file does not match itself.
const editorAndCompanion = [
    /\bvs[\s_-]+code\b/i,
    /\bvs[c]ode(?![-_](?:jsonrpc|languageserver|uri)\b)/i,
    /\bvisual[\s-]+studio[\s-]+code\b/i,
    /\bvoidaliot\/(?!swaml(?:[\/#?\s)"`\x27<>]|$))[\w.-]+/i,
    /\bextension (?:package|repository|development|boundary)\b/i,
    /[.]vsi[x]\b/i,
    // Editor-product repository names: an editor abbreviation joined to a name by - or _.
    /[a-z0-9][-_]v[s]c(?![a-z0-9])/i,
];
const localPaths = [
    // Windows drive paths: a letter, a colon and one or two separators before a name
    // (also JSON-escaped, drive-root files and names with spaces).
    /(?<![\w$])[A-Za-z]:(?:[\\]{1,2}|\/)(?=[\w.$~-])/,
    // UNC paths: two separators, a server, a separator and a share.
    /(?<![\w\\])[\\]{2}[\w.$-]+[\\][\w.$ -]+/,
    // Git Bash drive paths: a one-letter root directory followed by a further segment.
    /(?<![\w.~:\/-])\/[a-z]\/[\w.$-]+/,
];

/**
 * Files whose tests deliberately feed synthetic drive paths to path validators.
 * Only the local-path rules are waived for them; they are published inputs of
 * earlier editions and keep their bytes.
 */
export const pathFixtureFiles = new Set([
    'scripts/test-publication-2-1.py',
    'scripts/test-publication-2-2.py',
    'scripts/test-publication-archive.py',
]);

/** True when one line of public text contains a disallowed reference. */
export function isDisallowed(line, { allowLocalPaths = false } = {}) {
    return editorAndCompanion.some(pattern => pattern.test(line))
        || (!allowLocalPaths && localPaths.some(pattern => pattern.test(line)));
}
