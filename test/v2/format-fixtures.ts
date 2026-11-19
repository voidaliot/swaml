// Generated formatter inputs shared by the formatter tests and their fresh-process runs.
/** A valid model exercising every comment position and the layout rules, repeated count times. */
export function largeModel(count: number): string {
    let s = '// Generated formatter stress model.\npackage Large {\n  /** Generated package documentation. */\n  port def Messages {\n    /** Message port. */\n    provides event message(value: int) /** Trailing member documentation. */;\n  }\n  datatype Pair { left: int /** Left value. */; right: int; }\n';
    for (let i = 0; i < count; i++)
        s += `
  component def Unit${i} {
    /**
     * Component number ${i}: documentation spanning
     *   several indented lines.
     */
    reversed port input: Messages;
    reversed port control: Messages;
    // A line comment before an attribute ${i}.
    attribute last: int = - ${i} /** Leaf documentation ${i}. */;
    attribute values: int[3] =[1, -2, 3];
    attribute pair: Pair = record Pair { left = 1; right = -(2 + ${i}); };
    /* A block comment ${i}. */
    operation pick() returns int[3] {
      return[last, - last, 0]; // trailing line comment ${i}
    }
    operation work() {
      interruptible {
        wait 8ms;
        last = values[0] + (pair.left);
      } on receive input.message(value) {
        last = value;
      }
    }
    operation lamp() {
      state Off {
        /** State documentation ${i}. */
        after 2ms {
          exit;
        } on receive control.message(v) {
          if(v > 0) {
            last = v;
            exit;
          }
        }
      }
      state On {
        on entry {
          last = 1;
        } on exit {
          last = 0;
        }
        after 3ms exit;
      }
      state Done {
      }
    }
    schedule {
      on start work();
      on start lamp();
    }
  }
`;
    return s + '}\n// Trailing comment after the last declaration.\n';
}

/**
 * Documentation first in operation bodies (before if, before var) and first in a state, the four positions
 * the V2X showcase always lost in-process on Node.js 26.12.0 (onPseudonym, transmitAwareness, transmitHazard
 * and state Idle), repeated count times.
 */
export function bodyDocsModel(count: number): string {
    let s = 'package Shapes {\n  port def Ticks {\n    provides event tick(v: int);\n  }\n';
    for (let i = 0; i < count; i++)
        s += `  component def Unit${i} {
    reversed port input: Ticks;
    attribute stationId: uint = 0;
    attribute sent: int = 0;
    operation digest(v: int) returns int {
      return v + ${i};
    }
    operation onPseudonym(id: uint) {
      /** A new pseudonym restarts the linkable action identifiers ${i}. */
      if (id != stationId) {
        stationId = id;
      }
    }
    operation transmitAwareness(frame: int) {
      /** Signs and sends a prepared awareness frame ${i}. */
      var d: int = digest(frame);
      sent = sent + d;
    }
    operation transmitHazard(frame: int) {
      /** Signs a prepared hazard frame and sends it on both channels ${i}. */
      var d: int = digest(frame);
      sent = sent - d;
    }
    operation hazardLifecycle() {
      state Idle {
        /** No own hazard is announced ${i}. */
        on entry {
          transmitAwareness(1);
        }
        on receive input.tick(v) {
          transmitHazard(v);
          to Idle;
        }
      }
    }
    schedule {
      on start hazardLifecycle();
    }
  }
`;
    return s + '}\n';
}
