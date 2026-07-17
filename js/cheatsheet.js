// cheatsheet.js — the readiness "cheat-sheet" builder (TRD-4.2).
//
// The IRAS form already collects its simple structured fields itself (radios,
// multi-selects, Yes/No). This app must NOT re-emit those as pasteable prose.
// Instead it VERIFIES the reader has each piece (the readiness check) and, here,
// turns those verified picks into a concise READ-ONLY cheat-sheet: short
// reminders of what to SELECT in the form — never text to paste.
//
// buildCheatSheet(draft) is pure and DOM-free. It reads ONLY
// draft.readiness.answers and returns an array of { label, value } rows in a
// stable order. Values are short reminders: a chosen option string, a
// comma-joined multi-select, "Yes" / "No", or — for anything not yet resolved —
// the honest reminder "Not yet — decide before you submit". No "unsure"
// placeholder ever appears; an unresolved verify item is reported as a reminder,
// never as prose.

// The single honest reminder for anything the reader has not yet pinned down.
export const NOT_YET = 'Not yet — decide before you submit';

function answers(draft) {
  return (draft && draft.readiness && draft.readiness.answers) || {};
}

// A single-select (or free string): the chosen value, else the "not yet" reminder.
function single(v) {
  return v != null && String(v).trim() !== '' ? String(v).trim() : NOT_YET;
}

// A multi-select stored as string[]: comma-joined non-empty picks, else "not yet".
function multi(v) {
  if (!Array.isArray(v)) return NOT_YET;
  const parts = v.map((x) => (x == null ? '' : String(x).trim())).filter((x) => x !== '');
  return parts.length ? parts.join(', ') : NOT_YET;
}

// A verify item stored as 'have' | 'unsure' | 'no'. 'have' -> its yes label;
// 'no' -> its no label (defaults to the "not yet" reminder for "do you know…?"
// items, where a No is still an unresolved gap); anything else -> "not yet".
function verify(v, opts) {
  const cfg = opts || {};
  const yes = cfg.have || 'Yes';
  const no = Object.prototype.hasOwnProperty.call(cfg, 'no') ? cfg.no : NOT_YET;
  if (v === 'have') return yes;
  if (v === 'no') return no;
  return NOT_YET;
}

// The reward single-select ("Yes, and I confirm the requirements" | "No").
// Condensed to a Yes/No reminder; unset -> "not yet".
function yesNo(v) {
  if (v == null || String(v).trim() === '') return NOT_YET;
  return /^no\b/i.test(String(v).trim()) ? 'No' : 'Yes';
}

/**
 * Pure. Build the readiness cheat-sheet from a draft.
 * @param {object} draft
 * @returns {Array<{label:string, value:string}>}
 */
export function buildCheatSheet(draft) {
  const a = answers(draft);
  return [
    { label: 'Who you are reporting on', value: single(a.reportingOn) },
    { label: 'Reported this to IRAS before', value: verify(a.priorIras, { have: 'Yes', no: 'No' }) },
    { label: 'Tax type(s) involved', value: multi(a.taxTypes) },
    { label: 'What appears to have happened', value: multi(a.behaviours) },
    { label: 'Timing known', value: verify(a.timing) },
    { label: 'Amount known', value: verify(a.amount) },
    { label: 'Who else was involved, known', value: verify(a.whoElse) },
    { label: 'How you came to know', value: multi(a.relationship) },
    { label: 'Considered for the reward', value: yesNo(a.reward) },
    { label: 'How IRAS may contact you', value: single(a.contact) },
  ];
}
