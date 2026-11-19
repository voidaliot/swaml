// swa.ml source highlighting shared by the front page (App.tsx) and the specification reader (scripts/build-spec.mjs).
// Keywords are bold; double-quoted strings use the accent. Quoted names ('Withdraw cash'), comments and keywords used
// as plain names (after '.', or before '=' or ':') stay plain.
const TOKEN = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|[A-Za-z_]\w*/g;

/**
 * @param {string} text source text
 * @param {Set<string>} keywords keyword set
 * @returns {{t: string, c?: 'keyword' | 'string' | 'comment'}[][]} tokens per line
 */
export function highlight(text, keywords) {
  const tokens = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) tokens.push({ t: text.slice(last, m.index) });
    const t = m[0], after = text.slice(m.index + t.length, m.index + t.length + 40).trimStart();
    let p = m.index - 1;
    while (p >= 0 && /\s/.test(text[p])) p--;
    const before = text[p];
    let c;
    if (t.startsWith('/')) c = 'comment';
    else if (t.startsWith('"')) c = 'string';
    else if (t.startsWith("'")) c = undefined;
    else if (keywords.has(t) && before !== '.' && !/^(?:=(?!=)|:(?!:))/.test(after)) c = 'keyword';
    tokens.push(c ? { t, c } : { t });
    last = m.index + t.length;
  }
  if (last < text.length) tokens.push({ t: text.slice(last) });
  // Split tokens at line ends so that each line can be wrapped on its own.
  const lines = [[]];
  for (const token of tokens) token.t.split('\n').forEach((part, i) => { if (i) lines.push([]); if (part) lines.at(-1).push(token.c ? { t: part, c: token.c } : { t: part }); });
  return lines;
}
