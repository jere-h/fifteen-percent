// save-doc.js — build + download the report as a LOCAL plain-text document.
//
// TRD-4.4. This is the product's answer to the IRAS form's unsaveable session:
// the reader can keep their own copy of the two free-text blocks, the readiness
// cheat-sheet and an attachments reminder, on their own device. NOTHING is
// transmitted — the download is a local Blob + object URL (with a data: URI
// fallback), which never leaves the browser. The document is honest: money reads
// "up to ~S$…" and there is no submission or outcome-predicting language.
//
// Exports:
//   buildDocument(draft) -> string   (pure; the whole .txt body)
//   downloadDocument(draft) -> boolean (triggers the local download; true on ok)

import { buildNarrative } from './draft.js';
import { buildCheatSheet } from './cheatsheet.js';
import { money, iras } from './data.js';

const FILENAME = 'fifteen-percent-report.txt';

// A neutral attachments reminder. The form handles attachments itself, so this
// simply prompts the reader to bring whatever they kept. Returns an array of
// strings.
function attachmentLines() {
  return [
    'Attach anything you kept: invoices, messages, records or screenshots.',
    'If you have nothing to attach, your written account above is the record.',
  ];
}

// The honest reward phrase from the single money source: the personalised
// estimate when the reckoner has one, else the generic ceiling — always with the
// discretion caveat, never a promise.
function rewardPhrase(draft) {
  const est = draft && draft.reckoner ? draft.reckoner.rewardEstimate : null;
  if (typeof est === 'number' && isFinite(est) && est > 0) {
    return money.phrase(est);
  }
  return money.ceilingPhrase + ", at IRAS's discretion (not guaranteed)";
}

/**
 * Pure. Compose the whole plain-text document body for a draft.
 * @param {object} draft
 * @returns {string}
 */
export function buildDocument(draft) {
  const safe = draft || {};
  const model = buildNarrative(safe);
  const sheet = buildCheatSheet(safe);
  const rule = '='.repeat(60);
  const thin = '-'.repeat(60);
  const out = [];

  out.push('FIFTEEN PERCENT: MY IRAS REPORT NOTES');
  out.push(rule);
  out.push('');
  out.push(
    'Independent tool, not affiliated with IRAS. This file was built on your own'
  );
  out.push(
    'device and nothing here has been sent anywhere. It is your working copy;'
  );
  out.push('paste it into the official form yourself. This tool never submits.');
  out.push('');
  out.push('Possible informant reward: ' + rewardPhrase(safe) + '.');
  out.push('');

  // FT-1
  out.push(thin);
  out.push('FORM FIELD 1');
  out.push(model.ft1.label);
  out.push(thin);
  out.push(model.ft1.text && model.ft1.text.trim() !== '' ? model.ft1.text.trim() : '(not drafted yet)');
  out.push('');

  // FT-2
  out.push(thin);
  out.push('FORM FIELD 2');
  out.push(model.ft2.label);
  out.push(thin);
  out.push(model.ft2.text && model.ft2.text.trim() !== '' ? model.ft2.text.trim() : '(not drafted yet)');
  out.push('');

  // Readiness recap — what to be ready with before opening the form.
  out.push(thin);
  out.push('BEFORE YOU OPEN THE FORM, BE READY TO');
  out.push('(a recap of your readiness check, not text to paste)');
  out.push(thin);
  sheet.forEach((row) => {
    out.push('- ' + row.label + ': ' + row.value);
  });
  out.push('');

  // Attachments reminder.
  out.push(thin);
  out.push('SUPPORTING FILES');
  out.push(thin);
  attachmentLines().forEach((l) => out.push('- ' + l));
  out.push('');

  out.push(rule);
  out.push('Open the IRAS form yourself: ' + iras.reportUrl);
  out.push('Facts last verified ' + iras.lastVerified + '.');
  out.push('');

  return out.join('\n');
}

// Click a temporary <a download> to save `text` locally. Prefers a Blob +
// object URL; on any failure falls back to a data: URI. Never touches the
// network. Returns true when a download was triggered.
function triggerDownload(text) {
  // Preferred path: Blob + object URL.
  if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
    let url = null;
    try {
      const blob = new Blob([text], { type: 'text/plain' });
      url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = FILENAME;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke after the click has been handled.
      setTimeout(function () {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {
          /* already gone */
        }
      }, 4000);
      return true;
    } catch (err) {
      if (url) {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {
          /* ignore */
        }
      }
      // fall through to the data: URI path
    }
  }

  // Fallback: data: URI (still fully local, no network).
  try {
    const a = document.createElement('a');
    a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
    a.download = FILENAME;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch (err2) {
    return false;
  }
}

/**
 * Build the document for `draft` and trigger a local download of it.
 * @param {object} draft
 * @returns {boolean} true when a download was triggered.
 */
export function downloadDocument(draft) {
  const text = buildDocument(draft);
  return triggerDownload(text);
}
