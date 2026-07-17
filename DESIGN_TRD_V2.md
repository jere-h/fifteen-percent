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
