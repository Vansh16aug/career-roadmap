# Mindler Data Fetcher

Utility scripts to pre-fetch AI-assisted roadmap data (starting with the top 10 engineering colleges) and sync the output into a Google Sheet for review.

## Prerequisites

- Node.js 18+
- Perplexity API key
- Google Cloud service account with the Sheets API enabled
- Target Google Sheet shared with the service-account email

## Setup

1. Copy `env.example` to `.env` and fill in your secrets:
   - `PERPLEXITY_API_KEY`
   - `GOOGLE_SHEETS_ID` (from the sheet URL)
   - `GOOGLE_APPLICATION_CREDENTIALS` (path to the downloaded service-account JSON)
   - Optional overrides: `PERPLEXITY_MODEL`, `GOOGLE_SHEETS_TAB`
2. Place your service-account JSON inside `config/service-account.json` (or update the env to match its location). This file is already gitignored.
3. Install dependencies:

   ```bash
   npm install
   ```

## Usage

- Fetch and sync the “top 10 engineering colleges” dataset:

  ```bash
  npm run fetch:colleges
  ```

  The script requests Perplexity for a JSON-only response, normalizes the data, then overwrites the header + 10 rows in the configured sheet tab.

- Build the project (for deployment environments that require compiled JS):

  ```bash
  npm run build
  ```

- Lint the codebase:

  ```bash
  npm run lint
  ```

## Scheduling

Once validated, the `npm run fetch:colleges` command can be plugged into any scheduler (GitHub Actions, Cloud Scheduler, cron on a server, etc.). Ensure the environment variables and service-account JSON are available wherever the job runs.

## Extending

- Add new fetchers inside `src/clients/` and normalize their domain-specific outputs.
- Reuse the Sheets helper in `src/services/` or add alternative destinations (databases, warehouses).
- Use the `src/scripts/` directory for additional cron-style entry points (exam dates, roadmap variants, etc.).

