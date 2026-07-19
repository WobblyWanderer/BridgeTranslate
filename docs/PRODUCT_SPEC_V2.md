# BridgeTranslate v2

## Product definition

BridgeTranslate is a one-shot AI-assisted translation depot.

A user describes what happened in their own words, chooses communication-pattern prompts, uploads relevant documents or screenshots, selects the intended destination, and receives an editable, downloadable document grounded in the supplied evidence.

The finished document is the product. The service is not a chat history, social network, permanent archive, diagnostic tool, legal service, medical service, or benefits adviser.

## Core promise

> Bring the story. Add the evidence. Choose where it needs to go. Leave with a document that carries your meaning across.

## Primary users

- Neurodivergent people, including undiagnosed or unsure users
- People with word-finding, sequencing, alexithymia, literacy, fatigue, pain, language, or executive-function barriers
- People helping a friend or family member
- Users who can explain an experience naturally but cannot readily convert it into the format expected by institutions or relationships

## Beta user journey

### 1. Choose the intended output

Use icon-led cards with short labels and one concrete explanation.

- Build a timeline
- Explain the evidence
- Reply to an organisation
- Complete a form answer
- Make a complaint
- Draft an appeal
- Message a person
- Understand an incoming letter
- I am not sure

### 2. Describe communication patterns

Diagnosis is optional. Users select functional descriptions rather than needing clinical labels.

- My thoughts arrive as a connected map
- I know what I mean but cannot find the word
- The information comes out in a different order
- I understand complex ideas but forms confuse me
- I struggle to identify or describe feelings
- I need time before I can explain what happened
- Speaking is easier than typing
- Typing is easier than speaking
- English is not my first language
- I do not know, please help me work it out

Optional clinical or identity labels may be available in an expandable section.

### 3. Tell the story naturally

The interface explicitly permits fragments, repetition, tangents, emotional language, uncertain dates, and relational descriptions.

### 4. Upload supporting material

Beta formats:

- PDF
- DOCX
- TXT
- PNG
- JPG/JPEG

Beta limits:

- Up to 10 files per job
- A clear total upload-size limit
- One requested output pack per completed job

### 5. Map the evidence

The system extracts:

- Dates and date ranges
- People and organisations
- Actions and decisions
- Promises and deadlines
- Contradictions
- Evidence supporting each event
- Missing information
- Uncertain or disputed information
- The outcome requested by the user

The system must never invent dates, quotations, diagnoses, legal duties, events, or sources.

### 6. Produce an editable result

Depending on the selected destination, the output may contain:

1. Plain-language summary
2. Chronological timeline
3. Evidence index
4. Destination-specific draft
5. Questions or missing information
6. Editable final version

For simple interpersonal messages, only the final message may be needed.

### 7. Export and erase

Users can:

- Copy the result
- Download DOCX
- Download PDF
- Download TXT
- Erase the working session immediately

## Evidence provenance rules

Each extracted event should remain linked to its source wherever practical.

Example:

```text
12 March 2026
The GP received the diagnosis report.
Source: Care provider email, page 1.
Confidence: high.
```

Required behaviours:

- Use `date unclear` when the date cannot be established
- Distinguish supplied fact from user interpretation
- Identify conflicting documents rather than silently choosing one
- Use source labels that remain useful in the exported pack
- Warn when the output relies only on the user's account and has no uploaded corroboration

## Communication and tone rules

- Assume competence
- Preserve facts, meaning, agency, boundaries, and desired outcome
- Do not infantilise, flatten, or sanitise the user into submission
- Reduce avoidable repetition without deleting context required for understanding
- Ask concise questions rather than guessing
- Separate fact, interpretation, impact, and requested action where useful
- Do not promise legal robustness or professional accuracy
- Describe institutional outputs as structured for review or evidence-grounded

## Session-code model

For beta testing, use manually issued access codes.

A code represents a temporary entitlement, not a conventional profile.

Suggested beta behaviour:

- One code contains three completed-job credits
- A credit is consumed only when a finished output is generated
- Revisions within the active session do not consume another credit
- The code can be used on a phone and computer
- IP address is an abuse signal only, not the primary identity mechanism

Future production model:

- Signed browser/device token
- Hashed access code in a small entitlement database
- Code balance or membership status
- Rolling usage timestamps
- Payment reference
- Minimal abuse-prevention metadata

Do not store access codes in plaintext.

## Retention and privacy

Do not claim that nothing whatsoever is stored if credit balances or payments exist.

Preferred wording:

> Uploaded documents, personal accounts and generated content are not kept as a permanent user history. Temporary working files are deleted after the session or expiry period. We retain only the minimum information needed for access codes, payments, security and abuse prevention.

Beta requirements:

- No permanent document history
- Temporary processing only
- Visible erase-session control
- Clear warning that a browser crash may lose unsaved work
- No passwords, bank details, National Insurance numbers, or unnecessary identifying information
- OpenAI key and all service secrets stored outside GitHub

## Access-code security

A code-entry screen is a reasonable low-friction gate for a closed beta, provided:

- Codes are random and sufficiently long
- Codes are stored hashed, not plaintext
- Failed attempts are rate-limited
- The browser receives a short-lived signed session token after successful entry
- Codes can be revoked
- Code use is logged minimally
- HTTPS is used
- Sensitive uploads are deleted promptly

A code alone is not strong identity proof. It is suitable for controlled testing, not for asserting that a specific named person owns an account.

## Beta exclusions

Do not build these before the translation and evidence loop has been tested:

- Paid subscriptions
- Automated payments
- Permanent accounts
- Permanent inbox connections
- Large archives
- Multilingual routing
- Organisational administration dashboards
- Legal conclusions or automated legal advice

## Success criteria

The beta succeeds when a tester can:

1. Understand the interface without reading a wall of text
2. Describe their communication pattern without needing a diagnosis
3. Enter a nonlinear account
4. Upload a small evidence bundle
5. Receive a source-grounded output in the intended format
6. Edit and download it
7. Understand what was and was not saved
8. Report errors or unclear steps

## Product family boundary

- BridgeTranslate: external communication and evidence-to-document translation
- RegulationApp: recognition and handoff when interoception, alexithymia, or executive sequencing drops out
- MindBody: mapping interactions among body signals, capacity, environment, and regulation

The products may share visual components and infrastructure, but each keeps a distinct primary job.
