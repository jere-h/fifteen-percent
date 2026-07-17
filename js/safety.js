// safety.js — Renders the persistent Safety panel.
//
// Honest device-trail caveats + a plain-language DISCLAIMER that progress is
// saved on this device only (never a toggle — on-device saving is the whole
// point of the tool, so there is nothing to switch off) + a one-tap "Clear my
// data" button. Caveat copy is present and legible regardless of theme;
// nothing here is hidden at rest.
//
// Contract:
//   export function renderSafety(rootEl, onClear) -> void
// Imports store.js only. app.js wires onClear to store.clear() +
// renderAll(createEmptyDraft()).

import { storageAvailable } from './store.js';

// Honest, plain-language device-trail caveats. Local-only is not anonymous:
// clearing this page does NOT erase these separate trails.
const CAVEATS = [
  'This page runs only in your browser. It never sends what you type to any server.',
  'Browser history still records that you opened this page. Clearing here does not remove that.',
  'Autofill and saved form data may keep copies of what you typed, outside this page.',
  'On a shared or borrowed device, cached files can let someone else recover this page.',
  'Your network provider or workplace can log that you visited, even in private mode.',
  'Local-only is not anonymous. To leave the least trace, use your own device and clear browser history afterwards.',
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * Render the Safety panel into rootEl (#safety).
 * @param {HTMLElement} rootEl
 * @param {() => void} onClear  invoked when the user taps "Clear my data"
 */
export function renderSafety(rootEl, onClear) {
  if (!rootEl) return;

  rootEl.textContent = '';

  const panel = el('section', 'safety');
  panel.setAttribute('aria-label', 'Safety and privacy');

  const eyebrow = el('p', 'eyebrow', 'Your safety');
  panel.appendChild(eyebrow);

  const heading = el('h2', 'safety__heading', 'Before you start, read this');
  heading.id = 'safety-panel-title'; // labels the safety dialog (modal.js)
  heading.tabIndex = -1; // focus target when opened as a dialog
  panel.appendChild(heading);

  // --- Honest device-trail caveats ---------------------------------------
  const caveats = el('ul', 'safety__caveats');
  caveats.setAttribute('role', 'list');
  for (const line of CAVEATS) {
    caveats.appendChild(el('li', 'safety__caveat', line));
  }
  panel.appendChild(caveats);

  // --- On-device saving disclaimer (not a toggle) -------------------------
  // Saving on this device is the whole point of the tool, so there is nothing
  // to switch off. This is a reassurance, not a choice.
  const canStore = storageAvailable();
  const disclosure = el('div', 'safety__disclaimer');
  disclosure.appendChild(
    el('span', 'safety__disclaimer-title', 'Saved on this device only')
  );
  disclosure.appendChild(
    el(
      'span',
      'safety__disclaimer-help',
      canStore
        ? 'Your answers are kept in this browser so you can close the tab and come back — they are never sent to any server. Anyone using this device could open them, so use "Clear my data" below when you are done.'
        : 'Storage is unavailable in this browser (private mode or full), so your work stays in memory only and will not survive a reload. Nothing is ever sent anywhere.'
    )
  );
  panel.appendChild(disclosure);

  // --- One-tap Clear my data ---------------------------------------------
  const clearWrap = el('div', 'safety__clear-wrap');

  const clearBtn = el('button', 'safety__clear', 'Clear my data');
  clearBtn.type = 'button';
  clearBtn.addEventListener('click', () => {
    if (typeof onClear === 'function') onClear();
  });

  const clearNote = el(
    'p',
    'safety__clear-note',
    'Wipes everything you entered here and returns this page to empty. It cannot undo the browser and network trails above.',
  );

  clearWrap.appendChild(clearBtn);
  clearWrap.appendChild(clearNote);
  panel.appendChild(clearWrap);

  rootEl.appendChild(panel);
}

/**
 * Render the compact, always-visible on-device saving DISCLAIMER near the flow
 * — the product's answer to IRAS's unsaveable 15-minute session. It is a
 * reassurance, never a toggle: saving on the device is the whole point, so
 * there is nothing to switch off. Nothing is ever transmitted.
 * @param {HTMLElement} rootEl
 */
export function renderSaveControl(rootEl) {
  if (!rootEl) return;
  rootEl.textContent = '';

  const canStore = storageAvailable();

  const note = el('p', 'save-disclaimer');

  const icon = el('span', 'save-disclaimer__icon', '🔒');
  icon.setAttribute('aria-hidden', 'true');
  note.appendChild(icon);

  const text = el('span', 'save-disclaimer__text');
  text.appendChild(
    el('span', 'save-disclaimer__title', 'Saved on this device only — never sent anywhere.')
  );
  text.appendChild(
    el(
      'span',
      'save-disclaimer__help',
      canStore
        ? 'Close the tab and pick up where you left off. Your answers stay in this browser; nothing reaches any server.'
        : 'This browser is in private mode or full, so your work stays in memory only and will not survive a reload. Nothing reaches any server either way.'
    )
  );
  note.appendChild(text);

  rootEl.appendChild(note);
}
