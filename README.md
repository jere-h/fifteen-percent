# Fifteen Percent — A No-Server Report-Prep Kit for IRAS Tax-Evasion Whistleblowers

Built by the Idea-Engine incubate pipeline as a static, GitHub Pages-ready web app.

## What done means

- Entering a valid number in the reckoner and clicking 'Compute reward estimate' displays a reward figure equal to min(0.15 * entered recoverable tax, 100000), shown next to a visible 'discretionary estimate, not a promise' disclaimer.
- Entering an empty or non-numeric value in the reckoner and clicking compute shows an inline validation message (e.g. 'Please enter a number') and displays no reward figure, with no console error.
- Answering one or more checklist steps and then reloading the page restores the previously selected answers into the wizard.
- Completing the checklist renders an editable draft text area containing the selected tax type and offence details from the answers.
- With no checklist answers entered, the draft/Transfer area shows a specific message such as 'Start the checklist to build your report' rather than a blank area.
- Clicking 'Copy all as text' copies the draft to the clipboard and shows a visible 'Copied' confirmation, and clicking 'Clear my data' empties localStorage so that a reload returns the page to its empty state.

## Hosting

Serve this directory as static files (GitHub Pages or any static host). No build step required.
