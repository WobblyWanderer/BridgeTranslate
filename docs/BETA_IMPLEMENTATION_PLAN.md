# BridgeTranslate Closed Beta Plan

## Goal

Deploy a closed, code-gated tester version that proves the core loop:

```text
natural account + small evidence bundle
                ↓
source-aware mapping
                ↓
editable destination-specific document
                ↓
download and erase
```

## Phase 1: Interface and session gate

- Add a first-screen access-code field
- Validate against hashed tester codes stored in Streamlit secrets
- Create a signed, short-lived session state after successful entry
- Add rate limiting for failed code attempts
- Add progress steps
- Replace diagnosis-first multiselect with icon-led communication-pattern cards
- Add an expandable optional section for named traits or diagnoses

## Phase 2: One-shot job intake

- Select the intended output using icon-led cards
- Large natural-language story field
- Optional context field for recipient, deadline, desired outcome, and word limit
- Upload up to 10 supported files
- Display file count, file names, and total size before processing
- Require confirmation of the privacy warning

## Phase 3: Extraction and evidence mapping

- Extract text from TXT, DOCX, and text-based PDFs
- Send images and screenshots through a vision-capable model
- Create a structured internal evidence map containing:
  - source ID
  - filename
  - page or image reference when available
  - date or uncertain date
  - event
  - people and organisations
  - evidence strength
  - contradiction or uncertainty note
- Reject unsupported or oversized files with a clear explanation
- Treat OCR as a fallback rather than the default

## Phase 4: Translation output

- Generate the selected output type
- Include source references where appropriate
- Add a visible uncertainty and missing-information section
- Show the output in an editable text area
- Permit revisions during the same session without consuming another credit

## Phase 5: Export and erasure

- Download DOCX
- Download PDF
- Download TXT
- Add `Erase this session now`
- Clear uploaded files, extracted text, evidence map, and generated output from session state
- Display an explicit confirmation after erasure

## Phase 6: Tester feedback

Add a short feedback panel:

- Did the output preserve what you meant?
- Did it invent or omit anything?
- Could you understand the choices without reading every word?
- Which step created friction?
- Would you trust yourself to edit and use the result?

For the closed beta, feedback may go to a simple external form rather than being stored in the app.

## Initial code model

For the first beta, store code hashes and remaining credits in deployment secrets.

Example conceptual structure:

```toml
[tester_codes]
"sha256-hash-of-code-a" = 3
"sha256-hash-of-code-b" = 3
```

This is acceptable only for a small tester group because changing balances requires updating secrets or using a minimal database.

Preferred next step after the first test:

- SQLite is not reliable for persistent Streamlit Community Cloud state
- Move entitlements to a managed store such as Supabase, Neon/Postgres, or another small hosted database
- Store only hashed code, credit balance, status, and timestamps

## Hosting recommendation

### Closed beta

Use:

- Private GitHub repository
- Streamlit Community Cloud
- Public Streamlit app URL with an in-app tester-code gate
- Streamlit secrets for the OpenAI key and initial tester-code hashes

This is the lowest-friction route for the current Python/Streamlit application.

### Later production service

Reassess hosting when the app needs:

- paid credits
- reliable entitlement storage
- background document processing
- larger uploads
- strict deletion guarantees
- custom domain and branding
- stronger observability
- formal data-processing controls

At that stage use a conventional backend or container host, object storage with lifecycle deletion, and a managed database.

## Deployment checklist

- [ ] App runs locally
- [ ] No real key exists in GitHub history
- [ ] `.env` and `.streamlit/secrets.toml` are ignored
- [ ] OpenAI key added in Streamlit secrets
- [ ] Random tester codes generated offline
- [ ] Only code hashes added to deployment secrets
- [ ] Upload size and count limits enforced
- [ ] Privacy warning displayed before upload
- [ ] Output warns users to check before sending
- [ ] Erase-session path tested
- [ ] Phone, tablet, keyboard-only, zoom, and screen-reader smoke tests completed
- [ ] Three test cases run end-to-end

## Three essential test cases

### Test A: interpersonal

A nonlinear account with no files produces a concise message to a friend while preserving boundaries and emotional meaning.

### Test B: institutional

A natural account plus three emails produces a chronology, evidence index, and complaint draft without inventing dates or duties.

### Test C: benefits or health form

A natural account plus supporting documents produces a form-focused answer that distinguishes reported experience from documentary evidence and highlights missing information.

## Stop conditions

Do not invite a wider tester group if any of these occur:

- uploaded content appears in another user's session
- the app exposes secrets or raw tester codes
- outputs repeatedly invent dates, quotations, or evidence
- erasure does not clear the active session
- the app silently drops uploaded files
- a user cannot tell which claims came from which source
