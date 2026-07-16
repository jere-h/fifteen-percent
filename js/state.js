// state.js — canonical in-memory reportDraft shape + pure factory.
// Single source of truth for "Fifteen Percent". No DOM, no storage access
// here — this module is pure logic and unit-testable in isolation. store.js
// layers localStorage persistence on top; every other module reads/mutates
// the ReportDraft shape defined here.

// localStorage key for the serialized ReportDraft (see contract storage_keys).
// store.js writes this whenever the persistence toggle is on (default).
export const DRAFT_KEY = 'fifteenpct.reportDraft';

// Bump only on a breaking change to the ReportDraft shape. store.load()
// refuses to hydrate any draft whose schemaVersion does not match this, and
// returns a fresh createEmptyDraft() instead (no migration, no stale shape).
export const SCHEMA_VERSION = 1;

// ReportDraft shape (kept in one place so every module agrees):
//
// {
//   schemaVersion: number,          // === SCHEMA_VERSION
//   updatedAt: string,              // ISO 8601 timestamp of last mutation
//   answers: {                      // checklist wizard answers
//     taxType: string|null,
//     offenceNature: string|null,
//     taxpayerDetailsKnown: string|null,
//     timePeriod: string|null,
//     evidenceInHand: string[],     // multiselect; empty array when unset
//     relationship: string|null,
//     identifyForReward: string|null
//   },
//   reckoner: {
//     recoverableInput: string,     // raw text the user typed
//     rewardEstimate: number|null   // DERIVED — recomputed, never trusted from storage
//   },
//   narrativeOverride: string|null, // full-narrative hand edit (draft.js)
//   fieldOverrides: {               // per-field Transfer Mode hand edits
//     [draftKey: string]: string    // draftKey -> edited text
//   }
// }
//
// Every field starts unset so an untouched draft renders as the honest empty
// state rather than fabricated content.

// Pure factory: returns a brand-new, fully-unset ReportDraft. Called on first
// load, on any failed/missing/mismatched store.load(), and by the Safety
// panel's "Clear my data" to reset the whole page to empty state.
//
// Returns a fresh object graph on every call — no shared references — so
// callers can mutate the result freely without touching a previous draft.
// The seven checklist answer fields, in order. Kept beside createEmptyDraft so
// progress accounting (answeredCount) has one canonical field list.
export const ANSWER_FIELDS = [
  'taxType',
  'offenceNature',
  'taxpayerDetailsKnown',
  'timePeriod',
  'evidenceInHand',
  'relationship',
  'identifyForReward',
];

// Pure: how many of the seven checklist fields are answered. A string answer
// counts when non-empty; evidenceInHand (an array) counts when it has at least
// one entry. Derived on demand — never persisted.
export function answeredCount(draft) {
  const answers = (draft && draft.answers) || {};
  let n = 0;
  for (const field of ANSWER_FIELDS) {
    const val = answers[field];
    if (field === 'evidenceInHand') {
      if (Array.isArray(val) && val.length > 0) n += 1;
    } else if (val != null && String(val).trim() !== '') {
      n += 1;
    }
  }
  return n;
}

export function createEmptyDraft() {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    answers: {
      taxType: null,
      offenceNature: null,
      taxpayerDetailsKnown: null,
      timePeriod: null,
      evidenceInHand: [],
      relationship: null,
      identifyForReward: null,
    },
    reckoner: {
      recoverableInput: '',
      rewardEstimate: null,
    },
    narrativeOverride: null,
    fieldOverrides: {},
  };
}
