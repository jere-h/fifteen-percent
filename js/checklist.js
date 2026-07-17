// checklist.js — the readiness check (Part 0), one decision per screen.
//
// REPURPOSED in IP-2: this module no longer re-collects the IRAS form's simple
// structured fields as prose. It renders the tap-first READINESS CHECK — a fast
// verification that the reader actually holds each piece the form will ask for —
// and doubles as the advisory gate (see js/gate.js). One item per internal step,
// reusing the stepper: single-select items are a WAI-ARIA radiogroup, multi-
// select items are distinct checkbox-style chips, and "verify" items are a
// three-button radiogroup ("I have this / Not sure / No") stored as
// have | unsure | no.
//
// Every answer is written into draft.readiness.answers[item.id], persisted
// through store.save (a no-op unless on-device saving is on), reported via
// onChange('readiness.'+id, value), and announced with a 'draft:changed' event.
//
// Contract (UNCHANGED): export function renderChecklist(rootEl, draft, onChange)

import { readiness } from './data.js';
import {
  readinessCrucialAnswered,
  evaluateGate,
} from './gate.js';
import * as store from './store.js';
import { showScreen } from './router.js';
import { createStepper } from './stepper.js';

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

function ensureReadiness(draft) {
  if (!draft.readiness || typeof draft.readiness !== 'object') {
    draft.readiness = { answers: {}, gate: { evaluated: false, passed: null, acknowledgedRedirect: false } };
  }
  if (!draft.readiness.answers || typeof draft.readiness.answers !== 'object') {
    draft.readiness.answers = {};
  }
  return draft.readiness.answers;
}

// Verify items map three display labels to the canonical have/unsure/no values.
// A select item's value is its own label.
function optionsFor(item) {
  if (item.kind === 'verify') {
    const labels =
      Array.isArray(item.options) && item.options.length === 3
        ? item.options
        : ['I have this', 'Not sure', 'No'];
    const values = ['have', 'unsure', 'no'];
    return labels.map((label, i) => ({ value: values[i], label }));
  }
  const opts = Array.isArray(item.options) ? item.options : [];
  return opts.map((o) => ({ value: o, label: o }));
}

function itemAnswered(draft, item) {
  const val = draft.readiness.answers[item.id];
  if (item.multi) return Array.isArray(val) && val.length > 0;
  return val != null && String(val).trim() !== '';
}

// Count of answered readiness items (durable, return-recognised progress).
function answeredReadinessCount(draft) {
  const items = (readiness && readiness.items) || [];
  return items.reduce((n, it) => (itemAnswered(draft, it) ? n + 1 : n), 0);
}

// Short human summary of an answer for the collapsed "answered so far" row.
function summaryValue(draft, item) {
  const val = draft.readiness.answers[item.id];
  if (item.kind === 'verify') {
    const pair = optionsFor(item).find((o) => o.value === val);
    return pair ? pair.label : '';
  }
  if (Array.isArray(val)) return val.join(', ');
  return val == null ? '' : String(val);
}

// --- single-select (select-single AND verify): WAI-ARIA radio pattern -------
function renderSingleChoice(stepEl, item, draft, commit, promptId, hintId) {
  const wrap = el('div', 'checklist__options');
  wrap.setAttribute('role', 'radiogroup');
  if (promptId) wrap.setAttribute('aria-labelledby', promptId);
  if (hintId) wrap.setAttribute('aria-describedby', hintId);

  const pairs = optionsFor(item);
  const buttons = [];
  const current = () => draft.readiness.answers[item.id];

  function refresh() {
    const cur = current();
    let checkedIdx = pairs.findIndex((p) => p.value === cur);
    buttons.forEach((btn, i) => {
      const selected = pairs[i].value === cur;
      btn.classList.toggle('checklist__radio--selected', selected);
      btn.setAttribute('aria-checked', selected ? 'true' : 'false');
      const rove = checkedIdx === -1 ? 0 : checkedIdx;
      btn.tabIndex = i === rove ? 0 : -1;
    });
  }

  function move(fromIdx, delta) {
    if (!pairs.length) return;
    const nextIdx = (fromIdx + delta + pairs.length) % pairs.length;
    commit(item.id, pairs[nextIdx].value); // arrow always selects, never clears
    refresh();
    buttons[nextIdx].focus();
  }

  pairs.forEach((pair, i) => {
    const btn = el('button', 'checklist__radio', pair.label);
    btn.type = 'button';
    btn.setAttribute('role', 'radio');
    btn.addEventListener('click', () => {
      // Re-tapping the selected option clears it, so a phone mis-tap is easy to
      // undo.
      const next = current() === pair.value ? null : pair.value;
      commit(item.id, next);
      refresh();
    });
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        move(i, 1);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        move(i, -1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        move(-1, 1);
      } else if (e.key === 'End') {
        e.preventDefault();
        move(0, -1);
      }
    });
    buttons.push(btn);
    wrap.appendChild(btn);
  });

  refresh();
  stepEl.appendChild(wrap);
}

// --- multi-select: distinct checkbox-style toggles --------------------------
function renderMultiSelect(stepEl, item, draft, commit, promptId, hintId) {
  const wrap = el('div', 'checklist__multiselect');
  wrap.setAttribute('role', 'group');
  if (promptId) wrap.setAttribute('aria-labelledby', promptId);
  if (hintId) wrap.setAttribute('aria-describedby', hintId);

  if (!Array.isArray(draft.readiness.answers[item.id])) {
    draft.readiness.answers[item.id] = [];
  }

  const options = Array.isArray(item.options) ? item.options : [];

  options.forEach((opt) => {
    const selected = draft.readiness.answers[item.id].includes(opt);
    const btn = el('button', 'checklist__chip checklist__chip--multi', opt);
    btn.type = 'button';
    btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    if (selected) btn.classList.add('checklist__chip--checked');
    btn.addEventListener('click', () => {
      const cur = Array.isArray(draft.readiness.answers[item.id])
        ? draft.readiness.answers[item.id].slice()
        : [];
      const idx = cur.indexOf(opt);
      if (idx === -1) cur.push(opt);
      else cur.splice(idx, 1);
      commit(item.id, cur);
      const on = cur.includes(opt);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.classList.toggle('checklist__chip--checked', on);
    });
    wrap.appendChild(btn);
  });

  stepEl.appendChild(wrap);
}

// Build the interactive body (counter + prompt + hint + options) for one item.
function buildStepBody(item, draft, commit, index, total) {
  const stepEl = el('div', 'checklist__step is-active');
  stepEl.dataset.item = item.id;

  stepEl.appendChild(
    el('p', 'readiness__step-counter', 'Step ' + (index + 1) + ' of ' + total)
  );

  const promptId = 'readiness-prompt-' + item.id;
  const prompt = el('p', 'checklist__prompt', item.prompt || '');
  prompt.id = promptId;
  stepEl.appendChild(prompt);

  const hintId = promptId + '-hint';
  const defaultHint = item.multi ? 'Pick any that apply' : 'Pick one';
  const hint = el('p', 'checklist__hint', item.hint || defaultHint);
  hint.id = hintId;
  stepEl.appendChild(hint);

  if (item.multi) {
    renderMultiSelect(stepEl, item, draft, commit, promptId, hintId);
  } else {
    renderSingleChoice(stepEl, item, draft, commit, promptId, hintId);
  }

  return stepEl;
}

/**
 * renderChecklist(rootEl, draft, onChange)
 * Draws the whole readiness stepper into rootEl (#checklist). Each answer mutates
 * draft.readiness.answers, persists through store.save, calls
 * onChange('readiness.'+id, value), and dispatches 'draft:changed'.
 */
export function renderChecklist(rootEl, draft, onChange) {
  if (!rootEl) return;
  ensureReadiness(draft);
  rootEl.textContent = '';

  const items = (readiness && Array.isArray(readiness.items) ? readiness.items : [])
    .filter((it) => it && it.id);
  const total = items.length;
  const part = (readiness && readiness.part) || { name: 'Part 0: Readiness', estimate: '~3 mins' };

  // --- timeboxed header (single-sourced from data.js) --------------------
  rootEl.appendChild(el('p', 'eyebrow', 'Readiness check'));
  const heading = el('h2', null, part.name + ' — ' + part.estimate);
  heading.id = 'checklist-heading';
  heading.tabIndex = -1; // focus target on screen switch (router)
  rootEl.appendChild(heading);
  rootEl.appendChild(
    el('p', 'part__timebox', 'About ' + part.estimate.replace(/[~]/g, '').trim() + ' — you tap, you don’t type.')
  );
  rootEl.appendChild(
    el(
      'p',
      'checklist__intro',
      'The form already collects the simple choices itself. This quick check just confirms you have what it will ask for — nothing here is typed into the form or sent anywhere.'
    )
  );

  // --- progress counter (always visible) ---------------------------------
  const progress = el('div', 'checklist__progress');
  progress.setAttribute('role', 'status');
  rootEl.appendChild(progress);

  const wizard = el('div', 'checklist checklist--stepped');
  const summariesEl = el('div', 'checklist__summaries');
  const stepHost = el('div', 'checklist__stephost');
  wizard.appendChild(summariesEl);
  wizard.appendChild(stepHost);
  rootEl.appendChild(wizard);

  function firstUnansweredIndex() {
    for (let i = 0; i < items.length; i++) {
      if (!itemAnswered(draft, items[i])) return i;
    }
    return Math.max(0, total - 1);
  }

  function updateProgress() {
    const n = answeredReadinessCount(draft);
    progress.textContent = '';
    progress.appendChild(el('span', 'checklist__progress-count', n + ' of ' + total));
    progress.appendChild(
      document.createTextNode(
        ' checked' + (n === total ? ' — you have been through every item.' : '')
      )
    );
  }

  // stepperApi is assigned once createStepper() below returns; the "Edit" links
  // built here only run later, on click, by which time it is always assigned.
  let stepperApi = null;

  function renderSummaries(activeIndex) {
    summariesEl.textContent = '';
    const answered = items
      .map((item, i) => ({ item, i }))
      .filter(({ item, i }) => i !== activeIndex && itemAnswered(draft, item));
    if (!answered.length) return;

    summariesEl.appendChild(el('p', 'checklist__summaries-title', 'Checked so far'));

    answered.forEach(({ item, i }) => {
      const row = el('div', 'checklist__summary');
      const check = el('span', 'checklist__check', '✓');
      check.setAttribute('aria-hidden', 'true');
      row.appendChild(check);

      const textWrap = el('div', 'checklist__summary-text');
      textWrap.appendChild(el('span', 'checklist__summary-prompt', item.prompt));
      textWrap.appendChild(el('span', 'checklist__summary-value', summaryValue(draft, item)));
      row.appendChild(textWrap);

      const edit = el('button', 'checklist__edit', 'Edit');
      edit.type = 'button';
      edit.setAttribute('aria-label', 'Edit your answer to: ' + item.prompt);
      edit.addEventListener('click', () => {
        if (stepperApi) stepperApi.goTo(i);
      });
      row.appendChild(edit);

      summariesEl.appendChild(row);
    });
  }

  const commit = (id, value) => {
    draft.readiness.answers[id] = value;
    draft.updatedAt = new Date().toISOString();
    try {
      store.save(draft);
    } catch (err) {
      /* persistence is best-effort; the in-memory draft is source of truth */
    }
    if (typeof onChange === 'function') onChange('readiness.' + id, value);
    document.dispatchEvent(
      new CustomEvent('draft:changed', { detail: { field: 'readiness.' + id, value } })
    );
    updateProgress();
  };

  // Evaluate the advisory gate, persist it, and route: pass -> Part 1;
  // otherwise -> the "gather this first" redirect. Preserves any prior
  // acknowledgedRedirect so re-running readiness never silently re-locks.
  // Passed to the stepper only as an opaque finish.onFinish callback
  // (TRD-5.1/5.13) — stepper.js never sees this routing logic.
  function finishReadiness() {
    const result = evaluateGate(draft);
    const prev = (draft.readiness && draft.readiness.gate) || {};
    draft.readiness.gate = {
      evaluated: true,
      passed: result.passed,
      acknowledgedRedirect: !!prev.acknowledgedRedirect,
    };
    draft.updatedAt = new Date().toISOString();
    try {
      store.save(draft);
    } catch (err) {
      /* best-effort */
    }
    document.dispatchEvent(new CustomEvent('draft:changed'));
    showScreen(result.passed ? 'part1' : 'redirect');
  }

  // painted flips true after the very first paint, so only THAT paint skips
  // moving focus (mirrors the old paintActive(focusIt) contract: false on
  // initial render, true on every subsequent goTo/advance/retreat).
  let painted = false;

  function renderStep(index, ctx) {
    const focusIt = painted;
    painted = true;

    stepHost.textContent = '';
    if (!total) return;
    const item = items[index];
    const body = buildStepBody(item, draft, commit, index, ctx.total);

    const nav = el('div', 'checklist__nav');

    const back = el('button', 'checklist__back', '← Back');
    back.type = 'button';
    back.disabled = index === 0;
    back.addEventListener('click', ctx.retreat);
    nav.appendChild(back);

    if (ctx.isLast) {
      const finishBtn = el('button', 'checklist__next', 'Check my readiness →');
      finishBtn.type = 'button';
      finishBtn.disabled = !readinessCrucialAnswered(draft);
      finishBtn.addEventListener('click', finishReadiness);
      nav.appendChild(finishBtn);
    } else {
      const next = el('button', 'checklist__next', 'Next →');
      next.type = 'button';
      next.addEventListener('click', ctx.advance);
      nav.appendChild(next);
    }

    body.appendChild(nav);
    stepHost.appendChild(body);

    announce('Step ' + (index + 1) + ' of ' + ctx.total + ': ' + (item.prompt || ''));

    if (focusIt) {
      const prompt = body.querySelector('.checklist__prompt');
      if (prompt) {
        prompt.tabIndex = -1;
        prompt.focus();
      }
    }
  }

  updateProgress();

  stepperApi = createStepper({
    screenName: 'readiness',
    total: total,
    firstIndex: firstUnansweredIndex(),
    renderStep: renderStep,
    onIndexChange: renderSummaries,
    finish: {
      label: 'Check my readiness →',
      isEnabled: () => readinessCrucialAnswered(draft),
      onFinish: finishReadiness,
    },
  });
}
