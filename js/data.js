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
// The IRAS form already collects every simple choice itself, so the readiness
// check does NOT re-ask them. It confirms only the three things a person often
// has NOT pinned down and genuinely needs before a report is worth filing —
// each a single tap of "I have this / Not sure / No". The resolution screen
// (js/gate.js) then tells them plainly whether they are ready, and names what
// to find out if not.
export const readiness = {
  part: { name: "Readiness check", estimate: "~1 min" },
  items: [
    {
      id: "whoKnown",
      kind: "verify",
      crucial: "who",
      prompt: "Do you have a name for the person or business you want to report?",
      hint: "An address, NRIC/FIN or UEN helps too. Without at least a name, IRAS has little to act on.",
      // Short label + a plain recommendation, surfaced on the resolution screen
      // when this is thin. `gap` is the heading; `recommend` is what would help.
      gap: "Who is involved",
      recommend: "Try to pin down a name for the person or business, plus an address, NRIC/FIN or UEN if you can. Without at least a name, IRAS has little to act on.",
    },
    {
      id: "whatKnown",
      kind: "verify",
      crucial: "what",
      prompt: "Can you describe what they did, and roughly when?",
      hint: "Rough is fine. You'll get help wording it in the next step.",
      gap: "What happened, and roughly when",
      recommend: "Note down what they did and a rough time period. It doesn't need to be precise; the wording comes later.",
    },
    {
      id: "howKnown",
      kind: "verify",
      crucial: "how",
      prompt: "Do you have something to point to, or a first-hand account of how you know?",
      hint: "Documents you kept, like invoices, messages or records, or just what you saw or handled yourself.",
      gap: "How you know",
      recommend: "Think about what you can point to: invoices, messages or records you kept, or what you saw or handled yourself.",
    },
  ],
};

// ---------------------------------------------------------------------------
// parts — Part names + honest time estimates (timeboxes). Part 0 lives on
// `readiness.part`; Parts 1 and 2 are the two free-text drafting screens.
// The three estimates (~3 + ~5 + ~4) reconcile with the intro modal's ~12 mins.
// ---------------------------------------------------------------------------
export const parts = {
  part1: { name: "What happened", estimate: "~5 mins" },
  part2: { name: "How you know", estimate: "~4 mins" },
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
  // The live FormSG form itself (reached from IRAS's "report tax evasion"
  // page). Opening it is plain user navigation in a new tab — no user data is
  // ever placed in the URL, and the app never submits or uploads anything.
  reportUrl: "https://form.gov.sg/682fea70b14df1e60402f3a4",
  lastVerified: "2026-07-17",
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
  caveat: "a discretionary reward, not guaranteed",
  ceilingPhrase: "up to ~S$100,000",
  // Bare "up to ~S$X" figure (whole dollars, en-SG grouping).
  format(n) {
    return "up to ~S$" + Math.round(Number(n) || 0).toLocaleString("en-SG");
  },
  // Figure + discretion caveat, e.g. "up to ~S$30,000, at IRAS's discretion,
  // never a promise".
  phrase(n) {
    return this.format(n) + ", at IRAS's discretion (not guaranteed)";
  },
};

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
        hint: "Pick whichever is closest.",
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
              { label: "Other (type it myself)", manual: true },
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
              { label: "Other (type it myself)", manual: true },
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
              { label: "Other (type it myself)", manual: true },
            ],
          },
        ],
      },
      {
        // One clean, non-overlapping set of amount bands (issue 7). The old
        // "I can give a rough figure" reveal duplicated these same bands, so it
        // is gone; a rough band IS the answer here.
        id: "amounts",
        prompt: "Roughly how much was involved, if you know?",
        hint: "A rough range is fine. Pick “I don't know” to skip.",
        sentence: (f) => "On scale, " + f + ".",
        options: [
          {
            label: "A few thousand dollars",
            fragment: "the amount involved appears to be a few thousand dollars",
          },
          {
            label: "Tens of thousands",
            fragment: "the amount involved appears to run into the tens of thousands",
          },
          {
            label: "Around a hundred thousand",
            fragment:
              "the amount involved appears to be around a hundred thousand dollars",
          },
          {
            label: "Several hundred thousand or more",
            fragment:
              "the amount involved appears to be several hundred thousand dollars or more",
          },
          {
            label: "It happened repeatedly",
            fragment: "it appears to have happened repeatedly rather than only once",
          },
          { label: "I don't know the amount", omitIfUnrefined: true },
        ],
      },
      {
        id: "timing",
        prompt: "When did this happen?",
        hint: "Roughly is fine.",
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
              { label: "Other (type it myself)", manual: true },
            ],
          },
        ],
      },
      {
        id: "whoElse",
        prompt: "Was anyone else involved?",
        hint: "Optional. Pick “I don't know” to skip.",
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
              { label: "Other (type it myself)", manual: true },
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
              { label: "Other (type it myself)", manual: true },
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
              { label: "Other (type it myself)", manual: true },
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
              { label: "Other (type it myself)", manual: true },
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

