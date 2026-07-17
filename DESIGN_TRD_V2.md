# Fifteen Percent — Technical Requirements Document (v2, form-aligned screen/modal refactor)

A numbered, testable spec that refactors the existing step-nav SPA into a
screens-and-modals flow whose only writing job is drafting the **two hard
free-text fields** of the real IRAS "Reporting Tax Evasion" form, while a fast
**readiness check** verifies (never re-collects) the simple structured fields the
form already gathers itself. Every requirement is grounded in the current code
(real selectors, tokens, render contracts and the `ReportDraft` shape) and is
independently verifiable in a browser at a 390×844 viewport.

Phases are strictly ordered: **IP-1** builds the screen router + intro modal +
home/menu shell; **IP-2** replaces the 7-question checklist with a form-aligned
readiness gate and timeboxed Parts; **IP-3** builds the two free-text builders
with the "unsure → jog-memory → omit" guarantee (the core); **IP-4** refactors
Assembly/Transfer into the two-block + cheat-sheet model and adds Save-as-document
+ Open-IRAS.

---

## Overview

IRAS pays informants **up to ~S$100,000** (15% of tax recovered, discretionary).
The real online form (form.gov.sg, ~10 minutes, single unsaveable session)
already collects the *simple* inputs as radios / multi-selects / Yes-No. It has
exactly two hard free-text fields:

- **FT-1** — *"Provide as much detail as possible about the tax evasion or tax fraud."*
- **FT-2** — *"Explain how and when you became aware of the tax evasion or tax fraud."*

The current build (`js/data.js` `transferMap`) invents IRAS field labels and
emits per-field copy for each — a **hallucinated mapping**. This refactor
**removes** that model and replaces it with: (1) a readiness check that verifies
the user has the simple info and becomes the advisory gate, and (2) tap-first
builders that turn taps into paste-ready prose for FT-1 and FT-2. The end saves a
local document and opens the real IRAS page. The app never transmits or submits.

## Form-alignment rationale

- **Do not duplicate the form.** The simple structured fields (Section A of the
  brief) are collected by the form itself. The app must *verify* the user has
  them (readiness) and *remind* the user what to pick (cheat-sheet) — never emit
  them as pasteable prose.
- **Focus the writing.** The only pasteable outputs are FT-1 and FT-2, each
  headed with its **exact** form label so the user knows where to paste.
- **Never emit "unsure".** No `unsure` / `not sure` / `rather not say` /
  `unsure of the dates` string may appear in FT-1/FT-2. Vague picks are refined
  via a secondary jog-memory list (ending in one manual "Other" input) or
  **omitted** entirely.

## Target flow

`Home/Menu` (money hook + reckoner + Start + phase menu) → **Intro modal**
(accessible dialog: what it does, tap-first, private/local, ~12 min total, leave
& return) → `Readiness` (Part 0, ~3 min; tap "I have this / not sure / no" plus a
few actual multi-selects) → gate: if crucial items missing → `Redirect`
("gather this first", with continue-anyway + Menu); if ready → `Part 1` (FT-1
builder, ~5 min) → `Part 2` (FT-2 builder, ~4 min) → `Assembly` (two editable
blocks + cheat-sheet) → `Transfer/End` (two Copy blocks + cheat-sheet + **Save
document** + **Open IRAS**). Persistent **Back / Menu / Next** on every core
screen; **Menu** returns to Home which lists every reachable phase. One screen at
a time, no vertical scroll needed at 390×844.

## Constraints preserved (global invariants)

- **100% static, local-only, offline.** No fetch/XHR/WebSocket/sendBeacon/CDN.
  Datasets stay inlined in `js/data.js`. Opening the IRAS page is user
  navigation (new tab); saving is a local Blob/object-URL/`data:` download.
  Neither transmits user data.
- **ES modules only**, no bundler/build step, no new runtime dependency.
- **Render-contract signatures preserved:** `renderChecklist(rootEl,draft,onChange)`,
  `renderDraft(rootEl,draft,onEdit)` + pure `buildNarrative(draft)`,
  `renderTransfer(rootEl,draft)`, `renderSafety(rootEl,onClear)` +
  `renderSaveControl(rootEl)`, `renderReckoner(rootEl,draft,onBand)`,
  `renderAll(draft)`, and the `draft:changed` CustomEvent flow. What they
  *produce* changes; signatures and `app.js` orchestration keep working.
- **`ReportDraft` grows additively; `SCHEMA_VERSION` stays 1.** `store.load()`
  refuses mismatches — do not orphan saved drafts. `store.normalizeDraft` carries
  the new `readiness` / `freeText` keys. Readiness answers, FT working data,
  refined unsure answers and gate state persist through the existing store when
  saving is on, and are never transmitted.
- **Accessibility floor on every screen and modal:** 18px body (`html{font-size:112.5%}`,
  `1rem = 18px`), 44px tap targets (`min-height:44px`), WCAG AA contrast both
  themes (`--color-accent-strong:#b8446a`, `--color-link`), visible
  `:focus-visible`, full keyboard operability, `prefers-reduced-motion` honoured
  (global override at `styles.css:1293`), and modals as proper dialogs
  (`role=dialog`, `aria-modal=true`, focus trap, ESC, labelled, focus restored).
- **Keep the good parts, re-hosted:** money-first hero (`.hero__headline` /
  `#hero-figure`), tap-only reckoner (`#reckoner`), honest "up to ~S$" copy from
  the single `money` source, independence strip (`.banner`), visible progress,
  local-save control.
- **No "unsure"-style placeholder ever appears in FT-1/FT-2.**
- **`stepper.js` is domain-generic (IP-5).** `js/stepper.js` owns only index
  state and control-bar wiring; it must never import from `js/gate.js` or
  `js/data.js` and must contain no readiness/IRAS-specific branching
  (TRD-5.1/5.13). All pass/fail routing stays inside `js/checklist.js`'s
  `finishReadiness()`, invoked only via the generic `finish.onFinish` callback.
- **Manual free-text entry is normalized, preserving a leading "I" (IP-5).** Any
  typed "Other — type it myself" fragment passes through `js/draft.js`'s
  `normalizeFragment()` (TRD-5.5) before splicing into a `sentence()` template:
  trimmed, trailing `.!?` stripped, first letter lowercased **unless** the
  fragment starts with the pronoun "I" (`/^I\b/`) — several authored FT-2
  `howKnown` fragments legitimately start with "I" and must never be lowercased.
- **Home carries one, PM-approved scroll exception (IP-5).** Every other core
  screen (Readiness/Redirect/Part 1/Part 2/Assembly/Transfer) is required to fit
  390×844 with zero internal scroll (`main.scrollHeight === main.clientHeight`);
  Home alone is allowed a bounded residual internal scroll after its phase-menu
  is collapsed into a disclosure (TRD-5.6), because it uniquely carries the
  hero, reckoner, Start and the trust-critical save-control above any modal.
  This is the one place in this document where "no vertical scroll needed at
  390×844" does not hold exactly.

---

## IP-1 — Screen router, home/menu shell, and the intro modal

**Goal:** One accessible screen at a time (no vertical scroll at 390×844),
persistent Back/Menu/Next, a compact Home/Menu, and a proper intro dialog.
Re-host every existing render call inside the router without changing signatures.

### TRD-1.1 — Screen host + state router (`js/router.js`)
- **Files:** `js/router.js` (new), `index.html`, `js/nav.js` (removed/replaced),
  `js/app.js`, `styles.css`.
- **Before:** `nav.js` toggles `[hidden]` on three `.view` panels via a
  `role=tablist` stepnav (`#tab-checklist/-draft/-transfer`).
- **After:** `index.html` `<main>` holds one `<section class="screen" id="screen-…">`
  per screen: `home`, `readiness`, `redirect`, `part1`, `part2`, `assembly`,
  `transfer`. `router.js` exports `showScreen(name,{focus})` and `getScreen()`,
  keeps a `SCREENS` order array and a `FLOW` next/prev map, toggles `hidden`, and
  moves focus to the shown screen's `<h2 id="…-heading" tabindex="-1">`. The old
  tablist and `.view__next` buttons are deleted.
- **Implementation notes:** `SCREENS = ['home','readiness','redirect','part1','part2','assembly','transfer']`.
  `FLOW` linear next/prev skips `redirect` unless the gate routed there.
  `showScreen` sets `document.querySelectorAll('.screen').forEach(s => s.hidden = (s.id !== 'screen-'+name))`,
  resets scroll `behavior:'auto'` (reduced-motion safe), announces via existing
  `#sr-live`. Boot shows `home` without stealing focus. Router imports nothing
  from section modules; `app.js` renders content, router only shows/hides.
- **Acceptance:** At 390×844 exactly one `.screen` is visible; `document.body.scrollHeight <= 844`
  on each core screen (no vertical scroll needed). Activating Next advances one
  screen; focus lands on the shown `h2[tabindex="-1"]`; `#sr-live` announces it.
- **Accessibility:** Each screen has one `<h2 id="…-heading" tabindex="-1">`;
  focus moves there on navigation; keyboard-only reachable; reduced-motion: no
  animated scroll.
- **Static/local-only:** Pure DOM show/hide; no network.

### TRD-1.2 — Persistent Back / Menu / Next control bar
- **Files:** `index.html`, `js/router.js`, `styles.css`.
- **Before:** Per-step Back/Next lived inside `checklist.js`; `.view__next`
  buttons lived in each panel.
- **After:** A single `<nav id="screen-controls" aria-label="Screen navigation">`
  with three real `<button>`s: `.screen-controls__back` ("← Back"),
  `.screen-controls__menu` ("Menu"), `.screen-controls__next` ("Next →").
  `router.js` updates them per screen: Back = `FLOW` prev (disabled on `home`),
  Menu = `showScreen('home')`, Next = `FLOW` next (label/enabled overridden per
  screen; e.g. hidden on `home`, "Save & finish" context on `transfer`).
- **Implementation notes:** Router exposes `setControls({back,next,onNext})` so
  screens (readiness gate, builders) can gate Next (e.g. Next disabled until the
  crucial readiness items are answered). Each button `min-height:44px`,
  `:focus-visible` ring, 18px label.
- **Acceptance:** Every core screen shows Back/Menu/Next ≥44px; Menu returns to
  Home from any screen; Back on `part2` returns to `part1`; keyboard Tab reaches
  all three with visible focus.
- **Accessibility:** `<nav aria-label>`; buttons are `<button type=button>`;
  disabled Back on Home is `aria-disabled`/`disabled`; 44px targets.
- **Static/local-only:** DOM only.

### TRD-1.3 — Compact Home / Menu screen (re-host hero + reckoner)
- **Files:** `index.html`, `js/app.js`, `js/router.js`, `styles.css`,
  `js/reckoner.js` (unchanged signature).
- **Before:** Hero (`header.hero`), reckoner (`#reckoner`), save-control and
  safety all stacked on one long scrolling page.
- **After:** `#screen-home` contains: the slim `.banner` independence strip, a
  condensed hero (`h1.hero__headline` + `#hero-figure` + one-line subhead), the
  `#reckoner` mount, a primary **Start** button (`.home__start`), and a **phase
  menu** `<ul class="home__menu">` with a `<button>` per reachable phase
  (Readiness, Part 1: What happened, Part 2: How you know, Review & Copy) plus a
  quiet link-row to Privacy/Save (opens the safety panel, TRD-1.6).
- **Implementation notes:** `renderReckoner(el('reckoner'), draft, handleBand)`
  stays as-is. Menu buttons call `showScreen(target)`. A returning user (saving
  on, `answeredCount`/readiness present) may jump to any *reached* phase;
  unreached phases are disabled with a hint. Start opens the intro modal
  (TRD-1.4). Fits 390×844 without scroll — hero trimmed to headline+figure+one
  line; menu is a compact tap list.
- **Acceptance:** On load Home shows the money hook, reckoner and Start above the
  fold at 390×844; tapping a band updates `#hero-figure` (existing `handleBand`);
  the menu lists the four phases; a fresh user sees only Readiness enabled.
- **Accessibility:** One `<h1>` in `.hero`; menu is a `<ul>` of `<button>`s ≥44px;
  reckoner keeps its `role=group`/`aria-labelledby="reckoner-label"`.
- **Static/local-only:** No network; reckoner is inlined `rewardBands`.

### TRD-1.4 — Accessible intro modal (`role=dialog`) before core content
- **Files:** `index.html` (`<div id="modal-root">`), `js/modal.js` (new),
  `js/router.js`, `styles.css`.
- **Before:** No modal; content shown inline.
- **After:** `js/modal.js` exports `openModal({titleId,contentNode,invoker})` and
  `closeModal()`. The intro modal (opened by Start) is a
  `<div role="dialog" aria-modal="true" aria-labelledby="intro-modal-title">`
  over a `.modal__backdrop`, summarising: it drafts the two hard free-text fields
  for you (the form collects the simple fields itself); it is tap-first, private
  and local-only; total time ≈ ~12 minutes; you can leave and return. Primary
  button "Start the readiness check" → `closeModal()` + `showScreen('readiness')`;
  secondary "Not now" → close, focus restored to Start.
- **Implementation notes:** Focus trap over the dialog's tabbables (loop
  Tab/Shift+Tab); initial focus to the dialog heading or first button; **ESC**
  closes; **backdrop click** closes; on close `invoker.focus()` restores focus to
  the Start button. Body scroll locked while open. Content nodes built in JS,
  fully inlined copy. Reduced-motion: no entrance animation.
- **Acceptance:** Start opens the dialog; Tab cycles only within it; ESC and
  backdrop click close it and return focus to Start; screen readers announce a
  dialog labelled by its heading; primary button lands on Readiness.
- **Accessibility:** `role=dialog`, `aria-modal=true`, labelled by its `<h2 id>`,
  focus trapped, ESC-to-close, focus restored; buttons ≥44px, AA contrast.
- **Static/local-only:** DOM only; no network.

### TRD-1.5 — Re-host existing render calls into the router without signature change
- **Files:** `js/app.js`, `index.html`.
- **Before:** `renderAll(draft)` renders into `#reckoner`, `#checklist`, `#draft`,
  `#transfer`, `#safety`, `#save-control`.
- **After:** Same mounts, relocated inside their screens: `#reckoner`+`#save-control`
  in `#screen-home`; `#checklist` in `#screen-readiness`; `#draft` in
  `#screen-assembly`; `#transfer` in `#screen-transfer`; new `#builder-ft1` in
  `#screen-part1` and `#builder-ft2` in `#screen-part2`; `#safety` inside a
  safety modal/disclosure. `renderAll` renders every mount (hidden screens paint
  offscreen); router controls visibility. `draft:changed` still calls
  `renderDependent()` (now also re-renders builders + cheat-sheet surfaces).
- **Implementation notes:** Keep `safeRender` isolation. `renderDependent` extends
  to `#builder-ft1/-ft2`, `#draft`, `#transfer`. `updateHeroFigure` and the
  reckoner path are unchanged.
- **Acceptance:** All sections still paint; editing on Assembly re-renders
  Transfer via `draft:changed`; no render function signature changed (grep shows
  identical exports).
- **Accessibility:** Unchanged per-section a11y preserved.
- **Static/local-only:** Unchanged.

### TRD-1.6 — Re-host safety + save control; keep privacy always reachable
- **Files:** `index.html`, `js/app.js`, `js/safety.js` (signatures unchanged),
  `js/modal.js`, `styles.css`.
- **Before:** `<details id="safety-wrap">` with an always-visible privacy summary;
  `#save-control` near the top.
- **After:** `renderSaveControl(#save-control)` sits on Home under the hero; the
  full `renderSafety(#safety, handleClear)` panel is reachable from Home's quiet
  Privacy link and opens in the accessible modal (reusing `modal.js`). The
  always-visible "nothing is sent" reassurance stays on Home as a one-line strip.
- **Implementation notes:** `renderSafety`/`renderSaveControl` signatures and the
  `.js-persistence-toggle` sync (`persistence:changed`) are untouched. The safety
  panel opened in a modal still gets `role=dialog` semantics from `modal.js`.
- **Acceptance:** A first-time user sees the save control + a privacy line on Home
  without opening anything; opening Privacy shows the full safety panel as a
  dialog; Clear returns the app to empty and Home.
- **Accessibility:** Modal semantics per TRD-1.4; toggles ≥44px.
- **Static/local-only:** Persistence via existing `store.js`; no network.

---

## IP-2 — Form-aligned readiness gate + timeboxed Parts

**Goal:** Replace the 7-question checklist *purpose* with a fast readiness check
that verifies the form's simple fields, gates the flow, and timeboxes the Parts.

### TRD-2.1 — Additive readiness + freeText data model (`state.js`, `store.js`)
- **Files:** `js/state.js`, `js/store.js`.
- **Before:** `createEmptyDraft()` has `answers` (7 checklist fields), `reckoner`,
  `narrativeOverride`, `fieldOverrides`. `SCHEMA_VERSION = 1`.
- **After (additive, still v1):** add
  `readiness: { answers: {}, gate: { evaluated:false, passed:null, acknowledgedRedirect:false } }`
  and `freeText: { ft1:{ answers:{}, override:null }, ft2:{ answers:{}, override:null } }`.
  `readiness.answers` is keyed by readiness item id → value (`string` for single
  selects, `string[]` for multi-selects, or `'have'|'unsure'|'no'` for verify
  items). `freeText.*.answers` is keyed by prompt id → **refined value string**
  (never an unsure placeholder). Legacy `answers`/`fieldOverrides` remain so old
  saved drafts still load.
- **Implementation notes:** `normalizeDraft` copies `readiness` and `freeText`
  onto the fresh base when present and object-shaped (mirroring the existing
  `answers`/`fieldOverrides` merge), defaulting to empties otherwise; keep
  `rewardEstimate` derived/nulled. `SCHEMA_VERSION` stays `1`. Add an exported
  `READINESS_CRUCIAL` id list for the gate.
- **Acceptance:** A pre-existing v1 draft (no `readiness`/`freeText`) loads
  without loss and gains empty `readiness`/`freeText`. Saving with saving-on,
  reloading, restores readiness answers and FT taps. `SCHEMA_VERSION === 1`.
- **Accessibility:** N/A (pure model).
- **Static/local-only:** Persists only through `store.js`; never transmitted.

### TRD-2.2 — Readiness items + Parts/timebox config in `data.js`
- **Files:** `js/data.js`.
- **Before:** `checklist.steps` (7 narrative-oriented questions), `transferMap`,
  `optionFragments` for the old checklist.
- **After:** export `readiness = { part:{name:'Part 0: Readiness', estimate:'~3 mins'}, items:[…] }`.
  Each item: `{ id, kind:'select'|'verify', prompt, hint, options?, multi?, crucial?:'who'|'what'|'how' }`.
  Items align to Section A: `reportingOn` (select single: individual / business /
  both; crucial `who`), `identityDetails` (verify; crucial `who`), `taxTypes`
  (select multi: Individual Income Tax, Corporate Income Tax, GST, Property Tax,
  Stamp Duties, Others; crucial `what`), `behaviours` (select multi: the 9 listed
  behaviours + Others; crucial `what`), `timing` (verify), `amount` (verify),
  `whoElse` (verify), `evidence` (select multi of document types reusing
  `evidenceAttachments` keys; crucial `how` when not `no`), `relationship`
  (select multi: the relationship list; crucial `how`), `priorIras` (verify
  Yes/No), `reward` (select single: "Yes, and I confirm the requirements" / "No"),
  `contact` (select single: Email / Phone / I do not wish to be contacted).
  Verify options render as **"I have this / Not sure / No"** → stored `have/unsure/no`.
- **Implementation notes:** Keep `money`, `rewardBands`, `estimateForBand`,
  `evidenceAttachments`. **Delete** `transferMap` and the old checklist-specific
  `optionFragments`/`fragmentFor` usage tied to the removed narrative (see
  TRD-3.5). Add `readiness.items` and Part configs for `part1`/`part2` estimates.
- **Acceptance:** `data.js` exports `readiness.items` with the exact Section-A
  option sets; `transferMap` no longer exists (grep returns nothing); tax-type
  and behaviour options match the real form verbatim.
- **Accessibility:** N/A (data).
- **Static/local-only:** Inlined; no network.

### TRD-2.3 — `renderChecklist` becomes the readiness check (same signature)
- **Files:** `js/checklist.js`, `js/app.js`.
- **Before:** `renderChecklist(rootEl,draft,onChange)` renders a 7-step narrative
  wizard into `#checklist` writing `draft.answers[field]`.
- **After:** Same signature; renders the **readiness check** into `#checklist`
  (mounted in `#screen-readiness`). One item per internal step (reuse the
  existing stepper: `.checklist__step`, single-select radiogroup pattern for
  `select single`, `.checklist__chip--multi` for `select multi`, and a 3-button
  "I have this / Not sure / No" radiogroup for `verify`). Writes
  `draft.readiness.answers[item.id]` and calls `onChange('readiness.'+id, value)`.
  Header reads "Part 0: Readiness — ~3 mins" from `readiness.part`.
- **Implementation notes:** Reuse `renderSingleChoice`/`renderMultiSelect`;
  `verify` items use `renderSingleChoice` over `['I have this','Not sure','No']`
  mapped to `have/unsure/no`. `commit` writes into `draft.readiness.answers`,
  persists via `store.save`, dispatches `draft:changed`. `app.js.handleChange`
  routes `readiness.*` fields into `draft.readiness.answers`. Progress counter
  counts answered readiness items.
- **Acceptance:** Readiness screen shows one tap-first item at a time with
  Back/Next; every crucial item can be answered by tap; no prose entry; header
  shows the timebox; keyboard-only completable; `draft.readiness.answers`
  populates.
- **Accessibility:** Radiogroup / group semantics preserved; ≥44px chips;
  `role=status` progress; reduced-motion honoured.
- **Static/local-only:** Persistence via `store.js` only.

### TRD-2.4 — Advisory gate + `Redirect` "gather this first" screen
- **Files:** `js/checklist.js` (or `js/gate.js` new), `js/router.js`,
  `js/data.js`, `index.html`, `styles.css`.
- **Before:** No gate; the checklist just flowed into the draft.
- **After:** After the last readiness item, evaluate `evaluateGate(draft)` (pure,
  in `data.js`/`state.js`): `who = reportingOn set && identityDetails==='have'`;
  `what = taxTypes.length>0 && behaviours.length>0`; `how = relationship.length>0
  && evidence!=='no'`. `passed = who && what && how`. Store into
  `draft.readiness.gate`. If **not** passed → `showScreen('redirect')`; else Next
  → `showScreen('part1')`. `#screen-redirect` (rendered content) names exactly
  which crucial group is missing ("Find out who is involved and an identifying
  detail", "Pin down which tax and what they did", "Note how you know and what you
  can point to"), a **Continue anyway** button (sets `gate.acknowledgedRedirect=true`,
  → `part1`), and **Back to menu**.
- **Implementation notes:** Next on Readiness is disabled until all crucial items
  are answered (via `router.setControls`). `evaluateGate` reads only
  `readiness.answers`. Redirect copy is procedural (names what to gather; never
  characterises conduct or predicts outcome).
- **Acceptance:** With a crucial item = `no`/unset, finishing Readiness routes to
  Redirect naming that gap; Continue-anyway proceeds to Part 1 and sets the flag;
  with all crucial items satisfied, Next goes straight to Part 1.
- **Accessibility:** Redirect has an `h2[tabindex=-1]` heading; buttons ≥44px;
  reachable by keyboard; `#sr-live` announces the redirect.
- **Static/local-only:** Pure evaluation; no network.

### TRD-2.5 — Timeboxed Part headers on every Part
- **Files:** `js/checklist.js`, `js/builders.js` (new, IP-3), `js/data.js`.
- **Before:** No time estimates.
- **After:** Each Part's `h2` carries its name + estimate from `data.js`:
  "Part 0: Readiness — ~3 mins", "Part 1: What happened — ~5 mins", "Part 2: How
  you know — ~4 mins". A small `.part__timebox` line under the heading restates it.
- **Implementation notes:** `data.js` exports `parts = { part1:{name,estimate},
  part2:{name,estimate} }`; builders/checklist read them.
- **Acceptance:** Each Part screen visibly shows its name and "~N mins"; totals
  match the intro modal's "~12 minutes".
- **Accessibility:** Estimate is real text (not `title`-only); AA contrast.
- **Static/local-only:** Inlined copy.

---

## IP-3 — The two free-text builders + unsure disclosure (the core)

**Goal:** Tap-first prompt trees assemble paste-ready prose for FT-1 and FT-2,
with a guaranteed no-"unsure" output.

### TRD-3.1 — Free-text prompt trees inline in `data.js`
- **Files:** `js/data.js`.
- **Before:** No prompt-tree data; prose came from `optionFragments` over the old
  checklist answers.
- **After:** export `freeTextBuilders = { ft1:{…}, ft2:{…} }`. Each:
  `{ fieldLabel, part, prompts:[ … ] }`. `fieldLabel` is the **exact** form label
  (FT-1: "Provide as much detail as possible about the tax evasion or tax
  fraud."; FT-2: "Explain how and when you became aware of the tax evasion or tax
  fraud."). Each prompt:
  `{ id, prompt, hint, multi?, options:[ {label, value?, fragment?, unsure?, omitIfUnrefined?, jog?:[ {label, fragment}… , {label:'Other — type it myself', manual:true} ]} ], sentence(vals)->string }`.
  FT-1 prompts: kind of evasion; what the person/business did; how it was
  conducted; amounts/frequency (if known); timing (if known); who else (if known).
  FT-2 prompts: your vantage/relationship; when you became aware; how you came to
  know (saw/heard/handled); whether it is ongoing.
- **Implementation notes:** Options carry lowercase `fragment`s (like the old
  `optionFragments`) so `sentence()` composes fluent prose without splicing
  capitalised labels. Any option that is a variant of "unsure/not sure/rather not
  say" sets `unsure:true` and provides a `jog` list ending in one `manual:true`
  entry; options that mean "I don't know" set `omitIfUnrefined:true` so the prompt
  contributes nothing when unresolved. Full option/fragment text authored in
  `data.js` following this shape.
- **Acceptance:** `freeTextBuilders.ft1.fieldLabel` and `.ft2.fieldLabel` equal
  the exact form strings; each unsure option has a non-empty `jog` ending in a
  single `manual:true` entry.
- **Accessibility:** N/A (data).
- **Static/local-only:** Inlined.

### TRD-3.2 — Builder renderer with jog-memory disclosure (`js/builders.js`)
- **Files:** `js/builders.js` (new), `js/app.js`, `index.html`, `styles.css`.
- **Before:** No builder UI.
- **After:** export `renderBuilder(rootEl, draft, key, onChange)` (`key` =
  `'ft1'|'ft2'`), rendering into `#builder-ft1`/`#builder-ft2`. One prompt per
  internal step (reuse the stepper look). Selecting a `select`/`radio` option
  writes `draft.freeText[key].answers[promptId]`. Selecting an `unsure:true`
  option reveals its **secondary jog-memory list** inline (more specific
  possibilities) ending in **"Other — type it myself"** which reveals one
  `<textarea>`/`contenteditable` manual input; the refined value replaces the
  vague pick. Nothing is stored for an unresolved unsure pick.
- **Implementation notes:** `onChange('freeText.'+key, promptId, value)` →
  `app.js` writes `draft.freeText[key].answers[promptId]`, persists, dispatches
  `draft:changed`. Jog list is a nested radiogroup; manual input commits on blur
  (reuse the `makeEditable` pattern from `draft.js`). Store the **fragment/value**,
  not the label. Live-preview of the growing block may show under the prompts.
- **Acceptance:** Picking an unsure option reveals a more-specific list; picking
  "Other" reveals a text input; the refined value flows into the block; leaving an
  unsure pick unrefined stores nothing and omits it. Keyboard-only operable.
- **Accessibility:** Nested groups labelled; manual input `role=textbox`, ≥44px
  targets; visible focus; reduced-motion (no reveal animation).
- **Static/local-only:** Persist via `store.js`; no network.

### TRD-3.3 — `buildNarrative` returns the two-field model (same signature)
- **Files:** `js/draft.js`.
- **Before:** `buildNarrative(draft) -> { paragraph, detailsRows }` composed from
  the 7 checklist answers via `composeParagraph`.
- **After:** `buildNarrative(draft) -> { ft1:{ label, text }, ft2:{ label, text } }`.
  Pure, DOM-free. `label` = the exact form label from `freeTextBuilders`. `text`
  composed by joining each prompt's `sentence()` over the stored refined
  `freeText[key].answers`, honouring `freeText[key].override` when non-empty.
  Omits any prompt with no stored/refined value.
- **Implementation notes:** Replace `composeParagraph`/`detailRowsWithKeys`/`FIELDS`
  with a `composeBlock(draft,key)` helper. `override` (whole-block hand edit)
  wins over composed text. Guarantee: never emit a value equal to an unsure
  placeholder (only refined values are ever stored, TRD-3.2).
- **Acceptance:** With FT-1 taps set, `buildNarrative(draft).ft1.text` is fluent
  prose containing no capitalised mid-sentence label and no "unsure"/"not sure";
  `.ft1.label`/`.ft2.label` equal the exact form strings; an empty draft yields
  empty `text` (not a placeholder).
- **Accessibility:** N/A (pure).
- **Static/local-only:** Pure.

### TRD-3.4 — Unsure never reaches FT-1/FT-2 (guarantee test point)
- **Files:** `js/data.js`, `js/builders.js`, `js/draft.js`.
- **Before:** Old fragments emitted "a tax type I am not sure of",
  "relates to a period I am unsure of", etc.
- **After:** No composed sentence may contain `unsure`, `not sure`, `rather not
  say`, `unsure of the dates`, or an equivalent. Unrefined vague picks are
  omitted; refined picks use their jog fragment or manual text.
- **Implementation notes:** A defensive filter in `composeBlock` drops any
  fragment matching `/\b(unsure|not sure|rather not say)\b/i` as a final
  backstop; primary guarantee is that such values are never stored.
- **Acceptance:** For every reachable combination of taps (including choosing an
  unsure option then abandoning it), `buildNarrative(draft).ft1.text` and
  `.ft2.text` contain none of the banned substrings.
- **Accessibility:** N/A.
- **Static/local-only:** Pure.

### TRD-3.5 — Remove the old narrative + details-table + transferMap dependency
- **Files:** `js/draft.js`, `js/transfer.js`, `js/data.js`, `js/state.js`.
- **Before:** `draft.js` built a paragraph + `detailsRows`; `transfer.js` imported
  `transferMap` and emitted per-field copy; `data.js` exported `transferMap` and
  `optionFragments`.
- **After:** `transferMap` deleted from `data.js` and its imports removed from
  `transfer.js`; the `FIELDS`/`detailsRows`/`composeParagraph` model removed from
  `draft.js`; `narrativeOverride`/`fieldOverrides` in state are superseded by
  `freeText.*.override` (legacy keys retained only for back-compat load, never
  rendered).
- **Implementation notes:** `resolveValue`/`buildAllText` per-field logic in
  `transfer.js` is replaced by the two-block model (IP-4). `fragmentFor` may be
  kept only if reused by the FT builders; otherwise removed.
- **Acceptance:** grep for `transferMap` and `detailsRows` returns nothing in the
  runtime path; the app renders with no console error; old per-field copy rows are
  gone.
- **Accessibility:** N/A.
- **Static/local-only:** Unchanged.

---

## IP-4 — Assembly + Transfer/End refactor + Save + Open IRAS

**Goal:** Two editable blocks + a readiness cheat-sheet on Assembly; two Copy
blocks + cheat-sheet + Save-as-document + Open-IRAS on Transfer/End.

### TRD-4.1 — Assembly screen: two editable blocks + cheat-sheet (`renderDraft`)
- **Files:** `js/draft.js`, `js/app.js`, `styles.css`.
- **Before:** `renderDraft` showed an editable paragraph + details table.
- **After:** `renderDraft(rootEl, draft, onEdit)` renders into `#draft`
  (`#screen-assembly`): two blocks, each headed with its **exact** form label
  (`h3`/`.draft__block-label`) and an inline-editable body (`contenteditable`,
  reuse `makeEditable`) initialised from `buildNarrative(draft).ft1/.ft2`; edits
  commit as `onEdit({ freeText:{ ft1:{override} } })`. Below, a concise
  **cheat-sheet** ("In the form you will also select: …") from
  `buildCheatSheet(draft)` — reminders, not paste prose.
- **Implementation notes:** `app.js.handleEdit` merges `patch.freeText` into
  `draft.freeText` (additive per key). Empty edit clears the override. Cheat-sheet
  is read-only text (no Copy buttons on it).
- **Acceptance:** Assembly shows both blocks with their exact labels; editing a
  block updates it and (via `draft:changed`) the Transfer copy; the cheat-sheet
  lists the user's readiness selections; no details table remains.
- **Accessibility:** Each block `role=textbox`, labelled by its `h3`; ≥44px edit
  affordances; visible focus.
- **Static/local-only:** Persist via `store.js`.

### TRD-4.2 — Readiness cheat-sheet builder
- **Files:** `js/draft.js` (or `js/cheatsheet.js` new), `js/data.js`.
- **Before:** No cheat-sheet; simple fields were (wrongly) emitted as pasteable
  rows.
- **After:** export `buildCheatSheet(draft)` (pure) → array of `{label, value}`
  derived from `readiness.answers`: reporting on = …; reported before to IRAS =
  Yes/No; tax type(s) = …; behaviour(s) = …; timing known = Yes/Not yet; amount
  known = Yes/Not yet; who-else known = Yes/Not yet; relationship = …; reward =
  Yes/No; contact = …. Values are short reminders (never prose to paste); an
  unresolved verify item reads "Not yet — decide before you submit".
- **Implementation notes:** Multi-selects join with commas; a `'no'`/`'unsure'`
  verify never becomes an "unsure" prose fragment (it stays a reminder line).
- **Acceptance:** `buildCheatSheet(draft)` reflects the exact readiness picks;
  changing a readiness pick changes the corresponding reminder; nothing in it is
  framed as pasteable free text.
- **Accessibility:** N/A (pure).
- **Static/local-only:** Pure.

### TRD-4.3 — Transfer/End: two labelled Copy blocks (`renderTransfer`)
- **Files:** `js/transfer.js`, `styles.css`.
- **Before:** Per-simple-field copy rows keyed off `transferMap`, plus "Copy all".
- **After:** `renderTransfer(rootEl, draft)` renders into `#transfer`
  (`#screen-transfer`): for **each** of FT-1 and FT-2 a prominent Copy block —
  heading "Copy, then paste into the form field: <exact label>", the composed
  text (selectable), and a `.transfer__copy` button using the existing
  `doCopy`/`writeText` path with honest `Copied` / `Copy failed` / `Nothing to
  copy yet` toasts. Below, the read-only cheat-sheet (TRD-4.2). No per-simple-field
  rows, no invented labels.
- **Implementation notes:** Reuse `pendingToast`/`showToast`/`showNeutralToast`/
  `revealSelectable`. Text comes from `buildNarrative(draft).ft1/.ft2.text`
  (honours overrides). Remove `transferMap` import and `resolveValue`/`buildAllText`.
- **Acceptance:** Two Copy blocks each name their exact form field; Copy on a
  filled block toasts "Copied" only after `writeText` succeeds; an empty block's
  Copy toasts "Nothing to copy yet"; the cheat-sheet shows below with no Copy
  buttons.
- **Accessibility:** Copy buttons ≥44px, labelled; toast `role=status
  aria-live=polite`; selectable fallback on failure.
- **Static/local-only:** Clipboard is local; no network.

### TRD-4.4 — Save-as-document (local download, no network)
- **Files:** `js/transfer.js`, `js/save-doc.js` (new), `styles.css`, `js/data.js`.
- **Before:** No save-to-file; only "Copy all as text".
- **After:** A **Save my report as a document** button builds a plain-text
  document containing: FT-1 label + text, FT-2 label + text, the cheat-sheet
  ("In the form you will also select: …"), and an **attachments reminder**
  derived from `evidence`/`evidenceAttachments`. Download via
  `new Blob([text],{type:'text/plain'})` → `URL.createObjectURL` → a temporary
  `<a download="fifteen-percent-report.txt">` click → `URL.revokeObjectURL`
  (or a `data:` URI fallback). No network.
- **Implementation notes:** `save-doc.js` exports `buildDocument(draft)` (pure
  string) and `downloadDocument(draft)`. The document is honest: money reads "up
  to ~S$…"; no submission language.
- **Acceptance:** Tapping Save downloads a `.txt` containing both labelled blocks,
  the cheat-sheet and the attachments reminder; DevTools Network shows no request;
  works from a `file://` copy.
- **Accessibility:** Button ≥44px, labelled; a `role=status` line confirms the
  download.
- **Static/local-only:** Blob/object-URL only; nothing transmitted.

### TRD-4.5 — Open-IRAS button (centralised URL, new tab)
- **Files:** `js/transfer.js`, `js/data.js`.
- **Before:** Transfer told users to "open the official IRAS form" with no link;
  URL not centralised.
- **After:** `data.js` exports `iras = { reportUrl:'https://www.iras.gov.sg/contact-us/report-tax-evasion', lastVerified:'2026-07-16' }`.
  An **Open the IRAS form** control is an `<a href=iras.reportUrl target="_blank"
  rel="noopener noreferrer">` styled as a button. Adjacent copy: paste FT-1 and
  FT-2 into their two fields, select the simple fields from the cheat-sheet, and
  attach your files. The app never submits or uploads.
- **Implementation notes:** Single source for the URL + `lastVerified` marker
  (replaces the deleted `transferMap.lastVerified`). Independence strip still
  states non-affiliation.
- **Acceptance:** The link opens the exact IRAS URL in a new tab with
  `rel="noopener noreferrer"`; changing `iras.reportUrl` in `data.js` changes the
  link; no auto-submit/upload affordance exists.
- **Accessibility:** Real `<a>` (announced as link), ≥44px, visible focus; opens
  new tab (announced in adjacent text).
- **Static/local-only:** Plain navigation; no user data in the URL.

### TRD-4.6 — End-screen honesty + completion recognition
- **Files:** `js/transfer.js`, `styles.css`.
- **Before:** `buildReadyBlock` gave a completion cue + attachment checklist.
- **After:** A concise "You're ready" recognition line (both blocks present),
  the personalised reward phrase from the single `money` source ("up to ~S$…, at
  IRAS's discretion, never a promise"), the paste/select/attach steps, and the
  Save + Open actions. Procedural only; never characterises conduct or predicts
  outcome.
- **Implementation notes:** Reuse `money.phrase`/`ceilingPhrase`; attachments
  reminder from `evidenceAttachments`.
- **Acceptance:** When both blocks have text, a clear "You're ready" cue shows
  with the honest reward phrase and the three next steps; no guaranteed-payout or
  outcome-predicting language appears.
- **Accessibility:** `role=status` cue; AA contrast both themes.
- **Static/local-only:** Read-only; no upload.

---

## IP-5 — Bug fixes and navigation-consistency hardening

**Goal:** Close out a 3-round design-critique loop (UI/UX designer + Senior PM)
run against the built IP-1..4 flow: two real navigation bugs that let a single
persistent-bar tap skip required steps, a Home scroll-budget overrun, three
small copy/consistency cleanups, two "document as intentional, do not touch"
comments, and a stale-cache correctness fix for Home's re-entry gating. No new
readiness/free-text content, no schema change, no IRAS field-mapping change.

### TRD-5.1 — Shared stepper module (`js/stepper.js`) unifies inline and persistent Next

- **Files:** `js/stepper.js` (new), `js/checklist.js`, `js/builders.js`,
  `js/router.js` (consumes `clearControls`, TRD-5.2), `js/gate.js`/`js/app.js`
  (reference pattern only, unchanged).
- **Before:** `checklist.js` and `builders.js` each hand-roll their own
  independent `activeIndex`/`goTo(index,focusIt)`/`paintActive(focusIt)`
  stepper (`checklist.js:267-434`; `builders.js:428-581`) plus their own,
  inconsistent way of talking to the persistent control bar. `checklist.js`'s
  `applyReadinessControls` (`checklist.js:411-420`) unconditionally wires the
  persistent Next to "finish" behaviour — label "Check my readiness →", enabled
  once `readinessCrucialAnswered(draft)` is true — on every call, including
  calls fired after every single-item `commit` (`checklist.js:331`) and on
  every `screen:changed` to `readiness` (`checklist.js:422-429`), regardless of
  which step is active. Reproduction: answer only the 2 non-multi crucial items
  (of 12 total), then tap the always-visible persistent Next — it fires
  `finishReadiness()` and jumps straight to Redirect, skipping the other 10
  items. Separately, `builders.js` never imports `router.js` at all (its import
  block is `builders.js:20-22`) and never calls `setControls`, so on Part 1/
  Part 2 the persistent Next silently keeps the router's plain `FLOW` default
  (`part1.next = 'part2'`), active and enabled from the very first, unanswered
  prompt. Reproduction: on Part 1 with 0 of 6 prompts answered, one tap on the
  persistent bar jumps straight to Part 2.
- **After:** `js/stepper.js` exports
  `createStepper({screenName, total, firstIndex, renderStep, onIndexChange, finish})`.
  It owns `activeIndex` and drives one advance function reused by both callers:
  `renderStep(index, {total, isLast, goTo, advance, retreat})` is called on
  every paint; the host module (`checklist.js`/`builders.js`) builds the step
  body **and** its own inline Back/Next buttons from the passed-in
  `retreat`/`advance` functions, so the inline Next button's `onclick` and the
  persistent bar Next's `onNext` on every non-last step both point at literally
  the same `advance` function reference — not two separately-written functions
  that happen to behave the same way. `onIndexChange(index)` fires after
  `activeIndex` changes (before paint), for the host's own per-render
  bookkeeping (progress counters, "answered/chosen so far" summaries, live
  preview) — kept in `checklist.js`/`builders.js`, never in `stepper.js`. On
  every step except the last, `stepper.js` calls
  `router.setControls({next:{label:'Next →'}, onNext: advance})`. On the last
  step: if `finish` is present (`{label, isEnabled, onFinish}`), `stepper.js`
  calls
  `router.setControls({next:{label:finish.label, disabled:!finish.isEnabled()}, onNext:finish.onFinish})`;
  if `finish` is absent, `stepper.js` calls the new `router.clearControls()`
  (TRD-5.2) so the screen falls back to the plain `FLOW`-derived Next. It
  listens once for `screen:changed` filtered to its own `screenName`,
  re-applying controls on (re-)entry — replacing `checklist.js`'s
  `listenerBound` guard (`checklist.js:422-429`) and adding the equivalent for
  `builders.js`, which has none today.

  `js/checklist.js` (readiness, 12 items) and `js/builders.js` (Part 1 = 6
  prompts, Part 2 = 4 prompts) are migrated to call `createStepper`, and their
  hand-rolled `activeIndex`/`goTo`/`paintActive`/`applyReadinessControls`/
  `listenerBound` logic is deleted. Readiness's `finish` config is
  `{label:'Check my readiness →', isEnabled:() => readinessCrucialAnswered(draft), onFinish: finishReadiness}`
  — `finishReadiness` (`checklist.js:337-353`, unchanged) still owns the
  pass→Part1/fail→Redirect routing. Part 1 and Part 2 pass no `finish` config,
  so their last prompt's persistent Next falls back to the plain default via
  `clearControls()`.

  `js/gate.js`'s Redirect screen is **not** migrated and is explicitly out of
  scope for this item: it is a single-action screen, not a stepped one, and
  keeps talking to the control bar exactly as it does today — via `app.js`'s
  `renderRedirectScreen()` (`app.js:209-224`), which calls
  `router.setControls({next:{label:'Continue anyway →'}, onNext: acknowledgeRedirect})`
  directly on every `screen:changed` to `redirect` (`app.js:379-383`). *(Note:
  this direct-`setControls` call lives in `app.js`, not `js/gate.js` itself —
  `gate.js` only exports the pure evaluators and `renderRedirect`'s DOM paint;
  flagged here so a coding agent greps the right file.)* This existing
  direct-wiring pattern is the reference for "how a non-stepped screen talks to
  the control bar without going through `stepper.js`."
- **Implementation notes:** `js/stepper.js` must import only from `js/router.js`
  (`setControls`, `clearControls`, `getScreen`) — nothing from `js/gate.js`,
  `js/data.js`, or any domain module (TRD-5.13 restates this as its own
  acceptance gate). `checklist.js` keeps `finishReadiness` (routing logic, gate
  evaluation, redirect/part1 dispatch) entirely inside itself, passed to the
  stepper only as an opaque `onFinish` callback.
- **Acceptance:** With 2 of 12 readiness items answered (the two non-multi
  crucial ones) and the other 10 untouched, the persistent Next on Readiness is
  enabled and advances exactly one step at a time on every non-last step —
  tapping it never jumps ahead to Redirect early. On Part 1 with 0 of 6 prompts
  answered, the persistent Next is enabled (unchanged UX) but advances to
  prompt 2 of 6 on tap — it no longer jumps straight to Part 2; only tapping
  Next on the 6th (last) prompt reaches Part 2. Grep `js/stepper.js` for
  `from './gate.js'` and `from './data.js'` returns nothing.
  `readinessCrucialAnswered` — not `evaluateGate` — is the literal function
  passed as readiness's `finish.isEnabled`.
- **Accessibility:** Unchanged from IP-2/IP-3 — inline Back/Next remain
  `<button type=button>` ≥44px; the persistent bar's existing
  `aria-disabled`/focus-ring handling (`router.js`'s `setDisabled`) is reused
  as-is by `stepper.js`.
- **Static/local-only:** Pure DOM + in-memory state; no network; no storage
  change (`stepper.js` persists nothing itself — `checklist.js`/`builders.js`
  keep calling `store.save` from their own `commit`).

### TRD-5.2 — `clearControls()`: a real reset, distinct from `setControls(null)`

- **Files:** `js/router.js`.
- **Before:** `setControls(next)` (`router.js:181-184`) is
  `overrides = Object.assign({}, overrides || {}, next || {}); applyControls();`.
  Calling `setControls(null)` merges `{}` onto whatever `overrides` already
  held, so it is a no-op — it changes nothing and does not clear a stale
  override left by a previous screen.
- **After:** Add `export function clearControls() { overrides = null; applyControls(); }`
  next to `setControls`. This actually discards `overrides` (the module-scoped
  `let overrides = null;`, `router.js:48`) and lets `applyControls()`
  (`router.js:78-127`) fall back entirely to the plain `FLOW`-derived
  Back/Menu/Next for the current screen.
- **Implementation notes:** `overrides` is the exact internal variable name
  (verified by reading `router.js` — no renaming needed). `clearControls` is a
  one-line sibling of `setControls`, exported alongside it. Used by
  `js/stepper.js` (TRD-5.1) on a stepped screen's last step when no `finish`
  config is given.
- **Acceptance:** After any `setControls({...})` override is active, calling
  `clearControls()` and re-rendering the control bar reproduces exactly what a
  screen with no override ever applied would show (same label, same enabled
  state, same target) — i.e. `clearControls()` is behaviourally distinct from
  `setControls(null)`, which is provably a no-op by inspection of
  `Object.assign({}, overrides||{}, null||{})`.
- **Accessibility:** N/A (pure control-bar state).
- **Static/local-only:** Pure DOM; no network.

### TRD-5.3 — Home's persistent Next no longer bypasses the intro modal

- **Files:** `js/router.js`.
- **Before:** `FLOW.home = { next: 'readiness' }` (`router.js:27`). Because
  `applyControls()`'s Next block computes
  `target = (ov.next && ov.next.target) || flow.next` (`router.js:112`) and
  only disables Next when `!target` (`router.js:114-117`), Home's persistent
  Next is enabled from first paint and, on tap, calls `showScreen('readiness')`
  directly — skipping the intro modal (TRD-1.4) entirely. `FLOW.transfer` has
  no `next` key (`router.js:33`) and is already correctly Next-disabled today,
  proving the fallback logic already does the right thing once `next` is
  absent.
- **After:** `FLOW.home = {}` (the `next` key removed entirely, mirroring
  `FLOW.transfer`'s existing shape). No other code changes: `target` on Home
  now resolves to `undefined` (no override, no `flow.next`), so `nextDisabled`
  is `true` and the persistent Next button on Home shows disabled, exactly as
  `transfer`'s already does.
- **Implementation notes:** A one-line data change in the `FLOW` map;
  `applyControls()` itself is untouched. After this fix, the only ways to reach
  Readiness from Home are the **Start** button (`#home-start`, opens the intro
  modal via `openIntroModal()`, `router.js:187-209`) and the Home phase-menu's
  "Readiness check" item (`.home__menu-item[data-target="readiness"]`,
  `index.html:43`).
- **Acceptance:** On Home, the persistent Next button renders with
  `aria-disabled="true"`/`.is-disabled` and its `onclick` is `null` (per
  `setDisabled`, `router.js:64-73`) at every point before Start is tapped;
  tapping Start still opens the intro dialog and its primary button still
  lands on Readiness (TRD-1.4, unchanged); tapping a Home phase-menu item still
  navigates directly (unchanged, TRD-1.3).
- **Accessibility:** Unchanged — the persistent Next stays in the tab order but
  inert per the existing `aria-disabled` pattern (`router.js:60-63` comment).
- **Static/local-only:** Pure DOM; no network.

### TRD-5.4 — Persistent control-bar "Menu" button renamed "Home"

- **Files:** `js/router.js`, `index.html`.
- **Before:** The persistent control bar's third button reads "Menu" in two
  places — its static fallback markup,
  `<button ... id="ctl-menu">Menu</button>` (`index.html:112`), and the text
  `applyControls()` sets on every render, `menuBtn.textContent = 'Menu';`
  (`router.js:104`).
- **After:** Both become "Home" —
  `<button ... id="ctl-menu">Home</button>` (`index.html:112`) and
  `menuBtn.textContent = 'Home';` (`router.js:104`). The button's id
  (`ctl-menu`), its `showScreen('home')` behaviour (`router.js:105-108`), and
  its CSS class (`.screen-controls__menu`) are all unchanged — a label-only
  rename.
- **Implementation notes — explicitly OUT of scope, do not touch:** `js/gate.js`'s
  Redirect screen has its own, separate, screen-local "Back to menu" button
  (`redirect__menu`, `gate.js:149`, wired in `app.js`'s `renderRedirectScreen`
  to `showScreen('home')`, `app.js:215-217`). That control is deliberately
  excluded from this rename — it reads "Back to menu" today and stays "Back to
  menu"; only the persistent control bar's own button (`#ctl-menu`) is
  renamed. A coding agent must not "helpfully" rename `gate.js`'s button to
  match.
- **Acceptance:** The persistent control bar shows "Home" (not "Menu") on
  every screen; `js/gate.js`'s Redirect-screen button still reads "Back to
  menu" verbatim (grep `gate.js` for `'Back to menu'` still matches);
  `SCREEN_LABELS` (`router.js:36-44`, used only for `#sr-live` announcements)
  needs no change — it already reads `home: 'Home'`.
- **Accessibility:** Button text change only; existing focus/44px treatment
  unchanged.
- **Static/local-only:** Pure DOM text; no network.

### TRD-5.5 — `normalizeFragment()` fixes broken manual-entry text, preserves a leading "I"

- **Files:** `js/draft.js`, `js/builders.js`.
- **Before:** `js/builders.js`'s manual "Other — type it myself" input commits
  with only `.trim()` (the `commitManual` closure inside `buildJog`,
  `builders.js:347-353`:
  `const text = String(manualInput.value || '').replace(/\s+$/, '').trim();`).
  Every authored `fragment` string in `data.js` is hand-written lowercase with
  no trailing punctuation so it splices cleanly into a `sentence()` template
  (e.g. `freeTextBuilders.ft1.kind`'s
  `sentence: (f) => "This report concerns " + f + "."`, `data.js:304`); a
  user-typed manual fragment is not normalized the same way, so a typed "A
  relative under-reported rental income for three years." (capitalised,
  trailing period) composes into a malformed sentence when spliced.
- **After:** `js/draft.js` exports:
  ```js
  export function normalizeFragment(raw, { leadsSentence = false } = {}) {
    let s = String(raw == null ? '' : raw).trim();
    s = s.replace(/[.!?]+$/, '').trim();
    if (s && !leadsSentence && !/^I\b/.test(s)) {
      s = s.charAt(0).toLowerCase() + s.slice(1);
    }
    return s;
  }
  ```
  `js/builders.js`'s `commitManual` (`builders.js:347-353`) calls
  `normalizeFragment(manualInput.value)` in place of its bare `.trim()`, then
  commits the result (or `null` when empty) exactly as today.

  The `!/^I\b/.test(s)` guard is **mandatory, not cosmetic**:
  `freeTextBuilders.ft2.howKnown`'s `sentence()` template is
  `"I know about it because " + f + "."` (`data.js:655`) and its own authored
  options already read `"I saw it happen myself"`,
  `"I handled the records or money involved"`,
  `"someone who took part told me directly"`, with a jog entry `"I overheard
  it being discussed"` (`data.js:656-691`) — i.e. this exact prompt's fragments
  legitimately start with a capitalised pronoun "I" and must NOT be lowercased.
  Without the guard, a manual entry "I overheard my colleague discussing it"
  would normalize to "i overheard my colleague discussing it", producing a
  new, visible, real grammatical bug in the exact pasted-into-a-government-form
  text this fix exists to protect.
- **Implementation notes:** `js/draft.js`'s separate whole-block
  `contenteditable` override path — `makeEditable` (`draft.js:136-150`), used
  on the Assembly screen to let a reader hand-edit an entire composed FT-1/FT-2
  block — is a fully independent code path and is **not** touched by this
  change. `makeEditable` replaces an entire composed block wholesale
  (`freeText[key].override`, consumed by `buildNarrative`, `draft.js:101-118`)
  and its text is never spliced into a `sentence()` template, so it has no
  "leading fragment inside a sentence" problem to normalize. `normalizeFragment`'s
  `leadsSentence` option exists for API completeness/future callers; every
  current `sentence()` template in `data.js` places its fragment argument
  mid-sentence (after some lead-in phrase), so the one call site added here
  (`commitManual`) always uses the default `leadsSentence:false`.
- **Acceptance:** For the `howKnown` prompt (FT-2), a manual entry of "I
  overheard my colleague discussing it" composes (via
  `buildNarrative(draft).ft2.text`) to exactly `"I know about it because I
  overheard my colleague discussing it."` — capital "I" preserved, NOT "...
  because i overheard...". For the same prompt, a manual entry of "A relative
  under-reported rental income for three years." composes to `"I know about it
  because a relative under-reported rental income for three years."` —
  lowercase first letter, no doubled/stray punctuation (the originally-reported
  bug). At the unit level, `normalizeFragment(' Some Text.  ')` returns
  `'some Text'` (only the leading character is lowercased, mid-string
  capitals untouched, trailing punctuation/whitespace stripped) and
  `normalizeFragment('I overheard.')` returns `'I overheard'` (capital "I"
  preserved, trailing period stripped).
- **Accessibility:** N/A (text composition only; the manual `<input>` already
  existed, TRD-3.2).
- **Static/local-only:** Pure string function; no network.

### TRD-5.6 — Home's scroll overflow: phase-menu disclosure (partial, bounded fix)

- **Files:** `index.html`, `styles.css`, `js/router.js` (boot()'s home-menu
  wiring, unaffected), `js/app.js` (`updateMenuGating`, unaffected).
- **Before:** Home's phase menu is a static, always-expanded
  `<ul class="home__menu">` of 4 buttons inside
  `<nav class="home__menu-wrap" aria-label="Jump to a section">`
  (`index.html:41-49`), stacked below the hero, reckoner and Start button and
  above `#save-control` (`index.html:36-56`). Measured live in a 390×844
  Chromium page: the real internal scroll container is `#app > main`
  (`overflow-y:auto`, inside a fixed-height `#app` shell — `styles.css:155-171`)
  — **not** `document.body`, which is pinned to `100dvh` and so cannot detect
  this overflow; TRD-1.1's original `document.body.scrollHeight <= 844`
  acceptance is trivially satisfied regardless of `main`'s internal content and
  does not actually catch this. On first load with an empty draft,
  `main.scrollHeight = 1488`, `main.clientHeight = 747` — an overflow of
  **741px**; with a mid-progress draft (readiness fully answered/gate passed,
  FT-1 partially drafted), `main.scrollHeight = 1418` — overflow **671px**.
- **After:** The phase-menu `<ul>` and its `#home-menu-hint` are wrapped in a
  `<details class="home__menu-disclosure">` / `<summary class="home__menu-summary">`,
  collapsed by default (no `open` attribute), with summary text **"Jump to a
  section — start with the readiness check"** — Readiness is named explicitly
  so a first-time user never reads the collapsed state as "nothing to do
  here." The `<summary>` reuses the existing `.transfer__empty-summary` sizing
  rules (`styles.css:1587-1599`: `min-height:44px`,
  `display:flex; align-items:center`, `cursor:pointer`, the default
  `::-webkit-details-marker` hidden) rather than new hand-authored CSS — add
  `.home__menu-summary` as a second selector alongside `.transfer__empty-summary`
  in that existing rule block (properties unchanged, a pure additional-selector
  reuse). Visible `:focus-visible` on the `<summary>` is already provided for
  free by the page-wide `:focus-visible` rule (`styles.css:143-147`, a
  universal selector), so no new focus CSS is needed. `#save-control`
  (`index.html:51`) is **not** touched, moved, or collapsed — it stays exactly
  where it is, always visible on Home without any tap/expand, per the PM's
  explicit rejection of hiding it behind a disclosure (it would contradict
  TRD-1.6's own acceptance bar, "A first-time user sees the save control + a
  privacy line on Home without opening anything," and undercut the product's
  honesty/trust pillar with an always-on-by-default persistence toggle buried
  behind a tap). `js/router.js`'s `boot()` menu-item click wiring
  (`router.js:213-217`) and `js/app.js`'s `updateMenuGating`
  (`app.js:91-108`, `querySelectorAll('.home__menu-item')`) need no change —
  they select by class, not DOM position, and keep working once the `<ul>`
  moves inside the `<details>`.

  Re-measured after applying only this change (menu collapsed, `#save-control`
  kept visible, nothing else on Home altered): `main.scrollHeight = 1232`,
  `main.clientHeight = 747` in both the empty-draft and mid-progress states —
  an overflow of **485px**, down from 741px/671px but **not zero**. This is an
  accepted, PM-approved, **Home-only** exception to the "no vertical scroll
  needed" rule stated elsewhere in this document (Overview; TRD-1.1's
  acceptance), because Home uniquely carries the money-hook hero, the
  reckoner, Start, and the trust-critical save-control above any modal, and
  the PM-approved scope for this item is explicitly "partial/bounded," not
  full elimination.

  **Additional finding**, re-measuring every screen with the stricter
  `main.scrollHeight`/`main.clientHeight` method rather than
  `document.body.scrollHeight`: every other core screen also shows nonzero
  internal overflow at 390×844 under realistic content, not just Home — e.g.
  (empty-draft state) Readiness 108px, Redirect 264px, Part 1 799px, Part 2
  716px, Assembly 903px, Transfer 2514px; a mid-progress draft (readiness
  answered, FT-1/FT-2 partially drafted) shows even larger figures on
  Readiness (2091px, from the growing "Checked so far" summary list) and
  Transfer (2230px). **This is a pre-existing condition, not introduced or
  worsened by this TRD** — IP-5 makes no DOM/CSS change to Readiness,
  Redirect, Part 1, Part 2, Assembly or Transfer, so nothing here can regress
  them, and no item in this TRD touches their layout (the global "no further…
  layout changes beyond Home" constraint, restated in Out of scope, forbids
  fixing them here). It is flagged rather than silently accepted because the
  improvement list's premise — that those screens are "currently passing" a
  zero-internal-scroll bar — does not hold under this stricter, more honest
  measurement method; a future phase should re-scope those screens (likely
  candidates: trimming the readiness "Checked so far" summary list's
  verbosity, and Transfer's cheat-sheet/copy-block density) using the same
  `main.scrollHeight`/`clientHeight` method used here, not
  `document.body.scrollHeight`.
- **Implementation notes:** `<details>`/`<summary>` needs no JS to open/close
  (native behaviour); `updateMenuGating`'s existing `.home__menu-item`
  disabled/`aria-disabled` handling is unaffected by the wrapping.
- **Acceptance:** `<details class="home__menu-disclosure">` renders collapsed
  on first paint (no `open` attribute); the `<summary>` text reads exactly
  "Jump to a section — start with the readiness check"; tapping/Entering the
  summary reveals the 4 phase-menu buttons + hint; `<summary>` is ≥44px with a
  visible focus ring on keyboard focus. `#save-control` remains visible and
  un-hidden on Home with zero taps, in both the collapsed and expanded
  disclosure states. Home's `main.scrollHeight − main.clientHeight` measures
  **≈485px** post-fix (down from **≈741px** empty-draft / **≈671px**
  mid-progress pre-fix) at 390×844 — the figures a coding agent should
  reproduce and re-report if its implementation differs materially. Readiness,
  Redirect, Part 1, Part 2, Assembly and Transfer are unchanged by this item
  (no file listed here touches them) — re-verify their pre-existing overflow
  figures are unchanged after this TRD ships (no accidental regression); do
  not attempt to zero them out here.
- **Accessibility:** `<details>`/`<summary>` is natively keyboard-operable
  (Enter/Space toggles, no ARIA needed) and exposed to assistive tech as a
  disclosure by role; `<summary>` ≥44px with visible `:focus-visible`
  (inherited, no new rule); collapsing does not remove the 4 menu buttons from
  the DOM, only visually hides them until expanded (native `<details>`
  behaviour).
- **Static/local-only:** Pure DOM/CSS; no network.

### TRD-5.7 — Trim duplicate field-label text on Part 1/Part 2; preserve (and add) the "app writes the words" tagline

- **Files:** `index.html`.
- **Before:** `#screen-part1`'s static `.screen__lead` (`index.html:78-82`)
  reads "Here we help you draft the form's field: **"Provide as much detail as
  possible about the tax evasion or tax fraud."** You choose; the app writes
  the words." — but `js/builders.js`'s `renderBuilder` already renders this
  exact field name as its own element pair, `.builder__field-label`
  ("Drafting the form field:") + `.builder__field-name` ("“Provide as much
  detail as possible about the tax evasion or tax fraud.”")
  (`builders.js:394-397`), inside `#builder-ft1`. The quoted label appears
  twice on the same screen. `#screen-part2`'s `.screen__lead`
  (`index.html:90-93`) has the same duplication with FT-2's label, and —
  unlike Part 1 — carries no tagline at all.
- **After:** Part 1's `.screen__lead` is trimmed to just its non-duplicated
  tagline: `<p class="screen__lead">You choose; the app writes the
  words.</p>`. Part 2 gains the same tagline (or an equivalent), since it
  currently has none and this is a cheap, in-scope addition at the same spot:
  `<p class="screen__lead">You choose; the app writes the words.</p>`. The
  "Here we help you draft the form's field: “…”" lead-in and quoted label are
  removed from both screens' static markup; `js/builders.js`'s
  `.builder__field-label`/`.builder__field-name` remain the sole on-screen
  source of the field name (unchanged).
- **Implementation notes:** The tagline is kept as static markup
  (`<p class="screen__lead">`) rather than moved into `builders.js`, since it
  is identical, static, non-draft-dependent copy — simplest change, no
  JS/render-contract touch. `<h2>` and `.part__timebox` on both screens are
  unaffected.
- **Acceptance:** Part 1 and Part 2 each show the quoted field-label text
  exactly once (from `.builder__field-name`), not twice; Part 1's "You choose;
  the app writes the words." tagline is still present verbatim; Part 2 now
  shows the same (or an equivalent) tagline where it previously had none.
- **Accessibility:** No heading/landmark structure change; text-only edit.
- **Static/local-only:** Pure markup; no network.

### TRD-5.8 — Shorten the inline per-step Next label; step-counter line unchanged

- **Files:** `js/checklist.js`, `js/builders.js`.
- **Before:** On every non-last step, `js/checklist.js`'s inline Next button
  reads "Next — N of M →" (`checklist.js:377-384`, e.g. "Next — 3 of 12 →"),
  and `js/builders.js`'s reads "Next prompt — N of M →"
  (`builders.js:528-536`) — both redundant with the separate, always-visible
  step-counter line rendered above the prompt ("Step N of M" in
  `checklist.js:198-200` / "Prompt N of M" in `builders.js:110-112`) and long
  enough to wrap to 3 lines on a 390px-wide button.
- **After:** Both inline Next buttons drop the "— N of M" suffix.
  `checklist.js`'s reads plain **"Next →"**; `builders.js`'s reads plain
  **"Next →"** (the separate step-counter line above the prompt still shows
  "Prompt N of M", so context is not lost, just not duplicated on the
  button). Once TRD-5.1's stepper wires the persistent bar's Next to call the
  same `advance` function as the inline Next on every non-last step, this
  shortened label automatically applies to the persistent bar too on those
  steps (`stepper.js`'s own default Next label is already the plain "Next →",
  so inline and persistent read identically).
- **Implementation notes:** The separate step-counter element/text itself is
  unchanged by this item — only the button label. On the last step,
  `checklist.js`'s finish label ("Check my readiness →") and `builders.js`'s
  "that is the last prompt…" note (`builders.js:538-543`) are unaffected.
- **Acceptance:** On any non-last readiness step, the inline Next button reads
  exactly "Next →"; on any non-last builder prompt, the inline Next button
  reads exactly "Next →"; the separate "Step N of M"/"Prompt N of M" line
  above the prompt is unchanged; at 390px width the inline Next button no
  longer wraps to 3 lines.
- **Accessibility:** Button text simplified only; ≥44px target unchanged.
- **Static/local-only:** Pure DOM text; no network.

### TRD-5.9 — Rename the shared step-counter CSS class per its two contexts

- **Files:** `js/checklist.js`, `js/builders.js`, `styles.css`.
- **Before:** A single class, `.checklist__step-counter`
  (`styles.css:1438-1445`), is used identically by `js/checklist.js`'s "Step N
  of M" line (`checklist.js:199`) and `js/builders.js`'s "Prompt N of M" line
  (`builders.js:111`) — same class, different content per context. Grep of the
  codebase shows these are the class's only two JS usages; nothing else
  queries it.
- **After:** `js/checklist.js` renames its usage to `readiness__step-counter`
  (`checklist.js:199`); `js/builders.js` renames its usage to
  `builder__step-counter` (`builders.js:111`), matching the codebase's
  existing `readiness__…`/`builder__…` naming convention (e.g.
  `.builder__field-label`, `.builder__jog`). `styles.css`'s rule
  (`styles.css:1438-1445`) becomes a single shared declaration block selected
  by both new class names: `.readiness__step-counter, .builder__step-counter { … }`
  — properties unchanged, a pure selector rename.
- **Implementation notes:** A rename only, not a restyle — same
  `margin`/`font-family`/`text-transform`/`letter-spacing`/`font-size`/`color`
  values, just reached via two class names instead of one shared one.
- **Acceptance:** Grep for `checklist__step-counter` across `js/*.js` and
  `styles.css` returns nothing; the readiness screen's step line has class
  `readiness__step-counter` and renders identically (same computed styles) to
  before; the builder screens' prompt line has class `builder__step-counter`
  and renders identically to before.
- **Accessibility:** N/A (class rename, no visual/text change).
- **Static/local-only:** Pure CSS/DOM; no network.

### TRD-5.10 — Document `priorIras`'s custom option labels as an intentional override

- **Files:** `js/data.js`.
- **Before:** `readiness.items`'s `priorIras` item (`data.js:161-167`)
  supplies its own three-option
  `options: ["Yes, already reported", "Not sure", "No, not yet"]`, unlike
  every other `kind:'verify'` item, which omits `options` and falls back to
  the generic `optionsFor()` triple "I have this" / "Not sure" / "No"
  (`checklist.js:55-66`). No comment explains why.
- **After:** Add an explanatory comment directly on the `priorIras` item
  definition (`data.js:161-167`) stating that the custom labels are a
  deliberate, allowed override — a yes/no history question ("Have you already
  reported this to IRAS before?") reads better with "Yes, already reported" /
  "No, not yet" than the generic verify triple — and that the underlying
  stored value tokens are unchanged from the standard verify-item contract
  (`optionsFor()` still maps the 3 custom labels to the same canonical
  `have`/`unsure`/`no` values by index, `checklist.js:56-62`), so
  `js/cheatsheet.js`'s `buildCheatSheet` (`cheatsheet.js:64`,
  `verify(a.priorIras, {have:'Yes', no:'No'})`) keeps working unchanged.
- **Implementation notes:** Comment-only change; no wording or behavioural
  change to the item, its options, its stored values, or
  `evaluateGate`/`buildCheatSheet`.
- **Acceptance:** `priorIras`'s definition in `data.js` carries a comment
  explaining the override is intentional; its `options` array, prompt text,
  hint text, and stored `have`/`unsure`/`no` mapping are byte-identical to
  before; `buildCheatSheet(draft)`'s "Reported this to IRAS before" row
  behaves unchanged.
- **Accessibility:** N/A (comment only).
- **Static/local-only:** Pure comment; no network.

### TRD-5.11 — Home's menu gating re-evaluates the gate live, never trusts the cache

- **Files:** `js/app.js`.
- **Before:** `menuReachable(draft)` (`app.js:74-85`) computes
  `readinessComplete` from `gate.evaluated && (gate.passed || gate.acknowledgedRedirect)`,
  where `gate.passed` is the CACHED boolean last written by `finishReadiness()`
  (`checklist.js:337-353`) or `acknowledgeRedirect()` (`app.js:192-205`) —
  whichever last ran. If a user later edits a previously-answered crucial
  readiness item (e.g. via a "Checked so far → Edit" link back into the
  stepper, `checklist.js:307-311`) in a way that would now fail the gate,
  `gate.passed` is never recomputed, so `menuReachable`/`updateMenuGating`
  (`app.js:91-108`) keep the Home phase-menu incorrectly unlocked on stale
  data.
- **After:** `menuReachable(draft)` imports and calls the existing, pure,
  already-exported `evaluateGate(draft)` (`js/gate.js:53-64`) fresh on every
  call, in place of reading `gate.passed`:
  `readinessComplete = !!(gate.evaluated && (evaluateGate(draft).passed || gate.acknowledgedRedirect))`.
  `gate.evaluated` (has the reader run the readiness finish action at least
  once) and `gate.acknowledgedRedirect` (a deliberate past choice to continue
  past a failed gate) both remain read from the cached `draft.readiness.gate`
  exactly as today — only the pass/fail check itself becomes live.

  This change is scoped only to `menuReachable`/`updateMenuGating` in
  `app.js` — it is **not** wired into readiness's stepper `finish.isEnabled`
  (TRD-5.1), which correctly stays on the narrower `readinessCrucialAnswered`
  (checking only the two non-multi crucial "who" items so the finish control
  can reach Redirect at all, per `gate.js`'s own comment, `gate.js:29-40`).
  These are two intentionally different checks serving two different purposes
  — Home-menu re-entry gating (this item) vs. "is the readiness stepper's
  finish control allowed to fire" (TRD-5.1) — and must not be unified.
- **Implementation notes:** `js/app.js` must import `evaluateGate` from
  `./gate.js` (alongside its existing `renderRedirect` import, `app.js:24`).
  Confirmed by reading `router.js`'s `FLOW` handling and `draft.js`: Part 1/
  Part 2/Assembly/Transfer's own internal Back/Next (governed entirely by
  `router.js`'s `FLOW` map) and every direct "go to my draft"-style CTA on
  those screens (`draft.js`'s "Start Part 1" / "Finish the other part" /
  "Draft this part" buttons, `draft.js:227, 241, 287`, each calling
  `showScreen(...)` directly) never call `menuReachable`/`updateMenuGating` —
  those functions are only ever invoked from `renderAll`/`renderDependent` to
  paint the Home menu's button states (`app.js:139-153, 293-347`), never
  consulted by in-flow navigation. So this live-gate change can never strand a
  user mid-work: it only controls whether Home's own phase-menu buttons are
  enabled for RE-ENTRY from Home, never whether in-progress work reached via
  the normal linear flow is reachable.
- **Acceptance:** With the gate previously evaluated and passing
  (`gate.evaluated:true, gate.passed:true` from a prior `finishReadiness()`
  run), then a crucial multi-select readiness answer (e.g. `taxTypes`) cleared
  afterward without re-running the finish action, Home's Part 1/Part 2/
  Review & Copy menu buttons become `disabled`/`aria-disabled` on the next
  render of Home — because `evaluateGate(draft).passed` is now freshly false
  and `acknowledgedRedirect` is false. A user already inside Part 1/Part 2 at
  that moment remains able to navigate Back/Next through their existing
  answers with no new restriction (per the implementation-notes verification
  above). With `acknowledgedRedirect:true` set (continued anyway past a failed
  gate) and the gate still failing live, the Home menu stays unlocked (sticky
  acknowledgement, unchanged behaviour).
- **Accessibility:** Unchanged — same `disabled`/`aria-disabled` mechanics as
  today (`app.js:97-104`).
- **Static/local-only:** Pure in-memory recomputation from
  `draft.readiness.answers`; no network, no new storage.

### TRD-5.12 — Document Redirect's Back-path as intentional (comment only)

- **Files:** `js/router.js`.
- **Before:** In the `FLOW` map (`router.js:26-34`), `part1.prev` is
  `'readiness'`, not `'redirect'`. So once a user reaches Redirect, taps
  "Continue anyway" (`acknowledgeRedirect`, `app.js:192-205`, →
  `showScreen('part1')`), and lands on Part 1, tapping the persistent Back
  returns to the last readiness step — never back to Redirect. No comment
  explains this is deliberate.
- **After:** Add a code comment on/near the
  `part1: { prev: 'readiness', next: 'part2' }` line (`router.js:30`) stating
  explicitly that this is confirmed intentional: `redirect` is a detour off
  the main linear Back-chain (reachable only via the readiness gate's fail
  branch — `finishReadiness`, `checklist.js:337-353` — never as a screen a
  user Back-navigates through), so `part1`'s Back always returns to
  `readiness`, by design, regardless of whether the user arrived via
  Redirect's "Continue anyway" or via a passing gate straight from Readiness.
- **Implementation notes:** Comment-only; the `FLOW` map's `part1.prev` value,
  and every other `FLOW` entry, is byte-identical before and after.
- **Acceptance:** The `FLOW` map carries the explanatory comment;
  `FLOW.part1.prev === 'readiness'` is unchanged; navigating Redirect →
  Continue anyway → Part 1 → Back still lands on Readiness (unchanged
  behaviour, now documented rather than accidental-looking).
- **Accessibility:** N/A (comment only).
- **Static/local-only:** Pure comment; no network.

### TRD-5.13 — `stepper.js` stays domain-generic (acceptance restatement, ties together TRD-5.1/5.11)

- **Files:** `js/stepper.js`, `js/checklist.js`.
- **Before:** N/A — this item restates, as its own explicit,
  independently-checkable acceptance gate, a design rule already implicit in
  TRD-5.1's implementation notes: `js/stepper.js` must never import from
  `js/gate.js`, must never import from `js/data.js`, and must contain no
  readiness/IRAS-specific branching of any kind.
- **After:** Unchanged from TRD-5.1's design — restated here because it is
  easy for a future edit to `stepper.js` (or a hasty implementation of
  TRD-5.1) to quietly reach for `evaluateGate`/`readinessCrucialAnswered`/
  `readiness.items` "just this once" for convenience. It must not. All
  pass→Part1 / fail→Redirect routing logic stays entirely inside
  `js/checklist.js`'s `finishReadiness()` (`checklist.js:337-353`,
  unchanged), which `stepper.js` only ever invokes via the generic
  `finish.onFinish` callback it was configured with — `stepper.js` itself does
  not know, and must never need to know, what that callback does or what a
  "readiness gate" is.
- **Implementation notes:** This is the same constraint TRD-5.11 relies on in
  the other direction — `evaluateGate` gets a second, live call site in
  TRD-5.11's `menuReachable` (`app.js`), entirely separate from and unaware of
  `stepper.js`; the two never need to coordinate, which is exactly the point
  of keeping `stepper.js` generic and putting all domain logic in the two call
  sites (`checklist.js`'s `finish.onFinish`/`finish.isEnabled`, and
  `app.js`'s `menuReachable`) instead.
- **Acceptance:** `grep -rn "from '\./gate\.js'" js/stepper.js` and
  `grep -rn "from '\./data\.js'" js/stepper.js` both return nothing;
  `grep -n "evaluateGate\|readinessCrucialAnswered\|readiness\.items\|freeTextBuilders" js/stepper.js`
  returns nothing; `js/stepper.js`'s only imports are from `js/router.js`
  (and, if needed, DOM/event-only helpers with no data-module dependency).
- **Accessibility:** N/A (structural/import constraint).
- **Static/local-only:** N/A (design constraint, not runtime behaviour).

---

## Out of scope

- No backend, build step, bundler, or new runtime dependency; no re-theming
  beyond existing tokens.
- No `SCHEMA_VERSION` break — the model grows additively at v1.
- No re-collection of the form's simple structured fields as pasteable prose
  (verified + reminded only).
- No official IRAS branding/mimicry; no form embedding; no auto-submit or file
  upload.
- No characterisation of conduct or prediction of outcomes; money is always
  "up to ~S$…".
- No clipboard-engine rewrite (reuse `clipboard.writeText`); no reckoner
  free-text entry (bands stay tap-only).
- Legal/content accuracy of IRAS facts is carried forward; only the two-free-text
  focus + readiness verification replace the invented field mapping.

**IP-5 additionally excludes:**

- No new readiness/free-text prompt content and no IRAS field-mapping changes
  — every IP-5 fix is navigational, textual-consistency, or comment-only.
- No desktop/1440px-specific layout changes.
- No further colour/contrast token changes beyond what IP-1..4 already
  verified passing — no rule touched in IP-5 changes a colour or contrast
  token.
- No new `ReportDraft`/`SCHEMA_VERSION` fields — IP-5 changes only how one
  existing field (`readiness.gate.passed`, via a live `evaluateGate` call,
  TRD-5.11) is READ, not the schema; `SCHEMA_VERSION` stays 1.
- No telemetry or analytics of any kind.
- `js/stepper.js`'s public API is exactly
  `{screenName, total, firstIndex, renderStep, onIndexChange, finish}` — no
  additional options.
- `js/gate.js` and `js/cheatsheet.js` are not modified by IP-5 at all —
  TRD-5.1 uses the Redirect screen's existing control-bar wiring (which
  actually lives in `app.js`, not `gate.js`) only as a reference pattern;
  TRD-5.11 only calls `gate.js`'s already-exported, unmodified `evaluateGate`;
  `js/cheatsheet.js` is untouched (TRD-5.10 only comments `data.js`, which
  `cheatsheet.js` reads from, unchanged).
- Other screens' pre-existing internal-scroll overflow (TRD-5.6's "additional
  finding") is out of scope for IP-5 to fix — flagged for a future phase, not
  remediated here.
