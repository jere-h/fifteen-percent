// transfer.js — Transfer Mode (the copy-into-the-form surface).
//
// SCOPE NOTE (IP-3 / TRD-3.5): the old hallucinated per-field mapping (one
// invented "IRAS field label" per checklist answer) has been REMOVED along with
// its dataset. The real Transfer surface is being rebuilt around the TWO
// free-text blocks (each labelled with its EXACT form field name) plus a concise
// readiness "cheat-sheet" of what to select in the form — that build lands in
// IP-4. This module keeps its render-contract signature, references nothing from
// the deleted model, and renders a calm interim that points the reader at the
// two blocks they draft in Parts 1 and 2. It never contacts or submits to IRAS.
//
// Contract (UNCHANGED): export function renderTransfer(rootEl, draft).

import { buildNarrative } from './draft.js';
import { showScreen } from './router.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function renderTransfer(rootEl, draft) {
  if (!rootEl) return;
  rootEl.innerHTML = '';

  const wrap = el('div', 'transfer');

  const header = el('header', 'transfer__header');
  header.appendChild(el('p', 'eyebrow', 'Transfer mode'));
  const heading = el('h2', null, 'Copy into the IRAS form yourself');
  heading.id = 'transfer-heading';
  heading.tabIndex = -1; // focus target on view switch (router)
  header.appendChild(heading);
  header.appendChild(
    el(
      'p',
      null,
      'The copy-ready output is the two free-text blocks you draft in Parts 1 and 2, each labelled with its exact form field, plus a short readiness cheat-sheet. This tool never sends anything to IRAS and never submits on your behalf.'
    )
  );
  wrap.appendChild(header);

  // Interim recognition: how many of the two blocks are drafted, with a path
  // back to finish. The full copy UI + cheat-sheet assemble here in IP-4.
  const model = buildNarrative(draft);
  const keys = ['ft1', 'ft2'];
  const filled = keys.filter((k) => model[k] && model[k].text && model[k].text.trim() !== '');

  const recognition = el('p', 'transfer__recognition');
  recognition.setAttribute('role', 'status');
  recognition.appendChild(
    document.createTextNode(filled.length + ' of ' + keys.length + ' blocks drafted. ')
  );
  if (filled.length < keys.length) {
    const back = el('button', 'transfer__recognition-link', 'Draft the parts');
    back.type = 'button';
    back.addEventListener('click', () => showScreen('part1'));
    recognition.appendChild(back);
    recognition.appendChild(document.createTextNode(' to build them.'));
  } else {
    recognition.appendChild(
      document.createTextNode('Both blocks are ready to review and copy.')
    );
  }
  wrap.appendChild(recognition);

  rootEl.appendChild(wrap);
}
