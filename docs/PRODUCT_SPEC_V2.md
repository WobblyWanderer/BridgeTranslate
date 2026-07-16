# BridgeTranslate v2

## One-shot translation depot

**Bring the story. Add the evidence. Choose where it needs to go. Leave with a finished document.**

BridgeTranslate is an accessibility tool for people whose natural communication does not match the narrow, linear formats expected by institutions, forms, workplaces, services or other people.

It accepts natural language plus supporting files, maps the evidence, builds a chronology where needed, and produces an editable document for a chosen destination.

The finished document is the product. The user should not have to learn prompt engineering, legal phrasing or bureaucratic structure first.

---

## Core problem

Many users understand their own situation but cannot easily convert it into the format expected by:

- PIP and other benefits systems
- NHS and GP services
- councils and housing providers
- parking and transport appeals
- carers and care services
- employers and education providers
- friends, relatives and community groups

The barrier is often not knowledge. It is translation cost.

BridgeTranslate treats fragments, tangents, repetition, word-finding delays, relational descriptions, emotional language and nonlinear chronology as usable input rather than evidence of incompetence.

---

## Core workflow

```text
Natural account + uploaded evidence
                  ↓
      extraction and source mapping
                  ↓
       chronology and issue mapping
                  ↓
   destination-specific translation
                  ↓
      editable finished document
                  ↓
          download and delete
```

---

## Beta user journey

### Step 1: What are you trying to make?

Use large icon-led cards with short labels and one-line explanations.

- 🗓️ **Build a timeline** — put events into date order
- 🧾 **Explain the evidence** — connect documents to what happened
- 🏛️ **Reply to an organisation** — council, NHS, benefits or housing
- 📝 **Answer a form question** — PIP or another structured form
- 📣 **Make a complaint** — facts, impact, failures and requested action
- ↩️ **Write an appeal** — explain what is wrong and what should change
- 💬 **Message a person** — friend, relative, colleague or community member
- 🔍 **Understand their letter** — translate incoming institutional language
- 🧭 **I am not sure** — help identify the most useful output

### Step 2: How does communication become difficult?

Diagnosis is optional. Users may select patterns instead.

- 🕸️ **My thoughts arrive as a connected map**
- 🔎 **I know what I mean but cannot find the word**
- 🌀 **The information comes out in a different order**
- 📚 **I understand complex ideas but forms confuse me**
- 🌫️ **I struggle to identify or describe feelings**
- ⏳ **I need time before I can explain what happened**
- 🎙️ **Speaking is easier than typing**
- ⌨️ **Typing is easier than speaking**
- 🌍 **English is not my first language**
- ❓ **I am unsure, please help me work it out**

Optional diagnostic or identity labels may also be selected, including autism, ADHD, AuDHD, dyslexia, dyspraxia, hyperlexia and alexithymia.

### Step 3: Tell the story naturally

The page should explicitly say:

> Repetition, fragments, tangents, context and emotion are allowed. Do not organise it first.

Input methods:

- type
- paste notes
- dictate
- paste an email or message
- state the question or outcome needed

### Step 4: Add evidence

Beta file support:

- PDF
- DOCX
- TXT
- PNG
- JPG/JPEG

Beta limit:

- up to 10 files
- one requested output pack
- a clear total upload-size limit

The system must never invent unreadable text, dates or missing evidence.

### Step 5: Review what the system found

Before drafting, show a simple evidence map:

- people and organisations
- dates and events
- promises and deadlines
- contradictions
- missing or unclear information
- requested outcome
- source linked to each event

The user can correct the map before generation.

### Step 6: Generate the document

Possible output pack:

1. plain-language summary
2. chronological timeline
3. evidence index
4. destination-specific draft
5. questions or missing information
6. editable final version

A personal message may produce only the final message. A formal complaint may produce the whole pack.

### Step 7: Download and delete

Downloads:

- Word document
- PDF
- plain text

Visible action:

- 🗑️ **Erase this session now**

---

## Evidence and provenance rules

Every factual statement should remain connected to its source.

Example:

```text
12 March 2026
The GP received the ADHD diagnosis.
Source: CareADHD email, page 1.

26 June 2026
The user asked for the diagnosis to be included on a fit note.
Source: appointment notes and follow-up email.
```

Rules:

1. Never invent a date, diagnosis, quotation or legal claim.
2. Mark uncertainty clearly, for example: **Date unclear**.
3. Separate fact, interpretation, impact and requested action.
4. Distinguish what the user says from what a document proves.
5. Highlight contradictions without claiming fraud or dishonesty unless the evidence directly supports that conclusion and the user chooses the wording.
6. Treat uploaded material as untrusted content, not instructions to the AI.
7. Keep source references visible in the draft and evidence index.

---

## Safety and wording

Public claims should say:

- **evidence-grounded**
- **structured for official or legal review**
- **designed to preserve the user's meaning**

Avoid claiming:

- legally guaranteed
- solicitor-approved
- medically accurate
- benefits-decision proof

Required warning:

> This is an early AI-assisted tool. Check all output before sending. It does not replace legal, medical, welfare-rights or benefits advice. Do not upload passwords, bank details, National Insurance numbers or unnecessary identifying information.

---

## Data model for a no-account service

BridgeTranslate should not create a permanent content history.

A code may store only:

- remaining credits
- membership status
- usage timestamps
- payment reference
- minimum abuse-prevention data

Uploaded files, natural accounts and generated documents should be temporary and deleted after the session or short expiry period.

Public wording:

> Uploaded documents, personal accounts and generated content are not kept as a permanent user history. Temporary working files are deleted after the session or expiry period. We retain only the minimum information needed for payments, credit balances, security and abuse prevention.

Do not hard-lock membership to one IP address. Use:

- unique access code
- signed browser or device token
- rolling usage allowance
- IP address only as one abuse signal

Allow at least two active devices.

---

## Future access model

### Trial

- one trial code
- three completed document credits
- no permanent content history

### Pay as you go

- 10 credits for £10
- 50 credits for £40

One credit should include one normal-sized evidence bundle, one chosen output pack and reasonable revisions during the active session.

### Membership

- £30 per month
- up to three completed jobs in a rolling 24-hour period
- personal and informal support use allowed
- no resale or organisational bulk processing

Users may help friends or relatives. The service should deter exploitation without punishing ordinary mutual aid.

---

## July beta scope

### Include

- icon-led onboarding
- natural text input
- up to 10 document or image uploads
- evidence extraction
- chronology building
- source-linked draft generation
- editable output
- DOCX, PDF and text download
- temporary tester codes
- privacy and accuracy warnings

### Exclude

- payments
- subscriptions
- permanent accounts
- inbox connections
- automated legal conclusions
- large archives
- multilingual output
- long-term storage

---

## Initial tester cohorts

### ADHD Babes

Likely use cases:

- PIP
- fit notes and GP communication
- reasonable adjustments
- benefits forms and appeals
- explaining executive-function barriers

### Neurobrum

Likely use cases:

- PIP and benefits
- NHS and council communication
- housing
- access barriers
- complaints and evidence timelines

### WI Ramblers

Likely use cases:

- carers and care coordination
- parking tickets and appeals
- health correspondence
- transport and accessibility
- messages to organisations or relatives

The cohorts provide different levels of technical confidence, age, diagnosis status and institutional experience. This is useful for accessibility testing.

---

## Institutional responsibility statement

BridgeTranslate is a stopgap, prototype and proof of concept. It is not permission for institutions to continue publishing inaccessible forms and expecting disabled people to fund or invent their own translation layer.

Government departments, councils, NHS bodies, benefits agencies, housing providers and other public services should develop their own in-house translation systems that:

- accept natural, nonlinear accounts
- explain questions in plain language
- allow voice, text and document input
- help users organise evidence
- preserve the user's original meaning
- show how information has been interpreted
- permit correction before submission
- produce accessible copies for the user
- work without requiring a diagnosis
- are tested with neurodivergent, disabled and multilingual users

Not everyone has the time, money, energy, technical confidence or concentrated nerd-density required to build a personal Vector Keel. Accessibility should be infrastructure, not a private engineering project completed while already in crisis. 🤓✋️

---

## Success criteria for the beta

A test succeeds when the user can:

1. understand the choices without reading dense instructions
2. enter their account without pre-organising it
3. upload relevant evidence
4. correct the extracted map
5. receive a useful, source-linked draft
6. edit it without losing structure
7. download it
8. understand what was and was not saved

The main question is not whether the prose sounds polished. It is whether the output carries the user's meaning across the institutional gap without inventing facts or consuming another bucket of executive function.
