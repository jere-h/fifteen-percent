// js/draft.js
// Assembled Draft section for "Fifteen Percent".
//
// Turns the in-memory reportDraft into an editable plain-language narrative:
// a single lead paragraph plus a details table that mirrors the IRAS informant
// fields. Every line is inline-editable; edits are captured as overrides
// (narrativeOverride for the paragraph, fieldOverrides[draftKey] for a row) so
// Transfer Mode emits the hand-edited wording rather than the auto-composed
// text.
//
// buildNarrative(draft) is a pure function (no DOM) returning
//   { paragraph:string, detailsRows:Array<{label,value}> }
// for snapshot tests. With no answers the section renders the specific
// empty-state prompt 'Start the checklist to build your report' (the one
// warm-gradient-orb hero moment) rather than a blank area.
//
// Contract: exports buildNarrative(draft) and renderDraft(rootEl, draft, onEdit).
// draftKeys used for fieldOverrides match the answer field names so transfer.js
// can prefer the same override values.

import { money, fragmentFor } from './data.js';

// --- field model -----------------------------------------------------------
// Ordered to mirror the IRAS informant fields; each `key` doubles as the
// fieldOverrides draftKey shared with Transfer Mode.
const FIELDS = [
  { key: 'taxType', label: 'Type of tax', list: false },
  { key: 'offenceNature', label: 'Nature of the suspected offence', list: false },
  { key: 'taxpayerDetailsKnown', label: 'Details known about the person or business', list: false },
  { key: 'timePeriod', label: 'Time period involved', list: false },
  { key: 'evidenceInHand', label: 'Evidence currently in hand', list: true },
  { key: 'relationship', label: 'Your connection to the matter', list: false },
  { key: 'identifyForReward', label: 'Willing to be identified for a possible reward', list: false },
];

const REWARD_KEY = 'rewardEstimate';
const REWARD_LABEL = 'Indicative discretionary reward';

// --- pure helpers -----------------------------------------------------------

// Join fragments into a natural list: "a", "a and b", "a, b and c".
function joinList(items) {
  const arr = items.filter((s) => s != null && String(s).trim() !== '');
  if (arr.length === 0) return '';
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return arr[0] + ' and ' + arr[1];
  return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
}

// Resolve every field to a plain string, letting a saved per-field override
// win over the raw checklist answer.
function resolvedValues(draft) {
  const answers = (draft && draft.answers) || {};
  const overrides = (draft && draft.fieldOverrides) || {};
  const out = {};
  for (const f of FIELDS) {
    const raw = answers[f.key];
    let val;
    if (f.list) {
      val = Array.isArray(raw) && raw.length ? raw.join(', ') : '';
    } else {
      val = raw == null ? '' : String(raw);
    }
    const ov = overrides[f.key];
    if (ov != null && String(ov).trim() !== '') val = String(ov);
    out[f.key] = val;
  }
  // Reckoner reward, co-rendered with its discretionary disclaimer.
  const est = draft && draft.reckoner ? draft.reckoner.rewardEstimate : null;
  const rewardOv = overrides[REWARD_KEY];
  if (rewardOv != null && String(rewardOv).trim() !== '') {
    out[REWARD_KEY] = String(rewardOv);
  } else if (typeof est === 'number' && isFinite(est) && est > 0) {
    out[REWARD_KEY] = money.phrase(est);
  } else {
    out[REWARD_KEY] = '';
  }
  return out;
}

// Rows with their draftKey attached, used by both buildNarrative and renderDraft.
function detailRowsWithKeys(draft) {
  const v = resolvedValues(draft);
  const rows = [];
  for (const f of FIELDS) {
    if (v[f.key]) rows.push({ key: f.key, label: f.label, value: v[f.key] });
  }
  if (v[REWARD_KEY]) rows.push({ key: REWARD_KEY, label: REWARD_LABEL, value: v[REWARD_KEY] });
  return rows;
}

// Compose the lead paragraph from fluent per-option fragments (TRD-13) rather
// than splicing raw capitalised button labels. Reads the raw answers directly
// so each fragment can be looked up; the whole-paragraph hand edit lives in
// narrativeOverride (handled by buildNarrative).
function composeParagraph(draft) {
  const a = (draft && draft.answers) || {};
  const parts = [];

  const taxType = a.taxType;
  const offence = a.offenceNature;
  if (taxType || offence) {
    let opening = 'I would like to report a suspected tax offence';
    if (taxType) opening += ' relating to ' + fragmentFor('taxType', taxType);
    if (offence) {
      opening +=
        (taxType ? ', ' : ' ') +
        'specifically ' +
        fragmentFor('offenceNature', offence);
    }
    parts.push(opening + '.');
  }
  if (a.taxpayerDetailsKnown) {
    parts.push(
      'About who is involved, I have ' +
        fragmentFor('taxpayerDetailsKnown', a.taxpayerDetailsKnown) +
        '.'
    );
  }
  if (a.timePeriod) {
    parts.push('The conduct ' + fragmentFor('timePeriod', a.timePeriod) + '.');
  }
  const evidence = a.evidenceInHand;
  if (Array.isArray(evidence) && evidence.length) {
    const frags = evidence.map((e) => fragmentFor('evidenceInHand', e));
    parts.push('I currently hold ' + joinList(frags) + '.');
  }
  if (a.relationship) {
    parts.push(
      'I came to know about this ' +
        fragmentFor('relationship', a.relationship) +
        '.'
    );
  }
  if (a.identifyForReward) {
    parts.push(
      'On a possible reward, ' +
        fragmentFor('identifyForReward', a.identifyForReward) +
        '.'
    );
  }
  return parts.join(' ');
}

/**
 * Pure. Returns the plain-language draft as { paragraph, detailsRows }.
 * paragraph honours a saved narrativeOverride; detailsRows honour per-field
 * overrides. Snapshot-testable and DOM-free.
 */
export function buildNarrative(draft) {
  const safe = draft || {};
  const keyedRows = detailRowsWithKeys(safe);
  const detailsRows = keyedRows.map((r) => ({ label: r.label, value: r.value }));
  const override = safe.narrativeOverride;
  const paragraph =
    override != null && String(override).trim() !== ''
      ? String(override)
      : composeParagraph(safe);
  return { paragraph, detailsRows };
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

// Wire a contenteditable element to commit its trimmed text via `commit(text)`
// on blur (and Enter, when singleLine), only when the value actually changed.
function makeEditable(node, initial, singleLine, commit) {
  node.contentEditable = 'true';
  node.setAttribute('role', 'textbox');
  node.setAttribute('spellcheck', 'true');
  node.tabIndex = 0;
  node.textContent = initial;

  node.addEventListener('blur', () => {
    const next = node.textContent.replace(/\s+$/, '').trim();
    if (next !== String(initial).trim()) {
      commit(next);
    }
  });

  if (singleLine) {
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        node.blur();
      }
    });
  }
}

/**
 * Render the Assembled Draft into rootEl (#draft). Inline edits call
 * onEdit(patch) with a fully-merged override object so a shallow top-level
 * merge by the caller is safe, then dispatch 'draft:changed'.
 */
export function renderDraft(rootEl, draft, onEdit) {
  if (!rootEl) return;
  const safe = draft || {};
  const emit = typeof onEdit === 'function' ? onEdit : function () {};

  const { paragraph } = buildNarrative(safe);
  const keyedRows = detailRowsWithKeys(safe);
  const hasContent = keyedRows.length > 0 || (paragraph && paragraph.trim().length > 0);

  rootEl.innerHTML = '';

  const eyebrow = el('p', 'eyebrow', 'Assembled draft');
  rootEl.appendChild(eyebrow);

  const heading = el('h2', null, 'Your report, in plain words');
  heading.id = 'draft-heading';
  heading.tabIndex = -1; // TRD-8 focus target on view switch
  rootEl.appendChild(heading);

  if (!hasContent) {
    const empty = el('div', 'draft__empty');
    empty.setAttribute('role', 'status');
    empty.appendChild(el('p', null, 'Start the checklist to build your report'));
    // Actionable path forward, not a dead end (TRD-18).
    const cta = el('button', 'draft__empty-cta', 'Start the checklist');
    cta.type = 'button';
    cta.addEventListener('click', () => {
      const tab = document.getElementById('tab-checklist');
      if (tab) tab.click();
    });
    empty.appendChild(cta);
    rootEl.appendChild(empty);
    return;
  }

  // Framed partial state: recognise progress rather than showing a bare
  // fragment (TRD-15). answeredCount comes from the seven checklist fields.
  const total = FIELDS.length;
  const ready = FIELDS.reduce((acc, f) => {
    const raw = safe.answers && safe.answers[f.key];
    const filled = f.list
      ? Array.isArray(raw) && raw.length > 0
      : raw != null && String(raw).trim() !== '';
    return acc + (filled ? 1 : 0);
  }, 0);
  if (ready < total) {
    const partial = el('p', 'draft__recognition');
    partial.setAttribute('role', 'status');
    partial.appendChild(
      document.createTextNode(ready + ' of ' + total + ' answers so far. ')
    );
    const back = el('button', 'draft__recognition-link', 'Finish the checklist');
    back.type = 'button';
    back.addEventListener('click', () => {
      const tab = document.getElementById('tab-checklist');
      if (tab) tab.click();
    });
    partial.appendChild(back);
    partial.appendChild(
      document.createTextNode(' to fill in the rest — your draft grows as you go.')
    );
    rootEl.appendChild(partial);
  }

  const note = el(
    'p',
    'draft__note',
    'Tap any line to reword it. Your edits are kept and used by Transfer Mode.'
  );
  rootEl.appendChild(note);

  const container = el('div', 'draft');

  // Editable lead paragraph -> narrativeOverride.
  const p = el('div', 'draft__paragraph');
  p.setAttribute('aria-label', 'Editable report narrative');
  makeEditable(p, paragraph, false, (text) => {
    emit({ narrativeOverride: text });
    emitChanged();
  });
  container.appendChild(p);

  // Details table: one editable value per field -> fieldOverrides[draftKey].
  const table = el('div', 'draft__table');
  const currentOverrides = safe.fieldOverrides || {};

  for (const row of keyedRows) {
    const rowEl = el('div', 'draft__row');

    const label = el('div', 'draft__label', row.label);
    label.id = 'draft-label-' + row.key;
    rowEl.appendChild(label);

    const field = el('div', 'draft__field');
    field.setAttribute('aria-labelledby', label.id);
    makeEditable(field, row.value, true, (text) => {
      const merged = Object.assign({}, currentOverrides);
      if (text === '') {
        delete merged[row.key];
      } else {
        merged[row.key] = text;
      }
      emit({ fieldOverrides: merged });
      emitChanged();
    });
    rowEl.appendChild(field);

    table.appendChild(rowEl);
  }

  container.appendChild(table);
  rootEl.appendChild(container);
}
