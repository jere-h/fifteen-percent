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
} from './store.js';
import { money, estimateForBand } from './data.js';
import { renderChecklist } from './checklist.js';
import { renderDraft } from './draft.js';
import { renderTransfer } from './transfer.js';
import { renderSafety, renderSaveControl } from './safety.js';
import { renderReckoner } from './reckoner.js';
import { showScreen } from './router.js';
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

// Placeholder for the two free-text-field builders (Part 1 / Part 2). The
// guided tap-to-draft flow that fills these lands in a later phase; for now the
// mounts are populated with a short lead so navigation shows filled content and
// the render pipeline (renderAll + renderDependent) already drives them.
function renderBuilderStub(rootEl, label) {
  if (!rootEl) return;
  rootEl.textContent = '';
  const note = document.createElement('p');
  note.className = 'builder__stub';
  note.textContent =
    'Tap-to-draft prompts for ' + label + ' are set up in the next step. ' +
    'You choose; the app writes the words to paste into the form.';
  rootEl.appendChild(note);
}

// Which Home phase-menu targets are currently reachable. A fresh draft can only
// enter the Readiness check; the drafting phases (Part 1 / Part 2 / Review) stay
// locked until the readiness check is complete, so a first-time user sees only
// Readiness enabled (TRD-1.3). The threshold will tighten to per-phase progress
// once the Part 1 / Part 2 builders carry their own completion state.
function menuReachable(draft) {
  const readinessComplete = answeredCount(draft) >= ANSWER_FIELDS.length;
  return {
    readiness: true,
    part1: readinessComplete,
    part2: readinessComplete,
    transfer: readinessComplete,
  };
}

// Reflect reachability on the Home menu: enabled targets are actionable; locked
// ones are disabled + aria-disabled, and a single hint explains why. Called from
// both renderAll and the draft:changed path so returning Home after answering
// shows freshly-unlocked phases.
function updateMenuGating(draft) {
  const reach = menuReachable(draft);
  let anyLocked = false;
  const items = document.querySelectorAll('.home__menu-item');
  for (let i = 0; i < items.length; i++) {
    const btn = items[i];
    const enabled = !!reach[btn.dataset.target];
    btn.disabled = !enabled;
    if (enabled) {
      btn.removeAttribute('aria-disabled');
    } else {
      btn.setAttribute('aria-disabled', 'true');
      anyLocked = true;
    }
  }
  const hint = el('home-menu-hint');
  if (hint) hint.hidden = !anyLocked;
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

// Re-render only the sections that derive from the mutable answers/overrides:
// the two free-text-field builders, the assembled draft and Transfer Mode. The
// checklist owns its own interactive state; the safety panel is not
// answer-dependent. Hidden screens repaint offscreen so navigation is instant.
function renderDependent() {
  const ft1El = el('builder-ft1');
  if (ft1El) {
    safeRender('builder-ft1', function () {
      renderBuilderStub(ft1El, 'Part 1 (what happened)');
    });
  }
  const ft2El = el('builder-ft2');
  if (ft2El) {
    safeRender('builder-ft2', function () {
      renderBuilderStub(ft2El, 'Part 2 (how you became aware)');
    });
  }
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
  updateMenuGating(currentDraft);
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

  // Home's quiet Privacy link opens the full safety panel as an accessible
  // dialog. Wired once on boot; the button lives in the persistent Home screen.
  const privacyBtn = el('home-privacy');
  if (privacyBtn) privacyBtn.addEventListener('click', openSafetyModal);

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
