// safety.js — Renders the persistent Safety panel.
//
// Honest device-trail caveats + the "Save my progress on this device" toggle
// (default ON — autosave, wired to store) which the user can switch off to
// run in-memory-only + a one-tap "Clear my data" button. Caveat copy is
// present and legible regardless of theme; nothing here is hidden at rest.
//
// Contract:
//   export function renderSafety(rootEl, onClear) -> void
// Imports store.js only. app.js wires onClear to store.clear() +
// renderAll(createEmptyDraft()).

import {
  isPersistenceEnabled,
  setPersistenceEnabled,
  storageAvailable,
} from './store.js';

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

// Keep every persistence toggle on the page (the surfaced control near the flow
// and the one inside the Safety panel) reflecting the single stored flag. One
// source of truth, no second storage key.
let syncBound = false;
function bindPersistenceSync() {
  if (syncBound) return;
  syncBound = true;
  document.addEventListener('persistence:changed', () => {
    const on = isPersistenceEnabled();
    document.querySelectorAll('.js-persistence-toggle').forEach((box) => {
      if (box.checked !== on) box.checked = on;
    });
  });
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
  panel.appendChild(heading);

  // --- Honest device-trail caveats ---------------------------------------
  const caveats = el('ul', 'safety__caveats');
  caveats.setAttribute('role', 'list');
  for (const line of CAVEATS) {
    caveats.appendChild(el('li', 'safety__caveat', line));
  }
  panel.appendChild(caveats);

  // --- Persistence toggle (default on — autosave) -------------------------
  const toggle = el('label', 'safety__toggle');

  bindPersistenceSync();

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'safety__toggle-input js-persistence-toggle';
  const canStore = storageAvailable();
  checkbox.checked = canStore && isPersistenceEnabled();
  if (!canStore) checkbox.disabled = true;

  const toggleText = el('span', 'safety__toggle-label');
  toggleText.appendChild(el('span', 'safety__toggle-title', 'Save my progress on this device'));
  const helpText = canStore
    ? 'On by default, so you can leave and come back. Your answers are stored only in this browser — anyone using this device could then find them. Turn off to keep this session in memory only, and use "Clear my data" any time to wipe what is already saved.'
    : 'Storage is unavailable in this browser (private mode or full). Your work stays in memory only and will not survive a reload.';
  toggleText.appendChild(el('span', 'safety__toggle-help', helpText));

  toggle.appendChild(checkbox);
  toggle.appendChild(toggleText);

  checkbox.addEventListener('change', () => {
    setPersistenceEnabled(checkbox.checked);
    document.dispatchEvent(new CustomEvent('persistence:changed'));
  });

  panel.appendChild(toggle);

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
 * Render a compact, always-visible "save on this device only" control near the
 * flow (TRD-20) — the product's answer to IRAS's unsaveable 15-minute session.
 * Strictly gated on the same store.js flag as the Safety panel toggle; no
 * second storage key; nothing is transmitted.
 * @param {HTMLElement} rootEl
 */
export function renderSaveControl(rootEl) {
  if (!rootEl) return;
  bindPersistenceSync();
  rootEl.textContent = '';

  const canStore = storageAvailable();

  const toggle = el('label', 'save-control');

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'save-control__input js-persistence-toggle';
  checkbox.checked = canStore && isPersistenceEnabled();
  if (!canStore) checkbox.disabled = true;

  const text = el('span', 'save-control__text');
  text.appendChild(
    el(
      'span',
      'save-control__title',
      'Save my progress on this device only — nothing is sent'
    )
  );
  text.appendChild(
    el(
      'span',
      'save-control__help',
      canStore
        ? 'So you can close this and come back to where you left off. Stored only in this browser; anyone using this device could find it. Turn off any time to keep this session in memory only.'
        : 'Storage is unavailable in this browser (private mode or full), so your work stays in memory only and will not survive a reload.'
    )
  );

  toggle.appendChild(checkbox);
  toggle.appendChild(text);

  checkbox.addEventListener('change', () => {
    setPersistenceEnabled(checkbox.checked);
    document.dispatchEvent(new CustomEvent('persistence:changed'));
  });

  rootEl.appendChild(toggle);
}
