// js/cases.js
// Fifteen Percent — the convictions-only Case Cards.
//
// Reads the inlined `cases` dataset from js/data.js (no fetch, no CDN) and
// paints a full gallery of real-looking IRAS conviction records into
// #cases-list on first load, so the section is never an empty shell. Each card
// shows the offence type, tax evaded, tax recovered, and the reward where the
// public release disclosed one (monospace figures), a citation link to the
// IRAS media release, and a self-contained CSS/inline-SVG motif (no external
// assets, so it still renders from a downloaded file:// copy). One file-level
// "last verified on <date>" marker carries the honesty about when a human last
// checked these facts.
//
// Public surface (see the shared contract):
//   export function renderCases(rootEl) -> void   // rootEl = #cases-list

import { cases } from "./data.js";

// --- small pure helpers ----------------------------------------------------

// Format a whole-dollar Singapore figure with grouping separators, e.g.
// 1030000 -> "S$1,030,000". Non-finite input degrades to a plain dash so a
// bad record never throws mid-render.
function formatSGD(value) {
  if (typeof value !== "number" || !isFinite(value)) return "-";
  try {
    return "S$" + Math.round(value).toLocaleString("en-SG");
  } catch (_err) {
    // Older engines without the en-SG data still get a grouped figure.
    return "S$" + Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
}

// Format the (possibly absent) reward. IRAS informant rewards are
// discretionary and rarely published, so null is the honest common case.
function formatReward(value) {
  return value === null || value === undefined ? "Not disclosed" : formatSGD(value);
}

// Deterministic, self-contained decorative motif for a card. Pure geometry
// tinted to the theme tokens (the ONE rose accent + warm sand + borders), so
// every card reads as a distinct object without shipping any external image.
// Returns an SVG markup string built from a fixed template only — no data from
// the record is interpolated, so it is safe to assign as innerHTML.
function motifSVG(index) {
  const variant = ((index % 6) + 6) % 6;
  const open =
    '<svg class="case-card__motif-art" viewBox="0 0 320 120" ' +
    'preserveAspectRatio="xMidYMid slice" role="presentation" aria-hidden="true" ' +
    'style="width:100%;height:100%;display:block">';
  const bg =
    '<rect x="0" y="0" width="320" height="120" ' +
    'style="fill:var(--color-sand,#ebe4d6)"/>';
  const accent = "var(--color-accent,#e8557f)";
  const border = "var(--color-border,#c1ccd7)";

  let art = "";
  switch (variant) {
    case 0: {
      // Concentric arcs radiating from the lower-left corner.
      for (let r = 30; r <= 210; r += 30) {
        const op = (0.06 + (r / 210) * 0.16).toFixed(3);
        art +=
          '<circle cx="20" cy="120" r="' + r + '" fill="none" ' +
          'style="stroke:' + accent + ';opacity:' + op + '" stroke-width="6"/>';
      }
      break;
    }
    case 1: {
      // Ascending stat bars.
      const heights = [34, 52, 40, 74, 60, 92, 78];
      heights.forEach((h, i) => {
        const op = (0.12 + (i / heights.length) * 0.2).toFixed(3);
        art +=
          '<rect x="' + (26 + i * 40) + '" y="' + (110 - h) + '" width="22" ' +
          'height="' + h + '" rx="4" style="fill:' + accent + ';opacity:' + op + '"/>';
      });
      break;
    }
    case 2: {
      // Dot grid.
      for (let gy = 0; gy < 3; gy++) {
        for (let gx = 0; gx < 8; gx++) {
          const on = (gx + gy) % 3 === 0;
          art +=
            '<circle cx="' + (28 + gx * 38) + '" cy="' + (30 + gy * 32) + '" r="' +
            (on ? 9 : 5) + '" style="fill:' + (on ? accent : border) +
            ";opacity:" + (on ? "0.22" : "0.5") + '"/>';
        }
      }
      break;
    }
    case 3: {
      // Diagonal stripes.
      for (let x = -120; x < 340; x += 34) {
        const op = (0.08 + (((x + 120) / 460) * 0.14)).toFixed(3);
        art +=
          '<rect x="' + x + '" y="-20" width="12" height="170" ' +
          'transform="rotate(22 ' + (x + 6) + ' 60)" ' +
          'style="fill:' + accent + ";opacity:" + op + '"/>';
      }
      break;
    }
    case 4: {
      // Overlapping translucent circles.
      const spots = [
        [70, 60, 46], [150, 44, 34], [210, 78, 40], [270, 40, 28],
      ];
      spots.forEach((s, i) => {
        const op = (0.1 + (i / spots.length) * 0.16).toFixed(3);
        art +=
          '<circle cx="' + s[0] + '" cy="' + s[1] + '" r="' + s[2] + '" ' +
          'style="fill:' + accent + ";opacity:" + op + '"/>';
      });
      break;
    }
    default: {
      // Layered wave lines.
      for (let i = 0; i < 4; i++) {
        const y = 40 + i * 20;
        const op = (0.1 + i * 0.05).toFixed(3);
        art +=
          '<path d="M0 ' + y + ' C 60 ' + (y - 24) + ", 120 " + (y + 24) +
          ", 180 " + y + " S 300 " + (y - 24) + ", 320 " + y + '" ' +
          'fill="none" style="stroke:' + accent + ";opacity:" + op +
          '" stroke-width="5" stroke-linecap="round"/>';
      }
      break;
    }
  }
  return open + bg + art + "</svg>";
}

// --- DOM construction ------------------------------------------------------

// One labelled figure row (label + monospace value). The value carries the
// contract's .case-card__figure class so styles.css renders it monospace.
function statRow(label, valueText, valueClassModifier) {
  const dt = document.createElement("dt");
  dt.className = "case-card__stat-label";
  dt.textContent = label;

  const dd = document.createElement("dd");
  dd.className =
    "case-card__figure" + (valueClassModifier ? " " + valueClassModifier : "");
  dd.textContent = valueText;

  return [dt, dd];
}

function buildCard(record, index) {
  const card = document.createElement("article");
  card.className = "case-card";

  // Self-contained decorative motif (no external asset).
  const motif = document.createElement("div");
  motif.className = "case-card__motif";
  motif.setAttribute("aria-hidden", "true");
  motif.innerHTML = motifSVG(index);
  card.appendChild(motif);

  // Offence type.
  const offence = document.createElement("h3");
  offence.className = "case-card__offence";
  offence.textContent = record.offenceType || "Tax offence";
  card.appendChild(offence);

  // Figures.
  const stats = document.createElement("dl");
  stats.className = "case-card__stats";
  statRow("Tax evaded", formatSGD(record.taxEvaded)).forEach((n) =>
    stats.appendChild(n)
  );
  statRow("Tax recovered", formatSGD(record.taxRecovered)).forEach((n) =>
    stats.appendChild(n)
  );
  statRow(
    "Reward where disclosed",
    formatReward(record.rewardDisclosed),
    record.rewardDisclosed === null || record.rewardDisclosed === undefined
      ? "case-card__figure--muted"
      : null
  ).forEach((n) => stats.appendChild(n));
  card.appendChild(stats);

  // Citation link to the IRAS media release.
  if (record.citationUrl) {
    const cite = document.createElement("a");
    cite.className = "case-card__citation";
    cite.href = record.citationUrl;
    cite.target = "_blank";
    cite.rel = "noopener noreferrer";
    cite.textContent = record.citationTitle || "Read the IRAS media release";
    card.appendChild(cite);
  }

  return card;
}

// --- public render ---------------------------------------------------------

export function renderCases(rootEl) {
  if (!rootEl) return;

  const items =
    cases && Array.isArray(cases.items) ? cases.items : [];

  // Rebuild from scratch each call (idempotent re-render).
  rootEl.textContent = "";

  const list = document.createElement("div");
  list.className = "case-card-grid";
  items.forEach((record, index) => {
    list.appendChild(buildCard(record, index));
  });
  rootEl.appendChild(list);

  // File-level "last verified on <date>" marker + honest example-data caveat.
  const verified = document.createElement("p");
  verified.className = "case-card__verified";
  const when = (cases && cases.lastVerified) || "an unrecorded date";
  verified.textContent =
    "Example conviction cards, last verified on " +
    when +
    ". Figures follow the pattern of IRAS newsroom convictions; verify against " +
    "the live IRAS newsroom before you rely on any single figure.";
  rootEl.appendChild(verified);
}
