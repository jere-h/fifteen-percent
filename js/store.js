// store.js — single-key localStorage persistence for the report draft.
//
// On-device saving is ALWAYS on (autosave every step) — it is the whole point
// of the tool, so there is no opt-out. There is no second storage key and no
// toggle: saving on this device is presented to the reader as a disclaimer
// (see js/safety.js), never a choice.
//
// The module degrades to in-memory-only WITHOUT throwing when localStorage is
// unavailable or full (private-browsing mode, quota exceeded, disabled storage).
// In that case storageAvailable() reports false so the Safety panel can honestly
// tell the reader that resume will not work.

import { DRAFT_KEY, SCHEMA_VERSION, createEmptyDraft } from './state.js';

// Cached probe result. Recomputed on first use and after any failure.
let storageOk = null;

// Feature-detect a genuinely writable localStorage. We do a real write/remove
// round-trip because Safari private mode exposes the object but throws on set,
// and a full quota also throws only at write time.
function probeStorage() {
  try {
    const ls = window.localStorage;
    if (!ls) return false;
    const probeKey = 'fifteenpct.__probe__';
    ls.setItem(probeKey, '1');
    ls.removeItem(probeKey);
    return true;
  } catch (err) {
    return false;
  }
}

// Public: is localStorage actually usable right now? The Safety panel reads
// this to warn, honestly, that resume will not work when it is false.
export function storageAvailable() {
  if (storageOk === null) {
    storageOk = probeStorage();
  }
  return storageOk;
}

// Public: persist the draft. No-op only when storage is unavailable /
// write-blocked (private mode, quota). Never throws.
export function save(draft) {
  if (!storageAvailable()) return;
  try {
    const payload = JSON.stringify(draft);
    window.localStorage.setItem(DRAFT_KEY, payload);
  } catch (err) {
    // Serialization failed or storage filled up mid-write. Silently degrade to
    // in-memory-only for the rest of the session; the in-memory draft is
    // unaffected and the Safety panel can surface that resume is off.
    storageOk = false;
  }
}

// Public: read the draft back. Returns a fresh createEmptyDraft() on:
//   - storage unavailable,
//   - the key missing,
//   - corrupt / unparseable JSON,
//   - any schemaVersion we do not recognize (no migration, no stale-shape load).
export function load() {
  if (!storageAvailable()) return createEmptyDraft();

  let raw;
  try {
    raw = window.localStorage.getItem(DRAFT_KEY);
  } catch (err) {
    storageOk = false;
    return createEmptyDraft();
  }
  if (raw === null || raw === undefined) return createEmptyDraft();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    // Corrupt JSON: discard it and start clean.
    return createEmptyDraft();
  }

  if (!parsed || typeof parsed !== 'object') return createEmptyDraft();
  if (parsed.schemaVersion !== SCHEMA_VERSION) return createEmptyDraft();

  // Recognized schema: normalize onto a fresh empty draft so any field the
  // stored blob happens to be missing comes back as its canonical default,
  // and the derived rewardEstimate is never trusted from storage (recomputed
  // by the reckoner on demand).
  return normalizeDraft(parsed);
}

// Public: wipe the draft from the device. Never throws.
export function clear() {
  removeDraft();
}

// Remove the stored draft. Used by the Safety panel's "Clear my data".
function removeDraft() {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch (err) {
    storageOk = false;
  }
}

// Merge a recognized-schema blob onto a fresh empty draft so the returned
// object always has the full, current shape. rewardEstimate is deliberately
// dropped (derived, recomputed) even though recoverableInput is preserved so
// the reckoner can recompute it.
function normalizeDraft(stored) {
  const base = createEmptyDraft();
  const storedAnswers = (stored.answers && typeof stored.answers === 'object')
    ? stored.answers
    : {};
  const storedReckoner = (stored.reckoner && typeof stored.reckoner === 'object')
    ? stored.reckoner
    : {};
  const storedOverrides = (stored.fieldOverrides && typeof stored.fieldOverrides === 'object')
    ? stored.fieldOverrides
    : {};

  const answers = { ...base.answers };
  for (const key of Object.keys(base.answers)) {
    if (Object.prototype.hasOwnProperty.call(storedAnswers, key)) {
      const val = storedAnswers[key];
      // evidenceInHand is an array; keep the empty-array default if the stored
      // value is not actually an array.
      if (Array.isArray(base.answers[key])) {
        answers[key] = Array.isArray(val) ? val.slice() : base.answers[key];
      } else {
        answers[key] = val;
      }
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: typeof stored.updatedAt === 'string' ? stored.updatedAt : base.updatedAt,
    answers,
    reckoner: {
      recoverableInput: typeof storedReckoner.recoverableInput === 'string'
        ? storedReckoner.recoverableInput
        : base.reckoner.recoverableInput,
      // Never trusted from storage — recomputed by the reckoner.
      rewardEstimate: null,
    },
    readiness: mergeReadiness(base.readiness, stored.readiness),
    freeText: mergeFreeText(base.freeText, stored.freeText),
    narrativeOverride: typeof stored.narrativeOverride === 'string'
      ? stored.narrativeOverride
      : base.narrativeOverride,
    fieldOverrides: { ...storedOverrides },
  };
}

// Merge a stored readiness blob onto the fresh base. Additive & defensive: a
// pre-readiness (older v1) draft simply keeps the empty base. Answers and gate
// are shallow-copied so no stored reference leaks into the live draft.
function mergeReadiness(base, stored) {
  if (!stored || typeof stored !== 'object') return base;
  const storedAnswers =
    stored.answers && typeof stored.answers === 'object' ? stored.answers : {};
  const storedGate =
    stored.gate && typeof stored.gate === 'object' ? stored.gate : {};
  return {
    answers: { ...storedAnswers },
    gate: {
      evaluated: !!storedGate.evaluated,
      passed:
        typeof storedGate.passed === 'boolean' ? storedGate.passed : base.gate.passed,
      acknowledgedRedirect: !!storedGate.acknowledgedRedirect,
    },
  };
}

// Merge the two free-text sides onto the fresh base, each with its own answers
// map and optional whole-block override string.
function mergeFreeText(base, stored) {
  if (!stored || typeof stored !== 'object') return base;
  const side = (key) => {
    const s = stored[key] && typeof stored[key] === 'object' ? stored[key] : {};
    const answers = s.answers && typeof s.answers === 'object' ? s.answers : {};
    return {
      answers: { ...answers },
      override: typeof s.override === 'string' ? s.override : base[key].override,
    };
  };
  return { ft1: side('ft1'), ft2: side('ft2') };
}
