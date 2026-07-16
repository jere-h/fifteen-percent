// clipboard.js
// writeText(text) -> Promise<boolean>
//
// Copies `text` to the clipboard and resolves the ACTUAL success boolean so the
// caller's toast never lies. Order of attempts:
//   1. navigator.clipboard.writeText (the modern async path) when it exists and
//      the context permits it (secure context / user-gesture). Any rejection or
//      exception falls through to the legacy path rather than failing outright.
//   2. A transient hidden <textarea> + document.execCommand('copy') fallback for
//      insecure or file:// contexts where the async Clipboard API is unavailable
//      or blocked.
// Resolves false only when BOTH paths fail (or nothing usable exists), e.g. a
// file:// page with no clipboard permission. No persistent DOM: the textarea is
// created and removed within the fallback and nothing else is touched.

/**
 * Legacy fallback: copy via a throwaway off-screen textarea + execCommand.
 * Returns true only when the copy command reports success.
 * @param {string} text
 * @returns {boolean}
 */
function copyViaTextarea(text) {
  // Nothing to hang the textarea on (non-browser / stripped environment).
  if (typeof document === 'undefined' || !document.body) {
    return false;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;

  // Keep it out of view and non-disruptive: no scroll jump, no visible flash,
  // no layout shift, but still selectable (display:none / visibility:hidden
  // would make the selection + copy fail in some engines).
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.width = '1px';
  textarea.style.height = '1px';
  textarea.style.padding = '0';
  textarea.style.border = 'none';
  textarea.style.outline = 'none';
  textarea.style.boxShadow = 'none';
  textarea.style.background = 'transparent';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';

  // Preserve the caller's current selection so copying doesn't clobber it.
  const selection = typeof window !== 'undefined' ? window.getSelection() : null;
  const savedRange =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  document.body.appendChild(textarea);

  let ok = false;
  try {
    textarea.focus();
    textarea.select();
    // iOS Safari needs an explicit range across the value.
    if (typeof textarea.setSelectionRange === 'function') {
      textarea.setSelectionRange(0, text.length);
    }
    ok = document.execCommand('copy') === true;
  } catch (_err) {
    ok = false;
  } finally {
    document.body.removeChild(textarea);
    // Restore whatever the user had selected before we intruded.
    if (savedRange && selection) {
      selection.removeAllRanges();
      selection.addRange(savedRange);
    }
  }

  return ok;
}

/**
 * Copy `text` to the clipboard, resolving the real success boolean.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function writeText(text) {
  const value = text == null ? '' : String(text);

  // Preferred path: async Clipboard API. Guard both the API surface and the
  // insecure-context case where writeText exists but always rejects.
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (_err) {
      // Blocked (insecure context, permission denied, no user gesture, etc.).
      // Fall through to the legacy textarea path below.
    }
  }

  return copyViaTextarea(value);
}
