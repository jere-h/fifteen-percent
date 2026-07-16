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

import { transferMap } from './data.js';
import { writeText } from './clipboard.js';
import { buildNarrative } from './draft.js';

let toastTimer = null;

// ---------------------------------------------------------------------------
// Value resolution
// ---------------------------------------------------------------------------

function formatMoney(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '';
  return 'S$' + Math.round(n).toLocaleString('en-SG');
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

export function renderTransfer(rootEl, draft) {
  if (!rootEl) return;
  rootEl.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'transfer';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'Transfer mode';
  wrap.appendChild(eyebrow);

  const heading = document.createElement('h2');
  heading.textContent = 'Copy into the IRAS form yourself';
  wrap.appendChild(heading);

  const intro = document.createElement('p');
  intro.textContent =
    'Each row below matches one field on the IRAS informant form. Copy the value across yourself when you are ready. This tool never sends anything to IRAS and never submits on your behalf.';
  wrap.appendChild(intro);

  const fields = (transferMap && transferMap.fields) || [];

  const list = document.createElement('div');
  list.className = 'transfer__fields';

  fields.forEach((field) => {
    const value = resolveValue(draft, field);

    const row = document.createElement('div');
    row.className = 'transfer__field';

    const label = document.createElement('div');
    label.className = 'transfer__label';
    label.textContent = field.irasLabel;
    row.appendChild(label);

    const valueEl = document.createElement('div');
    valueEl.className = 'transfer__value';
    if (value) {
      valueEl.textContent = value;
    } else {
      valueEl.textContent = 'Not provided yet';
      valueEl.setAttribute('data-empty', 'true');
    }
    row.appendChild(valueEl);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'transfer__copy';
    copyBtn.textContent = 'Copy';
    copyBtn.setAttribute('aria-label', 'Copy the value for ' + field.irasLabel);
    copyBtn.addEventListener('click', () => {
      doCopy(wrap, row, value);
    });
    row.appendChild(copyBtn);

    list.appendChild(row);
  });

  wrap.appendChild(list);

  // Whole-report fallback.
  const copyAll = document.createElement('button');
  copyAll.type = 'button';
  copyAll.className = 'transfer__copy-all';
  copyAll.textContent = 'Copy all as text';
  copyAll.addEventListener('click', () => {
    doCopy(wrap, wrap, buildAllText(draft));
  });
  wrap.appendChild(copyAll);

  // Live status toast (empty at rest, so no hidden text ships).
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  wrap.appendChild(toast);

  // Provenance marker for the field mapping.
  const verified = document.createElement('p');
  verified.className = 'transfer__verified';
  const when = transferMap && transferMap.lastVerified ? transferMap.lastVerified : 'an unrecorded date';
  verified.textContent = 'Field mapping last verified on ' + when + '. Manual copy-paste only.';
  wrap.appendChild(verified);

  rootEl.appendChild(wrap);
}
