// js/reckoner.js
// Self-contained MVP first-task slice for "Fifteen Percent".
// Loaded standalone by index.html as <script type="module" src="js/reckoner.js">.
// Depends ONLY on state.js (createEmptyDraft) — never imports app.js — so a fault
// elsewhere cannot break this reckoner. Pure parse/compute fns are exported for
// unit tests; initReckoner wires the #reckoner DOM and self-runs on load.
//
// Robustness note: initReckoner CREATES any missing controls (input, compute
// button, figure, disclaimer, error) inside #reckoner rather than assuming
// index.html already supplied them. If markup is present it is reused as-is (no
// duplicates); if the section ships as only a heading, the reckoner still works.

import { createEmptyDraft } from './state.js';

// --- Pure logic (exported for unit tests) ---------------------------------

// Strip grouping separators and a leading 'S$' / '$', then validate.
// empty / non-numeric / zero / negative -> { ok:false }.
export function parseInput(raw) {
  if (raw == null) return { ok: false };
  let s = String(raw).trim();
  if (s === '') return { ok: false };

  // Drop a leading currency prefix: 'S$', 'SGD', or '$' (case-insensitive).
  s = s.replace(/^\s*(?:S\$|SGD|\$)\s*/i, '');

  // Remove grouping separators (commas, spaces, apostrophes, underscores).
  s = s.replace(/[,\s'_]/g, '');

  if (s === '') return { ok: false };

  const value = Number(s);
  if (!Number.isFinite(value) || value <= 0) return { ok: false };

  return { ok: true, value };
}

// Discretionary reward estimate: 15% of recoverable tax, capped at S$100,000.
export function computeReward(value) {
  return Math.min(0.15 * value, 100000);
}

// --- Formatting helpers (module-local) ------------------------------------

function formatSGD(amount) {
  const rounded = Math.round(amount);
  // Group in thousands with commas; monospace styling comes from CSS.
  return 'S$' + rounded.toLocaleString('en-SG', { maximumFractionDigits: 0 });
}

function emitDraftChanged() {
  // Best-effort broadcast so app.js (if present) can re-render dependent
  // sections. The standalone MVP does not depend on anyone listening.
  try {
    document.dispatchEvent(new CustomEvent('draft:changed'));
  } catch (_) {
    /* CustomEvent unavailable — non-fatal for the standalone reckoner. */
  }
}

// --- DOM construction -----------------------------------------------------
// Ensure every control the reckoner needs exists inside rootEl. Reuse anything
// index.html already rendered; create only what is missing. This keeps the MVP
// working even when the section ships as just a heading. Returns the resolved
// element handles.
function ensureControls(rootEl) {
  let input = rootEl.querySelector('.reckoner__input');
  let button = rootEl.querySelector('.reckoner__button');
  let figure = rootEl.querySelector('.reckoner__figure');
  let disclaimer = rootEl.querySelector('.reckoner__disclaimer');
  let error = rootEl.querySelector('.reckoner__error');

  // Control group: label + input + compute button.
  if (!input || !button) {
    const control = document.createElement('div');
    control.className = 'reckoner__control';

    if (!input) {
      const label = document.createElement('label');
      label.className = 'reckoner__label';
      label.setAttribute('for', 'reckoner-input');
      label.textContent = 'Estimated tax likely recoverable (S$)';

      input = document.createElement('input');
      input.id = 'reckoner-input';
      input.className = 'reckoner__input';
      input.type = 'text';
      input.setAttribute('inputmode', 'decimal');
      input.setAttribute('autocomplete', 'off');
      input.placeholder = 'e.g. 40,000';

      control.appendChild(label);
      control.appendChild(input);
    }

    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'reckoner__button';
      button.textContent = 'Compute reward estimate';
      control.appendChild(button);
    }

    rootEl.appendChild(control);
  }

  // Inline validation message (hidden at rest; revealed only on invalid input).
  if (!error) {
    error = document.createElement('p');
    error.className = 'reckoner__error';
    error.setAttribute('role', 'alert');
    error.hidden = true;
    rootEl.appendChild(error);
  }

  // Result row: the figure BESIDE its fixed discretionary disclaimer chip.
  if (!figure || !disclaimer) {
    const result = document.createElement('div');
    result.className = 'reckoner__result';

    if (!figure) {
      figure = document.createElement('output');
      figure.className = 'reckoner__figure';
      figure.setAttribute('aria-live', 'polite');
      figure.hidden = true;
      result.appendChild(figure);
    }

    if (!disclaimer) {
      disclaimer = document.createElement('span');
      disclaimer.className = 'reckoner__disclaimer';
      disclaimer.textContent = 'discretionary estimate, not a promise';
      result.appendChild(disclaimer);
    }

    rootEl.appendChild(result);
  }

  return { input, button, figure, disclaimer, error };
}

// --- DOM wiring -----------------------------------------------------------

// initReckoner(rootEl, draft): ensures the compute controls exist, wires them,
// writes results into draft.reckoner, and renders either the figure (beside its
// disclaimer) or an inline invalid message. Never throws on invalid input;
// never logs errors.
export function initReckoner(rootEl, draft) {
  if (!rootEl) return;

  const { input, button, figure, disclaimer, error } = ensureControls(rootEl);

  // The disclaimer text is fixed and co-renders with every figure. It stays
  // visible by default (never hidden at rest); we only toggle the figure/error.
  if (disclaimer && disclaimer.textContent.trim() === '') {
    disclaimer.textContent = 'discretionary estimate, not a promise';
  }

  function showFigure(text) {
    if (figure) {
      figure.textContent = text;
      figure.hidden = false;
    }
    if (disclaimer) disclaimer.hidden = false;
    if (error) {
      error.textContent = '';
      error.hidden = true;
    }
  }

  function showError() {
    if (figure) {
      figure.textContent = '';
      figure.hidden = true;
    }
    // Hide the disclaimer only when there is no figure so the invalid state
    // reads cleanly as a lone inline message.
    if (disclaimer) disclaimer.hidden = true;
    if (error) {
      error.textContent = 'Please enter a positive amount';
      error.hidden = false;
    }
  }

  function compute() {
    const raw = input ? input.value : '';
    const parsed = parseInput(raw);

    // Persist the exact raw string the user typed so a resumed draft can echo it.
    draft.reckoner.recoverableInput = raw == null ? '' : String(raw);

    if (!parsed.ok) {
      draft.reckoner.rewardEstimate = null;
      draft.updatedAt = new Date().toISOString();
      showError();
      emitDraftChanged();
      return;
    }

    const reward = computeReward(parsed.value);
    draft.reckoner.rewardEstimate = reward;
    draft.updatedAt = new Date().toISOString();
    showFigure(formatSGD(reward));
    emitDraftChanged();
  }

  if (button) {
    button.addEventListener('click', compute);
  }
  if (input) {
    // Enter-to-compute for a phone-first tap/keyboard flow.
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        compute();
      }
    });
    // Restore a previously entered value (in-memory resume) without computing.
    if (draft.reckoner.recoverableInput) {
      input.value = draft.reckoner.recoverableInput;
    }
  }

  // If a prior estimate exists in the draft, reflect it on first render so the
  // section is not an empty shell after a resume.
  if (typeof draft.reckoner.rewardEstimate === 'number') {
    showFigure(formatSGD(draft.reckoner.rewardEstimate));
  }
}

// --- Standalone self-initialization ---------------------------------------
// Runs on its own against #reckoner with a fresh in-memory draft, independent
// of app.js. If app.js is also present it owns the shared draft for the other
// sections; this MVP slice keeps its own reckoner state either way.
function boot() {
  const root = document.getElementById('reckoner');
  if (!root) return;
  const draft = createEmptyDraft();
  initReckoner(root, draft);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}
