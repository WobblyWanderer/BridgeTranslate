# Contributing to Bridge

Bridge is accessibility infrastructure built from lived experience. Contributions should reduce translation friction while preserving user meaning, privacy, agency, and editability.

## Before contributing

Please do not put personal evidence, confidential forms, login details, medical records, case material, or identifiable screenshots into public issues, pull requests, commits, or test fixtures.

Describe a pattern with invented neutral examples instead. If a real-world failure needs review, remove identifying details and ask the project maintainer for a safe route first.

## Contributions currently useful

- Accessibility testing with keyboard, screen-reader, magnification, voice-input, AAC, or switch access.
- Tests that protect the guest-first, explicit-save, copy/download, and clear boundaries.
- Clear technical documentation for people running their own Bridge version.
- Native-speaker and bilingual review of a **complete** language route.

## Community-hosted language versions

Native speakers and bilingual contributors may create or review a language version for their own community and host that reviewed version on their own site. This is not a request for a mechanical word-for-word translation. Credit **Marie Brown (Meronym)**, identify the version as modified, and preserve a genuine free core route for people who cannot pay; do not use a language version for commercial advantage or monetary compensation.

Before calling a language version usable, review all of the following in context:

1. Button labels, form labels, help text, errors, warnings, loading messages, and deletion wording.
2. Translate, Forms, Evidence, copy/download, and optional-save paths.
3. Meaning-map, triage, and answer-list outputs using realistic anonymised examples.
4. Register, tone, cultural context, and potentially harmful ambiguity.
5. Page-language declarations and readable font/script coverage.

Keep the established English workflow independently tested. Do not silently translate a person’s sensitive source material or present incomplete translated controls as a complete language route.

### Listing a reviewed language version on the original Bridge site

Once your language route is reviewed and publicly usable, you may ask for a direct listing from the original Bridge site. Provide the language’s own name, the public URL, the hosting operator, a route for reporting issues, and the named reviewers only where they have consented. The proposed listing should be clear and direct — for example, **“Polski / Bridge Poland”** — so a person referred to Bridge can choose their language and go straight to the version built for that community.

## Development checks

Run the following before proposing a change:

```bash
pnpm test
pnpm check
pnpm build
```

Explain what was tested and which guest/privacy boundary was affected.
