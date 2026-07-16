# BridgeTranslate beta implementation plan

## Goal

Have a controlled Streamlit beta ready by 21 July 2026.

The beta flow is:

```text
natural account + small evidence bundle
→ extracted evidence map
→ user corrections
→ destination-specific draft
→ editable download
→ erase session
```

## 16 July: interface reset

- add icon-led purpose cards
- add communication-pattern cards
- keep diagnosis labels optional
- add progress steps and plain privacy wording
- preserve the existing translation and export engine

## 17 July: document intake

Support up to 10 files in PDF, DOCX, TXT, PNG or JPG format.

- show each uploaded file
- let the user remove files before processing
- report extraction failures clearly
- retain the source filename for every extracted passage

## 18 July: evidence map

Extract and display:

- people and organisations
- dates and events
- promises and deadlines
- contradictions
- impact
- requested outcome
- source references
- unclear or missing facts

The user must be able to correct the map before generation.

## 19 July: priority outputs

Test these first:

1. PIP or benefits form answer
2. NHS or GP communication
3. council, housing or service complaint
4. parking or transport appeal
5. evidence-grounded timeline
6. message to a friend or relative

## 20 July: controlled testing

Invite a small first wave:

- 2 to 4 people from ADHD Babes
- 2 to 4 people from Neurobrum
- 2 to 4 people from WI Ramblers

Ask testers to begin with invented, redacted or low-risk examples.

Only fix crashes, confusing navigation, missing files, invented facts, broken downloads and severe prompt failures. Do not add major new features on the final day.

## 21 July: demonstration version

Prepare one example containing:

- a natural nonlinear account
- two or three supporting files
- an extracted evidence map
- a corrected chronology
- one downloadable output

Keep screenshots or a short screen recording as backup.

## Tester use cases

### ADHD Babes

- PIP examples
- GP or fit-note chronology
- reasonable-adjustment request
- benefits response or appeal

### Neurobrum

- council or housing complaint
- NHS access barrier
- benefits timeline
- communication breakdown with systemic context

### WI Ramblers

- parking appeal
- carer or care-agency chronology
- health correspondence
- message to family or a community organiser

## Feedback questions

1. Could you understand what to do without help?
2. Which screen caused the most friction?
3. Did the evidence map reflect what happened?
4. Did the final document preserve your meaning?
5. Did the AI add anything untrue?
6. What did you need to correct?
7. Would you trust it for a low-risk real task?
8. What output should be added next?

## Tester invitation

> I am testing an early version of BridgeTranslate, a one-shot translation depot for people whose natural communication does not match the format expected by forms, services or other people.
>
> You explain what happened in your own words, add a small number of supporting documents or screenshots, and the tool helps build an evidence-grounded timeline or draft response.
>
> It is an experimental AI tool, not professional advice. Please begin with redacted, invented or low-risk examples and check every output before using it.
>
> I especially need feedback on whether the choices make sense, whether the tool preserves your meaning, and whether it invents or misses anything.

## Deferred until after beta

- payments and subscriptions
- permanent accounts
- inbox connections
- large archives
- multilingual output
- organisational deployments
- independent privacy, security and legal review

The beta proves that the bridge carries meaning. The tollbooth comes later.
