// router.js — one-screen-at-a-time state router + persistent control bar.
//
// Replaces the old role=tablist stepnav. Presents exactly one <section
// class="screen"> at a time, moves focus to that screen's h2[tabindex=-1] on
// navigation, announces the change through #sr-live, and keeps a single
// Back / Menu / Next control bar in sync with the linear FLOW.
//
// Router owns only show/hide + navigation. It imports NOTHING from the section
// render modules (checklist/draft/transfer/etc.) — app.js renders content into
// the mounts; the router just toggles visibility. It may open the shared modal
// primitive for the intro dialog.
//
// Public API:
//   showScreen(name, { focus })   -> void   (focus defaults to true)
//   getScreen()                   -> string
//   setControls({ back, next, onBack, onNext }) -> void  (per-screen override)
//   clearControls()               -> void   (TRD-5.2: a REAL reset — discards
//                                    any active override so the control bar
//                                    falls back entirely to the plain
//                                    FLOW-derived Back/Menu/Next; distinct from
//                                    the no-op setControls(null))

import { openModal, closeModal } from './modal.js';

// Canonical order. 'redirect' is a member but sits OFF the linear path — the
// readiness gate routes to it explicitly; Next/Back on the neighbours skip it.
const SCREENS = ['home', 'readiness', 'redirect', 'part1', 'part2', 'assembly', 'transfer'];

// Linear next/prev map. readiness<->part1 skip 'redirect'; the gate may still
// send the user to 'redirect', whose Back returns to readiness.
const FLOW = {
  // No 'next' key: Home's persistent Next is inert by the same fallback logic
  // that already disables transfer's (TRD-5.3). The only ways from Home to
  // Readiness are the Start button (opens the intro modal) and the Home
  // phase-menu's own "Readiness check" item — never the persistent bar.
  home: {},
  readiness: { prev: 'home', next: 'part1' },
  redirect: { prev: 'readiness', next: 'part1' },
  // part1.prev is 'readiness', NOT 'redirect' — confirmed intentional
  // (TRD-5.12). 'redirect' is a detour off the main linear Back-chain,
  // reachable only via the readiness gate's fail branch
  // (checklist.js's finishReadiness), never as a screen a user Back-navigates
  // through. So Back from part1 always returns to readiness, whether the
  // reader arrived via Redirect's "Continue anyway" or via a passing gate
  // straight from Readiness.
  part1: { prev: 'readiness', next: 'part2' },
  part2: { prev: 'part1', next: 'assembly' },
  assembly: { prev: 'part2', next: 'transfer' },
  transfer: { prev: 'assembly' },
};

const SCREEN_LABELS = {
  home: 'Home',
  readiness: 'Readiness check',
  redirect: 'Gather your details',
  part1: 'Part 1: What happened',
  part2: 'Part 2: How you became aware',
  assembly: 'Review your draft',
  transfer: 'Copy into the IRAS form',
};

let current = 'home';
// Per-screen control overrides, cleared on every navigation.
let overrides = null;

function el(id) {
  return document.getElementById(id);
}

function announce(name) {
  const live = el('sr-live');
  if (!live) return;
  live.textContent = (SCREEN_LABELS[name] || name) + ' screen';
}

// Mark a control-bar button inert WITHOUT the native `disabled` property, so it
// stays in the tab order and shows a focus ring (TRD-1.2: "Keyboard Tab reaches
// all three controls"). Inertness is enforced in applyControls by clearing the
// button's onclick, so a focused-and-activated inert control does nothing.
function setDisabled(btn, disabled) {
  if (!btn) return;
  if (disabled) {
    btn.setAttribute('aria-disabled', 'true');
    btn.classList.add('is-disabled');
  } else {
    btn.removeAttribute('aria-disabled');
    btn.classList.remove('is-disabled');
  }
}

// Rebuild the Back / Menu / Next bar from the current screen's FLOW entry plus
// any active per-screen overrides. Re-binds click handlers each time (via the
// onclick property, so no stale listeners accumulate).
function applyControls() {
  const flow = FLOW[current] || {};
  const ov = overrides || {};
  const backBtn = el('ctl-back');
  const menuBtn = el('ctl-menu');
  const nextBtn = el('ctl-next');

  // --- Back ---------------------------------------------------------------
  if (backBtn) {
    const backLabel = (ov.back && ov.back.label) || '← Back';
    const backDisabled =
      ov.back && Object.prototype.hasOwnProperty.call(ov.back, 'disabled')
        ? !!ov.back.disabled
        : !flow.prev;
    backBtn.textContent = backLabel;
    setDisabled(backBtn, backDisabled);
    backBtn.onclick = backDisabled
      ? null
      : function () {
          if (typeof ov.onBack === 'function') ov.onBack();
          else if (flow.prev) showScreen(flow.prev);
        };
  }

  // --- Home (always returns Home; labelled "Home", TRD-5.4) ---------------
  if (menuBtn) {
    menuBtn.textContent = 'Home';
    menuBtn.onclick = function () {
      showScreen('home');
    };
  }

  // --- Next ---------------------------------------------------------------
  if (nextBtn) {
    const target = (ov.next && ov.next.target) || flow.next;
    const nextLabel = (ov.next && ov.next.label) || 'Next →';
    const nextDisabled =
      ov.next && Object.prototype.hasOwnProperty.call(ov.next, 'disabled')
        ? !!ov.next.disabled
        : !target;
    nextBtn.textContent = nextLabel;
    setDisabled(nextBtn, nextDisabled);
    nextBtn.onclick = nextDisabled
      ? null
      : function () {
          if (typeof ov.onNext === 'function') ov.onNext();
          else if (target) showScreen(target);
        };
  }
}

/**
 * Show one screen, hide the rest, sync the control bar, announce, and (unless
 * focus:false) move focus to the screen's h2[tabindex=-1].
 * @param {string} name
 * @param {{focus?: boolean}} [opts]
 */
export function showScreen(name, opts) {
  if (SCREENS.indexOf(name) === -1) return;
  const focus = !(opts && opts.focus === false);

  current = name;
  overrides = null;

  const screens = document.querySelectorAll('.screen');
  for (let i = 0; i < screens.length; i++) {
    const s = screens[i];
    s.hidden = s.id !== 'screen-' + name;
  }

  // Instant scroll reset (behavior:'auto' is inherently reduced-motion safe).
  try {
    window.scrollTo({ top: 0, behavior: 'auto' });
  } catch (err) {
    window.scrollTo(0, 0);
  }
  const main = document.querySelector('main');
  if (main && typeof main.scrollTo === 'function') main.scrollTo({ top: 0, behavior: 'auto' });

  applyControls();

  if (focus) {
    announce(name);
    const screen = el('screen-' + name);
    const heading = screen && screen.querySelector('h2[tabindex="-1"]');
    if (heading && typeof heading.focus === 'function') heading.focus();
  }

  // Notify content modules AFTER the default control bar is applied, so a screen
  // that needs gate-aware controls (readiness) or dynamic content (redirect) can
  // override on entry. Fires on every navigation, focus or not.
  document.dispatchEvent(new CustomEvent('screen:changed', { detail: { name: name } }));
}

/** The currently shown screen name. */
export function getScreen() {
  return current;
}

/**
 * Override the control bar for the CURRENT screen (cleared on next navigation).
 * @param {object} next  { back:{disabled?,label?}, next:{disabled?,label?,target?}, onBack?, onNext? }
 */
export function setControls(next) {
  overrides = Object.assign({}, overrides || {}, next || {});
  applyControls();
}

/**
 * Discard any active per-screen control override and re-apply the plain
 * FLOW-derived Back/Menu/Next for the current screen (TRD-5.2). This is a
 * REAL reset — distinct from setControls(null), which merges {} onto whatever
 * `overrides` already held and therefore changes nothing.
 */
export function clearControls() {
  overrides = null;
  applyControls();
}

// Build + wire the intro dialog from its <template>, then open it.
function openIntroModal() {
  const tpl = el('intro-modal-template');
  if (!tpl || !tpl.content) return;
  const first = tpl.content.firstElementChild;
  if (!first) return;
  const node = first.cloneNode(true);

  const primary = node.querySelector('[data-action="start-readiness"]');
  const secondary = node.querySelector('[data-action="dismiss"]');
  if (primary) {
    primary.addEventListener('click', function () {
      closeModal();
      showScreen('readiness');
    });
  }
  if (secondary) {
    secondary.addEventListener('click', function () {
      closeModal();
    });
  }

  openModal({ titleId: 'intro-modal-title', contentNode: node, invoker: el('home-start') });
}

function boot() {
  // Home menu -> jump straight to a phase.
  document.querySelectorAll('.home__menu-item').forEach(function (btn) {
    btn.addEventListener('click', function () {
      showScreen(btn.dataset.target);
    });
  });

  // Start -> intro dialog.
  const start = el('home-start');
  if (start) start.addEventListener('click', openIntroModal);

  // Initial paint: Home, without stealing focus on load.
  showScreen('home', { focus: false });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
