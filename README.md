# Bridge — Accessibility Translation Layer

> **Bring the map. Cross the bridge.**

Bridge is a **Manus-based accessibility tool** for carrying natural, connected, non-linear communication into clear, editable language that another person, form, service, or institution can use. It is not generic “AI writing”: the user remains the owner and editor of the meaning.

This repository replaces the earlier Cloudflare reference build. The previous implementation is preserved at [`legacy/cloudflare-v0.3.0`](https://github.com/WobblyWanderer/BridgeTranslate/tree/legacy/cloudflare-v0.3.0); it is not the current running application.

**Live Bridge:** <https://bridgetrans-a8b6p3hm.manus.space>

## What works now

| Module | Current route | What a person can do without signing in |
|---|---|---|
| Bridge Translate | `/` | Add browser-held document context, write in their own words, review a meaning map, make a draft, copy/download it, and clear the session. |
| Bridge Forms | `/forms` | Add a real form, personal context, and up to 20 browser-held supporting sources; build/edit a triage and copy-and-paste answer list; copy/download/clear it. |
| Bridge Evidence | `/evidence` | Build a local chronology and download a portable ZIP packet. This remains a staged prototype. |

Sign-in is **not required to try, map, edit, copy, download, or clear** the live Translate or Forms routes. It is an explicit option only when someone chooses to save work in **their own** account for a later return.

## What Bridge does not do

Bridge does not submit official forms, decide eligibility, provide legal/medical/benefits/immigration advice, or replace checking names, dates, evidence, and wording. It creates editable working material for the official form, service, or conversation beside it.

## Run a version in your own Manus project

This is a Manus full-stack project. It uses the Manus web application stack: React, TypeScript, Express/tRPC, Manus authentication, database capability, built-in server-side AI access, and optional S3-compatible storage helpers.

1. Create a **new Manus full-stack web project** with database and user capability enabled.
2. Clone or fork this repository, then bring the source into that project. Keep the project’s own generated platform files and environment configuration where Manus requires them.
3. Install dependencies with `pnpm install`.
4. Review `drizzle/schema.ts`, generate/apply your own database migration, and use your own environment and privacy settings.
5. Run `pnpm test`, `pnpm check`, and `pnpm build` before any deployment.
6. Test guest use, explicit save, clear, document handling, and deletion in **your own** account before inviting other people.

Manus’ documented GitHub workflow exports a Manus project to a repository and maintains synchronisation with that repository. Repositories not originally created through that export may need to be ported into a new Manus project rather than automatically connected as a two-way sync.[^manus-github]

> **Never copy another project’s secrets, database credentials, generated access tokens, or user data into your deployment.**

## Safe operating boundary

Document text is extracted in the browser for the live guest workflow, but content used to create a map or draft is sent to Bridge’s server-side AI route for processing. A deployer must tell users which providers, logs, retention rules, and account model apply to their own version. Do not describe local clearing as a guarantee about a model provider’s or host’s independent operational records.

For sensitive, regulated, or high-stakes use, deployers are responsible for their own security review, data-protection assessment, accessibility testing, human escalation route, and retention/deletion policy.

## Language versions: native-speaker and community contribution

The current live interface and core prompt route are English. This is deliberate: Bridge will not claim that a language is supported until the **whole route** is usable in that language—labels, buttons, guidance, errors, loading text, deletion wording, generated output, and downloads.

Are you a native speaker or bilingual accessibility/community contributor? You are invited to review or create a language version for your community and **host that reviewed version on your own site**. Bridge can provide the architecture and English reference path; contributors supply the cultural and linguistic judgement that generic machine translation cannot substitute.

Please use it to widen access, not create another paywall. Under this repository’s non-commercial terms, you may adapt and host a reviewed community version, but you may not use it for commercial advantage or monetary compensation. Credit **Marie Brown (Meronym)**, identify that your version is modified, name its language and consenting reviewers, and keep its core communication-support route genuinely available to people who cannot pay. Be transparent about any hosting or AI costs, and provide a real free route rather than hiding basic access behind them.

When a version has been reviewed and is ready for people to use, Marie is happy to link to it from the original Bridge site’s language directory. The English reference site can show an entry such as **“Polski / Bridge Poland”** and take a person directly to the independently hosted Polish version. This is a signpost between communities, not a claim that the English site has mechanically translated or operates that version. The language-version operator remains responsible for its own users, privacy, support, safeguarding, accessibility, and local legal obligations.

Before publishing a language version, review the full interface and realistic anonymised outputs. Keep the English core regression-tested and do not silently translate sensitive source material.

See [`bridge_multilingual_roadmap.md`](bridge_multilingual_roadmap.md) for the staged safety and accessibility boundary.

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening an issue or pull request. In particular, do **not** upload personal evidence, confidential forms, credentials, case records, or identifiable screenshots to a public repository.

## Origin, licence, and attribution

Bridge was originated and designed by **Marie Brown (Meronym)**. AI tools have assisted with drafting and implementation under her direction.

- Source code: **PolyForm Noncommercial 1.0.0**
- Documentation and non-code prose: **CC BY-NC-SA 4.0**
- Attribution and naming expectations: [`NOTICE.md`](NOTICE.md)

The terms bar commercial use; they do not make hosting, AI compute, support, or professional services cost-free. Public language versions should preserve a genuine no-paywall route for people who cannot pay.

## References

[^manus-github]: [Manus documentation — GitHub Integration](https://manus.im/docs/website-builder/github-integration).
