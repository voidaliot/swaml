# PROTOTYPE P4 item 5: hand rewrites of WP5 examples 44, 46, 47 in revision 4 (written once, kept in the models folder).
M = 'E:/GitHub/swaml-vsc-ext/.temp/kept/states-p6/models/'
def load(n):
    return open('E:/t/sw-p6/examples/' + n, encoding='utf8', newline='').read().replace('\r\n', '\n')
def rep(t, old, new):
    assert t.count(old) == 1, old[:80]
    return t.replace(old, new)
# 44
t = load('44-session-completion.swaml')
i = t.index("  component def Session {"); j = t.index("    operation run() {", i); k = t.index("    schedule {", j)
t = t[:j] + """    operation run() {
      /** PROTOTYPE revision 4 rewrite: the completion transitions are conditions standing in Connecting, checked by its arrival look after on entry. */
      state Connecting {
        on entry {
          attempts = attempts + 1;
          sessionId = try(cloud.openSession(vehicleId), 0);
        }
        if (sessionId > 0) { to Connected; } else { to Backoff; }
        on receive network.coverage(up) { if (not up) { coverageLosses = coverageLosses + 1; to Offline; } }
      }
      state Backoff {
        on entry {
          backoffs = backoffs + 1;
        }
        after 10ms { to Connecting; }
        on receive network.coverage(up) { if (not up) { coverageLosses = coverageLosses + 1; to Offline; } }
      }
      state Connected {
        on receive network.coverage(up) { if (not up) { coverageLosses = coverageLosses + 1; sessionId = 0; to Offline; } }
      }
      state Offline {
        on receive network.coverage(up) { if (up) { to Connecting; } }
      }
    }
""" + t[k:]
open(M + 'wp5-44-session-completion.rev4.swaml', 'w', encoding='utf8').write(t)
# 46
t = load('46-breaker-internal.swaml')
i = t.index("  component def InternalBreaker {"); j = t.index("    operation circuit() {", i); k = t.index("    schedule {", j)
t = t[:j] + """    operation circuit() {
      /** PROTOTYPE revision 4 rewrite: internal transitions are staying lines; the completion transition is a condition written after the line whose write it reads (the machine's own write, seen in the same look). */
      state Closed {
        on receive stream.accepted(t) { write(t); }
        if (consecutiveFailures >= failureThreshold) { trips = trips + 1; to Open; }
      }
      state Open {
        on receive stream.accepted(t) { shedArrivals = shedArrivals + 1; }
        after 20ms { halfOpenAtNs = Swaml::Time::now(); exit; }
      }
      state HalfOpen {
        on entry {
          consecutiveFailures = 0;
        }
        on receive stream.accepted(t) { write(t); to Closed; }
      }
    }
""" + t[k:]
open(M + 'wp5-46-breaker-internal.rev4.swaml', 'w', encoding='utf8').write(t)
# 47
t = load('47-reaction-forms.swaml')
t = rep(t, """    attribute polls: uint = 0;
""", """    attribute polls: uint = 0;
    // PROTOTYPE revision 4: deferral never ships; Warmup remembers the last tick and the last level in variables, and Counting replays them on entry, tick first.
    attribute heldTick: uint = 0;
    attribute hasTick: bool = false;
    attribute heldLevel: uint = 0;
    attribute hasLevel: bool = false;
    operation fold(n: uint) {
      if (n > 0) {
        total = total * 10 + n;
      } else {
        polls = polls + 100;
      }
    }
""")
j = t.index("    operation run() {"); k = t.index("    schedule {", j)
t = t[:j] + """    operation run() {
      state Warmup {
        on entry {
          defer = defer + 1;
        }
        on receive feed.tick(n) { heldTick = n; hasTick = true; }
        on receive feed.level(v) { heldLevel = v; hasLevel = true; }
        after 1ms { polls = polls + 1; }
        after (stepMs * 1ms) { if (polls > 0) { polls = polls + 10; } }
        after 3ms { if (polls > 100) { to Done; } }
        after (stepMs * 2ms) { if (polls == 11) { to Counting; } }
        if (defer > 1) { to Done; }
      }
      state Counting {
        on entry {
          if (hasTick) { fold(heldTick); }
          if (hasLevel) { total = total * 10 + heldLevel; }
        }
        on receive feed.tick(n) { fold(n); }
        on receive feed.level(v) { total = total * 10 + v; }
        on receive feed.done() { to Done; }
        if (total > 5000) { to Done; }
      }
      state Done {
      }
    }
""" + t[k:]
open(M + 'wp5-47-reaction-forms.rev4.swaml', 'w', encoding='utf8').write(t)
