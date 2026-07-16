// nav.js — one-screen-at-a-time views with a real WAI-ARIA tablist.
//
// Toggles [hidden] on the .view panels and aria-selected on the matching
// .stepnav__tab, and implements the tabs keyboard pattern (TRD-8):
//   - the three tabs are ONE tab stop (roving tabindex),
//   - Left/Right and Up/Down move focus between tabs, Home/End jump to ends,
//   - MANUAL activation: Enter/Space/click switches the view and moves focus
//     into the shown panel's heading, announced via a polite live region.
// The scroll reset honours prefers-reduced-motion. Purely presentational: no
// section render contract is touched.

const VIEWS = ['checklist', 'draft', 'transfer'];

function tabs() {
  return VIEWS.map((v) => document.getElementById('tab-' + v)).filter(Boolean);
}

function announce(name) {
  const live = document.getElementById('sr-live');
  if (!live) return;
  const labels = { checklist: 'Checklist', draft: 'Assembly', transfer: 'Transfer' };
  live.textContent = (labels[name] || name) + ', step view';
}

function setRoving(activeTab) {
  tabs().forEach((tab) => {
    tab.tabIndex = tab === activeTab ? 0 : -1;
  });
}

function showView(name, moveFocus) {
  if (!VIEWS.includes(name)) return;

  VIEWS.forEach((view) => {
    const panel = document.getElementById('view-' + view);
    const tab = document.getElementById('tab-' + view);
    const active = view === name;
    if (panel) panel.hidden = !active;
    if (tab) tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  const activeTab = document.getElementById('tab-' + name);
  if (activeTab) setRoving(activeTab);

  // Instant scroll reset; never animate under reduced-motion (TRD-21). The
  // reset is already behavior:'auto', so this is inherently motion-free.
  const main = document.querySelector('main');
  if (main) main.scrollTo({ top: 0, behavior: 'auto' });
  window.scrollTo({ top: 0, behavior: 'auto' });

  if (moveFocus) {
    // Move focus into the newly shown panel's heading (rendered by the section
    // modules with tabindex=-1) and announce the change.
    const heading = document.getElementById(name + '-heading');
    if (heading && typeof heading.focus === 'function') {
      heading.focus();
    }
    announce(name);
  }
}

function moveTabFocus(fromTab, delta) {
  const list = tabs();
  const idx = list.indexOf(fromTab);
  if (idx === -1) return;
  const nextIdx = (idx + delta + list.length) % list.length;
  const nextTab = list[nextIdx];
  setRoving(nextTab);
  nextTab.focus();
}

function boot() {
  document.querySelectorAll('.stepnav__tab').forEach((tab) => {
    tab.addEventListener('click', () => showView(tab.dataset.view, true));
    tab.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        moveTabFocus(tab, 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        moveTabFocus(tab, -1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        const list = tabs();
        if (list[0]) {
          setRoving(list[0]);
          list[0].focus();
        }
      } else if (e.key === 'End') {
        e.preventDefault();
        const list = tabs();
        const last = list[list.length - 1];
        if (last) {
          setRoving(last);
          last.focus();
        }
      }
      // Enter/Space activate the focused tab via the native button click.
    });
  });

  document.querySelectorAll('.view__next').forEach((btn) => {
    btn.addEventListener('click', () => showView(btn.dataset.next, true));
  });

  // Initial paint: show the checklist without stealing focus on load.
  showView('checklist', false);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
