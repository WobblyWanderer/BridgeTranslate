# Bridge Multilingual Roadmap — Staged, Review-Led, and Non-Disruptive

## Current boundary

Bridge’s **English neurospicy-to-institutional workflow is live, tested, and must remain unchanged** while multilingual support is designed. This roadmap does not add a language selector, translate live interface text, change model prompts, or generate non-English outputs. It defines the conditions that must be met before any of those changes are released.

## Why this is a separate layer

Bridge is not a generic translation page. Its live value is that it maps connected, contextual, sometimes non-linear communication into a usable form without discarding meaning. A language feature must not weaken that mapping, introduce a second inconsistent prompt path, or leave people navigating English controls while their own text is in another language.

| Layer | Current status | Safe future requirement |
|---|---|---|
| English interface and prompts | **Live and protected** | Regression-tested before every language-related release |
| Interface text | English only | A complete reviewed set: buttons, labels, guidance, errors, loading text, warnings, deletion wording, and downloads |
| Meaning mapping and Forms output | English workflow only | The selected working language must apply consistently to mapping, triage, and answer-list output |
| Downloaded text, Word, and PDF | English workflow only | Correct language declaration, readable font coverage, and a human review sample per language |
| Community review | Not yet organised | Named native-speaking reviewers or community partners review interface strings and realistic outputs before public release |

## Accessibility minimums before any language is offered

Each released language must be equivalent enough to navigate the core task without falling back to English controls. In particular, the page language needs to be programmatically declared so assistive technology can apply the correct pronunciation and text-processing rules.[^w3c-language] A selector is appropriate only when the relevant content is genuinely available in that language, rather than presenting incomplete translated fragments as a complete route.[^uswds-selector]

The practical acceptance checks are therefore:

1. A person can reach Translate or Forms, add documents, map, edit, copy/download, and clear a session using the selected language without relying on English buttons or error messages.
2. The selected language is carried consistently into the generated map, draft, triage, answer list, and downloadable output.
3. A native-speaking reviewer checks the interface strings and examples for meaning, register, tone, and potentially harmful ambiguity.
4. The established English workflow passes its existing regression and live-use checks before and after the new language is enabled.

## Proposed rollout order

> **Do not launch a language because a model can produce words in it. Launch only when the full route is usable, reviewed, and does not compromise the English core.**

The first implementation should be a small, isolated translation catalogue and a single fully reviewed language pilot. It should set the document `lang` attribute, persist an explicit preference locally, and never auto-detect or silently translate a person’s sensitive source material. The person should choose the working language themselves.

Before any pilot, Bridge should invite bilingual and native-speaking contributors to review the entire interface and a small, anonymised set of outputs. Reviewers should be credited only with their explicit agreement. Until then, the live language remains English and Bridge should invite requests for future language/community review rather than promising a feature it has not safely implemented.

## Native-speaker and community-hosted language versions

Bridge welcomes native speakers and bilingual contributors who want to review, adapt, or create a language version for their own community. A contributor does **not** need to wait for a central Bridge rollout: once the code and language catalogue are ready for a reviewed version, they can host that version on their own website and retain local control over its community context, contact route, and update choices.

The contribution request should be honest about the work involved. A safe version needs review of the full interface—not only headline text—including buttons, labels, processing messages, errors, deletion wording, privacy notices, source-context guidance, generated-output instructions, and downloadable templates. It also needs test examples suitable for that community. Bridge can provide the core architecture and the English reference route; native-speaking contributors provide the linguistic and cultural judgement that a generic model cannot substitute.

> **Proposed contribution invitation:** “Are you a native speaker or bilingual accessibility/community contributor? Help review or create a Bridge language version for your community. You will be able to host a reviewed version on your own site. The aim is not to translate words mechanically; it is to keep the full Bridge route understandable, respectful, and usable in your language.”

## References

[^w3c-language]: [W3C WAI — Understanding SC 3.1.1: Language of Page](https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html). It explains why programmatically identifying the predominant page language supports assistive technologies and correct text processing.
[^uswds-selector]: [U.S. Web Design System — Language selector](https://designsystem.digital.gov/components/language-selector/). Its guidance advises against presenting a selector where translated content is incomplete and notes language-identification requirements for accessible language routes.
