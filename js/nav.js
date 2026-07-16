// nav.js — Turns the page into one-screen-at-a-time views instead of a single
// long scroll, matching the PRD's "one primary action per screen" rule.
//
// Purely presentational: toggles [hidden] on the .view panels and
// aria-selected on the matching .stepnav__tab. Does not touch any section's
// rendered content, so app.js/reckoner.js/checklist.js etc. are untouched.

const VIEWS = ['hook', 'checklist', 'draft', 'transfer'];

function showView(name) {
  if (!VIEWS.includes(name)) return;

  VIEWS.forEach((view) => {
    const panel = document.getElementById('view-' + view);
    const tab = document.getElementById('tab-' + view);
    const active = view === name;
    if (panel) panel.hidden = !active;
    if (tab) tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  const main = document.querySelector('main');
  if (main) main.scrollTo({ top: 0, behavior: 'auto' });
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function boot() {
  document.querySelectorAll('.stepnav__tab').forEach((tab) => {
    tab.addEventListener('click', () => showView(tab.dataset.view));
  });

  document.querySelectorAll('.view__next').forEach((btn) => {
    btn.addEventListener('click', () => showView(btn.dataset.next));
  });

  showView('hook');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
