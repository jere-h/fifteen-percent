// builders.js — shared helpers for the two free-text drafting Parts.
//
// IP-2 scope: single-source the timeboxed Part headers (name + "~N mins") from
// data.js `parts` so every Part screen visibly states its name and honest time
// estimate. The guided tap-to-draft bodies that fill #builder-ft1 / #builder-ft2
// land in a later phase; this module owns only the header/timebox for now.
//
// Pure DOM: no network, no storage.

import { parts } from './data.js';

// Apply one Part's name + estimate to its static <h2 tabindex="-1"> heading and
// restate the estimate in a small .part__timebox line beneath it. The heading is
// the router's focus target on screen switch, so we mutate its text in place
// rather than replacing the node.
function applyPart(key) {
  const cfg = parts && parts[key];
  if (!cfg) return;

  const heading = document.getElementById(key + '-heading');
  if (heading) {
    heading.textContent = cfg.name + ' — ' + cfg.estimate;
  }

  const timebox = document.getElementById(key + '-timebox');
  if (timebox) {
    const mins = String(cfg.estimate || '').replace(/[~]/g, '').trim();
    timebox.textContent = 'About ' + mins + ' — tap to choose, the app writes the words.';
  }
}

// Populate the Part 1 and Part 2 headers. Safe to call repeatedly (idempotent).
export function renderPartHeaders() {
  applyPart('part1');
  applyPart('part2');
}
