// js/data.js
// Fifteen Percent — datasets INLINED as ES-module exports.
// No fetch, no JSON files, no CDN: this file is the single source of truth for
// the app's bundled content, so the page runs fully offline from a file:// copy.
//
// Want your own values? You can edit THIS ONE FILE by hand:
//   - `checklist.steps`  -> the guided-wizard questions and options
//   - `transferMap.fields` -> the IRAS-label -> draft-chunk pairings
// Keep each object's shape (the keys) intact and the rest of the app keeps working.
//
// Every figure below is denominated in Singapore dollars (whole dollars, no cents).
// The `lastVerified` markers say when a human last checked these facts against the
// public IRAS record; update them when you re-check.

// ---------------------------------------------------------------------------
// checklist — the tap-first guided wizard, mirroring IRAS informant fields
// ---------------------------------------------------------------------------
// Shape (per step):
//   { id, field, prompt, inputType: 'chips'|'radio'|'multiselect'|'shorttext',
//     options?: string[] }
// `field` maps 1:1 to ReportDraft.answers keys. Wording stays neutral and aims
// to substantiate the claim, not to foreground identifying the taxpayer.
export const checklist = {
  steps: [
    {
      id: "step-tax-type",
      field: "taxType",
      prompt: "Which kind of tax does this involve?",
      inputType: "chips",
      options: [
        "Income Tax",
        "Goods & Services Tax (GST)",
        "Property Tax",
        "Stamp Duty",
        "Not sure",
      ],
    },
    {
      id: "step-offence-nature",
      field: "offenceNature",
      prompt: "In plain words, what seems to be going wrong?",
      inputType: "radio",
      options: [
        "Income or sales not being declared",
        "False or inflated expense or refund claims",
        "Records or documents that look falsified",
        "Something else that seems off",
      ],
    },
    {
      id: "step-taxpayer-known",
      field: "taxpayerDetailsKnown",
      prompt:
        "How much do you know about who is involved (a name, a business, an address)?",
      inputType: "radio",
      options: [
        "I have a full name or registered business",
        "I have partial details only",
        "I only know it happened, not who",
      ],
    },
    {
      id: "step-time-period",
      field: "timePeriod",
      prompt: "Roughly when did this happen or is it happening?",
      inputType: "chips",
      options: [
        "Currently ongoing",
        "Within the last year",
        "One to three years ago",
        "More than three years ago",
        "Unsure of the dates",
      ],
    },
    {
      id: "step-evidence",
      field: "evidenceInHand",
      prompt: "What can you actually point to? Pick everything that applies.",
      inputType: "multiselect",
      options: [
        "Invoices or receipts",
        "Bank or payment records",
        "Messages or emails",
        "Photos or screenshots",
        "Contracts or agreements",
        "What I saw or overheard in person",
        "Nothing kept yet, only my account",
      ],
    },
    {
      id: "step-relationship",
      field: "relationship",
      prompt: "How did you come to know about this?",
      inputType: "radio",
      options: [
        "Through my work or former work",
        "As a customer or supplier",
        "Personal or family connection",
        "I would rather not say",
      ],
    },
    {
      id: "step-identify-reward",
      field: "identifyForReward",
      prompt:
        "IRAS can pay a discretionary reward, but only if you let them contact you. Do you want to be identifiable for a possible reward?",
      inputType: "radio",
      options: [
        "Yes, I will provide contact details",
        "No, I want to stay anonymous",
        "Undecided for now",
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// transferMap — ordered IRAS-label -> draftKey mappings for manual Transfer Mode
// ---------------------------------------------------------------------------
// Shape (per field):
//   { irasLabel, draftKey, formatter?: 'list'|'text' }
// `draftKey` is the chunk the draft builder emits (matched, in order, against the
// IRAS informant form's own field labels). `formatter` hints how a chunk should
// read when copied: 'list' for multi-value answers, 'text' (default) for prose.
// Copy is manual and one field at a time; the app never submits to IRAS for you.
// ---------------------------------------------------------------------------
// money — the SINGLE honest source of every monetary phrase (TRD-3)
// ---------------------------------------------------------------------------
// Every S$ mention across the hero, the assembled draft, Transfer Mode and the
// closing "you're ready" block reads through this object, so no surface can
// drift into a different figure or drop the discretion caveat. Money is always
// framed "up to ~S$…" and never as a guarantee.
export const money = {
  ceiling: 100000,
  rate: 0.15,
  caveat: "a discretionary reward, never a promise",
  ceilingPhrase: "up to ~S$100,000",
  // Bare "up to ~S$X" figure (whole dollars, en-SG grouping).
  format(n) {
    return "up to ~S$" + Math.round(Number(n) || 0).toLocaleString("en-SG");
  },
  // Figure + discretion caveat, e.g. "up to ~S$30,000, at IRAS's discretion,
  // never a promise".
  phrase(n) {
    return this.format(n) + ", at IRAS's discretion, never a promise";
  },
};

// ---------------------------------------------------------------------------
// rewardBands — tap-only bands for the reckoner (TRD-4). No free text.
// ---------------------------------------------------------------------------
// Each band maps to the top of its range; reward = min(ceiling, top × rate).
// `more` resolves to the capped ceiling; `unsure` (and no selection) keeps the
// generic hero figure.
export const rewardBands = [
  { id: "lt10k", label: "under S$10k", top: 10000 },
  { id: "10-50k", label: "S$10k–50k", top: 50000 },
  { id: "50-200k", label: "S$50k–200k", top: 200000 },
  { id: "more", label: "more", top: null },
  { id: "unsure", label: "not sure", top: null },
];

// Derive the honest reward estimate for a band id. Returns a whole-dollar
// number, or null for "not sure" / an unknown id (which keeps the generic
// ceiling in the hero). Never trusted from storage — recomputed on demand.
export function estimateForBand(id) {
  if (!id || id === "unsure") return null;
  const band = rewardBands.find((b) => b.id === id);
  if (!band) return null;
  const top = band.top == null ? money.ceiling / money.rate : band.top;
  return Math.min(money.ceiling, Math.round(top * money.rate));
}

// ---------------------------------------------------------------------------
// optionFragments — lowercase sentence forms for app-written prose (TRD-13)
// ---------------------------------------------------------------------------
// The checklist stores and displays the human `label`; composeParagraph looks
// up these fluent fragments so assembled sentences never splice a capitalised
// button label mid-sentence. A missing fragment degrades to a lowercased label.
const optionFragments = {
  taxType: {
    "Income Tax": "income tax",
    "Goods & Services Tax (GST)": "goods and services tax (GST)",
    "Property Tax": "property tax",
    "Stamp Duty": "stamp duty",
    "Not sure": "a tax type I am not sure of",
  },
  offenceNature: {
    "Income or sales not being declared": "income or sales not being declared",
    "False or inflated expense or refund claims":
      "false or inflated expense or refund claims",
    "Records or documents that look falsified":
      "records or documents that appear falsified",
    "Something else that seems off": "something else that seems off",
  },
  taxpayerDetailsKnown: {
    "I have a full name or registered business":
      "a full name or registered business",
    "I have partial details only": "partial details only",
    "I only know it happened, not who":
      "only knowledge that it happened, not who is responsible",
  },
  timePeriod: {
    "Currently ongoing": "appears to be ongoing",
    "Within the last year": "relates to the last year",
    "One to three years ago": "relates to one to three years ago",
    "More than three years ago":
      "relates to something more than three years ago",
    "Unsure of the dates": "relates to a period I am unsure of",
  },
  evidenceInHand: {
    "Invoices or receipts": "invoices or receipts",
    "Bank or payment records": "bank or payment records",
    "Messages or emails": "messages or emails",
    "Photos or screenshots": "photos or screenshots",
    "Contracts or agreements": "contracts or agreements",
    "What I saw or overheard in person": "what I saw or overheard in person",
    "Nothing kept yet, only my account": "only my own account of events",
  },
  relationship: {
    "Through my work or former work": "through my work or former work",
    "As a customer or supplier": "as a customer or supplier",
    "Personal or family connection": "through a personal or family connection",
    "I would rather not say": "in a way I would rather not detail",
  },
  identifyForReward: {
    "Yes, I will provide contact details":
      "I am willing to be contacted and provide details for a possible reward",
    "No, I want to stay anonymous": "I prefer to stay anonymous",
    "Undecided for now": "I am undecided about being identified for a reward",
  },
};

// Look up the fluent fragment for a field/label pair, degrading to a lowercased
// label when no fragment is defined so a sentence never breaks.
export function fragmentFor(field, label) {
  const map = optionFragments[field] || {};
  if (Object.prototype.hasOwnProperty.call(map, label)) return map[label];
  return String(label == null ? "" : label).toLowerCase();
}

// ---------------------------------------------------------------------------
// evidenceAttachments — evidence answer -> concrete "bring this file" wording
// ---------------------------------------------------------------------------
// Drives the closing "bring these files to attach" checklist (TRD-17). Items
// with attach:false are things a user cannot attach as a file (an in-person
// account) and render as a gentle note instead.
export const evidenceAttachments = {
  "Invoices or receipts": { attach: true, text: "invoices or receipts" },
  "Bank or payment records": { attach: true, text: "bank or payment records" },
  "Messages or emails": { attach: true, text: "message or email exports" },
  "Photos or screenshots": { attach: true, text: "photos or screenshots" },
  "Contracts or agreements": { attach: true, text: "contracts or agreements" },
  "What I saw or overheard in person": {
    attach: false,
    text: "what you saw or overheard in person (nothing to attach — describe it in the summary)",
  },
  "Nothing kept yet, only my account": {
    attach: false,
    text: "nothing kept yet (there is no file to attach — your account is the record)",
  },
};

export const transferMap = {
  lastVerified: "2026-07-16",
  fields: [
    {
      irasLabel: "Type of tax",
      draftKey: "taxType",
      formatter: "text",
    },
    {
      irasLabel: "Nature of the alleged offence",
      draftKey: "offenceNature",
      formatter: "text",
    },
    {
      irasLabel: "Details of the person or business",
      draftKey: "taxpayerDetailsKnown",
      formatter: "text",
    },
    {
      irasLabel: "Period the offence relates to",
      draftKey: "timePeriod",
      formatter: "text",
    },
    {
      irasLabel: "Supporting information and documents held",
      draftKey: "evidenceInHand",
      formatter: "list",
    },
    {
      irasLabel: "How you came to know of this",
      draftKey: "relationship",
      formatter: "text",
    },
    {
      irasLabel: "Your contact details (for reward eligibility)",
      draftKey: "identifyForReward",
      formatter: "text",
    },
    {
      irasLabel: "Summary of what happened",
      draftKey: "narrative",
      formatter: "text",
    },
  ],
};
