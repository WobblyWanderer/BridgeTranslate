# BridgeTranslate static reference interface

This folder contains a no-build, no-framework browser prototype of the BridgeTranslate crossing.

## Purpose

The prototype exists to test the user journey before connecting authentication, document analysis, an AI provider or permanent hosting.

It uses ordinary HTML, CSS and JavaScript so organisations can understand and reproduce the interface without adopting Python or Streamlit.

## Open it

Open `index.html` in a modern browser.

No installation, command line, package manager or API key is needed.

## Prototype behaviour

- Any non-empty invitation code is accepted.
- Consent must be selected before continuing.
- Communication cards can be selected in any combination.
- Bracket labels and examples can be hidden independently.
- Context and evidence file controls display file names only.
- Files are not read or transmitted.
- The meaning map is an editable demonstration generated from the text entered by the tester.
- The draft is a placeholder, not an AI translation.
- Copy, text download and browser print are available.
- Erase Session resets the active page state.
- No local storage, cookies or database are used by this prototype.

## Accessibility features already represented

- keyboard-operable controls;
- visible focus states;
- semantic headings and fieldsets;
- screen-reader labels;
- responsive phone, tablet and desktop layout;
- reduced-motion support;
- no speech requirement;
- written-only, intermittent speech and AAC communication options;
- icon, plain label, bracket label and short example on each communication card;
- optional hiding of labels or examples;
- user confirmation before the destination draft stage.

## Deliberately absent

- real security or access control;
- document parsing;
- AI calls;
- data retention claims;
- artificial file-size limits;
- payments or accounts;
- a required hosting provider.

## Next gate

The next step is human interface testing. Hosting and the AI adapter should not be attached until testers can complete the static crossing without becoming confused, trapped or overloaded.