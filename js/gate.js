// gate.js — the advisory readiness gate + the readiness RESOLUTION screen.
//
// PURE evaluation (evaluateGate / gateGaps / readinessCrucialAnswered) reads
// ONLY draft.readiness.answers — no DOM, no storage, no network — so it is
// unit-testable in isolation and can never characterise conduct or predict an
// outcome. renderResolution paints the readiness result: a clear "you're ready"
// or a plain "you may want to find out more about X first", and doubles as the
// breather that introduces Part 1.
//
// The gate is ADVISORY: it names which crucial thing is thin and always offers
// a "Continue anyway" path (carried by the persistent control bar, not an
// in-screen button). It never blocks or judges.

import { readiness } from './data.js';

function answers(draft) {
  return (draft && draft.readiness && draft.readiness.answers) || {};
}

function hasValue(v) {
  return v != null && String(v).trim() !== '';
}

// The three crucial readiness items, in order (who / what / how).
function crucialItems() {
  const items = (readiness && readiness.items) || [];
  return items.filter((it) => it && it.crucial);
}

// Is the finish control allowed? Every crucial item must have been answered
// (with any of have / unsure / no) so the reader has been through all three and
// the gate can then evaluate a genuine pass-or-gaps result.
export function readinessCrucialAnswered(draft) {
  const a = answers(draft);
  return crucialItems().every((it) => hasValue(a[it.id]));
}

// Pure gate evaluation. Each of the three verify items passes only when the
// reader affirmatively has it ('have'); 'unsure' or 'no' is a real, named gap.
export function evaluateGate(draft) {
  const a = answers(draft);
  const who = a.whoKnown === 'have';
  const what = a.whatKnown === 'have';
  const how = a.howKnown === 'have';
  return { who, what, how, passed: who && what && how };
}

// The ordered list of thin crucial things for the resolution screen. Each gap's
// label comes from the item's own `gap` string in data.js, so copy lives in one
// place. Names what to find out; never says an offence occurred.
export function gateGaps(draft) {
  const a = answers(draft);
  return crucialItems()
    .filter((it) => a[it.id] !== 'have')
    .map((it) => ({ id: it.id, title: it.gap || it.prompt, detail: it.recommend || it.hint || '' }));
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function announce(message) {
  const live = document.getElementById('sr-live');
  if (live) live.textContent = message;
}

/**
 * renderRedirect(rootEl, draft, handlers) — the readiness RESOLUTION screen.
 * Paints into #redirect-body and sets the screen heading + eyebrow. It renders
 * one of two honest states and, either way, introduces Part 1 as the next step:
 *   - ready:  "You have what the form needs" + a Part 1 breather.
 *   - gaps:   "You can still start" + the named things to find out first.
 * Forward ("Begin Part 1" / "Continue anyway") and Back are carried by the
 * persistent control bar (app.js), not by in-screen buttons — one navigator,
 * no duplicate Next. `handlers` is kept for API compatibility but unused here.
 */
export function renderRedirect(rootEl, draft, handlers) {
  const screen = rootEl && rootEl.querySelector ? rootEl : null;
  const body = screen ? screen.querySelector('#redirect-body') : null;
  if (!body) return;
  body.textContent = '';

  const result = evaluateGate(draft);
  const gaps = gateGaps(draft);

  const eyebrow = screen.querySelector('#redirect-eyebrow');
  const heading = screen.querySelector('#redirect-heading');

  if (result.passed) {
    if (eyebrow) eyebrow.textContent = 'Check done';
    if (heading) heading.textContent = 'You have what the form needs';
    body.appendChild(
      el(
        'p',
        'screen__lead',
        'You can say who is involved, what happened, and how you know. That is enough for a useful report.'
      )
    );
  } else {
    if (eyebrow) eyebrow.textContent = 'Almost there';
    if (heading) heading.textContent = 'You can start, but a couple of things are worth firming up';
    body.appendChild(
      el(
        'p',
        'screen__lead',
        'You can carry on now and fill these in on the form itself. A stronger report covers them, though, so before you file it helps to know:'
      )
    );

    const list = el('ul', 'redirect__list');
    gaps.forEach((gap) => {
      const li = el('li', 'redirect__item');
      li.appendChild(el('span', 'redirect__item-title', gap.title));
      if (gap.detail) li.appendChild(el('span', 'redirect__item-detail', gap.detail));
      list.appendChild(li);
    });
    body.appendChild(list);
  }

  // The breather that introduces the next phase (issue 9): the reader always
  // knows exactly what comes next before they proceed.
  const nextUp = el('div', 'phase-intro');
  nextUp.appendChild(el('span', 'phase-intro__kicker', 'Up next'));
  nextUp.appendChild(
    el('span', 'phase-intro__name', 'What happened')
  );
  nextUp.appendChild(
    el(
      'span',
      'phase-intro__desc',
      'A few quick questions about what actually went on. Your answers become the write-up. About 5 minutes. Hit ' +
        (result.passed ? '“Begin →”' : '“Continue anyway →”') +
        ' below when you’re ready, or Back to change the check.'
    )
  );
  body.appendChild(nextUp);

  announce(
    result.passed
      ? 'You have what the form needs. Next, what happened.'
      : 'You can start. A couple of things worth firming up first: ' +
          gaps.map((g) => g.title).join('; ') +
          '.'
  );
}
