# BridgeTranslate

> **Originated and designed by Marie Meronym.** The documented private repository history begins on 11 July 2026. See [ORIGIN.md](ORIGIN.md), [DISCLOSURE_LOG.md](DISCLOSURE_LOG.md) and [CITATION.cff](CITATION.cff).

**Use GitHub to keep the bridge. Use an appropriate host to run the bridge as a webpage.**

**Status:** early reference implementation and open specification—not a managed legal, medical, clinical, benefits or safeguarding service. A deployer must verify security, privacy, accessibility, model behaviour and human review before using sensitive or high-stakes material.

BridgeTranslate is a user-made accessibility solution to a system-wide translation problem.

It accepts natural, nonlinear, neurodivergent, disabled, dyslexic, hyperlexic, alexithymic, non-speaking, AAC-supported or multilingual communication, maps the intended meaning, asks the user to confirm it, then translates that confirmed meaning into a useful format.

The user remains the owner of the meaning.

## Which platform does what?

| Platform | Job |
|---|---|
| **GitHub** | Stores the open specification, webpage files and version history. Organisations can copy or adapt the bridge from here. |
| **Cloudflare Workers** | Can host the reference webpage and call a selected AI provider from the server side. The current live API route expects Cloudflare Access authentication; adopters choose and document their own access model. |
| **AI provider** | Analyses the active text and documents and returns the meaning map or requested draft. The reference deployment uses a configurable Cloudflare Workers AI binding, but the specification is provider-neutral. |

You do **not** need Python or Streamlit to deploy the current reference webpage.

## Current reference build

The current peer crossing uses ordinary HTML, CSS and JavaScript with a Cloudflare Worker:

```text
BridgeTranslate/
├── public/
│   ├── index.html          # the accessible peer webpage
│   └── bridge-live.js      # browser interaction and live bridge calls
├── src/
│   ├── index.js            # Cloudflare Worker and AI adapter
│   ├── live-index.js       # live page handling
│   └── bridge-context.js   # universal translation rules
├── specification/
│   ├── USER_JOURNEY.md
│   ├── SYSTEM_CONTEXT.md
│   ├── TRANSLATION_AIDS.md
│   ├── communication-options.json
│   ├── translation-aids.json
│   ├── INPUT_SCHEMA.json
│   └── OUTPUT_SCHEMA.json
├── reference-web/          # static no-AI interface demonstration
├── wrangler.jsonc          # Cloudflare configuration
├── package.json
└── README.md
```

## What the working crossing does

```text
Open webpage
      ↓
Consent and continue
      ↓
Optional communication prompts
      ↓
Context / About Me documents
+ documents about what happened
+ natural account
      ↓
Meaning map
      ↓
User confirms or corrects meaning
      ↓
Destination-specific draft
      ↓
User edits and confirms
      ↓
Copy, text, Word-compatible or PDF/print output
      ↓
Erase active session
```

The bridge keeps separate lanes for:

- communication context;
- the user's account;
- documentary evidence;
- conflicting evidence;
- model inference;
- uncertainty or missing information.

## Cloudflare deployment

In Cloudflare, create a Worker by importing this GitHub repository.

Use:

```text
Repository: WobblyWanderer/BridgeTranslate
Branch: main
Configuration: wrangler.jsonc
```

The checked-in `wrangler.jsonc` expects a Cloudflare Workers AI binding named `AI` and sets the configurable `AI_MODEL` variable. No provider key belongs in this repository.

The live Worker protects `/api/*` with Cloudflare Access and reads the authenticated email header. A `USAGE_KV` binding is optional; without it, the quota counter is disabled. `BRIDGE_ACCESS_CODE` is no longer used.

Importing this repository does not by itself create a safe public service. Before deployment, read [SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md), choose the authentication and retention model deliberately, and verify the actual provider route.

## Two linked deliverables

### 1. Hosted peer bridge

A low-friction open crossing for ADHD Babes, WI members and other peers who need help carrying their meaning into a form another person or system can understand.

The reusable crossing is designed to:

- minimise unnecessary account, password and invitation barriers while allowing a deployer to protect sensitive processing appropriately;
- accept written communication without requiring speech;
- accept optional Context / About Me material;
- accept relevant evidence and screenshots;
- map meaning before drafting;
- require user confirmation;
- create editable destination-specific outputs;
- erase the active application session.

### 2. Reusable organisational bridge

A free, platform-neutral specification that public bodies, charities, healthcare services, employers and other organisations can adopt inside infrastructure they control.

BridgeTranslate does not require Cloudflare, OpenAI or one programming language. An adopting organisation can use its approved hosting, authentication, model, retention and security systems while preserving the same crossing and accessibility rules.

## Universal translation aids

The bridge includes diagnosis-optional support for:

- functional and relational naming;
- network capture before sequencing;
- procedural competence without formal labels;
- translation of hidden institutional questions;
- concrete and visual anchoring;
- delayed and distributed processing;
- alexithymia and interoception;
- stress, sensory and memory load;
- dialect, mirroring and register fluidity;
- written, non-speaking, AAC and supported communication;
- multilingual and cross-cultural communication;
- evidence provenance and visible uncertainty;
- energy-preserving translation.

See `specification/TRANSLATION_AIDS.md` and `src/bridge-context.js`.

## Original Python experiment

`app.py` and `requirements.txt` are retained only as an earlier Streamlit experiment and historical reference. They are **not** the current deployment route and are not required by Cloudflare or by organisations adopting the open bridge.

## Core rules

1. The user owns the meaning.
2. Diagnosis and speech are never required.
3. Natural input comes before linear structure.
4. Context and evidence remain distinguishable.
5. Meaning is reflected back before drafting.
6. Uncertainty is shown, not guessed away.
7. Evidence-based statements remain connected to their sources.
8. The final result remains editable.
9. The specification remains provider-neutral.
10. Adopting organisations operate their own crossing.

> Accessibility should not depend on the user already understanding the system's hidden language.


## Origin, citation and licences

BridgeTranslate was originated and designed by **Marie Meronym**. AI tools have assisted with translation, drafting and implementation under her direction.

- Origin and dated history: [ORIGIN.md](ORIGIN.md)
- Public disclosure record: [DISCLOSURE_LOG.md](DISCLOSURE_LOG.md)
- Machine-readable citation: [CITATION.cff](CITATION.cff)
- Free-core commitment: [PUBLIC-BENEFIT-COMMITMENT.md](PUBLIC-BENEFIT-COMMITMENT.md)
- Name and attribution policy: [TRADEMARK.md](TRADEMARK.md)

Software and machine-readable material are licensed under **AGPL-3.0-or-later**. Prose documentation is licensed under **CC BY-SA 4.0**. Commercial hosting, support and specialist integration are allowed, but the licence obligations and origin notices remain. Free source code does not promise free hosting, AI compute or professional services.

See [LICENSE](LICENSE), [LICENSE-DOCUMENTATION.md](LICENSE-DOCUMENTATION.md) and [NOTICE](NOTICE).

## Safety and privacy

Do not upload personal evidence, credentials or confidential records to public GitHub issues or pull requests. A deployer must verify where input is sent, what hosts and model providers log, and whether browser-level “erase” behaviour actually removes server/provider records. See [SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md).
