import { createHash } from 'node:crypto';

// Public guidance is independent of editor products, private companion projects and
// the author's machine. Protocol-library dependency names (the language-server
// protocol packages) and ordinary file/language extensions are valid. Patterns are
// written so that this file does not match itself.
const editorAndCompanion = [
    /\bvs[\s_-]+code\b/i,
    /\bvs[c]ode(?![-_](?:jsonrpc|languageserver|uri)\b)/i,
    /\bvisual[\s-]+studio[\s-]+code\b/i,
    /\bvisualstudio\.com\b/i,
    /\bvoidaliot\/(?!swaml(?:[\/#?\s)"`\x27<>]|$))[\w.-]+/i,
    /\bextension (?:package|repository|development|boundary)\b/i,
    /[.]vsi[x]\b/i,
    // Editor-product repository names: the editor abbreviation as a separate token,
    // joined by -, _, . or a space, or at the start or end of a line.
    /(?<![a-z0-9])v[s]c(?![a-z0-9])/i,
];
const localPaths = [
    // Windows drive paths: a letter, a colon and one or more separators before a name
    // (also escaped any number of times, drive-root files and names with spaces).
    /(?<![\w$])[A-Za-z]:(?:[\\]+|\/)(?=[\w.$~-])/,
    // URL-encoded drive paths: a letter, %3A and an encoded separator.
    /(?<![\w%])[A-Za-z]%3A(?:%5C|%2F)/i,
    // UNC paths: two separators, a server, a separator and a share.
    /(?<![\w\\])[\\]{2}[\w.$-]+[\\][\w.$ -]+/,
    // WSL and Cygwin drive mounts.
    /(?<![\w.~:\/-])\/(?:mnt|cygdrive)\/[A-Za-z]\/[\w.$-]+/i,
    // Git Bash drive paths: a one-letter root directory and at least two further
    // segments, so regex literals such as /a/g and route text such as /v/2 pass.
    /(?<![\w.~:\/-])\/[A-Za-z]\/[\w.$-]+\/[\w.$-]/,
];

/**
 * Files whose tests deliberately feed synthetic drive paths to path validators.
 * Only the local-path rules are waived, and only while the file keeps the bytes it
 * had at tag v2.2 (SHA-256 of its LF-normalized UTF-8 text). An edited file loses
 * the waiver and is checked like every other file.
 */
export const pathFixtureFiles = new Map([
    ['scripts/test-publication-2-1.py', 'e7c494570f7a450af203fecdf1ac5ec253248a928015a02c785a2c3170971c22'],
    ['scripts/test-publication-2-2.py', 'b4942ca9ae09070bbe7458ec15ec25b475b200845a61011d16802f6f0845cc52'],
    ['scripts/test-publication-archive.py', '5898ec8f50aea65f3edbcd009fd60cdf1338910b8f087cbb426a410c96a475c8'],
]);

/** SHA-256 of a text after normalizing line endings to LF. */
export function textDigest(source) {
    return createHash('sha256').update(source.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

/** True when this file keeps the pinned bytes of a waived path fixture. */
export function waivesLocalPaths(path, source) {
    return pathFixtureFiles.get(path) === textDigest(source);
}

/** True when one line of public text contains a disallowed reference. */
export function isDisallowed(line, { allowLocalPaths = false } = {}) {
    return editorAndCompanion.some(pattern => pattern.test(line))
        || (!allowLocalPaths && localPaths.some(pattern => pattern.test(line)));
}
