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
import { load as loadDraft, save as saveDraft, clear as clearDraft } from './store.js';
import { renderChecklist } from './checklist.js';
import { renderDraft } from './draft.js';
import { renderTransfer } from './transfer.js';
import { renderSafety } from './safety.js';

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

// Re-render only the sections that derive from the mutable answers/overrides:
// the assembled draft and Transfer Mode. Cases are static; the checklist owns
// its own interactive state; the safety panel is not answer-dependent.
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

// Called by the checklist for each answered field. Update the in-memory draft
// and persist (store.save is a no-op while persistence is off). The checklist
// itself dispatches 'draft:changed', which drives the dependent re-render.
function handleChange(field, value) {
  if (!currentDraft.answers || typeof currentDraft.answers !== 'object') {
    currentDraft.answers = {};
  }
  currentDraft.answers[field] = value;
  touch(currentDraft);
  saveDraft(currentDraft);
}

// Called by the draft section for per-field inline edits, captured as
// overrides so Transfer Mode can emit the hand-edited text. The patch may set
// narrativeOverride and/or per-field entries under fieldOverrides (and, for
// safety, direct answers). draft.js dispatches 'draft:changed' after the edit,
// so we only apply + persist here and let the listener re-render.
function handleEdit(patch) {
  if (!patch || typeof patch !== 'object') return;

  if (Object.prototype.hasOwnProperty.call(patch, 'narrativeOverride')) {
    currentDraft.narrativeOverride = patch.narrativeOverride;
  }
  if (patch.fieldOverrides && typeof patch.fieldOverrides === 'object') {
    currentDraft.fieldOverrides = Object.assign(
      {},
      currentDraft.fieldOverrides || {},
      patch.fieldOverrides
    );
  }
  if (patch.answers && typeof patch.answers === 'object') {
    currentDraft.answers = Object.assign(
      {},
      currentDraft.answers || {},
      patch.answers
    );
  }
  touch(currentDraft);
  saveDraft(currentDraft);
}

// Wired to the Safety panel's "Clear my data" button. Remove any persisted
// copy, then re-render the whole page from a fresh empty draft.
function handleClear() {
  clearDraft();
  renderAll(createEmptyDraft());
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

  // Any section that mutates the draft (checklist, draft edits, and the
  // standalone reckoner) dispatches 'draft:changed' on document. Re-render the
  // dependent sections only, so we never clobber active tap/focus state.
  document.addEventListener('draft:changed', function () {
    renderDependent();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
