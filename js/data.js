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
// iras — the SINGLE source of the official report URL + when it was last checked
// ---------------------------------------------------------------------------
// The "Open the IRAS form" control (Transfer/End) and the saved document both
// read this one object, so the destination never drifts and there is only one
// place to update when IRAS moves the page. Opening it is plain user navigation
// in a NEW TAB — no user data is ever placed in the URL, and the app never
// submits or uploads anything. `lastVerified` replaces the old, deleted
// transferMap.lastVerified marker.
export const iras = {
  reportUrl: "https://www.iras.gov.sg/contact-us/report-tax-evasion",
  lastVerified: "2026-07-16",
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
// freeTextBuilders — tap-first prompt trees for the two hard free-text fields
// ---------------------------------------------------------------------------
// This is the heart of the reframed product (TRD-3): the IRAS form already
// collects the simple structured choices itself, so the app FOCUSES on drafting
// the two hard free-text fields the reader has to write in prose:
//   ft1 -> "Provide as much detail as possible about the tax evasion or tax
//           fraud."
//   ft2 -> "Explain how and when you became aware of the tax evasion or tax
//           fraud."
//
// Each builder is a small tree of tap prompts. The user CHOOSES; the app WRITES.
// Every option carries a lowercase `fragment` so `sentence()` composes fluent
// prose without splicing a capitalised button label mid-sentence.
//
// Shape (per prompt):
//   { id, prompt, hint, multi?,
//     options: [
//       { label,                 // the tap button text (never composed as-is)
//         value?,                // optional stable token (defaults to label)
//         fragment?,             // lowercase clause spliced by sentence()
//         unsure?,               // true -> reveals a secondary jog-memory list
//         omitIfUnrefined?,      // true -> "I don't know" style; contributes nothing
//         jog?: [                // more-specific possibilities for an unsure pick
//           { label, fragment }, // a concrete, storable refinement
//           …,
//           { label: 'Other — type it myself', manual: true } // exactly one, last
//         ] } … ],
//     sentence(val) -> string }  // val = the stored fragment (or array, if multi)
//
// GUARANTEE (TRD-3.4): no "unsure / not sure / rather not say" placeholder ever
// reaches a composed block. Unsure options store NOTHING until refined via their
// jog list (a concrete fragment or the manual text); omitIfUnrefined options
// contribute nothing at all. draft.js keeps a defensive backstop as well.
export const freeTextBuilders = {
  ft1: {
    fieldLabel:
      "Provide as much detail as possible about the tax evasion or tax fraud.",
    part: parts.part1,
    prompts: [
      {
        id: "kind",
        prompt: "What kind of tax evasion does this involve?",
        hint: "Pick the closest fit — the app turns it into a sentence.",
        sentence: (f) => "This report concerns " + f + ".",
        options: [
          {
            label: "Income or sales were under-reported",
            fragment: "income or sales that were under-reported",
          },
          {
            label: "Expenses or reliefs were over-claimed",
            fragment: "expenses, deductions or reliefs that were over-claimed",
          },
          {
            label: "GST was mishandled",
            fragment: "GST that was charged, claimed or accounted for improperly",
          },
          {
            label: "A tax return was never filed",
            fragment: "a required tax return that was never filed",
          },
          {
            label: "Records or documents were falsified",
            fragment: "records, invoices or documents that were falsified",
          },
          {
            label: "I'm not certain which",
            unsure: true,
            jog: [
              {
                label: "It looks like money coming in was hidden",
                fragment:
                  "income that appears to have been hidden from the tax authorities",
              },
              {
                label: "It looks like claims were exaggerated",
                fragment:
                  "claims for expenses or refunds that appear to have been exaggerated",
              },
              {
                label: "It looks like paperwork was faked",
                fragment: "paperwork that appears to have been faked",
              },
              { label: "Other — type it myself", manual: true },
            ],
          },
        ],
      },
      {
        id: "did",
        prompt: "What did the person or business actually do?",
        hint: "The specific action.",
        sentence: (f) => "In particular, " + f + ".",
        options: [
          {
            label: "Left income or cash sales off the books",
            fragment: "they left income or cash sales off their declarations",
          },
          {
            label: "Inflated or invented expenses or refunds",
            fragment: "they inflated or invented expenses or refund claims",
          },
          {
            label: "Kept GST they were not entitled to",
            fragment: "they collected or kept GST they were not entitled to",
          },
          {
            label: "Altered or forged documents",
            fragment: "they altered or forged documents",
          },
          {
            label: "Ran takings through personal accounts",
            fragment: "they ran business takings through personal accounts",
          },
          {
            label: "I'd describe it differently",
            unsure: true,
            jog: [
              {
                label: "Money was taken in cash and not recorded",
                fragment: "they took payment in cash and did not record it",
              },
              {
                label: "Two different sets of figures were kept",
                fragment: "they kept two different sets of figures",
              },
              {
                label: "Sales were split to stay under a threshold",
                fragment:
                  "they split sales to stay under a registration threshold",
              },
              { label: "Other — type it myself", manual: true },
            ],
          },
        ],
      },
      {
        id: "how",
        prompt: "How was it carried out?",
        hint: "Pick “I don't know how” to skip this.",
        sentence: (f) => "It was carried out by " + f + ".",
        options: [
          {
            label: "Dealing in cash, no receipts",
            fragment: "dealing in cash and not issuing receipts",
          },
          {
            label: "Keeping it off the official books",
            fragment: "keeping the activity off the official books",
          },
          {
            label: "Using a separate account or name",
            fragment: "using a separate account or business name",
          },
          {
            label: "Changing figures before filing",
            fragment: "changing the figures before anything was filed",
          },
          { label: "I don't know how", omitIfUnrefined: true },
          {
            label: "I have a rough idea",
            unsure: true,
            jog: [
              {
                label: "A side arrangement paid off the books",
                fragment: "a side arrangement that was paid off the books",
              },
              {
                label: "Under-ringing the till",
                fragment:
                  "under-ringing the till so recorded sales looked lower",
              },
              { label: "Other — type it myself", manual: true },
            ],
          },
        ],
      },
      {
        id: "amounts",
        prompt: "Do you know the amounts or how often it happened?",
        hint: "A rough sense is fine; exact figures are not needed.",
        sentence: (f) => "On scale, " + f + ".",
        options: [
          {
            label: "Small — low thousands",
            fragment: "the sums involved appear to be in the low thousands",
          },
          {
            label: "Moderate — tens of thousands",
            fragment: "the sums involved appear to run into the tens of thousands",
          },
          {
            label: "Large — over a hundred thousand",
            fragment:
              "the sums involved appear to exceed a hundred thousand dollars",
          },
          {
            label: "It happens repeatedly",
            fragment: "it appears to happen repeatedly rather than only once",
          },
          { label: "I don't know the amounts", omitIfUnrefined: true },
          {
            label: "I can give a rough figure",
            unsure: true,
            jog: [
              {
                label: "Around a few thousand dollars",
                fragment: "the amount appears to be around a few thousand dollars",
              },
              {
                label: "Around tens of thousands",
                fragment: "the amount appears to be in the tens of thousands",
              },
              {
                label: "Six figures or more",
                fragment: "the amount appears to be six figures or more",
              },
              { label: "Other — type it myself", manual: true },
            ],
          },
        ],
      },
      {
        id: "timing",
        prompt: "When did this happen?",
        hint: "Even an approximate period helps.",
        sentence: (f) => "As for timing, " + f + ".",
        options: [
          {
            label: "Happening now",
            fragment: "it appears to be happening now",
          },
          {
            label: "Within the past year",
            fragment: "it happened within the past year",
          },
          {
            label: "One to three years ago",
            fragment: "it happened between one and three years ago",
          },
          {
            label: "More than three years ago",
            fragment: "it happened more than three years ago",
          },
          {
            label: "I'm hazy on the dates",
            unsure: true,
            jog: [
              {
                label: "Some time in the last few months",
                fragment: "it happened at some point in the last few months",
              },
              {
                label: "A year or two back, roughly",
                fragment: "it happened roughly a year or two ago",
              },
              { label: "Other — type it myself", manual: true },
            ],
          },
        ],
      },
      {
        id: "whoElse",
        prompt: "Was anyone else involved?",
        hint: "Optional — pick “I don't know” to skip.",
        sentence: (f) => "As for others involved, " + f + ".",
        options: [
          {
            label: "One person, acting alone",
            fragment: "it appears to be one person acting alone",
          },
          {
            label: "More than one person took part",
            fragment: "more than one person appears to have taken part",
          },
          {
            label: "A business helped arrange it",
            fragment: "a business appears to have helped arrange it",
          },
          { label: "I don't know", omitIfUnrefined: true },
          {
            label: "I suspect someone specific",
            unsure: true,
            jog: [
              {
                label: "Someone inside the business",
                fragment: "someone inside the business appears to be involved",
              },
              {
                label: "An outside adviser or agent",
                fragment: "an outside adviser or agent appears to be involved",
              },
              { label: "Other — type it myself", manual: true },
            ],
          },
        ],
      },
    ],
  },
  ft2: {
    fieldLabel:
      "Explain how and when you became aware of the tax evasion or tax fraud.",
    part: parts.part2,
    prompts: [
      {
        id: "vantage",
        prompt: "What was your position in relation to this?",
        hint: "How you were placed to notice it.",
        sentence: (f) => "I came to know about this " + f + ".",
        options: [
          {
            label: "Employee, current or former",
            fragment: "as a current or former employee",
          },
          {
            label: "Business partner or associate",
            fragment: "as a business partner or associate",
          },
          {
            label: "Customer or client",
            fragment: "as a customer or client",
          },
          {
            label: "Supplier or contractor",
            fragment: "as a supplier or contractor",
          },
          {
            label: "Personal or family connection",
            fragment: "through a personal or family connection",
          },
          {
            label: "Same line of work",
            fragment: "as someone working in the same trade",
          },
          {
            label: "I'd prefer not to be specific",
            unsure: true,
            jog: [
              {
                label: "Someone close to the business",
                fragment: "as someone with a close connection to the business",
              },
              {
                label: "Someone who dealt with them occasionally",
                fragment: "as someone who dealt with them from time to time",
              },
              { label: "Other — type it myself", manual: true },
            ],
          },
        ],
      },
      {
        id: "when",
        prompt: "When did you become aware of it?",
        hint: "Roughly is fine.",
        sentence: (f) => "I became aware of it " + f + ".",
        options: [
          {
            label: "In the past few weeks",
            fragment: "within the past few weeks",
          },
          {
            label: "In the past few months",
            fragment: "within the past few months",
          },
          {
            label: "Within the past year",
            fragment: "within the past year",
          },
          {
            label: "More than a year ago",
            fragment: "more than a year ago",
          },
          {
            label: "I can't pin the date",
            unsure: true,
            jog: [
              {
                label: "Around an event I remember",
                fragment: "around the time of an event I clearly remember",
              },
              {
                label: "Some time last year",
                fragment: "at some point last year",
              },
              { label: "Other — type it myself", manual: true },
            ],
          },
        ],
      },
      {
        id: "howKnown",
        prompt: "How did you come to know?",
        hint: "What you saw, handled or were told.",
        sentence: (f) => "I know about it because " + f + ".",
        options: [
          {
            label: "I saw it happen myself",
            fragment: "I saw it happen myself",
          },
          {
            label: "I handled the records or money",
            fragment: "I handled the records or money involved",
          },
          {
            label: "Someone who took part told me",
            fragment: "someone who took part told me directly",
          },
          {
            label: "I found it in documents or messages",
            fragment:
              "I came across it in documents or messages I had access to",
          },
          {
            label: "It was a mix of things",
            unsure: true,
            jog: [
              {
                label: "I noticed a pattern over time",
                fragment:
                  "I noticed a pattern in what I was seeing over time",
              },
              {
                label: "I overheard it discussed",
                fragment: "I overheard it being discussed",
              },
              { label: "Other — type it myself", manual: true },
            ],
          },
        ],
      },
      {
        id: "ongoing",
        prompt: "As far as you know, is it still going on?",
        hint: "Pick “I don't know” to skip.",
        sentence: (f) => "As far as I am aware, " + f + ".",
        options: [
          { label: "Still going on", fragment: "it is still going on" },
          { label: "Has stopped", fragment: "it has since stopped" },
          {
            label: "Was a one-off",
            fragment: "it appears to have been a one-off",
          },
          { label: "I don't know", omitIfUnrefined: true },
        ],
      },
    ],
  },
};

