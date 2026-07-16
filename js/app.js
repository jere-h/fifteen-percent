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

import { createEmptyDraft, answeredCount, ANSWER_FIELDS } from './state.js';
import {
  load as loadDraft,
  save as saveDraft,
  clear as clearDraft,
  isPersistenceEnabled,
  storageAvailable,
} from './store.js';
import { money, estimateForBand } from './data.js';
import { renderChecklist } from './checklist.js';
import { renderDraft } from './draft.js';
import { renderTransfer } from './transfer.js';
import { renderSafety, renderSaveControl } from './safety.js';
import { renderReckoner } from './reckoner.js';

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

// Overwrite the hero's injected figure with the personalised "up to ~S$X" when
// a numeric estimate exists, else the generic ceiling phrase (TRD-4).
function updateHeroFigure(draft) {
  const figure = el('hero-figure');
  if (!figure) return;
  const est = draft && draft.reckoner ? draft.reckoner.rewardEstimate : null;
  figure.textContent =
    typeof est === 'number' && isFinite(est) && est > 0
      ? money.format(est)
      : money.ceilingPhrase;
}

// Reflect answered-count progress in the Checklist stepnav tab, e.g. "4/7"
// after the index badge (TRD-11).
function updateChecklistTab(draft) {
  const tab = el('tab-checklist');
  if (!tab) return;
  const index = tab.querySelector('.stepnav__index');
  const n = answeredCount(draft);
  const total = ANSWER_FIELDS.length;
  tab.textContent = '';
  if (index) tab.appendChild(index);
  else {
    const span = document.createElement('span');
    span.className = 'stepnav__index';
    span.textContent = '1';
    tab.appendChild(span);
  }
  tab.appendChild(document.createTextNode(' Checklist ' + n + '/' + total));
}

// Persist + recompute on band choice, then refresh the hero and dependent
// sections. recoverableInput holds the raw band id; rewardEstimate is DERIVED
// and never trusted from storage.
function handleBand(bandId) {
  if (!currentDraft.reckoner || typeof currentDraft.reckoner !== 'object') {
    currentDraft.reckoner = { recoverableInput: '', rewardEstimate: null };
  }
  currentDraft.reckoner.recoverableInput = bandId || '';
  currentDraft.reckoner.rewardEstimate = estimateForBand(bandId);
  touch(currentDraft);
  saveDraft(currentDraft);

  const reckonerEl = el('reckoner');
  if (reckonerEl) {
    safeRender('reckoner', function () {
      renderReckoner(reckonerEl, currentDraft, handleBand);
    });
  }
  updateHeroFigure(currentDraft);
  document.dispatchEvent(new CustomEvent('draft:changed'));
}

// Show a dismissible "welcome back" greeting when saving is on and prior
// answers exist (TRD-11). Local-only; never appears when persistence is off.
function maybeGreetReturn(draft) {
  const host = el('welcome-back');
  if (!host) return;
  host.textContent = '';
  const n = answeredCount(draft);
  if (!(isPersistenceEnabled() && storageAvailable() && n > 0)) return;

  const total = ANSWER_FIELDS.length;
  const box = document.createElement('div');
  box.className = 'welcome-back';
  const msg = document.createElement('p');
  msg.className = 'welcome-back__text';
  msg.textContent =
    "Welcome back — you've answered " + n + ' of ' + total + '. Picking up where you left off.';
  box.appendChild(msg);

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'welcome-back__dismiss';
  dismiss.setAttribute('aria-label', 'Dismiss welcome-back message');
  dismiss.textContent = 'Dismiss';
  dismiss.addEventListener('click', () => {
    host.textContent = '';
  });
  box.appendChild(dismiss);

  host.appendChild(box);
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

  const reckonerEl = el('reckoner');
  if (reckonerEl) {
    safeRender('reckoner', function () {
      renderReckoner(reckonerEl, currentDraft, handleBand);
    });
  }
  updateHeroFigure(currentDraft);

  const checklistEl = el('checklist');
  if (checklistEl) {
    safeRender('checklist', function () {
      renderChecklist(checklistEl, currentDraft, handleChange);
    });
  }
  updateChecklistTab(currentDraft);

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

  // rewardEstimate is derived and deliberately nulled by normalizeDraft; recompute
  // it from the persisted band id before first paint so the hero personalises.
  if (currentDraft.reckoner) {
    currentDraft.reckoner.rewardEstimate = estimateForBand(
      currentDraft.reckoner.recoverableInput
    );
  }

  renderAll(currentDraft);
  maybeGreetReturn(currentDraft);

  // Any section that mutates the draft (checklist, draft edits, and the
  // standalone reckoner) dispatches 'draft:changed' on document. Re-render the
  // dependent sections only, so we never clobber active tap/focus state, and
  // keep the checklist tab progress badge in sync.
  document.addEventListener('draft:changed', function () {
    renderDependent();
    updateChecklistTab(currentDraft);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
