# PROTOTYPE P1: hand rewrites of the WP5 completion-transition machines into stage 1 text without a condition trigger.
import os, re
src='E:/t/p1-scratch/migrated/examples/'; dst='E:/t/p1-scratch/hand/examples/'
os.makedirs(dst, exist_ok=True)
def body(text, start_marker, new):
    i = text.index(start_marker); j = text.index('initial', i)
    # end of the operation body: match braces from the operation's '{'
    k = text.index('{', i); depth = 0
    for p in range(k, len(text)):
        if text[p] == '{': depth += 1
        elif text[p] == '}':
            depth -= 1
            if depth == 0: end = p; break
    return text[:j] + new + '\n    ' + text[end:]
t = open(src + '44-session-completion.swaml', encoding='utf8').read()
t = body(t, 'operation run() {\n      initial Connecting', """ignore network.coverage;
      state Connecting {
        on entry {
          attempts = attempts + 1;
          sessionId = try(cloud.openSession(vehicleId), 0);
        }
      }
      if (sessionId > 0) {
        to Connected;
      }
      state Backoff {
        on entry {
          backoffs = backoffs + 1;
        }
        after 10ms to Connecting;
        on receive network.coverage(up) when (not up) to Offline {
          coverageLosses = coverageLosses + 1;
        }
      }
      state Connected {
        on receive network.coverage(up) when (not up) to Offline {
          coverageLosses = coverageLosses + 1;
          sessionId = 0;
        }
      }
      state Offline {
        on receive network.coverage(up) when (up) to Connecting;
      }""")
open(dst + '44-session-completion.swaml', 'w', encoding='utf8').write(t)
t = open(src + '46-breaker-internal.swaml', encoding='utf8').read()
t = body(t, 'operation circuit() {\n      initial Closed;\n      state Closed {\n        on receive stream.accepted(t) {', """while (true) {
        while (consecutiveFailures < failureThreshold) {
          state Closed {
            on receive stream.accepted(t) exit {
              write(t);
            }
          }
        }
        trips = trips + 1;
        state Open {
          on receive stream.accepted(t) stay {
            shedArrivals = shedArrivals + 1;
          }
          after 20ms exit {
            halfOpenAtNs = Swaml::Time::now();
          }
        }
        state HalfOpen {
          on entry {
            consecutiveFailures = 0;
          }
          on receive stream.accepted(t) exit {
            write(t);
          }
        }
      }""")
open(dst + '46-breaker-internal.swaml', 'w', encoding='utf8').write(t)
t = open('E:/t/sw-p1/examples/47-reaction-forms.swaml', encoding='utf8').read()
t = body(t, 'operation run() {\n      initial Warmup', """keep feed.tick, feed.level;
      ignore feed.done;
      defer = defer + 1;
      if (defer > 1) {
        to Done;
      }
      state Warmup {
        after 1ms stay {
          polls = polls + 1;
        }
        after (stepMs * 1ms) when (polls > 0) stay {
          polls = polls + 10;
        }
        after 3ms when (polls > 100) to Done;
        after (stepMs * 2ms) when (polls == 11) exit;
      }
      while (total <= 5000) {
        state Counting {
          on receive feed.tick(n) when (n > 0) exit {
            total = total * 10 + n;
          }
          on receive feed.tick(n) stay {
            polls = polls + 100;
          }
          on receive feed.level(v) exit {
            total = total * 10 + v;
          }
          on receive feed.done() to Done;
        }
      }
      state Done { }""")
open(dst + '47-reaction-forms.swaml', 'w', encoding='utf8').write(t)
