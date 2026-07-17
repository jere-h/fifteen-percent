// gate.js — the advisory readiness gate + the "gather this first" redirect.
//
// PURE evaluation (evaluateGate / gateGaps / readinessCrucialAnswered) reads
// ONLY draft.readiness.answers — no DOM, no storage, no network — so it is
// unit-testable in isolation and can never characterise conduct or predict an
// outcome. renderRedirect paints the procedural "here is what to gather" screen.
//
// The gate is ADVISORY: it names which crucial group is thin and offers a
// "Continue anyway" path. It never blocks or judges.

import { readiness } from './data.js';

function answers(draft) {
  return (draft && draft.readiness && draft.readiness.answers) || {};
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function hasValue(v) {
  return v != null && String(v).trim() !== '';
}

// The evidence sentinel that means "I have kept nothing" — the reporter's own
// account only. Selecting just this does NOT clear the 'how' bar (see below).
const NOTHING_KEPT = 'Nothing kept yet, only my account';

// Is the finish control allowed? This is the "Next enabled" test — deliberately
// DISTINCT from evaluateGate's satisfaction test. It gates only on the NON-multi
// crucial items (the 'who' pair: reportingOn + identityDetails), which is what a
// report minimally needs to name a subject.
//
// The multi-select crucial items (taxTypes/behaviours → 'what',
// evidence/relationship → 'how') are intentionally NOT required here: leaving one
// empty is a real, meaningful gap, and finish must stay reachable so the gate can
// catch it and route to the "gather this first" Redirect. If finish required
// every crucial item (including the multis), a satisfiable multi would be
// indistinguishable from an unmet one and the what/how groups could never fail
// the gate — the Redirect would only ever fire for the 'who' group.
export function readinessCrucialAnswered(draft) {
  const a = answers(draft);
  const items = (readiness && readiness.items) || [];
  return items
    .filter((it) => it && it.crucial && !it.multi)
    .every((it) => hasValue(a[it.id]));
}

// Pure gate evaluation. Groups map to the vision's who / what / how:
//   who  = who you're reporting on is identifiable
//   what = which tax + what happened
//   how  = your connection + something to point to
export function evaluateGate(draft) {
  const a = answers(draft);
  const who = hasValue(a.reportingOn) && a.identityDetails === 'have';
  const what = arr(a.taxTypes).length > 0 && arr(a.behaviours).length > 0;
  // evidence is a multi-select stored as string[], so test its CONTENTS, not the
  // whole array against a string. A report backed ONLY by the "nothing kept"
  // sentinel (the reporter's own account, nothing to point to) does not satisfy
  // 'how'; any other selected evidence — including an in-person account — does.
  const ev = arr(a.evidence).filter((x) => x !== NOTHING_KEPT);
  const how = arr(a.relationship).length > 0 && ev.length > 0;
  return { who, what, how, passed: who && what && how };
}

// Procedural, non-characterising descriptions of each group's gap. Names what to
// gather; never says an offence occurred or predicts what IRAS will do.
const GAP_COPY = {
  who: {
    title: 'Who you are reporting on',
    detail:
      "A name for the person or business, plus any address, NRIC/FIN or UEN you happen to know. Without at least a name it is hard for IRAS to act.",
  },
  what: {
    title: 'What is involved',
    detail:
      'Which type(s) of tax, and a short description of what appears to have happened.',
  },
  how: {
    title: 'How you know',
    detail:
      'Your connection to it, and anything you can point to as supporting information.',
  },
};

// The ordered list of missing groups for the redirect screen.
export function gateGaps(draft) {
  const g = evaluateGate(draft);
  const gaps = [];
  if (!g.who) gaps.push({ group: 'who', ...GAP_COPY.who });
  if (!g.what) gaps.push({ group: 'what', ...GAP_COPY.what });
  if (!g.how) gaps.push({ group: 'how', ...GAP_COPY.how });
  return gaps;
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
 * renderRedirect(rootEl, draft, { onContinue, onBackToMenu })
 * Paints the "gather this first" screen body into #redirect-body, naming the
 * specific crucial group(s) that are thin. Both actions are >=44px buttons and
 * fully keyboard reachable. Nothing here is transmitted.
 */
export function renderRedirect(rootEl, draft, handlers) {
  const body = rootEl && rootEl.querySelector
    ? rootEl.querySelector('#redirect-body')
    : null;
  if (!body) return;
  body.textContent = '';

  const gaps = gateGaps(draft);
  const h = handlers || {};

  const list = el('ul', 'redirect__list');
  gaps.forEach((gap) => {
    const li = el('li', 'redirect__item');
    li.appendChild(el('span', 'redirect__item-title', gap.title));
    li.appendChild(el('span', 'redirect__item-detail', gap.detail));
    list.appendChild(li);
  });
  body.appendChild(list);

  const note = el(
    'p',
    'redirect__note',
    'Gather what you can, then come back — your other answers are saved. Or continue anyway; you can add these details on the form itself.'
  );
  body.appendChild(note);

  const actions = el('div', 'redirect__actions');

  const cont = el('button', 'btn btn--primary redirect__continue', 'Continue anyway');
  cont.type = 'button';
  cont.addEventListener('click', function () {
    if (typeof h.onContinue === 'function') h.onContinue();
  });
  actions.appendChild(cont);

  const menu = el('button', 'btn btn--secondary redirect__menu', 'Back to menu');
  menu.type = 'button';
  menu.addEventListener('click', function () {
    if (typeof h.onBackToMenu === 'function') h.onBackToMenu();
  });
  actions.appendChild(menu);

  body.appendChild(actions);

  const titles = gaps.map((g) => g.title.toLowerCase());
  announce(
    titles.length
      ? 'A few things to gather first: ' + titles.join('; ') + '.'
      : 'A few things to gather first.'
  );
}
