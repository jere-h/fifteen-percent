// app.js — Entry orchestrator for "Fifteen Percent".
//
// Responsibilities (see the shared contract):
//   - Load the single in-memory reportDraft via store.load() (which itself
//     respects the persistence toggle, default on).
//   - Render the checklist, draft, transfer and safety sections.
//   - Own the single in-memory source of truth and persist mutations through
//     store.save (a no-op only while the reader has explicitly turned
//     persistence off).
//   - Listen for the 'draft:changed' CustomEvent and re-render only the
//     dependent sections (#draft and #transfer) so tap/focus state elsewhere is
//     preserved.
//   - Expose renderAll(draft), used by the Safety panel's Clear to return the
//     whole page to its empty state.

import { createEmptyDraft } from './state.js';
import {
  load as loadDraft,
  save as saveDraft,
  clear as clearDraft,
} from './store.js';
import { renderChecklist } from './checklist.js';
import { renderRedirect } from './gate.js';
import { renderPartHeaders, renderBuilder } from './builders.js';
import { renderDraft } from './draft.js';
import { renderTransfer } from './transfer.js';
import { renderSafety, renderSaveControl } from './safety.js';
import { showScreen, setControls } from './router.js';
import { openModal, closeModal } from './modal.js';

// The one in-memory reportDraft this page treats as source of truth.
let currentDraft = createEmptyDraft();

function el(id) {
  return document.getElementById(id);
}

// Run one section's render in isolation. A thrown error in a single section
// must not stop the others from painting, and must never bubble out of the
// module (reckoner.js is separate, but we still keep this page resilient).
function safeRender(label, fn) {
  try {
    fn();
  } catch (err) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[app] failed to render ' + label, err);
    }
  }
}

function touch(draft) {
  draft.updatedAt = new Date().toISOString();
}

// Re-render only the sections that DERIVE from the mutable answers/overrides:
// the assembled two-block Review and Transfer Mode. The checklist AND the two
// free-text builders own their own interactive step state (rendered once in
// renderAll), so they are deliberately NOT repainted here — that preserves
// tap/focus place while their live previews and the Review update. The safety
// panel is not answer-dependent. Hidden screens repaint offscreen so navigation
// is instant.
function renderDependent() {
  const draftEl = el('draft');
  if (draftEl) {
    safeRender('draft', function () {
      renderDraft(draftEl, currentDraft, handleEdit);
    });
  }
  const transferEl = el('transfer');
  if (transferEl) {
    safeRender('transfer', function () {
      renderTransfer(transferEl, currentDraft);
    });
  }
}

// Called by the readiness check for each answered item. Fields prefixed
// 'readiness.' route into draft.readiness.answers; any other field falls back to
// the legacy draft.answers map (kept for back-compat). The checklist itself
// dispatches 'draft:changed', which drives the dependent re-render.
function handleChange(field, value) {
  // The free-text builders mutate draft.freeText[key].answers themselves (and
  // persist), so here we only re-touch + persist as the orchestrator's belt-and-
  // braces. The builder already dispatched 'draft:changed'.
  if (typeof field === 'string' && field.indexOf('freeText.') === 0) {
    touch(currentDraft);
    saveDraft(currentDraft);
    return;
  }
  if (typeof field === 'string' && field.indexOf('readiness.') === 0) {
    if (!currentDraft.readiness || typeof currentDraft.readiness !== 'object') {
      currentDraft.readiness = {
        answers: {},
        gate: { evaluated: false, passed: null, acknowledgedRedirect: false },
      };
    }
    if (!currentDraft.readiness.answers || typeof currentDraft.readiness.answers !== 'object') {
      currentDraft.readiness.answers = {};
    }
    currentDraft.readiness.answers[field.slice('readiness.'.length)] = value;
  } else {
    if (!currentDraft.answers || typeof currentDraft.answers !== 'object') {
      currentDraft.answers = {};
    }
    currentDraft.answers[field] = value;
  }
  touch(currentDraft);
  saveDraft(currentDraft);
}

// Record that the reader chose to continue past the "gather this first" redirect
// (or used the persistent Next on that screen). Sets the acknowledgement so the
// Home menu unlocks the drafting Parts, then proceeds to Part 1.
function acknowledgeRedirect() {
  if (!currentDraft.readiness || typeof currentDraft.readiness !== 'object') {
    currentDraft.readiness = { answers: {}, gate: {} };
  }
  if (!currentDraft.readiness.gate || typeof currentDraft.readiness.gate !== 'object') {
    currentDraft.readiness.gate = {};
  }
  currentDraft.readiness.gate.evaluated = true;
  currentDraft.readiness.gate.acknowledgedRedirect = true;
  touch(currentDraft);
  saveDraft(currentDraft);
  showScreen('part1');
}

// Paint the dynamic "gather this first" redirect body (naming the thin crucial
// group) and mirror its "Continue anyway" onto the persistent Next control.
function renderRedirectScreen() {
  const screen = el('screen-redirect');
  if (!screen) return;
  safeRender('redirect', function () {
    renderRedirect(screen, currentDraft, {
      onContinue: acknowledgeRedirect,
      onBackToMenu: function () {
        showScreen('home');
      },
    });
  });
  setControls({
    next: { label: 'Continue anyway →' },
    onNext: acknowledgeRedirect,
  });
}

// Called by the Review section for a whole-block hand edit, captured as
// draft.freeText[key].override so the composed prose is overridden but never
// lost (TRD-3.3 / TRD-4.1). The patch is { freeText: { ft1?: { override },
// ft2?: { override } } }; each present key is merged additively, and an empty
// override string clears that key back to the composed text. draft.js dispatches
// 'draft:changed' after the edit, so we only apply + persist here.
function handleEdit(patch) {
  if (!patch || typeof patch !== 'object' || !patch.freeText || typeof patch.freeText !== 'object') {
    return;
  }

  if (!currentDraft.freeText || typeof currentDraft.freeText !== 'object') {
    currentDraft.freeText = {
      ft1: { answers: {}, override: null },
      ft2: { answers: {}, override: null },
    };
  }

  let touched = false;
  ['ft1', 'ft2'].forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(patch.freeText, key)) return;
    const sub = patch.freeText[key];
    if (!sub || typeof sub !== 'object' || !Object.prototype.hasOwnProperty.call(sub, 'override')) {
      return;
    }
    if (!currentDraft.freeText[key] || typeof currentDraft.freeText[key] !== 'object') {
      currentDraft.freeText[key] = { answers: {}, override: null };
    }
    const text = sub.override == null ? '' : String(sub.override).trim();
    currentDraft.freeText[key].override = text === '' ? null : text;
    touched = true;
  });

  if (!touched) return;
  touch(currentDraft);
  saveDraft(currentDraft);
}

// Wired to the Safety panel's "Clear my data" button. Close the safety dialog
// (which returns #safety to its off-screen host), remove any persisted copy,
// re-render the whole page from a fresh empty draft, and land back on Home.
function handleClear() {
  closeModal();
  clearDraft();
  renderAll(createEmptyDraft());
  showScreen('home');
}

// Open the full safety/privacy panel inside the accessible modal, reached from
// Home's quiet Privacy link. renderSafety paints into #safety (off-screen host)
// first, then the modal borrows that node and returns it on close.
function openSafetyModal() {
  const safetyEl = el('safety');
  if (!safetyEl) return;
  safeRender('safety', function () {
    renderSafety(safetyEl, handleClear);
  });
  openModal({
    titleId: 'safety-panel-title',
    contentNode: safetyEl,
    invoker: el('home-privacy'),
  });
}

// Public entry: render every non-reckoner section from the given draft and
// adopt it as the current source of truth. Used on boot and by the Safety
// Clear flow.
export function renderAll(draft) {
  currentDraft = draft || createEmptyDraft();

  const checklistEl = el('checklist');
  if (checklistEl) {
    safeRender('checklist', function () {
      renderChecklist(checklistEl, currentDraft, handleChange);
    });
  }

  // Timeboxed Part headers (Part 1 / Part 2) are single-sourced from data.js.
  safeRender('part-headers', function () {
    renderPartHeaders();
  });

  // The two free-text builders own their own stepper state, so they render once
  // here (not in renderDependent) and survive the draft:changed re-render just
  // like the checklist does.
  const ft1El = el('builder-ft1');
  if (ft1El) {
    safeRender('builder-ft1', function () {
      renderBuilder(ft1El, currentDraft, 'ft1', handleChange);
    });
  }
  const ft2El = el('builder-ft2');
  if (ft2El) {
    safeRender('builder-ft2', function () {
      renderBuilder(ft2El, currentDraft, 'ft2', handleChange);
    });
  }

  const saveControlEl = el('save-control');
  if (saveControlEl) {
    safeRender('save-control', function () {
      renderSaveControl(saveControlEl);
    });
  }

  const safetyEl = el('safety');
  if (safetyEl) {
    safeRender('safety', function () {
      renderSafety(safetyEl, handleClear);
    });
  }

  renderDependent();
}

function boot() {
  // store.load() returns a fresh empty draft on missing/corrupt/unrecognized
  // schema and respects the persistence gate, so this is always a valid draft.
  currentDraft = loadDraft();

  renderAll(currentDraft);

  // Home's quiet Privacy link opens the full safety panel as an accessible
  // dialog. Wired once on boot; the button lives in the persistent Home screen.
  const privacyBtn = el('home-privacy');
  if (privacyBtn) privacyBtn.addEventListener('click', openSafetyModal);

  // Any section that mutates the draft (checklist, draft edits) dispatches
  // 'draft:changed' on document. Re-render the dependent sections only, so we
  // never clobber active tap/focus state.
  document.addEventListener('draft:changed', function () {
    renderDependent();
  });

  // The redirect screen's body depends on the live gate result, so (re)paint it
  // on entry. Fired by the router after it applies the default control bar, so
  // renderRedirectScreen's setControls override wins.
  document.addEventListener('screen:changed', function (e) {
    if (e && e.detail && e.detail.name === 'redirect') {
      renderRedirectScreen();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
