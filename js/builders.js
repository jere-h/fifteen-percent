// builders.js — the two tap-first free-text field builders (the core, TRD-3).
//
// Each builder walks the reader through one prompt tree from data.js
// `freeTextBuilders` (ft1 = "what happened", ft2 = "how/when you became aware"),
// one prompt per internal step, tap-only. The user CHOOSES; the app WRITES the
// prose. A live preview of the growing block renders under the prompts.
//
// Unsure disclosure (the guarantee, TRD-3.2/3.4): picking an "I'm not sure"
// option stores NOTHING and instead reveals a secondary jog-memory list of
// more-specific possibilities, ending in one "Other — type it myself" entry that
// reveals a text input. Only a refined value (a concrete jog fragment or the
// manual text) is ever stored, so no "unsure" placeholder can reach the block.
// "I don't know" (omitIfUnrefined) options contribute nothing at all.
//
// Contract: exports renderBuilder(rootEl, draft, key, onChange) and (from IP-2)
// renderPartHeaders(). renderBuilder mutates draft.freeText[key].answers[promptId],
// persists through store.save, calls onChange('freeText.'+key, promptId, value),
// and dispatches 'draft:changed'.

import { freeTextBuilders, parts } from './data.js';
import { buildNarrative } from './draft.js';
import * as store from './store.js';

// ---------------------------------------------------------------- Part headers

// Apply one Part's name + estimate to its static <h2 tabindex="-1"> heading and
// restate the estimate in a small .part__timebox line beneath it.
function applyPart(key) {
  const cfg = parts && parts[key];
  if (!cfg) return;

  const heading = document.getElementById(key + '-heading');
  if (heading) {
    heading.textContent = cfg.name + ' — ' + cfg.estimate;
  }

  const timebox = document.getElementById(key + '-timebox');
  if (timebox) {
    const mins = String(cfg.estimate || '').replace(/[~]/g, '').trim();
    timebox.textContent = 'About ' + mins + ' — tap to choose, the app writes the words.';
  }
}

// Populate the Part 1 and Part 2 headers. Safe to call repeatedly (idempotent).
export function renderPartHeaders() {
  applyPart('part1');
  applyPart('part2');
}

// ---------------------------------------------------------------- helpers

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

function ensureFreeText(draft, key) {
  if (!draft.freeText || typeof draft.freeText !== 'object') {
    draft.freeText = {
      ft1: { answers: {}, override: null },
      ft2: { answers: {}, override: null },
    };
  }
  if (!draft.freeText[key] || typeof draft.freeText[key] !== 'object') {
    draft.freeText[key] = { answers: {}, override: null };
  }
  if (!draft.freeText[key].answers || typeof draft.freeText[key].answers !== 'object') {
    draft.freeText[key].answers = {};
  }
  return draft.freeText[key].answers;
}

// The unsure option of a prompt (there is at most one, by design).
function unsureOption(prompt) {
  return (prompt.options || []).find((o) => o && o.unsure) || null;
}

// Resolve the stored fragment for a prompt to a short human label for the
// "so far" summary: a main-option label, a jog-entry label, or the manual text
// itself (quoted) when the reader typed their own.
function summaryLabelFor(prompt, stored) {
  if (stored == null || String(stored).trim() === '') return '';
  const s = String(stored);
  for (const opt of prompt.options || []) {
    if (opt.fragment === s) return opt.label;
    if (Array.isArray(opt.jog)) {
      for (const j of opt.jog) {
        if (j.fragment === s) return j.label;
      }
    }
  }
  return '“' + s + '”';
}

// ---------------------------------------------------------------- one prompt

// Build the interactive body for a single prompt: counter + prompt + hint +
// main radiogroup, with an unsure option's nested jog radiogroup revealed inline.
function buildPromptBody(cfg, prompt, index, total, answers, commit) {
  const stepEl = el('div', 'checklist__step builder__step is-active');
  stepEl.dataset.prompt = prompt.id;

  stepEl.appendChild(
    el('p', 'checklist__step-counter', 'Prompt ' + (index + 1) + ' of ' + total)
  );

  const promptId = 'builder-prompt-' + cfg.key + '-' + prompt.id;
  const promptEl = el('p', 'checklist__prompt', prompt.prompt || '');
  promptEl.id = promptId;
  stepEl.appendChild(promptEl);

  const hintId = promptId + '-hint';
  const hintEl = el('p', 'checklist__hint', prompt.hint || 'Pick one.');
  hintEl.id = hintId;
  stepEl.appendChild(hintEl);

  const options = Array.isArray(prompt.options) ? prompt.options : [];
  const unsure = unsureOption(prompt);

  // Is a jog value currently the stored one? Then reveal the jog on first paint.
  const stored = answers[prompt.id];
  let jogRevealed = false;
  if (stored != null && unsure) {
    const s = String(stored);
    const isMain = options.some((o) => o.fragment === s);
    if (!isMain) jogRevealed = true; // a jog fragment or manual text is stored
  }

  const group = el('div', 'checklist__options builder__options');
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-labelledby', promptId);
  group.setAttribute('aria-describedby', hintId);

  const mainButtons = [];
  let jogWrap = null;
  // Transient "I don't know" selection. An omitIfUnrefined pick stores NOTHING,
  // so its highlighted/checked state lives only here (until navigation) — but it
  // must still deselect every sibling, so exactly one radio is aria-checked.
  let omitIndex = -1;

  // Recompute selected/tab state across the main options. Exactly one radio may
  // read as checked: a concrete stored fragment, an open unsure branch, or a
  // transient omit pick — never two at once.
  function refreshMain() {
    const cur = answers[prompt.id];
    const curStr = cur == null ? null : String(cur);
    let checkedIdx = -1;
    options.forEach((opt, i) => {
      let selected = false;
      if (i === omitIndex) {
        selected = true; // transient "I don't know" highlight
      } else if (opt.unsure) {
        selected = jogRevealed; // the unsure branch reads "active" while open
      } else if (opt.fragment != null) {
        selected = curStr != null && opt.fragment === curStr;
      }
      const btn = mainButtons[i];
      btn.classList.toggle('checklist__radio--selected', selected);
      btn.setAttribute('aria-checked', selected ? 'true' : 'false');
      if (selected && checkedIdx === -1) checkedIdx = i;
    });
    const rove = checkedIdx === -1 ? 0 : checkedIdx;
    mainButtons.forEach((btn, i) => {
      btn.tabIndex = i === rove ? 0 : -1;
    });
  }

  function hideJog() {
    jogRevealed = false;
    if (jogWrap) jogWrap.hidden = true;
  }

  function showJog() {
    jogRevealed = true;
    if (jogWrap) jogWrap.hidden = false;
  }

  function moveMain(fromIdx, delta) {
    if (!options.length) return;
    const nextIdx = (fromIdx + delta + options.length) % options.length;
    mainButtons[nextIdx].focus();
  }

  options.forEach((opt, i) => {
    const btn = el('button', 'checklist__radio', opt.label);
    btn.type = 'button';
    btn.setAttribute('role', 'radio');
    btn.addEventListener('click', () => {
      if (opt.unsure) {
        // Reveal the jog list; store NOTHING until it is refined.
        omitIndex = -1;
        commit(prompt.id, null);
        showJog();
        refreshMain();
        const first = jogWrap && jogWrap.querySelector('.checklist__radio');
        if (first) first.focus();
      } else if (opt.omitIfUnrefined) {
        // "I don't know": contributes nothing. Clear any stored value + jog, and
        // deselect every sibling so this is the sole aria-checked radio.
        omitIndex = i;
        commit(prompt.id, null);
        hideJog();
        refreshMain();
      } else {
        // A concrete choice: store its fragment, close any open jog.
        omitIndex = -1;
        const next = String(answers[prompt.id]) === opt.fragment ? null : opt.fragment;
        commit(prompt.id, next);
        hideJog();
        refreshMain();
      }
    });
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        moveMain(i, 1);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        moveMain(i, -1);
      }
    });
    mainButtons.push(btn);
    group.appendChild(btn);

    // The jog list lives directly under its unsure option.
    if (opt.unsure && Array.isArray(opt.jog)) {
      jogWrap = buildJog(prompt, opt, answers, commit, promptId, () => {
        refreshMain();
      });
      jogWrap.hidden = !jogRevealed;
      group.appendChild(jogWrap);
    }
  });

  stepEl.appendChild(group);
  refreshMain();
  return stepEl;
}

// The secondary jog-memory list: a nested radiogroup of more-specific
// possibilities ending in a manual "type it myself" input.
function buildJog(prompt, unsure, answers, commit, labelledById, afterChange) {
  const wrap = el('div', 'builder__jog');

  const titleId = 'builder-jog-title-' + prompt.id;
  const title = el('p', 'builder__jog-title', 'A bit more specific — which is closest?');
  title.id = titleId;
  wrap.appendChild(title);

  const list = el('div', 'checklist__options builder__jog-list');
  list.setAttribute('role', 'radiogroup');
  list.setAttribute('aria-labelledby', titleId);

  const jog = Array.isArray(unsure.jog) ? unsure.jog : [];
  const buttons = [];
  let manualInput = null;

  const stored = answers[prompt.id];
  const storedStr = stored == null ? null : String(stored);
  const jogFragments = jog.filter((j) => j.fragment != null).map((j) => j.fragment);
  let manualActive =
    storedStr != null && storedStr !== '' && jogFragments.indexOf(storedStr) === -1
      ? true
      : false;

  function refreshJog() {
    const cur = answers[prompt.id];
    const curStr = cur == null ? null : String(cur);
    let checkedIdx = -1;
    jog.forEach((j, i) => {
      let selected = false;
      if (j.manual) selected = manualActive;
      else selected = curStr != null && j.fragment === curStr;
      const btn = buttons[i];
      btn.classList.toggle('checklist__radio--selected', selected);
      btn.setAttribute('aria-checked', selected ? 'true' : 'false');
      if (selected && checkedIdx === -1) checkedIdx = i;
    });
    const rove = checkedIdx === -1 ? 0 : checkedIdx;
    buttons.forEach((btn, i) => {
      btn.tabIndex = i === rove ? 0 : -1;
    });
  }

  function moveJog(fromIdx, delta) {
    if (!jog.length) return;
    const nextIdx = (fromIdx + delta + jog.length) % jog.length;
    buttons[nextIdx].focus();
  }

  jog.forEach((j, i) => {
    const btn = el('button', 'checklist__radio builder__jog-option', j.label);
    btn.type = 'button';
    btn.setAttribute('role', 'radio');
    btn.addEventListener('click', () => {
      if (j.manual) {
        manualActive = true;
        commit(prompt.id, null); // nothing stored until the reader types + commits
        if (manualInput) {
          manualInput.hidden = false;
          manualInput.focus();
        }
      } else {
        manualActive = false;
        if (manualInput) manualInput.hidden = true;
        const next = String(answers[prompt.id]) === j.fragment ? null : j.fragment;
        commit(prompt.id, next);
      }
      refreshJog();
      if (typeof afterChange === 'function') afterChange();
    });
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        moveJog(i, 1);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        moveJog(i, -1);
      }
    });
    buttons.push(btn);
    list.appendChild(btn);
  });

  wrap.appendChild(list);

  // Manual "type it myself" input — a real textbox, committing on blur/Enter.
  const manualEntry = jog.find((j) => j.manual);
  if (manualEntry) {
    manualInput = el('input', 'checklist__text builder__manual-input');
    manualInput.type = 'text';
    manualInput.setAttribute(
      'aria-label',
      'Type your own answer for: ' + (prompt.prompt || '')
    );
    manualInput.placeholder = 'Type it in your own words…';
    if (manualActive && storedStr) manualInput.value = storedStr;
    manualInput.hidden = !manualActive;

    const commitManual = () => {
      const text = String(manualInput.value || '').replace(/\s+$/, '').trim();
      manualActive = true;
      commit(prompt.id, text === '' ? null : text);
      refreshJog();
      if (typeof afterChange === 'function') afterChange();
    };
    manualInput.addEventListener('blur', commitManual);
    manualInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        manualInput.blur();
      }
    });
    wrap.appendChild(manualInput);
  }

  refreshJog();
  return wrap;
}

// ---------------------------------------------------------------- renderBuilder

/**
 * renderBuilder(rootEl, draft, key, onChange)
 * Draws the whole builder stepper for one free-text field into rootEl
 * (#builder-ft1 | #builder-ft2). key is 'ft1' | 'ft2'. Each refined choice
 * mutates draft.freeText[key].answers[promptId], persists through store.save,
 * calls onChange('freeText.'+key, promptId, value), and dispatches
 * 'draft:changed'. The builder owns its own step state and is NOT re-rendered by
 * the draft:changed listener (app.js), so tap/focus place is preserved.
 */
export function renderBuilder(rootEl, draft, key, onChange) {
  if (!rootEl) return;
  const cfg = freeTextBuilders[key];
  if (!cfg) return;
  cfg.key = key; // stamp for stable prompt ids across helpers
  const answers = ensureFreeText(draft, key);

  rootEl.textContent = '';

  const prompts = (Array.isArray(cfg.prompts) ? cfg.prompts : []).filter(
    (p) => p && p.id
  );
  const total = prompts.length;

  // Which form field this builds — the reader always knows the destination.
  rootEl.appendChild(
    el('p', 'builder__field-label', 'Drafting the form field:')
  );
  rootEl.appendChild(el('p', 'builder__field-name', '“' + cfg.fieldLabel + '”'));

  const progress = el('div', 'checklist__progress');
  progress.setAttribute('role', 'status');
  rootEl.appendChild(progress);

  const wizard = el('div', 'checklist checklist--stepped builder__wizard');
  const summariesEl = el('div', 'checklist__summaries');
  const stepHost = el('div', 'checklist__stephost');
  wizard.appendChild(summariesEl);
  wizard.appendChild(stepHost);
  rootEl.appendChild(wizard);

  // Live preview of the growing block.
  const preview = el('div', 'builder__preview');
  preview.appendChild(el('p', 'builder__preview-label', 'Your paste-ready text so far'));
  const previewText = el('p', 'builder__preview-text');
  previewText.setAttribute('role', 'status');
  previewText.setAttribute('aria-live', 'off');
  preview.appendChild(previewText);
  rootEl.appendChild(preview);

  function promptAnswered(prompt) {
    const v = answers[prompt.id];
    return v != null && String(v).trim() !== '';
  }

  function answeredCount() {
    return prompts.reduce((n, p) => (promptAnswered(p) ? n + 1 : n), 0);
  }

  function firstUnansweredIndex() {
    for (let i = 0; i < prompts.length; i++) {
      if (!promptAnswered(prompts[i])) return i;
    }
    return Math.max(0, total - 1);
  }

  let activeIndex = firstUnansweredIndex();

  function updateProgress() {
    const n = answeredCount();
    progress.textContent = '';
    progress.appendChild(el('span', 'checklist__progress-count', n + ' of ' + total));
    progress.appendChild(
      document.createTextNode(
        ' answered' + (n === total ? ' — every prompt is done.' : '')
      )
    );
  }

  function updatePreview() {
    const model = buildNarrative(draft);
    const text = model[key] ? model[key].text : '';
    if (text && text.trim() !== '') {
      previewText.textContent = text;
      previewText.classList.remove('builder__preview-text--empty');
    } else {
      previewText.textContent =
        'Nothing yet — as you tap, the words for this field build up here.';
      previewText.classList.add('builder__preview-text--empty');
    }
  }

  function renderSummaries() {
    summariesEl.textContent = '';
    const done = prompts
      .map((prompt, i) => ({ prompt, i }))
      .filter(({ prompt, i }) => i !== activeIndex && promptAnswered(prompt));
    if (!done.length) return;

    summariesEl.appendChild(el('p', 'checklist__summaries-title', 'Chosen so far'));
    done.forEach(({ prompt, i }) => {
      const row = el('div', 'checklist__summary');
      const check = el('span', 'checklist__check', '✓');
      check.setAttribute('aria-hidden', 'true');
      row.appendChild(check);

      const textWrap = el('div', 'checklist__summary-text');
      textWrap.appendChild(el('span', 'checklist__summary-prompt', prompt.prompt));
      textWrap.appendChild(
        el('span', 'checklist__summary-value', summaryLabelFor(prompt, answers[prompt.id]))
      );
      row.appendChild(textWrap);

      const edit = el('button', 'checklist__edit', 'Edit');
      edit.type = 'button';
      edit.setAttribute('aria-label', 'Edit your answer to: ' + prompt.prompt);
      edit.addEventListener('click', () => goTo(i, true));
      row.appendChild(edit);

      summariesEl.appendChild(row);
    });
  }

  const commit = (promptId, value) => {
    if (value == null) {
      delete answers[promptId];
    } else {
      answers[promptId] = value;
    }
    draft.updatedAt = new Date().toISOString();
    try {
      store.save(draft);
    } catch (err) {
      /* persistence is best-effort; the in-memory draft is source of truth */
    }
    if (typeof onChange === 'function') onChange('freeText.' + key, promptId, value);
    document.dispatchEvent(
      new CustomEvent('draft:changed', {
        detail: { field: 'freeText.' + key, promptId: promptId, value: value },
      })
    );
    updateProgress();
    renderSummaries();
    updatePreview();
  };

  function paintActive(focusIt) {
    stepHost.textContent = '';
    if (!total) return;
    const prompt = prompts[activeIndex];
    const body = buildPromptBody(cfg, prompt, activeIndex, total, answers, commit);

    const nav = el('div', 'checklist__nav');
    const back = el('button', 'checklist__back', '← Previous');
    back.type = 'button';
    back.disabled = activeIndex === 0;
    back.addEventListener('click', () => goTo(activeIndex - 1, true));
    nav.appendChild(back);

    if (activeIndex < total - 1) {
      const next = el(
        'button',
        'checklist__next',
        'Next prompt — ' + (activeIndex + 2) + ' of ' + total + ' →'
      );
      next.type = 'button';
      next.addEventListener('click', () => goTo(activeIndex + 1, true));
      nav.appendChild(next);
    } else {
      const doneNote = el(
        'p',
        'builder__done-note',
        'That is the last prompt — use Next below to move on.'
      );
      nav.appendChild(doneNote);
    }

    body.appendChild(nav);
    stepHost.appendChild(body);

    announce('Prompt ' + (activeIndex + 1) + ' of ' + total + ': ' + (prompt.prompt || ''));

    if (focusIt) {
      const p = body.querySelector('.checklist__prompt');
      if (p) {
        p.tabIndex = -1;
        p.focus();
      }
    }
  }

  function goTo(index, focusIt) {
    activeIndex = Math.min(Math.max(index, 0), Math.max(0, total - 1));
    renderSummaries();
    paintActive(focusIt);
  }

  // Keep the live preview honest when the block changes OFF this screen — e.g. a
  // whole-block override set on the Review screen. Only the preview text is
  // repainted (never the stepper), so tap/focus place is preserved. A prior
  // listener from an earlier render of this same host is removed first, so
  // renderAll (boot, Clear) never leaks stacked listeners (IP3-4).
  if (rootEl.__previewListener) {
    document.removeEventListener('draft:changed', rootEl.__previewListener);
  }
  rootEl.__previewListener = updatePreview;
  document.addEventListener('draft:changed', updatePreview);

  updateProgress();
  updatePreview();
  renderSummaries();
  paintActive(false);
}
