// reckoner.js — the tap-first band reckoner (TRD-4).
//
// Lets the user OPTIONALLY pick a rough band of recoverable tax as a single tap.
// The app maps the band to an honest "up to ~S$X" reward (top-of-band × 15%,
// capped at S$100,000) surfaced in the hero, the assembled draft and the
// closing Transfer block. Never required to advance, never any typing: every
// band is a real <button> in a single-select group.
//
// Contract: export function renderReckoner(rootEl, draft, onBand) -> void
// onBand(bandId) is called with the chosen band id (or null when the current
// band is tapped again to clear it). app.js persists it, recomputes the derived
// rewardEstimate and refreshes the hero figure.

import { rewardBands, money, estimateForBand } from './data.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * Render the band selector into rootEl (#reckoner).
 * @param {HTMLElement} rootEl
 * @param {object} draft
 * @param {(bandId: string|null) => void} onBand
 */
export function renderReckoner(rootEl, draft, onBand) {
  if (!rootEl) return;
  rootEl.textContent = '';

  const current =
    draft && draft.reckoner ? draft.reckoner.recoverableInput : '';

  const label = el(
    'p',
    'reckoner__label',
    'Roughly how much tax might have gone unpaid? Tap one to see your possible reward — optional, and you can skip it.'
  );
  label.id = 'reckoner-label';
  rootEl.appendChild(label);

  const group = el('div', 'reckoner__chips');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-labelledby', 'reckoner-label');

  rewardBands.forEach((band) => {
    const selected = current === band.id;
    const btn = el('button', 'reckoner__chip', band.label);
    btn.type = 'button';
    if (selected) btn.classList.add('reckoner__chip--selected');
    btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    btn.addEventListener('click', () => {
      const next = current === band.id ? null : band.id;
      if (typeof onBand === 'function') onBand(next);
    });
    group.appendChild(btn);
  });

  rootEl.appendChild(group);

  // Honest, personalised read-out (or the generic ceiling when unset / "not
  // sure"). role=status so a screen reader hears the figure change.
  const est = estimateForBand(current);
  const out = el('p', 'reckoner__estimate');
  out.setAttribute('role', 'status');
  if (typeof est === 'number' && est > 0) {
    out.textContent = 'Your possible reward: ' + money.phrase(est) + '.';
  } else {
    out.textContent =
      'Possible reward: ' +
      money.ceilingPhrase +
      ', ' +
      money.caveat +
      '. Pick a band above for a figure closer to your situation.';
  }
  rootEl.appendChild(out);
}
