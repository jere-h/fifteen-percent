// stepper.js — shared, domain-generic stepper for one-prompt-per-screen flows
// (the readiness check + the two free-text builders), unifying how a screen's
// own inline Back/Next buttons and the persistent Back/Menu/Next control bar
// talk to the SAME advance/retreat logic (TRD-5.1).
//
// This module owns ONLY: the active step index, and wiring the persistent
// control bar (via router.js's setControls/clearControls) so it always calls
// literally the same advance/retreat function references a host's own inline
// Next/Back buttons use. It contains ZERO readiness/IRAS-specific knowledge —
// no import from js/gate.js or js/data.js, no branching on any domain concept
// (TRD-5.13). All pass/fail routing, gate evaluation, and prompt-tree content
// stay inside the host modules (js/checklist.js, js/builders.js); stepper.js
// only ever invokes a host's logic through the opaque `finish.onFinish` /
// `finish.isEnabled` callbacks it was configured with.
//
// Public API: createStepper({screenName, total, firstIndex, renderStep,
// onIndexChange, finish}) -> { goTo, advance, retreat }
//
//   screenName     - the router screen name this stepper drives the control
//                    bar for (e.g. 'readiness', 'part1', 'part2').
//   total          - number of steps.
//   firstIndex     - the initial active index.
//   renderStep(index, {total, isLast, goTo, advance, retreat})
//                    - paints ONE step's body into the host's own DOM. Called
//                      on every paint, including the very first. `goTo` /
//                      `advance` / `retreat` are the SAME function references
//                      the persistent bar's Next/Back use on that step, so a
//                      host builds its inline buttons from them directly.
//   onIndexChange(index) - fires right after activeIndex changes, BEFORE the
//                    paint (before renderStep runs) — for a host's own
//                    per-render bookkeeping that does not belong inside the
//                    painted step body itself (progress counters,
//                    "answered/chosen so far" summaries, live previews).
//                    Never touched by stepper.js beyond calling it.
//   finish?        - {label, isEnabled(), onFinish} — last-step-only "finish"
//                    behaviour for the persistent Next (e.g. evaluate a gate
//                    and route elsewhere). Omit for a screen whose last step
//                    should fall back to the plain FLOW-derived Next
//                    (router.clearControls()).
//
// Every step except the last: the persistent Next reads "Next →" and calls
// the exact same `advance` reference as any inline Next button the host
// wires up in renderStep. On the last step: `finish` present -> persistent
// Next reads finish.label, is disabled unless finish.isEnabled(), and calls
// finish.onFinish; `finish` absent -> router.clearControls() so the screen's
// plain FLOW-derived Back/Menu/Next takes back over.

import { setControls, clearControls, getScreen } from './router.js';

// One document-level 'screen:changed' listener per screenName (not per
// createStepper call), so re-rendering a screen's stepper (e.g. after the
// Safety panel's Clear resets and repaints the whole page) never stacks
// duplicate listeners — the single listener always calls whichever stepper
// instance for that screen was created most recently.
const latestApplyByScreen = Object.create(null);
const listenerBoundByScreen = Object.create(null);

export function createStepper(config) {
  const cfg = config || {};
  const screenName = cfg.screenName;
  const total = typeof cfg.total === 'number' && cfg.total > 0 ? cfg.total : 0;
  const renderStep = typeof cfg.renderStep === 'function' ? cfg.renderStep : null;
  const onIndexChange = typeof cfg.onIndexChange === 'function' ? cfg.onIndexChange : null;
  const finish = cfg.finish || null;

  function clamp(i) {
    return Math.min(Math.max(i, 0), Math.max(0, total - 1));
  }

  let activeIndex = clamp(typeof cfg.firstIndex === 'number' ? cfg.firstIndex : 0);

  function applyStepControls() {
    if (getScreen() !== screenName) return;
    const isLast = activeIndex === total - 1;
    if (!isLast) {
      setControls({ next: { label: 'Next →' }, onNext: advance });
    } else if (finish) {
      setControls({
        next: { label: finish.label, disabled: !finish.isEnabled() },
        onNext: finish.onFinish,
      });
    } else {
      clearControls();
    }
  }

  function paint() {
    if (renderStep) {
      renderStep(activeIndex, {
        total: total,
        isLast: activeIndex === total - 1,
        goTo: goTo,
        advance: advance,
        retreat: retreat,
      });
    }
    applyStepControls();
  }

  function goTo(index) {
    activeIndex = clamp(index);
    if (onIndexChange) onIndexChange(activeIndex);
    paint();
  }

  function advance() {
    goTo(activeIndex + 1);
  }

  function retreat() {
    goTo(activeIndex - 1);
  }

  latestApplyByScreen[screenName] = applyStepControls;
  if (!listenerBoundByScreen[screenName]) {
    listenerBoundByScreen[screenName] = true;
    document.addEventListener('screen:changed', function (e) {
      if (e && e.detail && e.detail.name === screenName && latestApplyByScreen[screenName]) {
        latestApplyByScreen[screenName]();
      }
    });
  }

  // Initial paint (mirrors every later goTo, so onIndexChange bookkeeping runs
  // consistently on first paint too).
  goTo(activeIndex);

  return { goTo: goTo, advance: advance, retreat: retreat };
}
