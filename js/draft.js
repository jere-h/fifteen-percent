// js/draft.js
// Assembled Draft (Review) section for "Fifteen Percent".
//
// Turns the in-memory reportDraft into the TWO paste-ready free-text blocks the
// IRAS form asks the reader to write in prose (FT-1 "what happened", FT-2 "how
// and when you became aware"). Each block is labelled with its EXACT form field
// name and shows the app-composed prose. The whole block is inline-editable; a
// hand edit is captured as freeText[key].override so it wins over the composed
// text without being lost.
//
// buildNarrative(draft) is a pure, DOM-free function returning the two-field
// model:
//   { ft1: { label, text }, ft2: { label, text } }
// where label is the exact form label from freeTextBuilders and text is composed
// by joining each prompt's sentence() over the stored REFINED answers (an unsure
// pick that was never refined stores nothing, so no "unsure" placeholder can
// ever be composed). A whole-block override wins over the composed text.
//
// Contract (UNCHANGED signatures): exports buildNarrative(draft) and
// renderDraft(rootEl, draft, onEdit).

import { freeTextBuilders } from './data.js';
import { buildCheatSheet, NOT_YET } from './cheatsheet.js';
import { showScreen } from './router.js';

// Final defensive backstop (TRD-3.4): even though an "unsure/not sure/rather not
// say" value is never STORED (the builder only commits refined fragments), drop
// any fragment or composed sentence that still matches, so such a placeholder can
// never reach a block. The primary guarantee lives in the builder + prompt tree.
const BANNED = /\b(unsure|not sure|rather not say)\b/i;

const KEYS = ['ft1', 'ft2'];

// A prompt's sentence() hard-codes a linking adverbial ("In particular,",
// "As for timing,", …) that presumes a preceding sentence. When an earlier
// prompt is skipped or abandoned, a later sentence can land FIRST in the block
// and open with a stranded connector. On the first emitted sentence only, strip
// a known leading connective and re-capitalise, so the block always opens with a
// clean standalone clause (IP3-2). Never alters banned-word handling.
const LEADING_CONNECTOR =
  /^(in particular,|as for timing,|as for others involved,|as far as i am aware,|on scale,)\s+/i;

function destrandFirst(sentence) {
  const stripped = sentence.replace(LEADING_CONNECTOR, '');
  if (stripped === sentence) return sentence;
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

// normalizeFragment (TRD-5.5): normalizes a raw, user-typed "Other — type it
// myself" manual entry so it splices cleanly into a sentence() template the
// same way every hand-authored `fragment` in data.js already does — trimmed,
// trailing .!? stripped, first letter lowercased. The ONE exception is
// mandatory, not cosmetic: a fragment that starts with the pronoun "I"
// (/^I\b/) is left exactly as typed. Several authored FT-2 `howKnown`
// fragments legitimately start with a capitalised "I" ("I saw it happen
// myself", "I handled the records or money involved", jog entry "I
// overheard it being discussed") because that prompt's sentence() template
// is "I know about it because " + f + "." — splicing in a lowercased "i"
// there would be a new, visible grammar bug in text meant to be pasted
// straight into a government form. `leadsSentence` is kept for API
// completeness for a future caller whose fragment opens its own sentence;
// every current sentence() template places its fragment argument
// mid-sentence, so builders.js's one call site always uses the default
// leadsSentence:false.
export function normalizeFragment(raw, { leadsSentence = false } = {}) {
  let s = String(raw == null ? '' : raw).trim();
  s = s.replace(/[.!?]+$/, '').trim();
  if (s && !leadsSentence && !/^I\b/.test(s)) {
    s = s.charAt(0).toLowerCase() + s.slice(1);
  }
  return s;
}

// --- pure composition -------------------------------------------------------

// Compose one free-text block from the stored refined answers. Joins each
// prompt's sentence() over its stored fragment (or array of fragments, for a
// multi prompt), omitting any prompt with no stored/refined value. Never emits a
// banned placeholder.
function composeBlock(draft, key) {
  const cfg = freeTextBuilders[key];
  if (!cfg || !Array.isArray(cfg.prompts)) return '';
  const ft = (draft && draft.freeText && draft.freeText[key]) || {};
  const answers = ft.answers && typeof ft.answers === 'object' ? ft.answers : {};

  const sentences = [];
  for (const prompt of cfg.prompts) {
    if (!prompt || !prompt.id || typeof prompt.sentence !== 'function') continue;
    const raw = answers[prompt.id];
    if (raw == null) continue;

    let val;
    if (Array.isArray(raw)) {
      const frags = raw
        .map((v) => (v == null ? '' : String(v).trim()))
        .filter((v) => v !== '' && !BANNED.test(v));
      if (!frags.length) continue;
      val = frags;
    } else {
      const s = String(raw).trim();
      if (s === '' || BANNED.test(s)) continue;
      val = s;
    }

    let sentence;
    try {
      sentence = prompt.sentence(val);
    } catch (err) {
      sentence = '';
    }
    if (sentence == null) continue;
    const clean = String(sentence).trim();
    if (clean === '' || BANNED.test(clean)) continue;
    sentences.push(sentences.length === 0 ? destrandFirst(clean) : clean);
  }
  return sentences.join(' ');
}

/**
 * Pure. Returns the two-field model:
 *   { ft1: { label, text }, ft2: { label, text } }
 * label = the exact form label from freeTextBuilders; text = the whole-block
 * override when non-empty, else the composed prose. DOM-free and
 * snapshot-testable. An empty draft yields empty text for both blocks.
 */
export function buildNarrative(draft) {
  const safe = draft || {};
  const out = {};
  for (const key of KEYS) {
    const cfg = freeTextBuilders[key];
    const label = cfg ? cfg.fieldLabel : '';
    const ft = (safe.freeText && safe.freeText[key]) || {};
    const override = ft.override;
    let text;
    if (override != null && String(override).trim() !== '') {
      text = String(override).trim();
    } else {
      text = composeBlock(safe, key);
    }
    out[key] = { label, text };
  }
  return out;
}

// --- DOM rendering ----------------------------------------------------------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function emitChanged() {
  document.dispatchEvent(new CustomEvent('draft:changed'));
}

// Wire a contenteditable element to commit its trimmed text via commit(text) on
// blur, only when the value actually changed. Shared pattern with the builder's
// manual input (TRD-3.2).
function makeEditable(node, initial, commit) {
  node.contentEditable = 'true';
  node.setAttribute('role', 'textbox');
  node.setAttribute('aria-multiline', 'true');
  node.setAttribute('spellcheck', 'true');
  node.tabIndex = 0;
  node.textContent = initial;

  node.addEventListener('blur', () => {
    const next = node.textContent.replace(/\s+$/, '').trim();
    if (next !== String(initial).trim()) {
      commit(next);
    }
  });
}

/**
 * Shared, read-only cheat-sheet renderer (TRD-4.2 consumed by TRD-4.1/4.3).
 * Turns the pure buildCheatSheet(draft) rows into a labelled description list of
 * reminders — what the reader will SELECT in the form. It is explicitly NOT
 * pasteable prose: no Copy buttons attach to it. `idPrefix` keeps the labelling
 * id unique across the two screens that both mount a cheat-sheet.
 * @param {object} draft
 * @param {string} idPrefix
 * @returns {HTMLElement}
 */
export function renderCheatSheet(draft, idPrefix) {
  const prefix = idPrefix || 'cheatsheet';
  const rows = buildCheatSheet(draft);

  const section = el('section', 'cheatsheet');
  section.setAttribute('aria-labelledby', prefix + '-title');

  const title = el('h3', 'cheatsheet__title', 'Before you open the form, be ready to:');
  title.id = prefix + '-title';
  section.appendChild(title);

  section.appendChild(
    el(
      'p',
      'cheatsheet__note',
      'A quick recap of your readiness check — not text to paste.'
    )
  );

  const list = el('dl', 'cheatsheet__list');
  rows.forEach((row) => {
    const item = el('div', 'cheatsheet__row');
    item.appendChild(el('dt', 'cheatsheet__label', row.label));
    const dd = el('dd', 'cheatsheet__value', row.value);
    if (row.value === NOT_YET) dd.classList.add('cheatsheet__value--pending');
    item.appendChild(dd);
    list.appendChild(item);
  });
  section.appendChild(list);

  return section;
}

/**
 * Render the two-block Review into rootEl (#draft). Each block shows its exact
 * IRAS form field label (an <h3>) and the app-written, inline-editable prose;
 * editing a block calls onEdit({ freeText: { ft1: { override } } }) with the
 * hand-edited text (empty string clears the override), then dispatches
 * 'draft:changed'. Below the two blocks, the read-only readiness cheat-sheet.
 */
export function renderDraft(rootEl, draft, onEdit) {
  if (!rootEl) return;
  const safe = draft || {};
  const emit = typeof onEdit === 'function' ? onEdit : function () {};

  const model = buildNarrative(safe);
  const filled = KEYS.filter((k) => model[k].text && model[k].text.trim() !== '');

  rootEl.innerHTML = '';

  rootEl.appendChild(el('p', 'eyebrow', 'Review your draft'));

  const heading = el('h2', null, 'Your two paste-ready blocks');
  heading.id = 'draft-heading';
  heading.tabIndex = -1; // focus target on screen switch (router)
  rootEl.appendChild(heading);

  // Recognition of progress: how many of the two blocks are drafted, with a path
  // back to finish the other. Shown above the blocks in every non-complete state.
  if (!filled.length) {
    const empty = el('div', 'draft__empty');
    empty.setAttribute('role', 'status');
    empty.appendChild(el('p', null, 'Draft the two parts to build your report'));
    const cta = el('button', 'draft__empty-cta', 'Start Part 1');
    cta.type = 'button';
    cta.addEventListener('click', () => {
      showScreen('part1');
    });
    empty.appendChild(cta);
    rootEl.appendChild(empty);
  } else if (filled.length < KEYS.length) {
    const partial = el('p', 'draft__recognition');
    partial.setAttribute('role', 'status');
    partial.appendChild(
      document.createTextNode(filled.length + ' of ' + KEYS.length + ' blocks drafted so far. ')
    );
    const missing = model.ft1.text.trim() !== '' ? 'part2' : 'part1';
    const back = el('button', 'draft__recognition-link', 'Finish the other part');
    back.type = 'button';
    back.addEventListener('click', () => {
      showScreen(missing);
    });
    partial.appendChild(back);
    partial.appendChild(document.createTextNode(' — your report grows as you go.'));
    rootEl.appendChild(partial);
  }

  // The two editable blocks (only when at least one has content — an all-empty
  // draft shows just the CTA above plus the cheat-sheet below).
  if (filled.length) {
    rootEl.appendChild(
      el(
        'p',
        'draft__note',
        'Tap a block to reword it. Your edits are kept and used when you copy into the form.'
      )
    );

    const container = el('div', 'draft');

    KEYS.forEach((key) => {
      const block = model[key];
      const section = el('section', 'draft__block');

      // The EXACT IRAS form field label (an <h3>) so the reader knows where each
      // block goes, and so the editable body can be labelled by it.
      const labelId = 'draft-block-label-' + key;
      const labelEl = el('h3', 'draft__block-label', 'Form field: “' + block.label + '”');
      labelEl.id = labelId;
      section.appendChild(labelEl);

      const hasText = block.text && block.text.trim() !== '';
      if (hasText) {
        const body = el('div', 'draft__block-text');
        body.setAttribute('aria-labelledby', labelId);
        makeEditable(body, block.text, (text) => {
          emit({ freeText: { [key]: { override: text } } });
          emitChanged();
        });
        section.appendChild(body);
      } else {
        const gap = el('p', 'draft__block-gap');
        gap.appendChild(document.createTextNode('Not drafted yet. '));
        const go = el('button', 'draft__recognition-link', 'Draft this part');
        go.type = 'button';
        go.addEventListener('click', () => {
          showScreen(key === 'ft1' ? 'part1' : 'part2');
        });
        gap.appendChild(go);
        section.appendChild(gap);
      }

      container.appendChild(section);
    });

    rootEl.appendChild(container);
  }

  // The read-only readiness cheat-sheet — reminders of what to SELECT in the
  // form (never pasteable prose, no Copy buttons).
  rootEl.appendChild(renderCheatSheet(safe, 'assembly-cheatsheet'));
}
