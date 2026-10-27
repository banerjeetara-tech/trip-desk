# Trip Desk: guide

Live app: https://banerjeetara-tech.github.io/trip-desk
Code: https://github.com/banerjeetara-tech/trip-desk

## What the app does

Trip Desk is a free, personal trip planner. Research comes from free public sources. Claude is used only for an optional paid check at the end.

| Tab | What it does |
|---|---|
| 🧭 Plan | Type places in order ("Varanasi then Ayodhya") or a region ("Kerala"). Set days, people and start date. The tour plan is prepared automatically. Switch between tour options, add or remove places, reorder, and see saved plans. |
| 🚆 Travel | Choose Train, Bus, Sedan, SUV, Taxi or Flight for each leg. Each leg keeps its own choice. A total for the head count appears at the end, with the cheapest possible total for comparison. |
| 📍 Places | What to see in each place, with ＋ Add to plan, ★ Must see and ✗ Skip. Changes update the Plan tab. Main places nearby, a map, and recent vlogs sorted newest first. |
| 🏨 Stay | Hotels (Budget, Mid-range, Luxury), Food, Itinerary and Tickets. |
| ⛅ Weather | Weather for your trip dates. |
| 💰 Cost | Summary, Expenses, Documents and Visa. Also the optional Claude plan check. |

## Principles

- Saving is optional and quiet. There are no reminders.
- Changes in one tab flow to the others automatically.
- Research is cached in the browser (localStorage).
- API keys live only in Apps Script Script Properties. Never in chat or in GitHub.
- No passport scans or secrets in the repo.

## Free data sources

- Open-Meteo: geocoding, forecast, climate archive
- Wikipedia and Wikidata: place info, coordinates, country codes
- Wikivoyage: sights, food, sleep, getting around
- Wikimedia Commons: photos
- REST Countries and open.er-api.com: currency
- Wikipedia visa requirements table
- Bing News RSS and YouTube search through a Cloudflare Worker proxy

## Limits

- Free guide data can be thin for smaller places.
- Fares and travel times are estimates from distance. Booking links show real ones.
- Vlogs depend on the proxy fetching YouTube. Consent pages can block them. Instagram and Google video links are always shown as fallbacks.
- Map pins appear only where the guide gives a location.
- The Claude check needs the one-time Apps Script setup.

## Apps Script setup for the Claude check (one time)

1. **Claude API key.** Go to console.anthropic.com. Under Billing, add a small credit (about $5) and set a monthly spend limit. Under API keys, create a key and copy it. Keep it private.
2. **Create the script.** Go to script.google.com → New project, and name it "Trip Desk backend". Delete the default code.
3. **Paste the code.** Open `backend/Code.gs` on GitHub and click **Raw**. Select all, copy and paste into `Code.gs`. Save.
4. **Paste the manifest.** Click ⚙️ Project Settings and tick "Show appsscript.json". Open `appsscript.json` in the editor and replace it with the Raw copy of `backend/appsscript.json`. Save.
5. **Script Properties.** In ⚙️ Project Settings → Script Properties, add:
   - `ANTHROPIC_API_KEY`: your key from step 1
   - `APP_PASSCODE`: a private word you choose
   - `DAILY_CAP`: `10` (optional; maximum checks per day)
6. **Authorise.** Choose `setupCheck` from the function menu and click Run. Approve the permissions: Review → your account → Advanced → "Go to Trip Desk backend (unsafe)" → Allow. The warning is normal for your own script.
7. **Deploy.** Click Deploy → New deployment → ⚙️ → Web app. Set "Execute as" to **Me** and "Who has access" to **Anyone**. Deploy and copy the URL that ends in `/exec`.
8. **Connect the app.** In Trip Desk, open ⚙️ Settings → Claude plan check. Paste the `/exec` URL and your passcode. Tap **Test connection**.
9. **Use it.** When the plan is final, go to the Cost tab and tap **Check my plan**. The usage meter shows this month's spend.
10. **After code changes.** Paste the new `Code.gs`, then Deploy → Manage deployments → ✏️ → Version: **New version** → Deploy. The URL stays the same.

## Troubleshooting

- **"Locationbfailed" or syntax errors:** paste the Raw copy of `Code.gs` again, not the page view.
- **Test connection shows an HTML page:** the deployment access is not "Anyone", or the URL is not the `/exec` one.
- **"Unknown action":** the Apps Script code is old. Create a new version (step 10).
- **Daily limit reached:** raise `DAILY_CAP` in Script Properties, or wait until tomorrow.
