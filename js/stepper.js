// stepper.js — shared, domain-generic stepper for one-prompt-per-screen flows
// (the readiness check + the two free-text builders). Steps no longer draw
// their own inline Back/Next; the persistent Back/Menu/Next control bar is the
// single navigator, and this module drives BOTH of its ends from the SAME
// advance/retreat logic (TRD-5.1).
//
// This module owns ONLY: the active step index, and wiring the persistent
// control bar (via router.js's setControls) so its Back/Next call the same
// advance/retreat references throughout. It contains ZERO readiness/IRAS-
// specific knowledge —
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
//                      host can trigger navigation (e.g. auto-advance) with them.
//   onIndexChange(index) - fires right after activeIndex changes, BEFORE the
//                    paint (before renderStep runs) — for a host's own
//                    per-render bookkeeping that does not belong inside the
//                    painted step body itself (progress counters,
//                    "answered/chosen so far" summaries, live previews).
//                    Never touched by stepper.js beyond calling it.
//   finish?        - {label, isEnabled(), onFinish} — last-step-only "finish"
//                    behaviour for the persistent Next (e.g. evaluate a gate
//                    and route elsewhere). Omit for a screen whose last step
//                    should fall through to the FLOW-derived next screen.
//
// Back: retreats to the previous step, except on the first step where it clears
// its override (undefined) so the router's FLOW-derived previous SCREEN applies.
// Next: on any step but the last it reads "Next →" and calls `advance`. On the
// last step: `finish` present -> reads finish.label, disabled unless
// finish.isEnabled(), calls finish.onFinish; `finish` absent -> cleared
// (undefined) so the FLOW-derived next screen applies.

import { setControls, getScreen } from './router.js';

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

  // Drive BOTH ends of the persistent control bar for the current step, so the
  // bar is the single navigator now that steps have no inline Back/Next
  // (issues 6 & 8). Back retreats to the previous step, except on the first step
  // where it falls through to the FLOW-derived previous SCREEN. Next advances to
  // the next step, runs the finish action on the last step (when configured), or
  // falls through to the FLOW-derived next SCREEN on a last step with no finish.
  // Passing `undefined` for a side clears any prior override so the router's
  // FLOW default takes over for that side.
  function applyStepControls() {
    if (getScreen() !== screenName) return;
    const isFirst = activeIndex === 0;
    const isLast = activeIndex === total - 1;

    const controls = {};
    if (!isFirst) {
      controls.back = { label: '← Back', disabled: false };
      controls.onBack = retreat;
    } else {
      controls.back = undefined; // first step: FLOW prev screen
      controls.onBack = undefined;
    }

    if (!isLast) {
      controls.next = { label: 'Next →' };
      controls.onNext = advance;
    } else if (finish) {
      controls.next = { label: finish.label, disabled: !finish.isEnabled() };
      controls.onNext = finish.onFinish;
    } else {
      controls.next = undefined; // last step, no finish: FLOW next screen
      controls.onNext = undefined;
    }

    setControls(controls);
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

  // refreshControls re-applies the persistent control bar for the CURRENT step
  // WITHOUT repainting the step body — used when an answer commit on the last
  // step changes finish.isEnabled() (e.g. the final crucial item just became
  // answered), so the persistent Next enables without a full re-render.
  return { goTo: goTo, advance: advance, retreat: retreat, refreshControls: applyStepControls };
}
