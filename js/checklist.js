// checklist.js — the tap-first guided wizard.
//
// Renders the ordered steps from the inlined data.checklist (chips / radio /
// multiselect / short-text) into #checklist. Each answer is written straight
// into reportDraft.answers, persisted through store.save (a no-op unless the
// user has opted in to on-device saving), and announced via a 'draft:changed'
// CustomEvent so the Assembled Draft and Transfer Mode sections re-render.
//
// The wording is kept neutral: the wizard collects what substantiates the
// claim, and never pushes the informant to foreground the taxpayer's identity.
// All controls are real <button>/<input> elements so they clear the ~44px tap
// floor and stay reachable by keyboard and assistive tech. Every step is
// visible at rest — nothing waits on a class another file must add.

import { checklist } from './data.js';
import * as store from './store.js';

// Small debounce so typing into a short-text field does not fire a save +
// re-render on every keystroke.
function debounce(fn, wait) {
  let timer = null;
  return function debounced(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  };
}

function ensureAnswers(draft) {
  if (!draft.answers || typeof draft.answers !== 'object') {
    draft.answers = {};
  }
  return draft.answers;
}

// Builds one selectable option control. `variant` picks the block class and the
// accessibility model: chips/multiselect use aria-pressed (toggle buttons),
// radio uses role="radio" + aria-checked.
function makeOptionButton(labelText, variant, selected) {
  const cls = variant === 'radio' ? 'checklist__radio' : 'checklist__chip';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = cls + (selected ? ' ' + cls + '--selected' : '');
  btn.textContent = labelText;
  if (variant === 'radio') {
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', selected ? 'true' : 'false');
  } else {
    btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
  }
  return btn;
}

function applySelectedState(btn, variant, selected) {
  const cls = variant === 'radio' ? 'checklist__radio' : 'checklist__chip';
  btn.classList.toggle(cls + '--selected', selected);
  if (variant === 'radio') {
    btn.setAttribute('aria-checked', selected ? 'true' : 'false');
  } else {
    btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
  }
}

// Renders a single-choice step (inputType 'chips' or 'radio'). Tapping a
// selected option again clears it, so a mis-tap on a phone is easy to undo.
function renderSingleChoice(stepEl, step, draft, commit, promptId) {
  const variant = step.inputType === 'radio' ? 'radio' : 'chip';
  const wrap = document.createElement('div');
  wrap.className = 'checklist__options';
  wrap.setAttribute('role', variant === 'radio' ? 'radiogroup' : 'group');
  if (promptId) wrap.setAttribute('aria-labelledby', promptId);

  const options = Array.isArray(step.options) ? step.options : [];
  const controls = [];

  const refresh = () => {
    const current = draft.answers[step.field];
    controls.forEach(({ btn, value }) => {
      applySelectedState(btn, variant, current === value);
    });
  };

  options.forEach((opt) => {
    const selected = draft.answers[step.field] === opt;
    const btn = makeOptionButton(opt, variant, selected);
    btn.addEventListener('click', () => {
      const next = draft.answers[step.field] === opt ? null : opt;
      commit(step.field, next);
      refresh();
    });
    controls.push({ btn, value: opt });
    wrap.appendChild(btn);
  });

  stepEl.appendChild(wrap);
}

// Renders a multi-choice step (inputType 'multiselect'). The answer is always
// an array; tapping toggles membership.
function renderMultiSelect(stepEl, step, draft, commit, promptId) {
  const wrap = document.createElement('div');
  wrap.className = 'checklist__multiselect';
  wrap.setAttribute('role', 'group');
  if (promptId) wrap.setAttribute('aria-labelledby', promptId);

  if (!Array.isArray(draft.answers[step.field])) {
    draft.answers[step.field] = [];
  }

  const options = Array.isArray(step.options) ? step.options : [];

  options.forEach((opt) => {
    const selected = draft.answers[step.field].includes(opt);
    const btn = makeOptionButton(opt, 'chip', selected);
    btn.addEventListener('click', () => {
      const current = Array.isArray(draft.answers[step.field])
        ? draft.answers[step.field].slice()
        : [];
      const idx = current.indexOf(opt);
      if (idx === -1) current.push(opt);
      else current.splice(idx, 1);
      commit(step.field, current);
      applySelectedState(btn, 'chip', current.includes(opt));
    });
    wrap.appendChild(btn);
  });

  stepEl.appendChild(wrap);
}

// Renders a short free-text step (inputType 'shorttext'). Empty input is stored
// as null so downstream sections can treat "unanswered" uniformly.
function renderShortText(stepEl, step, draft, commit, promptId) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'checklist__text';
  input.setAttribute('aria-labelledby', promptId || '');
  // Reduce the odds of the value being cached in browser autofill; the Safety
  // panel is honest that device trails still exist, but there is no reason to
  // volunteer this field to autofill.
  input.autocomplete = 'off';
  input.autocapitalize = 'off';
  input.spellcheck = false;

  const existing = draft.answers[step.field];
  input.value = typeof existing === 'string' ? existing : '';

  const doCommit = () => {
    const value = input.value.length ? input.value : null;
    commit(step.field, value);
  };

  input.addEventListener('input', debounce(doCommit, 250));
  input.addEventListener('blur', doCommit);

  stepEl.appendChild(input);
}

/**
 * renderChecklist(rootEl, draft, onChange)
 * Draws the whole wizard into rootEl (#checklist). For every answer it mutates
 * draft.answers, persists through store.save (no-op unless persistence is on),
 * calls onChange(field, value) if provided, and dispatches 'draft:changed'.
 */
export function renderChecklist(rootEl, draft, onChange) {
  if (!rootEl) return;
  ensureAnswers(draft);

  // Commit path shared by every control type.
  const commit = (field, value) => {
    draft.answers[field] = value;
    draft.updatedAt = new Date().toISOString();
    // store.save gates itself on the persistence toggle and degrades to
    // in-memory-only without throwing; guard anyway so a storage fault can
    // never break the wizard.
    try {
      store.save(draft);
    } catch (err) {
      /* persistence is best-effort; the in-memory draft is the source of truth */
    }
    if (typeof onChange === 'function') {
      onChange(field, value);
    }
    document.dispatchEvent(
      new CustomEvent('draft:changed', { detail: { field, value } })
    );
  };

  rootEl.textContent = '';

  const list = document.createElement('div');
  list.className = 'checklist';

  const steps = checklist && Array.isArray(checklist.steps) ? checklist.steps : [];

  steps.forEach((step) => {
    if (!step || !step.field) return;

    const stepEl = document.createElement('div');
    stepEl.className = 'checklist__step';
    stepEl.dataset.field = step.field;

    const promptId = 'checklist-prompt-' + (step.id || step.field);
    const prompt = document.createElement('p');
    prompt.className = 'checklist__prompt';
    prompt.id = promptId;
    prompt.textContent = step.prompt || '';
    stepEl.appendChild(prompt);

    switch (step.inputType) {
      case 'multiselect':
        renderMultiSelect(stepEl, step, draft, commit, promptId);
        break;
      case 'shorttext':
        renderShortText(stepEl, step, draft, commit, promptId);
        break;
      case 'radio':
      case 'chips':
      default:
        renderSingleChoice(stepEl, step, draft, commit, promptId);
        break;
    }

    list.appendChild(stepEl);
  });

  rootEl.appendChild(list);
}
