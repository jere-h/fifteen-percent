# Fifteen Percent — Technical Requirements Document (v1, build-and-prove round)

A numbered, testable spec that turns the PM-approved list into 21 buildable
requirements for the static, local-only "Fifteen Percent" app. Requirements are
ordered by pillar priority: lead-with-the-money (TRD-1..4), the Pillar-7
hard-constraint fixes with numeric proof (TRD-5..9), one-decision-per-screen
fused with durable progress (TRD-10..12), and making the app write and end well
(TRD-13..21).

## Overview

The app helps someone privately prepare a tax-evasion report to Singapore's
IRAS. IRAS pays informants 15% of tax recovered (capped at S$100,000), but the
official form is a single unsaveable 15-minute session. This build leads with
the money, removes preparation friction via a guided tap-first checklist where
the user chooses and the app writes the report, and ends with "copy this, paste
there, attach these files" — while the site never sees a byte of user data.

## Constraints preserved

- **100% static, local-only, offline-capable.** No fetch/XHR/WebSocket/CDN/
  analytics. Every dataset is an inlined ES-module export in `js/data.js`. Runs
  from a `file://` copy.
- **ES modules only.** New code (`js/reckoner.js`) ships as an ES module through
  the existing `js/app.js` / `js/nav.js` entry points. No bundler, no globals.
- **Existing render contracts preserved.** `renderChecklist(rootEl,draft,onChange)`,
  `renderDraft(rootEl,draft,onEdit)` + pure `buildNarrative(draft)`,
  `renderTransfer(rootEl,draft)`, `renderSafety(rootEl,onClear)`, `renderAll(draft)`,
  the `draft:changed` CustomEvent, and `nav.js` view switching. `createEmptyDraft()`
  grows only additively; `SCHEMA_VERSION` stays 1.
- **Persistence stays gated** through `store.save()`/`setPersistenceEnabled()`,
  no-op when persistence is off or storage is unavailable. Derived values
  (`rewardEstimate`) are recomputed, never trusted from storage.
- **Accessibility floor is non-negotiable:** ≥18px reading/interaction text,
  ≥44px tap targets, WCAG AA contrast (verified numerically, both themes),
  visible `:focus-visible`, full keyboard operability, correct ARIA.
- **Tap-first:** ≥70% of inputs are taps; no free text ever required to advance.
- **Money is always honest:** every amount reads "up to ~S$…" with a discretion
  caveat, from one source in `data.js`.
- **Independence and non-mimicry:** the "not affiliated / nothing submitted"
  statement stays legible without interaction; no official IRAS mimicry.
- **`prefers-reduced-motion` honoured page-wide.**

## Requirements

### TRD-1 — Promote the money to a single semantic h1 hero
The hero is the first meaningful content (after the demoted independence strip),
with exactly one `<h1>` leading with the incentive, the S$ ceiling as the largest
figure and 15% as supporting context.
- `document.querySelectorAll('h1').length === 1`, inside `.hero`.
- The S$ ceiling figure is the largest text on first paint.
- Outline is h1 then section h2s; no h2 precedes the h1 (banner has no heading).
- `.hero__figure` ≥3:1 (large), subhead/rate ≥4.5:1, both themes.
- No `.reward-line` element remains.

### TRD-2 — Demote the disclaimer banner to a slim independence strip
The independence statement and verified date stay always-visible but quiet, no
longer competing with the hero; never hidden behind a disclosure.
- The "not affiliated / nothing submitted" text is readable on load at 390px and desktop.
- The banner's visual weight is visibly less than the hero figure.
- The banner appears before `.hero` in DOM and visual order.
- No `<details>`/`<summary>` wraps the statement.

### TRD-3 — Centralize money phrasing as one honest source
A single exported `money` object in `data.js` drives every monetary phrase, so
every mention reads "up to ~S$…" with the discretion caveat.
- Every S$ amount is prefixed "up to ~S$" with a discretion caveat.
- Draft reward row and transfer reward both read "up to ~S$…".
- Changing `money.ceiling`/`money.format` changes hero, draft, and transfer together.
- No bare "S$100,000" or "you will get" / guaranteed phrasing.

### TRD-4 — Wire a tap-first band reckoner that surfaces a personalised "up to ~S$X"
Tap bands (`under S$10k` / `S$10k–50k` / `S$50k–200k` / `more` / `not sure`) map
to top-of-band × 15% capped at S$100,000, surfaced in hero, draft and transfer.
- `S$50k–200k` → "up to ~S$30,000, at IRAS's discretion, never a promise" in hero, draft, transfer.
- `more` → capped "up to ~S$100,000"; `not sure` → generic ceiling.
- The report completes end-to-end without touching the reckoner.
- No text input; every band is a button tap.
- With saving on, reload restores the band and its recomputed figure.

### TRD-5 — Raise body text to an 18px floor
`html { font-size: 112.5% }` (1rem = 18px); `body` uses `1rem`; every sub-1rem
reading/interaction size re-derived to ≥18px.
- Computed font-size on body, chips, radios, prompts, transfer values, draft
  paragraph/table, safety text, and stepnav tabs all ≥18px.
- No horizontal overflow at 390px and desktop.
- 2-col checklist ≥720px and draft table render without clipping.

### TRD-6 — Introduce a darker text-bearing accent token for AA contrast
`--color-accent-strong: #b8446a` for white-on-accent fills; `--color-link` for
accent-as-text (light `#b8446a`, dark `#e8557f`). Light `--color-accent` kept
only for large/decorative use.
- White-on-fill pairs measure ≥4.5:1 both themes (measured 5.16:1).
- Accent-as-text pairs ≥4.5:1 both themes (4.86–5.83:1).
- Hero figure ≥3:1 as large text (4.86:1).

### TRD-7 — Make the stepnav fit a 390px viewport without clipping
`.stepnav` is a `repeat(3, minmax(0,1fr))` grid; tabs use `min-width:0`,
wrapping labels, ≥44px height.
- All three tabs fully within the viewport at 390px; no horizontal scroll.
- Each tab bounding box height ≥44px.
- The TRD-11 progress suffix still fits at 390px.

### TRD-8 — Make the stepnav a real tablist
`role="tablist"`, roving tabindex, Left/Right/Up/Down + Home/End; manual
activation moves focus into the shown panel's heading and announces via a polite
live region; scroll reset honours reduced-motion.
- Tab lands on the tablist once; arrows move focus (roving), Home/End jump to ends.
- Activating a tab moves focus into the shown panel heading and announces the view.
- Reduced-motion: no smooth/animated scroll on switch.

### TRD-9 — Correct single-select vs multi-select affordance + keyboard radio pattern
Single-select steps implement the WAI-ARIA radio pattern (one tab stop, arrows
move-and-select, roving tabindex). Multi-select shows distinct checkbox ticks.
Each prompt carries a "Pick one" / "Pick any that apply" hint.
- Single-select: Tab enters once; arrows move and change selection; radiogroup announced.
- Multi-selected options show a distinct tick, visibly different from the single-select fill.
- Each prompt shows its Pick-one/Pick-any hint.
- All option controls ≥44px with visible focus.

### TRD-10 — Rework the checklist into one decision per screen
One question shows per screen with Back/Next; answered steps collapse to compact
editable summaries; the advance CTA is a per-step Next labelled with progress.
- Exactly one question presented at a time; no ~3000px mobile scroll.
- A per-step Next is reachable without scrolling past remaining questions.
- Completable keyboard-only; the live region announces step and progress.
- Reduced-motion: no step-transition animation; focus never yanked.

### TRD-11 — Durable, return-recognised progress
An "N of 7 answered" counter and per-question checks are always visible; the
Checklist tab shows completion ("Checklist 4/7"); a welcome-back cue restores
position when saving is on.
- The counter is always visible and increments on commit.
- Each answered step shows a check; the tab shows the count.
- With saving on, answering 4 and reloading restores position and shows "Welcome back — 4 of 7".
- With saving off, no greeting and no persistence; no network request.

### TRD-12 — Re-render checklist eyebrow/heading/intro from JS; single-source headings
`renderChecklist` emits its own eyebrow + heading + intro; the checklist view
always shows a title. All three section headings come from JS only.
- The checklist view always shows an eyebrow, heading, and intro; no heading flash.
- No section heading string is defined in both index.html and a JS module.
- Each section's `aria-labelledby` resolves to the JS-rendered heading id.

### TRD-13 — Fix app-written prose with per-option narrative fragments
`data.js` stores lowercase sentence fragments; `composeParagraph` builds fluent
sentences (no verbatim button labels mid-sentence). Fragments degrade to a
lowercased label.
- "Currently ongoing" → "The conduct appears to be ongoing." (no capitalised fragment).
- No assembled sentence contains a verbatim label mid-sentence.
- `buildNarrative` still returns `{paragraph, detailsRows}` with human labels in rows.

### TRD-14 — Keep the Transfer section header full-width above the field grid
The eyebrow/h2/intro sit in a `.transfer__header` spanning full width; only
`.transfer__fields` is the 2-column grid at ≥720px.
- At ≥720px the header renders full-width above the two-column field list.
- The eyebrow and h2 are never in different grid columns.
- Mobile layout unchanged (single column).

### TRD-15 — Replace the Transfer "Not provided yet" wall with recognition
Answered fields show prominently; unfilled fields collapse into a "Not yet
filled (N)" disclosure; an "X of 8 ready" line links back to the checklist. The
draft mirrors a framed partial state.
- With 2 of 8 answered, those 2 show prominently plus "X of 8 ready" and a working link back.
- Unfilled fields are de-emphasised/collapsed, not an equal wall.
- The count updates as fields are answered.

### TRD-16 — Stop empty per-field Copy buttons from falsely toasting "Copied"
Empty fields render no Copy button; `doCopy` short-circuits empty payloads with a
neutral "Nothing to copy yet" and never calls `writeText('')`.
- An empty field's Copy never shows "Copied".
- "Copied" appears only after `writeText` succeeds on non-empty text.
- "Copy all as text" still works when a field is filled.

### TRD-17 — Add a closing "you're ready — paste and attach these files" block
A framed block gives a completion cue, the paste steps, and an attachment
checklist derived from the user's `evidenceInHand` answers, plus the personalised
reward phrase. Read-only, no upload.
- When every fillable field is filled, a clear "You're ready" cue shows.
- The block names exactly the files matching the selected evidence.
- Different evidence changes the attachment checklist.
- No upload/submit affordance.

### TRD-18 — Make draft/transfer empty states actionable
The empty draft and empty/partial transfer offer a one-tap button back to the
checklist.
- One tap on the empty-draft CTA shows the checklist.
- One tap from the empty/partial transfer returns to the checklist.
- The CTA is a ≥44px keyboard-activatable button with visible focus.

### TRD-19 — Surface an always-visible privacy reassurance line
The `<summary>` reads "Private: everything stays in this browser — nothing is
sent. Read how…"; activating it expands the safety panel. Not open by default.
- On first load the "everything stays in this browser" line is visible.
- Activating it expands the full safety panel.
- The panel is not open by default; the control is ≥44px and keyboard-activatable.

### TRD-20 — Give the local-save affordance a visible, honest presence
A compact "Save my progress on this device only — nothing is sent" control sits
near the flow, gated on the same store flag as the safety toggle (one source of
truth, no second key).
- A first-time user sees the save control without expanding the safety panel.
- Enabling, answering, and reloading restores progress with the greeting.
- Disabling clears the persisted draft (`fifteenpct.reportDraft` removed).
- No network requests when toggling/saving/restoring.
- Both controls reflect the same state.

### TRD-21 — Make prefers-reduced-motion a page-wide constraint
A global reduced-motion override zeroes animation/transition durations and
scroll-behavior; new reckoner/stepper/progress motion applies instantly.
- With reduced-motion on, no element animates or auto-scrolls with motion.
- Reckoner, stepper transitions, and progress updates apply instantly.
- All content remains reachable and legible.

## Out of scope

- No free-text amount entry for the reckoner (bands are tap-only chips).
- No persistence schema break — `ReportDraft` grows additively; `SCHEMA_VERSION` stays 1.
- No server, backend, auto-submit, file upload, or network transport.
- No official IRAS branding, colours, logos, or form embedding.
- No re-theming beyond the accent-contrast token.
- No short-text checklist step work (current steps are all chips/radio/multiselect).
- No copy-to-clipboard engine rewrite (TRD-16 only prevents empty payloads).
- Content/legal accuracy of the IRAS facts and field mapping is carried forward unchanged.
