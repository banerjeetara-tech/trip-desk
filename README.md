# Trip Desk

Personal trip planner. Frontend is a single-page app on GitHub Pages (`index.html`).
Backend is a Google Apps Script web app (`backend/`) that calls the Claude API with web search.

## Folders
- `index.html` : Step 1 test page (research sections: overview, visa, food, itinerary, routes, local transport)
- `backend/Code.gs` and `backend/appsscript.json` : paste into your Apps Script project

## Secrets
Never commit keys or documents. The Anthropic key and passcode live only in Apps Script Script properties
(`ANTHROPIC_API_KEY`, `APP_PASSCODE`, optional `DAILY_CAP`). The backend URL and passcode are typed into the app and
stored only in your own browser.

## Setup
See the step list shared in chat: create API key, create the Apps Script project, add Script properties,
run `setupCheck`, deploy as web app (Execute as Me, access Anyone), paste the /exec URL into the app.
