// js/data.js
// Fifteen Percent — datasets INLINED as ES-module exports.
// No fetch, no JSON files, no CDN: this file is the single source of truth for
// the app's bundled content, so the page runs fully offline from a file:// copy.
//
// Want your own values? You can edit THIS ONE FILE by hand:
//   - `readiness.items` -> the tap-first readiness-check questions and options
//   - `parts`           -> the Part names + time estimates
// Keep each object's shape (the keys) intact and the rest of the app keeps working.
//
// Every figure below is denominated in Singapore dollars (whole dollars, no cents).
// The `lastVerified` markers say when a human last checked these facts against the
// public IRAS record; update them when you re-check.

// ---------------------------------------------------------------------------
// evidenceAttachments — evidence answer -> concrete "bring this file" wording
// ---------------------------------------------------------------------------
// Its keys are the canonical evidence option strings, reused verbatim by the
// readiness `evidence` item below, so the two never drift. Items with
// attach:false are things a user cannot attach as a file (an in-person account)
// and render as a gentle note instead.
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

// ---------------------------------------------------------------------------
// readiness — the tap-first readiness check (Part 0)
// ---------------------------------------------------------------------------
// This does NOT re-collect the IRAS form's simple structured fields as prose —
// the form already collects them directly. It VERIFIES the reader actually has
// each piece and becomes the advisory gate (see js/gate.js). One item per
// screen, tap-only.
//
// Shape (per item):
//   { id, kind:'select'|'verify', prompt, hint,
//     options?: string[],   // select items: the tap choices (verbatim to the form)
//     multi?: boolean,      // select items: pick-many when true
//     crucial?: 'who'|'what'|'how' }  // gate group this item feeds
//
// 'select' single -> stores the chosen string; 'select' multi -> stores string[].
// 'verify' -> renders three choices (default "I have this / Not sure / No", or a
// custom `options` triple) mapped by index to 'have' | 'unsure' | 'no'.
export const readiness = {
  part: { name: "Part 0: Readiness", estimate: "~3 mins" },
  items: [
    {
      id: "reportingOn",
      kind: "select",
      multi: false,
      crucial: "who",
      prompt: "Who are you reporting on?",
      hint: "Pick one. The form asks this first.",
      options: [
        "An individual",
        "A business",
        "Both an individual and a business",
      ],
    },
    {
      id: "identityDetails",
      kind: "verify",
      crucial: "who",
      prompt:
        "Do you have their identity details — a name, plus any address, NRIC/FIN or UEN you happen to know?",
      hint: "You will type these into the form itself, not here.",
    },
    {
      id: "taxTypes",
      kind: "select",
      multi: true,
      crucial: "what",
      prompt: "Which type(s) of tax are involved?",
      hint: "Pick any that apply.",
      options: [
        "Individual Income Tax",
        "Corporate Income Tax",
        "GST",
        "Property Tax",
        "Stamp Duties",
        "Others",
      ],
    },
    {
      id: "behaviours",
      kind: "select",
      multi: true,
      crucial: "what",
      prompt: "What best describes what happened?",
      hint: "Pick any that apply.",
      options: [
        "Did not file a tax return or notify chargeability to tax",
        "Under-declared or omitted income, sales or turnover",
        "Over-claimed or fictitious expenses, deductions or reliefs",
        "Fraudulent GST refund or input tax claims",
        "Failure to register for GST when required",
        "Charging or collecting GST without GST registration",
        "Falsifying records, invoices or documents",
        "Dealing in cash to hide income or under-report earnings",
        "Not issuing receipts or keeping proper records",
        "Others",
      ],
    },
    {
      id: "timing",
      kind: "verify",
      prompt:
        "Do you know roughly when this happened — a period, a year, or specific dates?",
      hint: "Even an approximate period helps.",
    },
    {
      id: "amount",
      kind: "verify",
      prompt: "Do you have a sense of the amount or value involved?",
      hint: "A rough figure is fine; an exact one is not required.",
    },
    {
      id: "whoElse",
      kind: "verify",
      prompt: "Do you know who else, if anyone, was involved?",
      hint: "This is optional on the form.",
    },
    {
      id: "evidence",
      kind: "select",
      multi: true,
      crucial: "how",
      prompt: "What can you point to as supporting information?",
      hint: "Pick any that apply. You can attach files on the form later.",
      options: Object.keys(evidenceAttachments),
    },
    {
      id: "relationship",
      kind: "select",
      multi: true,
      crucial: "how",
      prompt: "How did you come to know about this?",
      hint: "Pick any that apply.",
      options: [
        "I am, or was, an employee",
        "I am, or was, a business partner or associate",
        "I am, or was, a customer or client",
        "I am, or was, a supplier or contractor",
        "Through a personal or family connection",
        "A competitor in the same trade",
        "A member of the public",
        "Others",
      ],
    },
    {
      id: "priorIras",
      kind: "verify",
      prompt: "Have you already reported this to IRAS before?",
      hint: "The form asks whether this is a repeat report.",
      options: ["Yes, already reported", "Not sure", "No, not yet"],
    },
    {
      id: "reward",
      kind: "select",
      multi: false,
      prompt:
        "Do you want to be considered for the informant reward (up to ~S$100,000, at IRAS's discretion)?",
      hint: "A reward is only possible if you let IRAS contact you.",
      options: ["Yes, and I confirm the requirements", "No"],
    },
    {
      id: "contact",
      kind: "select",
      multi: false,
      prompt: "How may IRAS contact you, if at all?",
      hint: "Staying anonymous means no reward is possible.",
      options: ["Email", "Phone", "I do not wish to be contacted"],
    },
  ],
};

// ---------------------------------------------------------------------------
// parts — Part names + honest time estimates (timeboxes). Part 0 lives on
// `readiness.part`; Parts 1 and 2 are the two free-text drafting screens.
// The three estimates (~3 + ~5 + ~4) reconcile with the intro modal's ~12 mins.
// ---------------------------------------------------------------------------
export const parts = {
  part1: { name: "Part 1: What happened", estimate: "~5 mins" },
  part2: { name: "Part 2: How you know", estimate: "~4 mins" },
};

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

