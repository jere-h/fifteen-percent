# Fifteen Percent — A No-Server Report-Prep Kit for IRAS Tax-Evasion Whistleblowers

Built by the Idea-Engine incubate pipeline as a static, GitHub Pages-ready web app.

## What done means

- A thin, persistent header states "IRAS can pay up to 15% of tax recovered, up to $100,000" on every screen.
- Answering one or more checklist steps and then reloading the page restores the previously selected answers into the wizard.
- Completing the checklist renders an editable draft text area containing the selected tax type and offence details from the answers.
- With no checklist answers entered, the draft/Transfer area shows a specific message such as 'Start the checklist to build your report' rather than a blank area.
- Clicking 'Copy all as text' copies the draft to the clipboard and shows a visible 'Copied' confirmation, and clicking 'Clear my data' empties localStorage so that a reload returns the page to its empty state.

## Hosting

Serve this directory as static files (GitHub Pages or any static host). No build step required.
