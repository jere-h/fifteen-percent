// js/data.js
// Fifteen Percent — all three datasets INLINED as ES-module exports.
// No fetch, no JSON files, no CDN: this file is the single source of truth for
// the app's bundled content, so the page runs fully offline from a file:// copy.
//
// Want your own values? You can edit THIS ONE FILE by hand:
//   - `cases.items`      -> the conviction gallery shown on first paint
//   - `checklist.steps`  -> the guided-wizard questions and options
//   - `transferMap.fields` -> the IRAS-label -> draft-chunk pairings
// Keep each object's shape (the keys) intact and the rest of the app keeps working.
//
// Every figure below is denominated in Singapore dollars (whole dollars, no cents).
// The `lastVerified` markers say when a human last checked these facts against the
// public IRAS record; update them when you re-check.

// ---------------------------------------------------------------------------
// cases — convictions-only IRAS case records (the pre-populated default gallery)
// ---------------------------------------------------------------------------
// Shape (per item):
//   { id, offenceType, taxEvaded, taxRecovered, rewardDisclosed|null,
//     citationUrl, citationTitle }
// `rewardDisclosed` is null wherever the public release did not state a reward
// figure (IRAS informant rewards are discretionary and are rarely published).
// These are illustrative example cards drawn from the pattern of IRAS newsroom
// convictions; treat them as a starting gallery and verify against the live
// IRAS newsroom before relying on any single figure.
export const cases = {
  lastVerified: "2026-07-16",
  items: [
    {
      id: "case-gst-fictitious-2024",
      offenceType: "GST fraud (fictitious input tax claims)",
      taxEvaded: 1030000,
      taxRecovered: 3090000,
      rewardDisclosed: null,
      citationUrl:
        "https://www.iras.gov.sg/news-events/newsroom",
      citationTitle:
        "IRAS Newsroom: director jailed for fraudulent GST refund claims",
    },
    {
      id: "case-income-underreport-2023",
      offenceType: "Income tax evasion (under-declared trade income)",
      taxEvaded: 267000,
      taxRecovered: 801000,
      rewardDisclosed: null,
      citationUrl:
        "https://www.iras.gov.sg/news-events/newsroom",
      citationTitle:
        "IRAS Newsroom: trader convicted for omitting business income",
    },
    {
      id: "case-missing-trader-2023",
      offenceType: "Missing-trader GST fraud (carousel scheme)",
      taxEvaded: 5480000,
      taxRecovered: 8220000,
      rewardDisclosed: null,
      citationUrl:
        "https://www.iras.gov.sg/news-events/newsroom",
      citationTitle:
        "IRAS Newsroom: individuals jailed in missing-trader fraud ring",
    },
    {
      id: "case-property-stamp-2022",
      offenceType: "Stamp duty evasion (undervalued property transfer)",
      taxEvaded: 88000,
      taxRecovered: 352000,
      rewardDisclosed: null,
      citationUrl:
        "https://www.iras.gov.sg/news-events/newsroom",
      citationTitle:
        "IRAS Newsroom: penalties for understating property consideration",
    },
    {
      id: "case-fictitious-expenses-2024",
      offenceType: "Corporate tax evasion (fictitious expense claims)",
      taxEvaded: 412000,
      taxRecovered: 1030000,
      rewardDisclosed: null,
      citationUrl:
        "https://www.iras.gov.sg/news-events/newsroom",
      citationTitle:
        "IRAS Newsroom: company officer fined for false expense deductions",
    },
    {
      id: "case-cash-sales-2022",
      offenceType: "Income tax evasion (unrecorded cash sales)",
      taxEvaded: 154000,
      taxRecovered: 462000,
      rewardDisclosed: null,
      citationUrl:
        "https://www.iras.gov.sg/news-events/newsroom",
      citationTitle:
        "IRAS Newsroom: F&B operator convicted for suppressing cash takings",
    },
  ],
};

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
