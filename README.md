# BridgeTranslate

**Say it your way. Add anything that helps explain it. Check the meaning. Take the version another person or system can understand.**

BridgeTranslate is a user-made accessibility solution to a system-wide translation problem.

It is designed for the point where natural, nonlinear, neurodivergent, disabled, dyslexic, hyperlexic, alexithymic, non-speaking, AAC-supported or multilingual communication meets a linear form, service, relationship or institution.

The user remains the owner of the meaning.

## Two linked deliverables

### 1. Hosted peer bridge

A low-friction crossing that can be shared with peers such as ADHD Babes, WI members and other human beings who need help translating an account and relevant material into a useful output.

The peer crossing is intended to:

- use invitation access without requiring a permanent account;
- accept written communication without requiring speech;
- accept an optional Context / About Me document;
- accept relevant evidence and screenshots;
- map the user's meaning before drafting;
- ask the user to confirm or correct the map;
- create an editable destination-specific output;
- allow the active session to be erased.

### 2. Reusable organisational bridge

A free, platform-neutral specification that public bodies, charities, healthcare services, employers and other organisations can adopt inside infrastructure they control.

Organisations remain responsible for their own hosting, authentication, AI provider, security, retention, data-protection duties and integration with existing systems.

BridgeTranslate specifies the crossing. It does not require one programming language, cloud provider or model.

## Repository map

```text
BridgeTranslate/
├── specification/
│   ├── USER_JOURNEY.md
│   ├── SYSTEM_CONTEXT.md
│   ├── communication-options.json
│   ├── INPUT_SCHEMA.json
│   └── OUTPUT_SCHEMA.json
├── reference-web/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── app.py
├── requirements.txt
└── README.md
```

## Current status

### Static reference interface

`reference-web/` is a clickable browser prototype built with ordinary HTML, CSS and JavaScript.

It demonstrates:

- the welcome and consent journey;
- icon-led communication options;
- bracketed cognitive and communication labels;
- written-only, non-speaking and AAC-supported communication choices;
- separate Context and Evidence upload areas;
- natural input;
- the mandatory meaning-confirmation loop;
- destination selection;
- editable draft and output controls;
- erase-session behaviour.

The static prototype does not send, read or analyse files. It is for testing the crossing before an AI adapter is connected.

### Original Python experiment

`app.py` is the earlier Streamlit translation experiment. It remains available as a historical reference but is not the required architecture for BridgeTranslate.

## Core rules

1. The user owns the meaning.
2. Diagnosis and speech are never required.
3. Natural input comes before linear structure.
4. Context and evidence remain distinguishable.
5. The bridge reflects meaning back before drafting.
6. Uncertainty is shown, not guessed away.
7. Evidence-based statements remain connected to their sources.
8. The final result remains editable.
9. The open specification remains provider-neutral.
10. Adopting organisations operate their own safe crossing.

## Test the static interface locally

No Python or installation is needed.

1. Download or clone this repository.
2. Open `reference-web/index.html` in a modern browser.
3. Enter any non-empty invitation code in the prototype.
4. Walk through the crossing and note anything confusing, missing or tiring.

A hosted preview will be connected only after the interface is ready for user testing.

## Not yet connected

The development branch does not yet include:

- a real access-code service;
- AI document analysis;
- a provider adapter;
- real Word or PDF generation;
- production data handling;
- a hosted peer deployment.

These components should be attached after the crossing itself has been tested.

## Project purpose

BridgeTranslate is not intended to make one person responsible for translating for everyone.

It demonstrates that organisations can accept a person's natural account and evidence, confirm the intended meaning, and translate it into the structure their existing process expects.

> Accessibility should not depend on the user already understanding the system's hidden language.