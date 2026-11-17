// Seeded random swa.ml models for differential runs of the reference interpreter. Each seed picks
// policies, periods, waits, timeouts, deadlines, concurrency, failures, state machines, interruptible
// regions and the number of producer/consumer pairs, so simultaneous events, overflow, timeouts, late
// replies, retries and age discards occur in many interleavings. Some seeds yield invalid models; the
// caller skips those and reports how many it ran.
export function random(seed) {
    let s = seed >>> 0 || 1;
    const next = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    return { int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)), pick: list => list[Math.floor(next() * list.length)], chance: p => next() < p };
}
export function randomModel(seed) {
    const r = random(seed), out = [];
    const line = (depth, text) => out.push('  '.repeat(depth) + text);
    const pairs = r.int(1, 4), ms = () => `${r.int(1, 6)}ms`;
    line(0, 'package Rnd {');
    line(1, 'import Swaml::Qos;');
    line(1, 'qos def Q: Policy {');
    line(2, `delivery = Delivery.${r.pick(['bestEffort', 'atMostOnce', 'atLeastOnce'])};`);
    line(2, `ordering = Ordering.${r.pick(['fifo', 'unordered'])};`);
    line(2, `capacity = ${r.int(1, 4)};`);
    line(2, `overflow = Overflow.${r.pick(['dropOldest', 'dropNewest', 'reject'])};`);
    line(2, `requestTimeout = ${r.int(1, 12)}ms;`);
    if (r.chance(0.4))
        line(2, `maxAge = ${r.int(1, 5)}ms;`);
    if (r.chance(0.15))
        line(2, `maxLatency = ${r.int(1, 3)}ms;`);
    line(1, '}');
    line(1, 'port def Feed {');
    line(2, 'provides event ev(v: int);');
    line(2, 'provides attribute level: int;');
    line(1, '}');
    line(1, 'port def Ask {');
    line(2, 'provides idempotent operation ask(v: int) returns int;');
    line(1, '}');
    // Producers: one period for all or one each, so simultaneous releases are common.
    const shared = r.int(1, 4);
    for (let i = 0; i < pairs; i++) {
        line(1, `component def Producer${i} {`);
        line(2, 'port feed: Feed;');
        line(2, 'attribute n: int = 0;');
        line(2, 'operation tick() {');
        line(3, 'n = n + 1;');
        if (r.chance(0.3))
            line(3, `wait ${ms()};`);
        line(3, 'publish feed.ev(n);');
        line(3, 'send feed.level(n);');
        line(2, '}');
        line(2, 'operation also() {');
        line(3, 'n = n + 10;');
        line(2, '}');
        line(2, 'schedule {');
        const period = r.chance(0.6) ? shared : r.int(1, 5), deadline = r.chance(0.2) ? ` deadline ${r.int(1, period)}ms` : '';
        line(3, `on every ${period}ms tick()${deadline};`);
        if (r.chance(0.4))
            line(3, 'after tick also();');
        line(2, '}');
        line(1, '}');
        line(1, `component def Consumer${i} {`);
        line(2, 'reversed port feed: Feed;');
        line(2, 'reversed port ask: Ask;');
        line(2, 'attribute last: int = 0;');
        line(2, 'attribute got: int = 0;');
        line(2, 'attribute seen: int = 0;');
        line(2, 'operation take(v: int) {');
        line(3, 'last = v;');
        if (r.chance(0.3))
            line(3, `wait ${ms()};`);
        line(3, 'got = try(ask.ask(v), - 1);');
        line(2, '}');
        const listen = r.pick(['loop', 'machine', 'interrupt', 'schedule']), done = r.chance(0.3);
        if (listen === 'loop') {
            line(2, 'operation listen() {');
            line(3, `while (true, ${r.int(5, 400)} times) {`);
            line(4, 'on receive feed.level(v) {');
            line(5, 'seen = v;');
            line(4, `} or after ${ms()} {`);
            line(5, 'seen = seen - 1;');
            line(4, '}');
            line(3, '}');
            line(2, '}');
        }
        else if (listen === 'machine') {
            line(2, 'operation listen() {');
            line(3, 'initial Idle;');
            line(3, 'state Idle {');
            line(4, 'on receive feed.level(v) to Busy {');
            line(5, 'seen = v;');
            line(4, '}');
            line(4, `after ${r.int(3, 20)}ms to Idle {`);
            line(5, 'seen = 0;');
            line(4, '}');
            line(3, '}');
            line(3, 'state Busy {');
            line(4, 'on entry {');
            line(5, 'got = got + 1;');
            line(4, '}');
            line(4, `after ${ms()} to ${done ? 'Done' : 'Idle'} {`);
            line(4, '}');
            line(3, '}');
            if (done) {
                line(3, 'final state Done {');
                line(3, '}');
            }
            line(2, '}');
        }
        else if (listen === 'interrupt') {
            line(2, 'operation listen() {');
            line(3, `while (true, ${r.int(5, 200)} times) {`);
            line(4, 'interruptible {');
            line(5, `wait ${ms()};`);
            line(5, 'seen = seen + 1;');
            line(4, '} on receive feed.level(v) {');
            line(5, 'seen = v;');
            line(4, '}');
            line(3, '}');
            line(2, '}');
        }
        else if (listen === 'schedule') {
            line(2, 'operation listen(v: int) {');
            line(3, 'seen = v;');
            line(2, '}');
        }
        line(2, 'schedule {');
        line(3, `on receive feed.ev(v) take(v)${r.chance(0.2) ? ` deadline ${r.int(2, 9)}ms` : ''};`);
        if (listen === 'schedule')
            line(3, 'on receive feed.level(v) listen(v);');
        else
            line(3, 'on start listen();');
        line(2, '}');
        line(1, '}');
    }
    line(1, 'component def Server {');
    for (let i = 0; i < pairs; i++)
        line(2, `port ask${i}: Ask;`);
    line(2, 'attribute total: int = 0;');
    line(2, 'operation add(v: int) returns int {');
    if (r.chance(0.5))
        line(3, `wait ${r.int(1, 8)}ms;`);
    line(3, 'total = total + v;');
    if (r.chance(0.4))
        line(3, `if (v == ${r.int(1, 9)}) {\n${'  '.repeat(4)}fail "unlucky";\n${'  '.repeat(3)}}`);
    line(3, 'return total;');
    line(2, '}');
    line(2, 'operation peek(v: int) returns int {');
    if (r.chance(0.5))
        line(3, `wait ${r.int(1, 4)}ms;`);
    line(3, 'return v + 1;');
    line(2, '}');
    line(2, 'schedule {');
    for (let i = 0; i < pairs; i++)
        line(3, r.chance(0.3) ? `on call ask${i}.ask(v) peek(v) concurrent;` : `on call ask${i}.ask(v) add(v);`);
    line(2, '}');
    line(1, '}');
    line(1, 'component Demo {');
    line(2, 'component server: Server;');
    for (let i = 0; i < pairs; i++) {
        line(2, `component producer${i}: Producer${i};`);
        line(2, `component consumer${i}: Consumer${i};`);
        line(2, `connect${r.chance(0.6) ? ` link${i}: Q` : ''} (producer${i}.feed, consumer${i}.feed);`);
        line(2, `connect${r.chance(0.5) ? ` call${i}: Q` : ''} (consumer${i}.ask, server.ask${i});`);
    }
    line(1, '}');
    line(0, '}');
    return out.join('\n') + '\n';
}
/** Simulation options for one seed: horizons, latency, faults and limits that make overflow likely. */
export function randomOptions(seed) {
    const r = random(seed ^ 0x9e3779b9), options = { untilNs: r.int(5, 120) * 1_000_000 };
    if (r.chance(0.3))
        options.latencyNs = r.int(0, 3) * 1_000_000;
    if (r.chance(0.4))
    {
        let offer = 0;
        options.faults = Array.from({ length: r.int(1, 4) }, () => ({ offer: offer += r.int(1, 5), kind: r.pick(['drop', 'duplicate', 'transport']), ...(r.chance(0.3) ? { delayNs: r.int(0, 3) * 1_000_000 } : {}) }));
    }
    if (r.chance(0.2))
        options.maxPending = r.int(1, 6);
    if (r.chance(0.2))
        options.maxConcurrent = r.int(1, 3);
    if (r.chance(0.2))
        options.maxSteps = r.int(50, 5000);
    return options;
}
