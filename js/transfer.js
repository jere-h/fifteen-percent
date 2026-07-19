// transfer.js — Transfer / End: the copy-into-the-form surface (IP-4).
//
// The OLD hallucinated per-field mapping (one invented "IRAS field label" per
// checklist answer, keyed off transferMap) is GONE. The real, honest output is:
//   - TWO prominent Copy blocks, one per hard free-text field (FT-1 "what
//     happened", FT-2 "how/when you became aware"), each headed with its EXACT
//     form field name so the reader knows exactly where to paste it;
//   - a READ-ONLY readiness cheat-sheet (reminders of what to SELECT in the
//     form — never pasteable prose, no Copy buttons);
//   - a "You're ready" recognition block with the honest reward phrase and the
//     three next steps (paste / select / attach);
//   - a local Save-as-document download (no network) and an Open-IRAS new-tab
//     link (plain navigation, no user data in the URL).
//
// This module never contacts, submits to, or uploads anything to IRAS. Copying
// is a local clipboard write; saving is a local Blob/data-URI download; opening
// IRAS is user navigation in a new tab.
//
// Contract (UNCHANGED signature): export function renderTransfer(rootEl, draft).

import { buildNarrative, renderCheatSheet } from './draft.js';
import { money, iras } from './data.js';
import { downloadDocument } from './save-doc.js';
import { writeText } from './clipboard.js';
import { showScreen } from './router.js';

const KEYS = ['ft1', 'ft2'];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function announce(message) {
  const live = document.getElementById('sr-live');
  if (live) live.textContent = message;
}

// -------------------------------------------------------------------- toast
// One shared, accessible toast (role=status, aria-live=polite). Every message is
// honest: "Copied" shows ONLY after writeText resolves true; a failure shows
// "Copy failed…" and selects the on-screen text so the reader can copy it by
// hand; an empty block shows the neutral "Nothing to copy yet".

let toastEl = null;
let toastTimer = null;

function ensureToast() {
  if (toastEl && document.body && document.body.contains(toastEl)) return toastEl;
  toastEl = el('div', 'toast');
  toastEl.setAttribute('role', 'status');
  toastEl.setAttribute('aria-live', 'polite');
  if (document.body) document.body.appendChild(toastEl);
  return toastEl;
}

function paintToast(variant, message) {
  const t = ensureToast();
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  t.className = 'toast toast--' + variant;
  t.textContent = '';
  t.appendChild(el('span', 'toast__text', message));
  announce(message);
  toastTimer = setTimeout(function () {
    t.className = 'toast';
    toastTimer = null;
  }, 3200);
}

function showToast(message) {
  paintToast('copied', message);
}

function showFailedToast(message) {
  paintToast('failed', message);
}

function showNeutralToast(message) {
  paintToast('neutral', message);
}

// Select the on-screen text of a Copy block so the reader can copy it manually
// when the clipboard write is blocked (file:// with no permission, etc.).
function revealSelectable(textEl) {
  if (!textEl) return;
  try {
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.selectNodeContents(textEl);
    sel.removeAllRanges();
    sel.addRange(range);
    if (typeof textEl.focus === 'function') {
      textEl.setAttribute('tabindex', '-1');
      textEl.focus();
    }
  } catch (e) {
    /* selection is a best-effort fallback */
  }
}

// Brief on-button confirmation so the feedback appears right where the reader
// clicked (the toast still fires for screen readers and peripheral vision).
function flashCopied(btn) {
  if (!btn) return;
  if (!btn.dataset.origLabel) btn.dataset.origLabel = btn.textContent;
  btn.classList.add('is-copied');
  btn.textContent = '✓ Copied';
  clearTimeout(btn.__copiedTimer);
  btn.__copiedTimer = setTimeout(function () {
    btn.classList.remove('is-copied');
    btn.textContent = btn.dataset.origLabel;
  }, 2000);
}

// The single copy path. Honest by construction: empty -> neutral toast, never
// "Copied"; a real write -> "Copied" only on a true resolution; a failure ->
// "Copy failed" + selectable fallback.
function doCopy(text, textEl, btn) {
  const value = text == null ? '' : String(text).trim();
  if (value === '') {
    showNeutralToast('Nothing to copy yet');
    return;
  }
  Promise.resolve(writeText(value)).then(
    function (ok) {
      if (ok) {
        showToast('Copied');
        flashCopied(btn);
      } else {
        showFailedToast('Copy failed. The text is selected, press ' + copyChord() + ' to copy it');
        revealSelectable(textEl);
      }
    },
    function () {
      showFailedToast('Copy failed. The text is selected, press ' + copyChord() + ' to copy it');
      revealSelectable(textEl);
    }
  );
}

function copyChord() {
  const mac =
    typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform || '');
  return mac ? '⌘C' : 'Ctrl+C';
}

// ------------------------------------------------------------- content bits

// The honest reward phrase from the single money source (personalised when the
// reckoner has an estimate, else the generic ceiling), always with the
// discretion caveat.
function rewardPhrase(draft) {
  const est = draft && draft.reckoner ? draft.reckoner.rewardEstimate : null;
  if (typeof est === 'number' && isFinite(est) && est > 0) {
    return money.phrase(est);
  }
  return money.ceilingPhrase + ", at IRAS's discretion (not guaranteed)";
}

// A neutral attachments reminder. The form handles attachments itself, so this
// simply prompts the reader to bring whatever they kept.
function attachmentSummary() {
  return 'Attach anything you kept: invoices, messages, records, screenshots. If you have nothing to attach, your written account is enough.';
}

// One Copy block for a free-text field: exact form-field heading, the composed
// text (selectable), and a Copy button.
function buildCopyBlock(key, block) {
  const section = el('section', 'transfer__block');

  const headId = 'transfer-block-head-' + key;
  const heading = el('h3', 'transfer__block-head');
  heading.id = headId;
  heading.appendChild(document.createTextNode('For the form field: '));
  heading.appendChild(el('span', 'transfer__block-field', '“' + block.label + '”'));
  section.appendChild(heading);

  const hasText = block.text && block.text.trim() !== '';

  const textEl = el('div', 'transfer__block-text');
  textEl.setAttribute('aria-labelledby', headId);
  if (hasText) {
    textEl.textContent = block.text;
  } else {
    textEl.classList.add('transfer__block-text--empty');
    textEl.textContent = 'Not drafted yet.';
  }
  section.appendChild(textEl);

  const actions = el('div', 'transfer__block-actions');
  const copyBtn = el('button', 'transfer__copy', 'Copy this text');
  copyBtn.type = 'button';
  copyBtn.setAttribute('aria-label', 'Copy the text for the form field: ' + block.label);
  copyBtn.addEventListener('click', function () {
    doCopy(hasText ? block.text : '', textEl, copyBtn);
  });
  actions.appendChild(copyBtn);

  if (!hasText) {
    const go = el('button', 'transfer__recognition-link', 'Draft this part');
    go.type = 'button';
    go.addEventListener('click', function () {
      showScreen(key === 'ft1' ? 'part1' : 'part2');
    });
    actions.appendChild(go);
  }

  section.appendChild(actions);
  return section;
}

// ------------------------------------------------------------- renderTransfer

/**
 * Render the Transfer / End screen into rootEl (#transfer).
 * @param {HTMLElement} rootEl
 * @param {object} draft
 */
export function renderTransfer(rootEl, draft) {
  if (!rootEl) return;
  const safe = draft || {};
  rootEl.innerHTML = '';

  const model = buildNarrative(safe);
  const filled = KEYS.filter((k) => model[k].text && model[k].text.trim() !== '');
  const bothReady = filled.length === KEYS.length;

  // --- Header -------------------------------------------------------------
  const header = el('header', 'transfer__header');
  header.appendChild(el('p', 'eyebrow', "You're ready"));
  const heading = el('h2', null, 'Your report is ready to file');
  heading.id = 'transfer-heading';
  heading.tabIndex = -1; // focus target on view switch (router)
  header.appendChild(heading);
  rootEl.appendChild(header);

  // --- You're ready + the three next steps + Save / Open actions ----------
  // Shown FIRST (issue 10): the streamlined path is "here's what to do next",
  // then the blocks to copy are right below.
  const ready = el('section', 'transfer__ready');

  const cue = el('p', 'transfer__ready-cue');
  cue.setAttribute('role', 'status');
  if (bothReady) {
    cue.textContent = 'Both answers are written. Open the IRAS form and do three things:';
  } else {
    cue.textContent =
      filled.length + ' of ' + KEYS.length + ' answers written so far. You can still open the form now. ';
    const link = el('button', 'transfer__recognition-link', 'Finish the other part');
    link.type = 'button';
    link.addEventListener('click', function () {
      showScreen(model.ft1.text.trim() !== '' ? 'part2' : 'part1');
    });
    cue.appendChild(link);
  }
  ready.appendChild(cue);

  ready.appendChild(el('p', 'transfer__ready-title', 'On the form:'));
  const steps = el('ol', 'transfer__ready-steps');
  const step1 = el('li');
  step1.appendChild(document.createTextNode('Paste your first answer into '));
  step1.appendChild(el('span', 'transfer__step-field', '“' + model.ft1.label + '”'));
  step1.appendChild(document.createTextNode(' and your second into '));
  step1.appendChild(el('span', 'transfer__step-field', '“' + model.ft2.label + '”'));
  step1.appendChild(document.createTextNode('. Both are just below.'));
  steps.appendChild(step1);
  steps.appendChild(el('li', null, 'Fill in the simple fields yourself. The recap at the bottom of this page lists what to have handy.'));
  const step3 = el('li');
  step3.appendChild(document.createTextNode('Attach your supporting files. ' + attachmentSummary()));
  steps.appendChild(step3);
  ready.appendChild(steps);

  ready.appendChild(
    el(
      'p',
      'transfer__ready-reward',
      'If IRAS recovers tax, you may get an informant reward: ' + rewardPhrase(safe) + '.'
    )
  );

  // Actions: Open IRAS (new tab, primary) + Save (local download). Neither transmits.
  const actions = el('div', 'transfer__actions');

  const openLink = el('a', 'btn btn--primary transfer__open', 'Open the IRAS form');
  openLink.href = iras.reportUrl;
  openLink.target = '_blank';
  openLink.rel = 'noopener noreferrer';
  actions.appendChild(openLink);

  const saveBtn = el('button', 'btn btn--secondary transfer__save', 'Save my report as a document');
  saveBtn.type = 'button';
  const saveStatus = el('p', 'transfer__save-status');
  saveStatus.setAttribute('role', 'status');
  saveStatus.setAttribute('aria-live', 'polite');
  saveBtn.addEventListener('click', function () {
    const ok = downloadDocument(safe);
    if (ok) {
      saveStatus.textContent =
        'Saved to your device as fifteen-percent-report.txt. Nothing was sent anywhere.';
    } else {
      saveStatus.textContent =
        'Could not start the download in this browser. Copy each block below instead.';
    }
  });
  actions.appendChild(saveBtn);

  ready.appendChild(actions);
  ready.appendChild(saveStatus);

  ready.appendChild(
    el(
      'p',
      'transfer__attach-note',
      'The form opens in a new tab. This tool is not affiliated with IRAS and never submits anything for you. You paste and attach everything yourself.'
    )
  );

  rootEl.appendChild(ready);

  // --- The two Copy blocks (right below the steps) ------------------------
  const fields = el('div', 'transfer__blocks');
  KEYS.forEach((key) => {
    fields.appendChild(buildCopyBlock(key, model[key]));
  });
  rootEl.appendChild(fields);

  // --- Read-only readiness recap (no Copy buttons) ------------------------
  rootEl.appendChild(renderCheatSheet(safe, 'transfer-cheatsheet'));
}
