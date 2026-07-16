// store.js — single-key localStorage persistence for the report draft.
//
// Persistence is ON by default (autosave every step, matching the brief) with
// a "Save my progress on this device" toggle the user can switch OFF to run
// in-memory-only. Turning it off wipes anything already saved so the choice
// actually clears the trail rather than leaving stale data behind.
//
// The module degrades to in-memory-only WITHOUT throwing when localStorage is
// unavailable or full (private-browsing mode, quota exceeded, disabled storage).
// In that case storageAvailable() reports false so the Safety panel can honestly
// tell the reader that resume will not work.

import { DRAFT_KEY, SCHEMA_VERSION, createEmptyDraft } from './state.js';

// Second storage key: the '1' | '0' flag for the persistence toggle.
const PERSISTENCE_KEY = 'fifteenpct.persistenceEnabled';

// In-memory mirror of the persistence flag. Used as the source of truth when
// localStorage cannot be read or written (so the toggle still works this
// session, it just cannot survive a reload).
let inMemoryPersistence = true;

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

// Public: turn persistence on or off. Persists the flag itself when
// storage allows; always mirrors it in memory so the current session honors it
// even if storage is blocked.
export function setPersistenceEnabled(on) {
  const enabled = !!on;
  inMemoryPersistence = enabled;
  if (storageAvailable()) {
    try {
      window.localStorage.setItem(PERSISTENCE_KEY, enabled ? '1' : '0');
    } catch (err) {
      // Write failed after the probe passed (e.g. quota hit). Fall back to the
      // in-memory flag and stop trusting storage.
      storageOk = false;
    }
  }
  // When persistence is switched OFF, remove any draft already on the device so
  // the choice actually clears the trail rather than leaving stale data behind.
  if (!enabled) {
    removeDraft();
  }
}

// Public: is persistence currently enabled? Reads the stored flag when it is
// available, otherwise the in-memory mirror. Absent (never toggled) means ON
// (the default); only an explicit '0' turns it off.
export function isPersistenceEnabled() {
  if (storageAvailable()) {
    try {
      const raw = window.localStorage.getItem(PERSISTENCE_KEY);
      return raw === null ? true : raw === '1';
    } catch (err) {
      storageOk = false;
    }
  }
  return inMemoryPersistence;
}

// Public: persist the draft. No-op when persistence is opted out or when
// storage is unavailable / write-blocked. Never throws.
export function save(draft) {
  if (!isPersistenceEnabled()) return;
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
//   - persistence opted out (in-memory-only session),
//   - storage unavailable,
//   - the key missing,
//   - corrupt / unparseable JSON,
//   - any schemaVersion we do not recognize (no migration, no stale-shape load).
export function load() {
  if (!isPersistenceEnabled()) return createEmptyDraft();
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

// Remove the stored draft only. Leaves the persistence-flag choice intact
// unless the caller (setPersistenceEnabled(false)) means to clear it too.
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
    narrativeOverride: typeof stored.narrativeOverride === 'string'
      ? stored.narrativeOverride
      : base.narrativeOverride,
    fieldOverrides: { ...storedOverrides },
  };
}
