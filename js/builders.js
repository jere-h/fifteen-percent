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
import { buildNarrative, normalizeFragment } from './draft.js';
import * as store from './store.js';
import { createStepper } from './stepper.js';
import { showScreen, setControls } from './router.js';

// Which screen each builder hands off to when its last prompt is answered
// (issue 8: the final tap moves you on). ft1 -> the Part 2 breather; ft2 ->
// the Review. Kept here so the builder never needs to read the router's FLOW.
const NEXT_SCREEN = { ft1: 'intro2', ft2: 'assembly' };

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

// Arrow-key roving within a radiogroup's buttons: Up/Left and Down/Right move
// focus, wrapping. Shared by the main options and the jog page.
function wireRoving(buttons) {
  buttons.forEach((btn, i) => {
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        buttons[(i + 1) % buttons.length].focus();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        buttons[(i - 1 + buttons.length) % buttons.length].focus();
      }
    });
  });
}

// Set roving tabindex so the selected radio (or the first) is the single tab
// stop, matching the WAI-ARIA radiogroup pattern.
function setRoving(buttons) {
  let checked = buttons.findIndex((b) => b.getAttribute('aria-checked') === 'true');
  const rove = checked === -1 ? 0 : checked;
  buttons.forEach((b, i) => {
    b.tabIndex = i === rove ? 0 : -1;
  });
}

// Build the MAIN options body for one prompt (issue 8: each tap moves you on).
// A concrete option commits its fragment and advances; an "I don't know"
// (omitIfUnrefined) commits nothing and advances; an "I'm not sure" (unsure)
// opens the jog list as its OWN page via nav.openJog — never an inline reveal.
function buildPromptBody(cfg, prompt, index, total, answers, commit, nav) {
  const stepEl = el('div', 'checklist__step builder__step is-active');
  stepEl.dataset.prompt = prompt.id;

  stepEl.appendChild(
    el('p', 'builder__step-counter', 'Prompt ' + (index + 1) + ' of ' + total)
  );

  const promptId = 'builder-prompt-' + cfg.key + '-' + prompt.id;
  const promptEl = el('p', 'checklist__prompt', prompt.prompt || '');
  promptEl.id = promptId;
  stepEl.appendChild(promptEl);

  const hintId = promptId + '-hint';
  const hintEl = el('p', 'checklist__hint', prompt.hint || 'Tap an answer to continue.');
  hintEl.id = hintId;
  stepEl.appendChild(hintEl);

  const options = Array.isArray(prompt.options) ? prompt.options : [];
  const stored = answers[prompt.id];
  const storedStr = stored == null ? null : String(stored);
  // A stored value that is NOT one of the main fragments came from the jog
  // page (a jog fragment or manual text), so the unsure option reads selected.
  const isJogValue =
    storedStr != null && !options.some((o) => o.fragment === storedStr);

  const group = el('div', 'checklist__options builder__options');
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-labelledby', promptId);
  group.setAttribute('aria-describedby', hintId);

  const buttons = [];
  options.forEach((opt) => {
    const btn = el('button', 'checklist__radio', opt.label);
    btn.type = 'button';
    btn.setAttribute('role', 'radio');

    let selected = false;
    if (opt.fragment != null) selected = storedStr != null && opt.fragment === storedStr;
    else if (opt.unsure) selected = isJogValue;
    btn.classList.toggle('checklist__radio--selected', selected);
    btn.setAttribute('aria-checked', selected ? 'true' : 'false');

    btn.addEventListener('click', () => {
      if (opt.unsure) {
        nav.openJog(index, prompt, opt); // reveal-more as its own page
      } else if (opt.omitIfUnrefined) {
        commit(prompt.id, null); // "I don't know" — contributes nothing
        nav.forward(index);
      } else {
        commit(prompt.id, opt.fragment);
        nav.forward(index);
      }
    });

    buttons.push(btn);
    group.appendChild(btn);
  });

  wireRoving(buttons);
  setRoving(buttons);
  stepEl.appendChild(group);
  return stepEl;
}

// Build the JOG page — the "a bit more specific" list, shown as its own page
// (issue 8) rather than an inline reveal. A jog option commits + advances; the
// manual "type it myself" reveals an input that commits + advances on Enter.
function buildJogBody(cfg, prompt, unsure, index, answers, commit, nav) {
  const stepEl = el('div', 'checklist__step builder__step builder__jog-step is-active');
  stepEl.dataset.prompt = prompt.id;

  stepEl.appendChild(
    el('p', 'builder__step-counter', 'Prompt ' + (index + 1) + ' — more options')
  );

  const titleId = 'builder-jog-title-' + cfg.key + '-' + prompt.id;
  const title = el('p', 'checklist__prompt', 'A bit more specific — which is closest?');
  title.id = titleId;
  stepEl.appendChild(title);

  const hintId = titleId + '-hint';
  const hint = el('p', 'checklist__hint', 'Tap the closest fit, or type your own.');
  hint.id = hintId;
  stepEl.appendChild(hint);

  const jog = Array.isArray(unsure.jog) ? unsure.jog : [];
  const stored = answers[prompt.id];
  const storedStr = stored == null ? null : String(stored);
  const jogFragments = jog.filter((j) => j.fragment != null).map((j) => j.fragment);
  const mainFragments = (prompt.options || [])
    .filter((o) => o.fragment != null)
    .map((o) => o.fragment);
  // Manual entry is only "active" if the stored value is genuinely typed text —
  // not a jog fragment and not a leftover MAIN-option fragment. Without the
  // main-fragment check, re-opening the jog after a main pick would wrongly
  // pre-fill the manual box with the app's composed clause.
  const manualActiveInit =
    storedStr != null &&
    storedStr !== '' &&
    jogFragments.indexOf(storedStr) === -1 &&
    mainFragments.indexOf(storedStr) === -1;

  const list = el('div', 'checklist__options builder__jog-list');
  list.setAttribute('role', 'radiogroup');
  list.setAttribute('aria-labelledby', titleId);
  list.setAttribute('aria-describedby', hintId);

  const buttons = [];
  let manualInput = null;

  jog.forEach((j) => {
    const btn = el('button', 'checklist__radio builder__jog-option', j.label);
    btn.type = 'button';
    btn.setAttribute('role', 'radio');

    const selected = j.manual
      ? manualActiveInit
      : storedStr != null && j.fragment === storedStr;
    btn.classList.toggle('checklist__radio--selected', selected);
    btn.setAttribute('aria-checked', selected ? 'true' : 'false');

    btn.addEventListener('click', () => {
      if (j.manual) {
        if (manualInput) {
          manualInput.hidden = false;
          manualInput.focus();
        }
      } else {
        commit(prompt.id, j.fragment);
        nav.forward(index);
      }
    });

    buttons.push(btn);
    list.appendChild(btn);
  });

  wireRoving(buttons);
  setRoving(buttons);
  stepEl.appendChild(list);

  // Manual "type it myself" input — commits on Enter and advances; a plain blur
  // persists the text without navigating (so tabbing away is not a surprise).
  const manualEntry = jog.find((j) => j.manual);
  if (manualEntry) {
    manualInput = el('input', 'checklist__text builder__manual-input');
    manualInput.type = 'text';
    manualInput.setAttribute('aria-label', 'Type your own answer for: ' + (prompt.prompt || ''));
    manualInput.placeholder = 'Type it in your own words, then press Enter…';
    if (manualActiveInit && storedStr) manualInput.value = storedStr;
    manualInput.hidden = !manualActiveInit;

    manualInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Normalized (TRD-5.5): trimmed, trailing .!? stripped, first letter
        // lowercased UNLESS it starts with the pronoun "I".
        const text = normalizeFragment(manualInput.value);
        if (text !== '') {
          commit(prompt.id, text);
          nav.forward(index);
        }
      }
    });
    manualInput.addEventListener('blur', () => {
      const text = normalizeFragment(manualInput.value);
      commit(prompt.id, text === '' ? null : text);
    });

    stepEl.appendChild(manualInput);
  }

  return stepEl;
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

  // stepperApi is assigned once createStepper() below returns; the "Edit"
  // links built here only run later, on click, by which time it is assigned.
  let stepperApi = null;

  function renderSummaries(activeIndex) {
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
      edit.addEventListener('click', () => {
        if (stepperApi) stepperApi.goTo(i);
      });
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
    updatePreview();
  };

  // painted flips true after the very first paint, so only THAT paint skips
  // moving focus (mirrors the old paintActive(focusIt) contract).
  let painted = false;

  // Paint the JOG page for one prompt (issue 8). Swaps the step body imperatively
  // (NOT via the stepper, so its default control bar is not re-applied) and takes
  // over the persistent bar: Back returns to this prompt's main options; Next
  // skips the prompt entirely. Selecting a jog option / typing a manual answer
  // commits and advances via nav.forward.
  function paintJog(index, ctx, nav, prompt, unsure) {
    stepHost.textContent = '';
    const jogBody = buildJogBody(cfg, prompt, unsure, index, answers, commit, nav);
    stepHost.appendChild(jogBody);
    announce('More options for: ' + (prompt.prompt || ''));
    const first = jogBody.querySelector('.checklist__radio');
    if (first) first.focus();
    setControls({
      back: { label: '← Back', disabled: false },
      onBack: function () {
        ctx.goTo(index); // repaint the main options + restore the default bar
      },
      next: { label: 'Skip →', disabled: false },
      onNext: function () {
        commit(prompt.id, null);
        nav.forward(index);
      },
    });
  }

  function renderStep(index, ctx) {
    const focusIt = painted;
    painted = true;

    stepHost.textContent = '';
    if (!total) return;
    const prompt = prompts[index];

    // The one navigator the option handlers use. forward advances to the next
    // prompt, or hands off to the next screen when this is the last prompt.
    const nav = {
      forward: function (i) {
        if (i < total - 1) ctx.advance();
        else showScreen(NEXT_SCREEN[key] || 'assembly');
      },
      openJog: function (i, pr, unsure) {
        paintJog(i, ctx, nav, pr, unsure);
      },
    };

    const body = buildPromptBody(cfg, prompt, index, ctx.total, answers, commit, nav);
    stepHost.appendChild(body);

    announce('Prompt ' + (index + 1) + ' of ' + ctx.total + ': ' + (prompt.prompt || ''));

    if (focusIt) {
      const p = body.querySelector('.checklist__prompt');
      if (p) {
        p.tabIndex = -1;
        p.focus();
      }
    }
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

  // Part 1 / Part 2 pass no `finish` config: on the last prompt the persistent
  // Next falls through to the FLOW-derived next screen (stepper.js), while a tap
  // on the final option auto-advances there via nav.forward. Back on the last
  // prompt still steps to the previous prompt (stepper owns both ends now).
  stepperApi = createStepper({
    screenName: key === 'ft1' ? 'part1' : 'part2',
    total: total,
    firstIndex: firstUnansweredIndex(),
    renderStep: renderStep,
    onIndexChange: renderSummaries,
  });
}
