// checklist.js — the tap-first guided wizard, one decision per screen.
//
// Renders the ordered steps from the inlined data.checklist as a stepper: one
// question is presented at a time with Back / Next controls, answered steps
// collapse to a compact editable summary, and an always-visible "N of 7
// answered" counter gives durable, return-recognised progress. Each answer is
// written straight into reportDraft.answers, persisted through store.save (a
// no-op unless the user opted in to on-device saving), and announced via a
// 'draft:changed' CustomEvent so the Assembled Draft and Transfer Mode re-render.
//
// Single-select steps (chips / radio) implement the WAI-ARIA radio pattern —
// one tab stop, arrow keys move-and-select, roving tabindex to the checked
// option. Multi-select steps use distinct checkbox-style ticks so pick-one and
// pick-many never look the same. Every control is a real <button> clearing the
// ~44px tap floor and reachable by keyboard and assistive tech.
//
// Contract: export function renderChecklist(rootEl, draft, onChange) -> void
// (also re-exports answeredCount for callers that want the count without DOM).

import { checklist, fragmentFor } from './data.js';
import { answeredCount, ANSWER_FIELDS } from './state.js';
import * as store from './store.js';

export { answeredCount };

function ensureAnswers(draft) {
  if (!draft.answers || typeof draft.answers !== 'object') {
    draft.answers = {};
  }
  return draft.answers;
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

// Is a single step answered? Mirrors state.answeredCount's per-field rule.
function stepAnswered(draft, step) {
  const val = draft.answers[step.field];
  if (step.inputType === 'multiselect') {
    return Array.isArray(val) && val.length > 0;
  }
  return val != null && String(val).trim() !== '';
}

// A short, human summary of a step's current answer for the collapsed row.
function summaryValue(draft, step) {
  const val = draft.answers[step.field];
  if (Array.isArray(val)) return val.join(', ');
  return val == null ? '' : String(val);
}

// --- single-select: WAI-ARIA radio pattern --------------------------------
// Applies to BOTH chips and radio inputType (both are single-choice). Visual
// treatment differs (pill vs full-width row) but the semantics and keyboard
// model are the correct radiogroup pattern.
function renderSingleChoice(stepEl, step, draft, commit, promptId, hintId) {
  const isRadio = step.inputType === 'radio';
  const cls = isRadio ? 'checklist__radio' : 'checklist__chip';

  const wrap = el('div', 'checklist__options');
  wrap.setAttribute('role', 'radiogroup');
  if (promptId) wrap.setAttribute('aria-labelledby', promptId);
  if (hintId) wrap.setAttribute('aria-describedby', hintId);

  const options = Array.isArray(step.options) ? step.options : [];
  const buttons = [];

  const current = () => draft.answers[step.field];

  function refresh() {
    const cur = current();
    let checkedIdx = options.indexOf(cur);
    buttons.forEach((btn, i) => {
      const selected = options[i] === cur;
      btn.classList.toggle(cls + '--selected', selected);
      btn.setAttribute('aria-checked', selected ? 'true' : 'false');
      // Roving tabindex: the checked option is the single tab stop; if nothing
      // is checked, the first option is.
      const rove = checkedIdx === -1 ? 0 : checkedIdx;
      btn.tabIndex = i === rove ? 0 : -1;
    });
  }

  function move(fromIdx, delta) {
    if (!options.length) return;
    const nextIdx = (fromIdx + delta + options.length) % options.length;
    commit(step.field, options[nextIdx]); // arrow always selects, never clears
    refresh();
    buttons[nextIdx].focus();
  }

  options.forEach((opt, i) => {
    const btn = el('button', cls, opt);
    btn.type = 'button';
    btn.setAttribute('role', 'radio');
    btn.addEventListener('click', () => {
      // Click toggles: re-tapping the selected option clears it, so a phone
      // mis-tap is easy to undo.
      const next = current() === opt ? null : opt;
      commit(step.field, next);
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

// --- multi-select: distinct checkbox-style toggles ------------------------
function renderMultiSelect(stepEl, step, draft, commit, promptId, hintId) {
  const wrap = el('div', 'checklist__multiselect');
  wrap.setAttribute('role', 'group');
  if (promptId) wrap.setAttribute('aria-labelledby', promptId);
  if (hintId) wrap.setAttribute('aria-describedby', hintId);

  if (!Array.isArray(draft.answers[step.field])) {
    draft.answers[step.field] = [];
  }

  const options = Array.isArray(step.options) ? step.options : [];

  options.forEach((opt) => {
    const selected = draft.answers[step.field].includes(opt);
    const btn = el('button', 'checklist__chip checklist__chip--multi', opt);
    btn.type = 'button';
    btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    if (selected) btn.classList.add('checklist__chip--checked');
    btn.addEventListener('click', () => {
      const cur = Array.isArray(draft.answers[step.field])
        ? draft.answers[step.field].slice()
        : [];
      const idx = cur.indexOf(opt);
      if (idx === -1) cur.push(opt);
      else cur.splice(idx, 1);
      commit(step.field, cur);
      const on = cur.includes(opt);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.classList.toggle('checklist__chip--checked', on);
    });
    wrap.appendChild(btn);
  });

  stepEl.appendChild(wrap);
}

// Build the interactive body (prompt + hint + options) for one step.
function buildStepBody(step, draft, commit, index, total) {
  const stepEl = el('div', 'checklist__step is-active');
  stepEl.dataset.field = step.field;

  const counter = el(
    'p',
    'checklist__step-counter',
    'Step ' + (index + 1) + ' of ' + total
  );
  stepEl.appendChild(counter);

  const promptId = 'checklist-prompt-' + (step.id || step.field);
  const prompt = el('p', 'checklist__prompt', step.prompt || '');
  prompt.id = promptId;
  stepEl.appendChild(prompt);

  const isMulti = step.inputType === 'multiselect';
  const hintId = promptId + '-hint';
  const hint = el(
    'p',
    'checklist__hint',
    isMulti ? 'Pick any that apply' : 'Pick one'
  );
  hint.id = hintId;
  stepEl.appendChild(hint);

  if (isMulti) {
    renderMultiSelect(stepEl, step, draft, commit, promptId, hintId);
  } else {
    renderSingleChoice(stepEl, step, draft, commit, promptId, hintId);
  }

  return stepEl;
}

/**
 * renderChecklist(rootEl, draft, onChange)
 * Draws the whole stepper into rootEl (#checklist). For every answer it mutates
 * draft.answers, persists through store.save (no-op unless persistence is on),
 * calls onChange(field, value) if provided, and dispatches 'draft:changed'.
 */
export function renderChecklist(rootEl, draft, onChange) {
  if (!rootEl) return;
  ensureAnswers(draft);
  rootEl.textContent = '';

  const steps = (checklist && Array.isArray(checklist.steps) ? checklist.steps : [])
    .filter((s) => s && s.field);
  const total = steps.length;

  // --- header (single-sourced from JS, TRD-12) ---------------------------
  rootEl.appendChild(el('p', 'eyebrow', 'Guided checklist'));
  const heading = el('h2', null, 'Build your report, one tap at a time');
  heading.id = 'checklist-heading';
  heading.tabIndex = -1; // TRD-8 focus target on view switch
  rootEl.appendChild(heading);
  rootEl.appendChild(
    el(
      'p',
      'checklist__intro',
      'You choose from the options; the app writes the report. Answer one question, then tap Next — you can stop and come back any time.'
    )
  );

  // --- progress counter (always visible, TRD-11) -------------------------
  const progress = el('div', 'checklist__progress');
  progress.setAttribute('role', 'status');
  rootEl.appendChild(progress);

  const wizard = el('div', 'checklist checklist--stepped');
  const summariesEl = el('div', 'checklist__summaries');
  const stepHost = el('div', 'checklist__stephost');
  wizard.appendChild(summariesEl);
  wizard.appendChild(stepHost);
  rootEl.appendChild(wizard);

  // First unanswered step (restores position on return); if all answered,
  // land on the last step so "See your draft" is one tap away.
  function firstUnansweredIndex() {
    for (let i = 0; i < steps.length; i++) {
      if (!stepAnswered(draft, steps[i])) return i;
    }
    return Math.max(0, total - 1);
  }

  let activeIndex = firstUnansweredIndex();

  function updateProgress() {
    const n = answeredCount(draft);
    progress.textContent = '';
    const strong = el('span', 'checklist__progress-count', n + ' of ' + total);
    progress.appendChild(strong);
    progress.appendChild(
      document.createTextNode(
        ' answered' + (n === total ? ' — you have covered every question.' : '')
      )
    );
  }

  function renderSummaries() {
    summariesEl.textContent = '';
    const answeredSteps = steps
      .map((step, i) => ({ step, i }))
      .filter(({ step, i }) => i !== activeIndex && stepAnswered(draft, step));
    if (!answeredSteps.length) return;

    const heading2 = el('p', 'checklist__summaries-title', 'Answered so far');
    summariesEl.appendChild(heading2);

    answeredSteps.forEach(({ step, i }) => {
      const row = el('div', 'checklist__summary');
      const check = el('span', 'checklist__check', '✓');
      check.setAttribute('aria-hidden', 'true');
      row.appendChild(check);

      const textWrap = el('div', 'checklist__summary-text');
      textWrap.appendChild(el('span', 'checklist__summary-prompt', step.prompt));
      textWrap.appendChild(
        el('span', 'checklist__summary-value', summaryValue(draft, step))
      );
      row.appendChild(textWrap);

      const edit = el('button', 'checklist__edit', 'Edit');
      edit.type = 'button';
      edit.setAttribute(
        'aria-label',
        'Edit your answer to: ' + step.prompt
      );
      edit.addEventListener('click', () => goTo(i, true));
      row.appendChild(edit);

      summariesEl.appendChild(row);
    });
  }

  const commit = (field, value) => {
    draft.answers[field] = value;
    draft.updatedAt = new Date().toISOString();
    try {
      store.save(draft);
    } catch (err) {
      /* persistence is best-effort; the in-memory draft is source of truth */
    }
    if (typeof onChange === 'function') onChange(field, value);
    document.dispatchEvent(
      new CustomEvent('draft:changed', { detail: { field, value } })
    );
    updateProgress();
    renderSummaries();
  };

  function paintActive(focusIt) {
    stepHost.textContent = '';
    if (!total) return;
    const step = steps[activeIndex];
    const body = buildStepBody(step, draft, commit, activeIndex, total);

    // Per-step Back / Next (TRD-10).
    const nav = el('div', 'checklist__nav');

    const back = el('button', 'checklist__back', '← Back');
    back.type = 'button';
    back.disabled = activeIndex === 0;
    back.addEventListener('click', () => goTo(activeIndex - 1, true));
    nav.appendChild(back);

    const isLast = activeIndex === total - 1;
    const nextLabel = isLast
      ? 'See your draft →'
      : 'Next — ' + (activeIndex + 2) + ' of ' + total + ' →';
    const next = el('button', 'checklist__next', nextLabel);
    next.type = 'button';
    next.addEventListener('click', () => {
      if (isLast) {
        const tab = document.getElementById('tab-draft');
        if (tab) tab.click();
      } else {
        goTo(activeIndex + 1, true);
      }
    });
    nav.appendChild(next);

    body.appendChild(nav);
    stepHost.appendChild(body);

    announce(
      'Step ' + (activeIndex + 1) + ' of ' + total + ': ' + (step.prompt || '')
    );

    if (focusIt) {
      // Move focus to the step's counter/heading region without yanking to a
      // control the user did not choose. The prompt is the natural landmark.
      const prompt = body.querySelector('.checklist__prompt');
      if (prompt) {
        prompt.tabIndex = -1;
        prompt.focus();
      }
    }
  }

  function goTo(index, focusIt) {
    activeIndex = Math.min(Math.max(index, 0), Math.max(0, total - 1));
    renderSummaries();
    paintActive(focusIt);
  }

  updateProgress();
  renderSummaries();
  paintActive(false);
}
