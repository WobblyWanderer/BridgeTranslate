# Security and privacy boundary

BridgeTranslate is an early reference implementation, not a managed legal, medical or safeguarding service.

## Do not place real sensitive records in a public issue

Never post personal records, passwords, API keys, access tokens, confidential documents or vulnerability details in GitHub issues, pull requests or discussions.

For a suspected vulnerability, use GitHub's private security-advisory route if it is enabled. If it is unavailable, open an issue containing no exploit or personal details and ask the maintainer to establish a private route.

## Deployment responsibility

A person or organisation deploying BridgeTranslate must verify and document:

- where text, documents and metadata are sent;
- the AI provider's retention, training and logging rules;
- host and access logs;
- authentication and authorisation;
- data location and lawful basis;
- deletion and retention behaviour;
- encryption and secret management;
- file-type, malware, size and content controls;
- accessibility and high-stakes human review.

The current reference Worker sends active material to the configured AI binding to produce a meaning map or draft. Repository code does not itself create a long-term evidence store, but hosting and model providers may process or log requests under their own configuration and terms. Do not promise users that data is erased merely because the browser form is cleared.

## Evidence safety

Keep communication context, the user's account, documentary evidence, conflicting material, inference and uncertainty distinguishable. Do not invent dates, diagnoses, legal duties, quotations, events or certainty.
