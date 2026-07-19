# BridgeTranslate peer proof-of-concept plan

This file replaces the earlier Streamlit-specific plan.

BridgeTranslate is not defined by Python, Streamlit, Cloudflare, OpenAI or any other single provider. It is a reusable communication crossing with one hosted peer implementation and a platform-neutral organisational specification.

## Current build

The `poc-v2-evidence-depot` branch now contains:

- `public/index.html`: the approved, icon-led peer crossing;
- `public/bridge-live.js`: live access, meaning-map, drafting and refinement controls;
- `src/index.js`: the server-side bridge API reference;
- `src/live-index.js`: the Cloudflare page wrapper;
- `src/bridge-context.js`: universal translation instructions derived from Granny and Vector Keel principles;
- `specification/TRANSLATION_AIDS.md`: human-readable translation rules;
- `specification/translation-aids.json`: reusable implementation data;
- `wrangler.jsonc`: Cloudflare Workers static-assets configuration.

## User crossing

```text
welcome and consent
        ↓
optional communication aids
        ↓
Context / About Me + evidence
        ↓
natural account
        ↓
AI meaning map
        ↓
user confirms or edits meaning
        ↓
destination-specific draft
        ↓
user refines and confirms
        ↓
copy, text, Word-compatible or PDF output
```

## Peer-hosted reference

The Cloudflare reference uses:

- ordinary HTML, CSS and JavaScript;
- a Cloudflare Worker as the server-side access and AI adapter;
- secrets named `BRIDGE_ACCESS_CODE` and `OPENAI_API_KEY`;
- optional `OPENAI_MODEL` configuration;
- no application database for user documents or generated content;
- direct active-job processing with `store: false` in the OpenAI Responses request;
- no product-level file count or file-size rule invented in advance.

The hosting and AI providers may still process or retain operational information under their own policies. The interface must state that accurately.

## Organisational adoption

Organisations may adopt:

1. the user journey only;
2. the translation-aid data and system context;
3. the complete reference webpage;
4. the API contract with a different model provider;
5. the whole package inside infrastructure they control.

An adopting organisation remains responsible for authentication, security, retention, accessibility testing, data protection, lawful basis, incident response and professional review requirements.

## Immediate remaining gates

1. Deploy the branch to a private Cloudflare preview.
2. Add the two secrets without placing them in GitHub.
3. Test with invented or deliberately redacted material.
4. Confirm which real file types the selected AI model handles reliably.
5. Run peer tests on phone, tablet, keyboard-only navigation and screen zoom.
6. Correct friction before widening access.

## Non-negotiable stop conditions

Do not widen access if:

- material from one session appears in another;
- secrets or invitation codes are exposed;
- files are silently dropped;
- the bridge invents dates, names, quotations, evidence or legal duties;
- users cannot distinguish their account from documentary evidence or inference;
- the meaning-confirmation loop can be bypassed;
- erase-session behaviour is misleading.
