// modal.js — one accessible dialog primitive shared across the app.
//
// openModal({titleId, contentNode, invoker}) mounts contentNode inside a
// role="dialog" aria-modal="true" surface over a backdrop, traps Tab focus
// within the dialog, closes on ESC or backdrop click, locks body scroll, and
// on close restores focus to the invoker and returns contentNode to wherever
// it came from (so a persistent panel like #safety can live off-screen and be
// borrowed by the modal without being destroyed).
//
// Contract:
//   export function openModal({ titleId, contentNode, invoker }) -> void
//   export function closeModal() -> void
//
// Pure DOM: no network, no storage. Only one modal is open at a time.

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

let backdropEl = null;
let dialogEl = null;
let contentEl = null;
let originParent = null;
let invokerEl = null;
let keydownHandler = null;

function isVisible(node) {
  return !!(
    node &&
    (node.offsetWidth || node.offsetHeight || node.getClientRects().length)
  );
}

function focusableWithin(root) {
  return Array.prototype.slice
    .call(root.querySelectorAll(FOCUSABLE))
    .filter(isVisible);
}

// Keep Tab / Shift+Tab looping inside the dialog. Focus that starts on the
// title (tabindex=-1, not in the focusable list) wraps to the first/last
// tabbable rather than escaping the dialog.
function trapTab(e) {
  if (!dialogEl) return;
  const nodes = focusableWithin(dialogEl);
  if (nodes.length === 0) {
    e.preventDefault();
    return;
  }
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  const active = document.activeElement;
  const idx = nodes.indexOf(active);

  if (e.shiftKey) {
    if (idx <= 0) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (idx === -1 || idx === nodes.length - 1) {
      e.preventDefault();
      first.focus();
    }
  }
}

/**
 * Open contentNode as an accessible modal dialog.
 * @param {object} opts
 * @param {string} [opts.titleId]   id of the heading that labels the dialog
 * @param {HTMLElement} opts.contentNode  the content to show (moved into the dialog)
 * @param {HTMLElement} [opts.invoker] element focus returns to on close
 */
export function openModal(opts) {
  const o = opts || {};
  if (!o.contentNode) return;
  if (backdropEl) closeModal(); // one dialog at a time

  invokerEl = o.invoker || (document.activeElement !== document.body ? document.activeElement : null);
  contentEl = o.contentNode;
  originParent = contentEl.parentNode || null;

  backdropEl = document.createElement('div');
  backdropEl.className = 'modal__backdrop';

  dialogEl = document.createElement('div');
  dialogEl.className = 'modal';
  dialogEl.setAttribute('role', 'dialog');
  dialogEl.setAttribute('aria-modal', 'true');
  if (o.titleId) dialogEl.setAttribute('aria-labelledby', o.titleId);

  dialogEl.appendChild(contentEl);
  backdropEl.appendChild(dialogEl);
  document.body.appendChild(backdropEl);

  document.body.classList.add('modal-open');

  // Initial focus: the labelling heading (made programmatically focusable) or
  // the first tabbable control.
  let target = o.titleId ? dialogEl.querySelector('[id="' + o.titleId + '"]') : null;
  if (target) {
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  } else {
    const list = focusableWithin(dialogEl);
    target = list[0] || dialogEl;
  }
  if (target && typeof target.focus === 'function') target.focus();

  keydownHandler = function (e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    } else if (e.key === 'Tab') {
      trapTab(e);
    }
  };
  document.addEventListener('keydown', keydownHandler, true);

  // Close on a full click that both starts and ends on the backdrop. Using
  // 'click' (not 'mousedown') means the whole pointer sequence resolves on the
  // backdrop before we tear down, so closeModal's focus-restore is the last
  // thing to run and nothing steals focus afterwards. A press that begins inside
  // the dialog and drags onto the backdrop won't fire a backdrop click, so a
  // text-selection drag never closes the dialog.
  backdropEl.addEventListener('click', function (e) {
    if (e.target === backdropEl) closeModal();
  });
}

/** Close the open dialog, restore its content node and focus. No-op if none. */
export function closeModal() {
  if (!backdropEl) return;

  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler, true);
    keydownHandler = null;
  }

  // Return the borrowed content to its original home so a persistent panel
  // (e.g. #safety) survives and can be reopened later.
  if (contentEl && originParent) {
    originParent.appendChild(contentEl);
  }

  backdropEl.remove();
  backdropEl = null;
  dialogEl = null;
  contentEl = null;
  originParent = null;

  document.body.classList.remove('modal-open');

  const inv = invokerEl;
  invokerEl = null;
  if (inv && typeof inv.focus === 'function') inv.focus();
}

/** Whether a modal is currently open (used by callers that must not double-open). */
export function isModalOpen() {
  return backdropEl !== null;
}
