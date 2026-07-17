// cheatsheet.js — the readiness recap builder.
//
// The readiness check now confirms just three things a reporter often has not
// pinned down (who / what+when / how you know). This turns those three answers
// into a short READ-ONLY recap: a reminder of what to be ready with before
// opening the form — never text to paste, and never a re-collection of the
// form's own fields.
//
// buildCheatSheet(draft) is pure and DOM-free. It reads ONLY
// draft.readiness.answers and returns a stable array of { label, value } rows.
// A confirmed item reads "Ready"; anything not yet confirmed reads the honest
// reminder NOT_YET.

// The single honest reminder for anything the reader has not yet confirmed.
export const NOT_YET = 'Not yet — find this out before you submit';

function answers(draft) {
  return (draft && draft.readiness && draft.readiness.answers) || {};
}

// A verify item stored as 'have' | 'unsure' | 'no'. Only an affirmative 'have'
// is "Ready"; 'unsure', 'no' and unset all read as the "not yet" reminder.
function ready(v) {
  return v === 'have' ? 'Ready' : NOT_YET;
}

/**
 * Pure. Build the readiness recap from a draft.
 * @param {object} draft
 * @returns {Array<{label:string, value:string}>}
 */
export function buildCheatSheet(draft) {
  const a = answers(draft);
  return [
    { label: 'You can name who is involved', value: ready(a.whoKnown) },
    { label: 'You can describe what happened, and roughly when', value: ready(a.whatKnown) },
    { label: 'You can point to how you know', value: ready(a.howKnown) },
  ];
}
