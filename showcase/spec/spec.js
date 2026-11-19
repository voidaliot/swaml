// Specification reader: theme selection shared with the site, phone contents and client-side search over a prebuilt index.
(() => {
  const html = document.documentElement, body = document.body;
  const root = body.dataset.root, spec = body.dataset.spec;
  const icons = { sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0', moon: 'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z', system: 'M3 4h18v14H3zM8 22h8m-4-4v4' };
  const nextTheme = t => t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system';
  let theme = 'system';
  try { const saved = localStorage.getItem('swaml-theme'); if (saved === 'light' || saved === 'dark') theme = saved; } catch { /* storage is optional */ }
  const media = matchMedia('(prefers-color-scheme: dark)');
  const toggle = document.querySelector('.theme-toggle');
  function applyTheme() {
    const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
    html.dataset.theme = resolved;
    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon) favicon.href = root + (resolved === 'dark' ? 'swaml-white.svg' : 'swaml.svg');
    if (!toggle) return;
    toggle.setAttribute('aria-label', `Theme: ${theme}. Switch to ${nextTheme(theme)}`);
    toggle.title = `Theme: ${theme}`;
    toggle.querySelector('span').textContent = theme;
    toggle.querySelector('path').setAttribute('d', icons[theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'system']);
  }
  toggle?.addEventListener('click', () => {
    theme = nextTheme(theme);
    try { localStorage.setItem('swaml-theme', theme); } catch { /* storage is optional */ }
    applyTheme();
  });
  media.addEventListener('change', applyTheme);
  applyTheme();

  // A deep link lands at once; later in-page jumps scroll smoothly.
  addEventListener('load', () => setTimeout(() => html.classList.add('smooth-scroll'), 300), { once: true });

  // On a phone the contents start collapsed above the text; on a wide screen they are always open and the
  // CONTENTS label is not a control.
  const contents = document.querySelector('.spec-contents'), summary = contents?.querySelector('summary');
  const narrow = matchMedia('(max-width: 800px)');
  const fitContents = () => {
    if (!contents || !summary) return;
    contents.open = !narrow.matches;
    if (narrow.matches) { summary.removeAttribute('tabindex'); summary.removeAttribute('aria-disabled'); }
    else { summary.tabIndex = -1; summary.setAttribute('aria-disabled', 'true'); }
  };
  fitContents();
  narrow.addEventListener('change', fitContents);
  summary?.addEventListener('click', event => { if (!narrow.matches) event.preventDefault(); });

  // Search: a prebuilt index of sections and rule rows, loaded on first use.
  const form = document.querySelector('.spec-search'), input = document.getElementById('spec-q'), results = document.getElementById('spec-results'), status = document.getElementById('spec-status');
  if (!form || !input || !results || !status) return;
  let index = null, loading = null, timer = 0, first = null;
  const load = () => loading ??= fetch(spec + 'search.json').then(r => { if (!r.ok) throw Error(String(r.status)); return r.json(); }).then(data => (index = data));
  const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const literal = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function mark(text, terms) {
    const pattern = new RegExp('(' + terms.map(literal).join('|') + ')', 'gi');
    return text.split(pattern).map((part, i) => i % 2 ? `<mark>${escape(part)}</mark>` : escape(part)).join('');
  }
  function snippet(text, query, terms) {
    const lower = text.toLowerCase();
    let at = lower.indexOf(query);
    if (at < 0) at = Math.min(...terms.map(t => lower.indexOf(t)).filter(i => i >= 0));
    if (!Number.isFinite(at)) at = 0;
    const start = Math.max(0, at - 60), end = Math.min(text.length, at + 160);
    return (start ? '… ' : '') + text.slice(start, end) + (end < text.length ? ' …' : '');
  }
  // A quoted "phrase" is one term; other words are terms of their own. Every term must occur in the title or the text.
  const parse = raw => [...raw.toLowerCase().matchAll(/"([^"]+)"?|(\S+)/g)].map(m => (m[1] ?? m[2]).replace(/"/g, '').trim().replace(/\s+/g, ' ')).filter(Boolean);
  const whole = term => new RegExp('(?:^|[^\\w])' + literal(term) + '(?!\\w)');
  const count = (text, term) => { let n = 0, at = text.indexOf(term); while (at >= 0 && n < 10) { n++; at = text.indexOf(term, at + term.length); } return n; };
  // Ranking: headings and rule identifiers above body text, whole words above parts of words.
  function search(raw) {
    const terms = parse(raw), query = terms.join(' ');
    if (!terms.length) return [];
    const words = terms.map(whole), phrase = whole(query), found = [];
    for (const entry of index) {
      const title = entry.t.toLowerCase(), text = entry.x.toLowerCase();
      if (!terms.every(t => title.includes(t) || text.includes(t))) continue;
      let score = title === query ? 400 : 0;
      terms.forEach((t, i) => {
        if (words[i].test(title)) score += 100; else if (title.includes(t)) score += 25;
        if (words[i].test(text)) score += 10 + count(text, t); else if (text.includes(t)) score += 1;
      });
      if (terms.length > 1 && phrase.test(text)) score += 20;
      found.push({ entry, score });
    }
    return found.sort((a, b) => b.score - a.score).slice(0, 50).map(f => ({ ...f.entry, snippet: snippet(f.entry.x || f.entry.t, query, terms), terms }));
  }
  async function show() {
    const query = input.value;
    if (!query.trim()) { results.hidden = true; results.innerHTML = ''; status.textContent = ''; if (contents) contents.hidden = false; first = null; return; }
    try { await load(); } catch { results.hidden = false; results.innerHTML = '<p>The search index could not be loaded.</p>'; status.textContent = 'The search index could not be loaded.'; return; }
    if (query !== input.value) return;
    const hits = search(query);
    first = hits[0] ? spec + hits[0].u : null;
    results.innerHTML = hits.length
      ? `<span class="pane-heading">RESULTS</span><ol>${hits.map(h => `<li><a href="${escape(spec + h.u)}"><span class="result-chapter">${escape(h.c)}</span><span class="result-title">${mark(h.t, h.terms)}</span><span class="result-text">${mark(h.snippet, h.terms)}</span></a></li>`).join('')}</ol>`
      : `<p>No section contains “${escape(query.trim())}”.</p>`;
    // Only the number of results is announced; the list itself is not a live region.
    status.textContent = hits.length ? `${hits.length === 50 ? '50 or more' : hits.length} results` : 'No results';
    results.hidden = false;
    if (contents) contents.hidden = true;
  }
  input.addEventListener('focus', () => { load().catch(() => {}); }, { once: true });
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(show, 120); });
  input.addEventListener('keydown', event => { if (event.key === 'Escape') { input.value = ''; show(); } });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    clearTimeout(timer);
    await show();
    if (first) location.href = first;
  });
  const initial = new URLSearchParams(location.search).get('q');
  if (initial) { input.value = initial; show(); }
})();
