# Neurospicy Translation MVP

A low-friction Streamlit prototype that accepts natural, nonlinear input and translates it
into a selected institutional or interpersonal format.

## What this prototype includes

- User-selected communication traits and preferences
- A large natural-language input area
- Purpose and output-style selectors
- Optional context
- OpenAI Responses API integration
- Editable results
- Word, PDF and plain-text downloads
- No database or user accounts
- No advertising

## Run locally

1. Install Python 3.11 or later.
2. Open a terminal in this folder.
3. Create a virtual environment:

   Windows:
   `python -m venv .venv`
   `.venv\Scripts\activate`

   macOS or Linux:
   `python3 -m venv .venv`
   `source .venv/bin/activate`

4. Install packages:

   `pip install -r requirements.txt`

5. Copy `.env.example` to `.env`, then set your API key.

   Streamlit does not automatically load `.env`, so either set the environment variable
   in your terminal or use `.streamlit/secrets.toml`.

   Example `.streamlit/secrets.toml`:

   `OPENAI_API_KEY = "your-key-here"`
   `OPENAI_MODEL = "gpt-5-mini"`

6. Start the app:

   `streamlit run app.py`

## Streamlit Cloud

Add these values under App settings → Secrets:

`OPENAI_API_KEY = "your-key-here"`
`OPENAI_MODEL = "gpt-5-mini"`

Never put a real API key in GitHub.

## Important production work

This is an MVP, not yet a safe public service. Before launch, add:

- Authentication and account deletion
- Payment handling through a provider such as Stripe
- Rate limits and subscription entitlements
- Explicit consent and privacy notices
- A retention policy and configurable deletion
- Safeguarding and crisis-routing language
- Stronger document handling and malware checks
- Audit logging without storing sensitive content
- Accessibility testing with keyboard, screen readers, zoom and voice input
- Human review warnings for legal, medical and benefits outputs
- Prompt-injection protection for uploaded documents
- Testing with diverse neurodivergent users
- UK GDPR and data-processing review

## Suggested next build order

1. Test the translation flow with ten example prompts.
2. Adjust labels, instructions and output modes.
3. Add speech-to-text.
4. Add accounts and saved preferences.
5. Add paid usage and one-off document credits.
6. Add secure document uploads.
7. Add multilingual and culturally adapted versions only after the English workflow is stable.
