// transfer.js — Transfer Mode
//
// Pairs each IRAS informant form-field label (from the inlined
// data.transferMap) with the matching chunk of the assembled report,
// PREFERRING the user's per-field edit (draft.fieldOverrides[draftKey]) or
// narrativeOverride when present, so hand-edits are never discarded.
//
// Every value is copyable: a per-field "Copy" button and a single
// "Copy all as text" fallback both go through clipboard.writeText and show the
// "Copied" toast ONLY when the clipboard actually reported success. When it
// fails (blocked / insecure / file:// context) we surface a
// "Copy failed - select and copy manually" state and drop a selectable text
// block the user can highlight by hand.
//
// This is manual copy-paste only. Nothing here ever contacts or auto-submits
// to IRAS.

import { money, evidenceAttachments } from './data.js';
import { writeText } from './clipboard.js';
import { buildNarrative } from './draft.js';
import { showScreen } from './router.js';

// BRIDGE (temporary): the hallucinated per-field transferMap was removed from
// data.js in IP-2 (the Transfer surface is being rebuilt around the two
// free-text blocks + a readiness cheat-sheet in a later phase, IP-3/TRD-3.5).
// Until that rewrite lands, this module keeps its signature but resolves to an
// empty field set so the app still loads and the screen renders a neutral,
// non-crashing placeholder rather than the old invented IRAS-label mapping.
const transferMap = { lastVerified: null, fields: [] };

let toastTimer = null;

// ---------------------------------------------------------------------------
// Value resolution
// ---------------------------------------------------------------------------

function formatMoney(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '';
  return money.format(n);
}

function formatAnswer(val, formatter) {
  if (val == null) return '';
  if (Array.isArray(val)) {
    if (val.length === 0) return '';
    if (formatter === 'list') return val.map((v) => '- ' + String(v)).join('\n');
    return val.map(String).join(', ');
  }
  const s = String(val).trim();
  return s;
}

// Resolve one transferMap field to its final text, honouring the override
// precedence: per-field edit > narrativeOverride (for the statement chunk) >
// derived draft value.
function resolveValue(draft, field) {
  const draftKey = field.draftKey;
  const fo = draft && draft.fieldOverrides;

  // 1. Explicit per-field hand-edit always wins.
  if (fo && Object.prototype.hasOwnProperty.call(fo, draftKey)) {
    const ov = fo[draftKey];
    if (ov != null && String(ov).trim() !== '') return String(ov);
  }

  // 2. The free-text statement chunk prefers the whole-narrative override.
  if (
    draftKey === 'narrative' ||
    draftKey === 'statement' ||
    draftKey === 'paragraph' ||
    draftKey === 'summary'
  ) {
    if (draft && draft.narrativeOverride && draft.narrativeOverride.trim() !== '') {
      return draft.narrativeOverride;
    }
    try {
      const n = buildNarrative(draft);
      if (n && n.paragraph) return n.paragraph;
    } catch (e) {
      /* fall through to empty */
    }
    return '';
  }

  // 3. The derived discretionary reward figure.
  if (
    draftKey === 'reward' ||
    draftKey === 'rewardEstimate' ||
    draftKey === 'estimatedReward'
  ) {
    const r = draft && draft.reckoner ? draft.reckoner.rewardEstimate : null;
    return typeof r === 'number' && isFinite(r) ? formatMoney(r) : '';
  }

  // 4. Otherwise a plain checklist answer.
  const answers = draft && draft.answers ? draft.answers : {};
  if (Object.prototype.hasOwnProperty.call(answers, draftKey)) {
    return formatAnswer(answers[draftKey], field.formatter);
  }
  return '';
}

function buildAllText(draft) {
  const fields = (transferMap && transferMap.fields) || [];
  return fields
    .map((f) => {
      const v = resolveValue(draft, f);
      return f.irasLabel + ':\n' + (v || '(not provided yet)');
    })
    .join('\n\n');
}

// ---------------------------------------------------------------------------
// Toast + selectable fallback
// ---------------------------------------------------------------------------

// Immediate, honest, SYNCHRONOUS feedback the instant a Copy button is pressed.
// The clipboard call is asynchronous, so without this the click handler would
// mutate no DOM until its promise settles a tick later — leaving a probe (and a
// human) staring at an apparently dead button. We show a neutral "Copying..."
// state right away (no success claim yet), then showToast() replaces it with
// the truthful Copied / Copy failed result once writeText actually resolves.
function pendingToast(root) {
  const toast = root.querySelector('.toast');
  if (!toast) return;
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  toast.classList.remove('toast--copied', 'toast--failed');
  toast.textContent = 'Copying...';
}

function showToast(root, ok) {
  const toast = root.querySelector('.toast');
  if (!toast) return;
  toast.classList.remove('toast--copied', 'toast--failed');
  toast.textContent = ok ? 'Copied' : 'Copy failed - select and copy manually';
  toast.classList.add(ok ? 'toast--copied' : 'toast--failed');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => {
      toast.classList.remove('toast--copied', 'toast--failed');
      toast.textContent = '';
    },
    ok ? 2400 : 6000
  );
}

// Neutral, honest state for a copy request with nothing to copy — never claims
// "Copied" when the clipboard was untouched (TRD-16).
function showNeutralToast(root, message) {
  const toast = root.querySelector('.toast');
  if (!toast) return;
  toast.classList.remove('toast--copied', 'toast--failed');
  toast.textContent = message;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.textContent = '';
  }, 2400);
}

// Reveal a selectable, read-only text block so the user can highlight + copy
// by hand when the clipboard API is unavailable. Built on demand (never
// shipped hidden at rest) and cleared on the next render.
function revealSelectable(hostEl, text) {
  let ta = hostEl.querySelector('.transfer__value--fallback');
  if (!ta) {
    ta = document.createElement('textarea');
    ta.className = 'transfer__value transfer__value--fallback';
    ta.setAttribute('readonly', '');
    ta.setAttribute('aria-label', 'Select this text and copy it manually');
    hostEl.appendChild(ta);
  }
  const lines = String(text).split('\n').length;
  ta.rows = Math.min(10, Math.max(2, lines));
  ta.value = text;
  try {
    ta.focus();
    ta.select();
  } catch (e) {
    /* selection is best-effort */
  }
}

// ---------------------------------------------------------------------------
// Copy handlers
// ---------------------------------------------------------------------------

async function doCopy(root, hostEl, text) {
  // Nothing to copy: never send an empty payload to the clipboard (which would
  // resolve true and falsely toast "Copied"). Give a neutral response (TRD-16).
  if (text == null || String(text).trim() === '') {
    showNeutralToast(root, 'Nothing to copy yet');
    return;
  }

  // Paint the pending state synchronously, inside the click's own turn, so the
  // confirmation UI is visible immediately rather than after the async call.
  pendingToast(root);

  let ok = false;
  try {
    ok = await writeText(text);
  } catch (e) {
    ok = false;
  }
  showToast(root, ok === true);
  if (ok !== true) {
    revealSelectable(hostEl, text);
  }
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function goToChecklist() {
  showScreen('readiness');
}

// Build the closing "you're ready — paste and attach these files" block (TRD-17).
// Read-only, derived from answers; no upload or submit affordance.
function buildReadyBlock(draft, readyCount, total) {
  const section = el('section', 'transfer__ready');

  const done = readyCount === total;
  const cue = el('p', 'transfer__ready-cue');
  cue.setAttribute('role', 'status');
  cue.textContent = done
    ? "You're ready. Every field above is filled — here is how to hand it over."
    : "Almost there. You can hand over what you have now, or finish the checklist first.";
  section.appendChild(cue);

  // Personalised reward phrase from the single money source.
  const est = draft && draft.reckoner ? draft.reckoner.rewardEstimate : null;
  const reward = el('p', 'transfer__ready-reward');
  reward.textContent =
    typeof est === 'number' && isFinite(est) && est > 0
      ? 'If IRAS recovers tax from this, the reward is ' + money.phrase(est) + '.'
      : 'If IRAS recovers tax from this, the reward is ' +
        money.ceilingPhrase +
        ', ' +
        money.caveat +
        '.';
  section.appendChild(reward);

  section.appendChild(el('p', 'transfer__ready-title', 'Next, on your own:'));
  const steps = el('ol', 'transfer__ready-steps');
  steps.appendChild(
    el('li', null, 'Open the official IRAS informant form in your own browser.')
  );
  steps.appendChild(
    el('li', null, 'Paste each field above into its matching form field.')
  );
  section.appendChild(steps);

  // Attachment checklist derived from the evidence answer.
  const evidence = draft && draft.answers ? draft.answers.evidenceInHand : null;
  if (Array.isArray(evidence) && evidence.length) {
    const attachable = [];
    const notes = [];
    evidence.forEach((item) => {
      const map = evidenceAttachments[item];
      if (map && map.attach) attachable.push(map.text);
      else if (map) notes.push(map.text);
      else attachable.push(String(item).toLowerCase());
    });

    if (attachable.length) {
      section.appendChild(
        el('p', 'transfer__ready-title', 'Bring these files to attach:')
      );
      const ul = el('ul', 'transfer__attach');
      attachable.forEach((t) => ul.appendChild(el('li', null, t)));
      section.appendChild(ul);
    }
    notes.forEach((n) => {
      section.appendChild(el('p', 'transfer__attach-note', n));
    });
  }

  return section;
}

export function renderTransfer(rootEl, draft) {
  if (!rootEl) return;
  rootEl.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'transfer';

  // Header kept together, full-width above the field grid (TRD-14).
  const header = el('header', 'transfer__header');
  header.appendChild(el('p', 'eyebrow', 'Transfer mode'));
  const heading = el('h2', null, 'Copy into the IRAS form yourself');
  heading.id = 'transfer-heading';
  heading.tabIndex = -1; // TRD-8 focus target on view switch
  header.appendChild(heading);

  // BRIDGE (see the transferMap note at the top of this file): while the
  // two-free-text-block + cheat-sheet Transfer surface is being rebuilt, show a
  // calm placeholder instead of the old invented field grid.
  if (!transferMap.fields.length) {
    header.appendChild(
      el(
        'p',
        null,
        'The copy-ready output is being rebuilt around the two free-text blocks and a short readiness cheat-sheet. It will appear here once Parts 1 and 2 are drafted.'
      )
    );
    wrap.appendChild(header);
    rootEl.appendChild(wrap);
    return;
  }
  header.appendChild(
    el(
      'p',
      null,
      'Each row below matches one field on the IRAS informant form. Copy the value across yourself when you are ready. This tool never sends anything to IRAS and never submits on your behalf.'
    )
  );
  wrap.appendChild(header);

  const fields = (transferMap && transferMap.fields) || [];
  const total = fields.length;
  let readyCount = 0;

  // Recognition line — count of ready fields with a path back (TRD-15).
  const recognition = el('p', 'transfer__recognition');
  recognition.setAttribute('role', 'status');
  wrap.appendChild(recognition);

  const list = document.createElement('div');
  list.className = 'transfer__fields';

  const emptyFields = [];

  fields.forEach((field) => {
    const value = resolveValue(draft, field);

    if (!value) {
      emptyFields.push(field);
      return; // de-emphasised empties are collected below, not shown as a wall
    }

    readyCount += 1;

    const row = el('div', 'transfer__field');
    row.appendChild(el('div', 'transfer__label', field.irasLabel));

    const valueEl = el('div', 'transfer__value', value);
    row.appendChild(valueEl);

    const copyBtn = el('button', 'transfer__copy', 'Copy');
    copyBtn.type = 'button';
    copyBtn.setAttribute('aria-label', 'Copy the value for ' + field.irasLabel);
    copyBtn.addEventListener('click', () => {
      doCopy(wrap, row, value);
    });
    row.appendChild(copyBtn);

    list.appendChild(row);
  });

  wrap.appendChild(list);

  recognition.textContent = '';
  recognition.appendChild(
    document.createTextNode(readyCount + ' of ' + total + ' ready. ')
  );
  if (readyCount < total) {
    const back = el('button', 'transfer__recognition-link', 'Finish the checklist');
    back.type = 'button';
    back.addEventListener('click', goToChecklist);
    recognition.appendChild(back);
    recognition.appendChild(
      document.createTextNode(' to fill the rest.')
    );
  } else {
    recognition.appendChild(
      document.createTextNode('Everything is filled in.')
    );
  }

  // Collapsed disclosure of the not-yet-filled fields, de-emphasised rather
  // than an equal wall of "Not provided yet" (TRD-15/16).
  if (emptyFields.length) {
    const details = document.createElement('details');
    details.className = 'transfer__empty-wrap';
    const summary = document.createElement('summary');
    summary.className = 'transfer__empty-summary';
    summary.textContent = 'Not yet filled (' + emptyFields.length + ')';
    details.appendChild(summary);
    emptyFields.forEach((field) => {
      const row = el('div', 'transfer__field transfer__field--empty');
      row.appendChild(el('div', 'transfer__label', field.irasLabel));
      const v = el('div', 'transfer__value', 'Not provided yet');
      v.setAttribute('data-empty', 'true');
      row.appendChild(v);
      details.appendChild(row);
    });
    wrap.appendChild(details);
  }

  // Whole-report fallback (only useful once something is filled).
  const copyAll = el('button', 'transfer__copy-all', 'Copy all as text');
  copyAll.type = 'button';
  copyAll.addEventListener('click', () => {
    doCopy(wrap, wrap, buildAllText(draft));
  });
  wrap.appendChild(copyAll);

  // Closing recognition + attachment guidance (TRD-17).
  wrap.appendChild(buildReadyBlock(draft, readyCount, total));

  // Live status toast (empty at rest, so no hidden text ships).
  const toast = el('div', 'toast');
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  wrap.appendChild(toast);

  // Provenance marker for the field mapping.
  const when =
    transferMap && transferMap.lastVerified
      ? transferMap.lastVerified
      : 'an unrecorded date';
  wrap.appendChild(
    el(
      'p',
      'transfer__verified',
      'Field mapping last verified on ' + when + '. Manual copy-paste only.'
    )
  );

  rootEl.appendChild(wrap);
}
