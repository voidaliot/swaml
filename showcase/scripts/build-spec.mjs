// Builds the browsable specification of the site from the repository Markdown at build time.
// The pages, their order and their sources follow the published book of the current edition:
// the source inventory comes from the edition's PDF manifest, the book order from scripts/build-spec-pdf-X.Y.py.
// Output: showcase/public/spec/ (git-ignored), copied unchanged into the production artifact by Vite.
import {readFile, writeFile, mkdir, rm, copyFile, stat} from 'node:fs/promises';
import {publishedEdition, publishedReader, readManifest, editionTree} from '../../scripts/site-publication.mjs';
import {posix} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Marked} from 'marked';
import {highlight} from '../src/highlight.js';

const root = new URL('../../', import.meta.url);
const out = new URL('showcase/public/spec/', root);
// Site files (styles and script) come from the working tree; book sources only through the published reader.
const readSite = path => readFile(new URL(path, root), 'utf8');
// The reader shows the latest published edition, also while spec/standard.json names an unreleased candidate.
// Its inventory, order and date come from the release manifest; every source is read from the edition tag when
// present and must equal its manifest digest (the published text is frozen).
const standard = publishedEdition(root);
const manifest = readManifest(root, standard);
if (manifest.release !== standard) throw Error(`The ${standard} manifest records release ${manifest.release}`);
const published = publishedReader(root, standard, manifest);
const read = async path => published.text(path);
const tree = editionTree(root, standard, manifest);
const sources = manifest.sources.map(s => s.path);
const grammar = 'src/language/swaml.langium', inventory = 'spec/kerml-mapping.json', license = 'LICENSE';
const at = path => { const i = sources.indexOf(path); if (i < 0) throw Error(`The ${standard} manifest does not list ${path}`); return i; };
// Manifest order: normative and guidance chapters, the grammar, the mapping inventory, the models, the license, attachments.
const chapters = sources.slice(0, at(grammar));
const models = sources.slice(at(inventory) + 1, at(license));
if (!chapters.every(p => p.endsWith('.md')) || !models.every(p => p.endsWith('.swaml')))
  throw Error('Unexpected manifest source order; review the reader against the book builder.');
const isNormative = p => /^docs\/(LANGUAGE_SPECIFICATION|GRAPHICAL_NOTATION|GRAPHICAL_CATALOG)\.md$|^docs\/spec\//.test(p);
const keywords = 'docs/KEYWORD_REFERENCE.md';
const normative = chapters.filter(isNormative), guidance = chapters.filter(p => !isNormative(p) && p !== keywords);
if (!chapters.includes(keywords) || chapters.slice(0, normative.length).some(p => !isNormative(p)))
  throw Error('The book places the keyword reference first and the normative chapters before the guidance.');

const REPO = `https://github.com/voidaliot/swaml/blob/v${standard}/`;
const PDF = `https://github.com/voidaliot/swaml/releases/download/v${standard}/SWAML-${standard}-Specification.pdf`;
const date = new Date(manifest.publicationDate + 'T00:00:00Z').toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'});

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = html => html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
// GitHub heading slugs, identical to scripts/check-docs.mjs (numbered when repeated).
const slug = h => h.replace(/`/g, '').trim().toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
const pageSlug = p => p === keywords ? 'keywords' : p.replace(/^docs\/(spec\/|decisions\/)?/, (_, dir) => dir === 'decisions/' ? 'adr-' : '').replace(/\.md$/, '').toLowerCase().replace(/_/g, '-');
// Rule identifiers (SIF-R05, WP8-S08) and diagnostics codes (SW2008) that open a table row become row anchors.
const RULE = /^(?:SW\d{4}|[A-Z][A-Z0-9]*-[A-Z]{1,2}\d{2}[a-z]?)$/;
const RULE_TEXT = /\b(SW\d{4}|[A-Z][A-Z0-9]*-[A-Z]{1,2}\d{2}[a-z]?)\b/g;

// Pages in book order. Each page lists the repository sources it shows.
const pages = [];
const page = (slugName, title, group, label, srcs, extra = {}) => { const p = {slug: slugName, title, group, label, sources: srcs, ...extra}; pages.push(p); return p; };
page('', `swa.ml ${standard} specification`, null, `STANDARD ${standard} / RELEASE EDITION, ${date.toUpperCase()}`, []);
const labelOf = p => p === keywords ? 'USER REFERENCE / CONCERN AND KEYWORD NAVIGATION' : isNormative(p) ? 'NORMATIVE / LANGUAGE CONTRACT' : 'INFORMATIVE / GUIDANCE AND PROJECT STATUS';
const groupOf = p => p === keywords ? 'User reference' : isNormative(p) ? 'Normative' : p.startsWith('docs/decisions/') ? 'Decisions' : 'Informative';
for (const p of [keywords, ...normative]) page(pageSlug(p), null, groupOf(p), labelOf(p), [p], {markdown: p});
page('grammar', 'A. Complete concrete grammar', 'Appendices', 'NORMATIVE APPENDIX', [grammar]);
page('grammar-inventory', 'B. Grammar-to-semantics inventory', 'Appendices', 'NORMATIVE DESIGN INVENTORY', [inventory]);
page('models', 'C. Model and library sources', 'Appendices', 'INFORMATIVE / COMPLETE MODELS', models);
for (const p of guidance) page(pageSlug(p), null, groupOf(p), labelOf(p), [p], {markdown: p});
const references = page('references', 'D. External references', 'References and license', 'INFORMATIVE / EXTERNAL REFERENCES', []);
page('license', 'E. License', 'References and license', 'LICENSE', [license]);
if (new Set(pages.map(p => p.slug)).size !== pages.length) throw Error('Duplicate specification page slug');
const pageOfSource = new Map(pages.flatMap(p => p.sources.map(s => [s, p])));
const modelAnchor = p => slug(posix.basename(p, '.swaml'));
if (new Set(models.map(modelAnchor)).size !== models.length) throw Error('Duplicate model anchor');

const KEYWORDS = new Set(JSON.parse(await read('spec/keywords.json')).entries.flatMap(e => e.keyword.split(' ')));
// The site's source highlighting (showcase/src/highlight.js, also used by the front page) over the complete keyword inventory.
function code(text, {highlight: colour = false, numbers = false, label} = {}) {
  const source = text.replace(/\r\n/g, '\n').replace(/\n+$/, '');
  const lines = colour ? highlight(source, KEYWORDS) : source.split('\n').map(t => [{t}]);
  const width = String(lines.length).length;
  const span = token => token.c === 'keyword' ? `<span class="token-keyword">${esc(token.t)}</span>` : token.c === 'string' ? `<span class="token-string">${esc(token.t)}</span>` : esc(token.t);
  const body = lines.map((line, i) => `<span class="code-line">${numbers ? `<span class="line-number" aria-hidden="true">${String(i + 1).padStart(Math.max(2, width), '0')}</span>` : ''}<span>${line.map(span).join('')}</span>\n</span>`).join('');
  return `<div class="spec-code">${label ? `<div class="panel-heading"><span>${esc(label)}</span></div>` : ''}<pre class="source-code${numbers ? ' numbered' : ''}"><code>${body}</code></pre></div>`;
}

// First pass: where each rule identifier is defined (first row in book order).
const ruleHome = new Map();
const lexer = new Marked({gfm: true});
const walk = (tokens, fn) => { for (const t of tokens ?? []) { fn(t); walk(t.tokens, fn); if (t.type === 'list') walk(t.items, fn); } };
for (const p of pages.filter(p => p.markdown)) walk(lexer.lexer(await read(p.markdown)), t => {
  if (t.type === 'table') for (const row of t.rows) { const id = row[0]?.text.trim(); if (RULE.test(id) && !ruleHome.has(id)) ruleHome.set(id, p); }
});

const external = new Map();
const figures = new Map();
const linkChecks = [];
const href = (from, to, fragment) => (to === from ? '' : (from.slug ? '../' : '') + (to.slug ? to.slug + '/' : (from.slug ? '' : './'))) + (fragment ? '#' + fragment : '');
// Links between included sources become site links; other repository files open at the edition tag, as in the PDF.
function resolveLink(url, source, from) {
  if (/^https?:\/\//.test(url)) return {url, external: true};
  if (/^[a-z]+:/i.test(url)) throw Error(`Unsupported link ${url} in ${source}`);
  const [file, fragment] = url.split('#');
  const rel = file ? posix.normalize(posix.join(posix.dirname(source), decodeURIComponent(file))).replace(/\/$/, '') : source;
  if (rel.startsWith('..')) throw Error(`Link outside the repository: ${url} in ${source}`);
  const target = pageOfSource.get(rel);
  if (target) {
    const anchor = target.slug === 'models' && !fragment ? modelAnchor(rel) : fragment;
    if (anchor) linkChecks.push({page: target, anchor, where: `${url} in ${source}`});
    return {url: href(from, target, anchor)};
  }
  if (!tree.paths.has(rel)) throw Error(`Broken repository link ${url} in ${source}: not in ${tree.fromTag ? 'tag v' + standard : 'the ' + standard + ' manifest (fetch tag v' + standard + ' to check other files)'}`);
  return {url: REPO + rel.split('/').map(encodeURIComponent).join('/') + (fragment ? '#' + fragment : ''), external: true};
}

function renderMarkdown(text, source, p) {
  const ids = new Map(), headings = [];
  let inLink = 0, inRuleCell = 0;
  const unique = base => { const n = ids.get(base) ?? 0; ids.set(base, n + 1); return n ? `${base}-${n}` : base; };
  const marked = new Marked({gfm: true, renderer: {
    heading({tokens, depth, text: raw}) {
      const id = unique(slug(raw));
      inLink++; const inner = this.parser.parseInline(tokens); inLink--;
      headings.push({id, depth, title: plain(inner)});
      if (depth === 1 && headings.length === 1) { p.title ??= plain(inner); return `<span class="eyebrow">${esc(p.label)}</span><h1 id="${id}">${inner}</h1>`; }
      return `<h${depth} id="${id}"><a class="heading-link" href="#${id}">${inner}</a></h${depth}>`;
    },
    code({text: body, lang}) {
      if (lang === 'mermaid') throw Error(`Mermaid diagram in ${source}`);
      return code(body, {highlight: lang === 'swaml', label: lang ? lang.toUpperCase() : undefined});
    },
    // Markdown sources are trusted text, not HTML: raw tags are shown literally.
    html({text: raw}) { return esc(raw); },
    link({href: url, tokens}) {
      inLink++; const label = this.parser.parseInline(tokens); inLink--;
      if (inLink) return label;
      const r = resolveLink(url, source, p);
      if (/^https?:\/\//.test(url) && !external.has(url)) external.set(url, plain(label));
      return r.external ? `<a href="${esc(r.url)}" target="_blank" rel="noreferrer">${label}</a>` : `<a href="${esc(r.url)}">${label}</a>`;
    },
    image({href: url, text: alt}) {
      const rel = posix.normalize(posix.join(posix.dirname(source), url));
      if (!/\.svg$/.test(rel) || !tree.paths.has(rel)) throw Error(`Missing figure ${url} in ${source}`);
      const name = rel.replace(/^docs\//, '').replace(/\//g, '-');
      figures.set(name, rel);
      return `<img class="notation-figure" src="${p.slug ? '../' : ''}figures/${esc(name)}" alt="${esc(alt)}" loading="lazy">`;
    },
    paragraph({tokens}) {
      if (tokens.length === 1 && tokens[0].type === 'image') return `<figure>${this.parser.parseInline(tokens)}<figcaption>${esc(tokens[0].text)}</figcaption></figure>\n`;
      return `<p>${this.parser.parseInline(tokens)}</p>\n`;
    },
    table(token) {
      const align = i => token.align[i] ? ` style="text-align:${token.align[i]}"` : '';
      const head = token.header.map((c, i) => `<th${align(i)}>${this.parser.parseInline(c.tokens)}</th>`).join('');
      const rows = token.rows.map(row => {
        const id = row[0]?.text.trim();
        const anchor = RULE.test(id) && !ids.has(id) ? (ids.set(id, 1), id) : null;
        return `<tr${anchor ? ` id="${anchor}"` : ''}>` + row.map((c, i) => {
          if (anchor && i === 0) { inRuleCell++; const inner = this.parser.parseInline(c.tokens); inRuleCell--; return `<td${align(i)}><a class="rule-link" href="#${anchor}">${inner}</a></td>`; }
          return `<td${align(i)}>${this.parser.parseInline(c.tokens)}</td>`;
        }).join('') + '</tr>';
      }).join('\n');
      // A scrollable table is a named region that the keyboard can focus and scroll.
      const name = (headings.at(-1)?.title ?? p.title) + ', table: ' + token.header.map(c => plain(this.parser.parseInline(c.tokens))).join(', ');
      return `<div class="table-scroll" tabindex="0" role="region" aria-label="${esc(name.length > 120 ? name.slice(0, 117) + '…' : name)}"><table><thead><tr>${head}</tr></thead><tbody>\n${rows}\n</tbody></table></div>\n`;
    },
    // Mentions of a rule identifier or diagnostics code link to the row that defines it.
    text(token) {
      if ('tokens' in token && token.tokens) return this.parser.parseInline(token.tokens);
      const text = token.escaped ? token.text : esc(token.text);
      if (inLink || inRuleCell) return text;
      return text.replace(RULE_TEXT, id => { const home = ruleHome.get(id); return home ? `<a class="rule-ref" href="${href(p, home, id)}">${id}</a>` : id; });
    },
  }});
  return {html: marked.parse(text), headings, ids};
}

function section(id, depth, title) { return {id, depth, title}; }
for (const p of pages) {
  if (p.markdown) { Object.assign(p, renderMarkdown(await read(p.markdown), p.markdown, p)); continue; }
  if (p.slug === 'grammar') {
    p.html = `<span class="eyebrow">${p.label}</span><h1 id="grammar">${esc(p.title)}</h1><p>Authoritative Langium grammar, reproduced in full.</p>` + code(await read(grammar), {numbers: true, label: 'LANGIUM GRAMMAR'});
    p.headings = [section('grammar', 1, p.title)];
  } else if (p.slug === 'grammar-inventory') {
    const entries = JSON.parse(await read(inventory)).mapping;
    p.html = `<span class="eyebrow">${p.label}</span><h1 id="grammar-inventory">${esc(p.title)}</h1><p>Every grammar rule/type name is represented. Proposed kernel bases identify the design target; they do not constitute an implemented or validated exporter. Empty bases indicate syntax normalized through its owner.</p>`
      + `<div class="table-scroll" tabindex="0" role="region" aria-label="Table: Rule / kind, Proposed kernel base, Meaning to preserve"><table><thead><tr><th>Rule / kind</th><th>Proposed kernel base</th><th>Meaning to preserve</th></tr></thead><tbody>\n`
      + entries.map(e => `<tr><td><strong>${esc(e.source)}</strong><br>${esc(e.kind)}</td><td>${esc(e.kernel.join(', ') || 'Owner representation')}</td><td>${esc(e.semantic)}</td></tr>`).join('\n') + '\n</tbody></table></div>';
    p.headings = [section('grammar-inventory', 1, p.title)];
  } else if (p.slug === 'models') {
    p.headings = [section('models', 1, p.title)];
    p.html = `<span class="eyebrow">${p.label}</span><h1 id="models">${esc(p.title)}</h1>`;
    for (const m of models) {
      const id = modelAnchor(m), title = posix.basename(m, '.swaml').replace(/-/g, ' ');
      p.headings.push(section(id, 2, title));
      p.html += `<h2 id="${id}"><a class="heading-link" href="#${id}">${esc(title)}</a></h2>` + code(await read(m), {highlight: true, numbers: true, label: m});
    }
  } else if (p.slug === 'license') {
    p.headings = [section('license', 1, p.title)];
    p.html = `<span class="eyebrow">${p.label}</span><h1 id="license">${esc(p.title)}</h1>` + (await read(license)).replace(/\r\n/g, '\n').split('\n\n').map(t => `<p>${esc(t.replace(/\n/g, ' '))}</p>`).join('\n');
  }
}
// External references in the order they are cited, as in the book.
references.headings = [section('references', 1, references.title)];
references.html = `<span class="eyebrow">${references.label}</span><h1 id="references">${esc(references.title)}</h1><p>Primary-source and project links cited in the included text. The comparisons identify their research baseline; this list does not imply conformance to any external standard.</p><ol class="reference-list">`
  + [...external].map(([url, label]) => `<li><strong>${esc(label)}</strong><br><a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(url)}</a></li>`).join('\n') + '</ol>';

for (const {page: target, anchor, where} of linkChecks) {
  const ids = new Set([...target.headings.map(h => h.id), ...(target.ids?.keys() ?? [])]);
  if (!ids.has(anchor)) throw Error(`Unresolved section link ${where}`);
}

// Contents, navigation and the page shell.
const groups = [...new Set(pages.map(p => p.group).filter(Boolean))];
const icon = {system: 'M3 4h18v14H3zM8 22h8m-4-4v4', external: 'M13 4h7v7m0-7L9 15M9 4H4v16h16v-5', arrow: 'M4 12h15m-5-5 5 5-5 5'};
const svg = (d, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="${d}"/></svg>`;
function contents(current) {
  return groups.map(g => `<p class="spec-group">${esc(g)}</p><ul>` + pages.filter(p => p.group === g).map(p => {
    const here = p === current;
    const sections = here ? p.headings.filter(h => h.depth === 2) : [];
    return `<li><a href="${href(current, p)}"${here ? ' aria-current="page"' : ''}>${esc(p.title)}</a>${sections.length ? '<ul>' + sections.map(h => `<li><a href="#${h.id}">${esc(h.title)}</a></li>`).join('') + '</ul>' : ''}</li>`;
  }).join('') + '</ul>').join('');
}
function shell(p, index) {
  const rootPath = p.slug ? '../../' : '../', specPath = p.slug ? '../' : './';
  const prev = pages[index - 1], next = pages[index + 1];
  const onPage = p.headings.filter(h => h.depth === 2 || h.depth === 3);
  const title = p.slug ? `${p.title} · swa.ml ${standard} specification` : `swa.ml ${standard} specification`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#ffffff">
<meta name="description" content="${esc(p.slug ? `${p.title} — swa.ml ${standard} specification.` : `The complete swa.ml ${standard} specification: keyword reference, normative chapters, notation, grammar, models, guides, release notes and decisions.`)}">
<meta name="swaml-sources" content="${esc(p.sources.join(' '))}">
<title>${esc(title)}</title>
<link rel="icon" type="image/svg+xml" href="${rootPath}swaml.svg">
<script>try{var t=localStorage.getItem('swaml-theme');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';document.querySelector('link[rel="icon"]').href=document.documentElement.dataset.theme==='dark'?'${rootPath}swaml-white.svg':'${rootPath}swaml.svg'}catch{}</script>
<link rel="stylesheet" href="${specPath}site.css">
</head>
<body data-root="${rootPath}" data-spec="${specPath}">
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
<a href="${rootPath}" class="wordmark" aria-label="swa.ml home"><img src="${rootPath}swaml.svg" alt="" width="36" height="36">swa.ml<span class="version-label">${standard}</span></a>
<nav aria-label="Main navigation"><a href="${rootPath}#language">Language</a><a href="${rootPath}#explore">Example</a><a href="${rootPath}#execution">Execution</a><a href="${rootPath}#start">Documentation</a><a href="${specPath}" aria-current="page">Specification</a></nav>
<button class="theme-toggle" type="button" aria-label="Theme: system" title="Theme: system">${svg(icon.system)}<span>system</span></button>
</header>
<div class="spec-layout">
<aside class="spec-sidebar">
<form class="spec-search" role="search" action="${specPath}"><label for="spec-q" class="pane-heading">SEARCH THE SPECIFICATION</label><input id="spec-q" name="q" type="search" autocomplete="off" spellcheck="false" placeholder="Rule, keyword or phrase" aria-controls="spec-results"></form>
<p id="spec-status" class="visually-hidden" role="status" aria-live="polite"></p>
<div id="spec-results" class="spec-results" hidden></div>
<details class="spec-contents" open><summary class="pane-heading">CONTENTS</summary><nav aria-label="Specification contents"><ul><li><a href="${specPath}"${p.slug ? '' : ' aria-current="page"'}>About this edition</a></li></ul>${contents(p)}</nav></details>
</aside>
<main id="main" class="spec-main">
<article class="spec-article">
${p.html}
</article>
<nav class="spec-pager" aria-label="Previous and next">${prev ? `<a class="pager-prev" href="${href(p, prev)}" rel="prev"><span class="pane-heading">PREVIOUS</span>${esc(prev.slug ? prev.title : 'About this edition')}</a>` : '<span></span>'}${next ? `<a class="pager-next" href="${href(p, next)}" rel="next"><span class="pane-heading">NEXT</span>${esc(next.title)}</a>` : ''}</nav>
</main>
${onPage.length ? `<aside class="spec-toc" aria-label="On this page"><span class="pane-heading">ON THIS PAGE</span><ul>${onPage.map(h => `<li class="toc-${h.depth}"><a href="#${h.id}">${esc(h.title)}</a></li>`).join('')}</ul></aside>` : ''}
</div>
<footer class="site-footer"><a class="wordmark" href="${rootPath}"><img src="${rootPath}swaml.svg" alt="" width="28" height="28">swa.ml</a><p>Software Architecture Modeling Language</p><div><a href="${href(p, pages.find(x => x.slug === 'license'))}">MIT license</a><a href="https://github.com/voidaliot/swaml" target="_blank" rel="noreferrer">GitHub ${svg(icon.external, 12)}</a></div></footer>
<script src="${specPath}spec.js" defer></script>
</body>
</html>
`;
}

// The start page is the book's "About this edition", read from the edition's own PDF builder (a published source), with
// the edition and date stated once; the PDF-only navigation table is replaced by one sentence on this site's links.
const builder = await read(`scripts/build-spec-pdf-${standard}.py`);
const about = /heading\('About this edition'[\s\S]*?\n\s*toc_title=/.exec(builder)?.[0];
if (!about) throw Error(`No "About this edition" in scripts/build-spec-pdf-${standard}.py`);
const values = {RELEASE: manifest.release, LANGUAGE: manifest.languageVersion, SIMULATION_PROFILE: manifest.simulationProfile, IMPLEMENTATION: manifest.implementationRevision, 'PUBLICATION_DATE.upper()': date.toUpperCase()};
const aboutParagraphs = [...about.matchAll(/Paragraph\((f?)'((?:[^'\\]|\\.)*)',STYLES\['(\w+)'\]\)/g)].map(([, f, text, style]) => ({style, text: (f ? text.replace(/\{([^}]+)\}/g, (_, k) => { if (!(k in values)) throw Error('Unknown value in the About text: ' + k); return values[k]; }) : text).replace(/\\(.)/g, '$1')}));
const aboutLabel = aboutParagraphs.find(x => x.style === 'label'), aboutBody = aboutParagraphs.filter(x => x.style !== 'label');
if (!aboutLabel || aboutBody.length < 3) throw Error('Unexpected "About this edition" in the book builder');
const start = pages[0];
start.label = aboutLabel.text;
start.headings = [section('contents', 2, 'Contents')];
start.html = `<span class="eyebrow">${esc(start.label)}</span><h1 id="top">About this edition</h1>
${aboutBody.map(x => `<p${x.style === 'small' ? ' class="muted"' : ''}>${esc(x.text)}</p>`).join('\n')}
<p>Links between included documents stay on this site; other repository links open at the <code>v${standard}</code> release tag. Rule identifiers and diagnostics codes link to the rows that define them.</p>
<div class="spec-pdf"><strong>Specification PDF</strong><a class="button primary" href="${PDF}">Download the PDF ${svg(icon.arrow)}</a></div>
<h2 id="contents"><a class="heading-link" href="#contents">Contents</a></h2>
<div class="spec-index">${groups.map(g => `<section><p class="spec-group">${esc(g)}</p><ol>${pages.filter(p => p.group === g).map(p => `<li><a href="${href(start, p)}">${esc(p.title)}</a></li>`).join('')}</ol></section>`).join('')}</div>`;

// The search index: one entry per section and per rule row, with its plain text.
const search = [];
for (const p of pages.slice(1)) {
  const parts = p.html.split(/(?=<h[1-3] id=")/);
  for (const part of parts) {
    const m = /^<h([1-3]) id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/.exec(part);
    const id = m ? m[2] : p.headings[0].id, title = m ? plain(m[3]) : p.title;
    // Cell, paragraph and item ends separate words in the plain text.
    const text = plain(part.replace(/<\/(?:td|th|tr|p|li|div|figcaption)>|<br>/g, ' $&').replace(/^<h[1-3][\s\S]*?<\/h[1-3]>/, '').replace(/<span class="eyebrow">[\s\S]*?<\/span>/, '').replace(/<span class="line-number"[^>]*>\d+<\/span>/g, '')).replace(/\s+/g, ' ').trim();
    search.push({u: `${p.slug}/#${id}`, t: title, c: p.title, x: text});
    for (const row of part.matchAll(/<tr id="([^"]+)">([\s\S]*?)<\/tr>/g)) search.push({u: `${p.slug}/#${row[1]}`, t: row[1], c: p.title, x: plain(row[2].replace(/<\/td>/g, ' ')).replace(/\s+/g, ' ').trim()});
  }
}

await rm(out, {recursive: true, force: true});
await mkdir(new URL('figures/', out), {recursive: true});
for (const [i, p] of pages.entries()) {
  const dir = p.slug ? new URL(p.slug + '/', out) : out;
  await mkdir(dir, {recursive: true});
  await writeFile(new URL('index.html', dir), shell(p, i));
}
for (const [name, rel] of figures) await writeFile(new URL('figures/' + name, out), published.bytes(rel));
const css = (await readSite('showcase/src/v2.css')) + '\n' + (await readSite('showcase/spec/spec.css'));
await writeFile(new URL('site.css', out), css);
await copyFile(new URL('showcase/spec/spec.js', root), new URL('spec.js', out));
await writeFile(new URL('search.json', out), JSON.stringify(search));
const size = (await stat(new URL('search.json', out))).size;
console.log(`Specification ${standard} (${published.fromTag ? 'tag v' + standard : 'working tree'}, manifest digests verified): ${pages.length} pages from ${new Set(pages.flatMap(p => p.sources)).size} sources, ${figures.size} figures, ${ruleHome.size} rule anchors, ${search.length} search entries (${Math.round(size / 1024)} KiB) in ${fileURLToPath(out)}.`);
