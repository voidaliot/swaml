// Public guidance is independent of editor products, private companion projects and
// the author's machine. Protocol-library dependency names and ordinary file/language
// extensions are valid. Patterns are written so that this file does not match itself.
export const disallowed = [
    /\bvs[\s-]+code\b/i,
    /\bvisual[\s-]+studio[\s-]+code\b/i,
    /\bvoidaliot\/(?!swaml(?:[\/#?\s)"`\x27<>]|$))[\w.-]+/i,
    /\bextension (?:package|repository|development|boundary)\b/i,
    /[.]vsi[x]\b/i,
    // Editor-product repository names (a name segment for the editor product between hyphens).
    /[\w]-v[s]c-[\w]/i,
    // Local drive-letter paths: a letter, a colon, a separator, a directory and another separator.
    /(?<![\w$])[A-Za-z]:[\\/][\w.$-]+[\\/]/,
];

/** True when one line of public text contains a disallowed reference. */
export function isDisallowed(line) {
    return disallowed.some(pattern => pattern.test(line));
}
