# Trip Desk

Personal trip planner PWA. Free-first: all research comes live from free public sources with no API key.
Claude is used only when you tap **Check my plan**, through your own Apps Script backend, and every check shows its cost.

## How it works
Three tabs:
- **Plan**: type a region or your places in order ("Varanasi then Ayodhya"), pick days and people, tap Make my plan.
  You get the trip at a glance and a route timeline: every place with its dates, nights and usual weather, and every
  journey between places. Tap a journey to switch train, bus, car or flight. Extra tools (other plans, nights per place,
  best time to go, explore a place, saved trips) are folded away until you open them.
- **Days**: a day-by-day plan from arrival to the trip home, with the weather for each day. Each day keeps nearby sights
  together. Swap or remove a sight, or add your own. **Places** shows each place's map, sights, hotels by price, food,
  local transport, day trips, news and vlogs.
- **Costs**: the estimated total and where it goes, your limit, your own prices, currency and the optional Claude check.
  **Split** shares expenses between travellers, and **Checklist** covers documents, visa and a packing list for the weather.

Light and dark themes in teal and sand (Settings → Appearance, or follow the phone).

## Files
- `index.html`: the app (GitHub Pages serves it at `https://banerjeetara-tech.github.io/trip-desk/`)
- `manifest.webmanifest`, `sw.js`, `icon-*.png`: install on your phone's home screen and open it offline
- `backend/Code.gs`, `backend/appsscript.json`: optional Apps Script backend for the Claude plan check
- `test.html`: older Step 1 test page for the backend research sections

## Free data sources
| What | Source |
|---|---|
| Place search | Open-Meteo geocoding, Wikipedia coordinates |
| Sights, food, stays, local transport, safety | Wikivoyage (CC BY-SA) |
| Vehicle and place photos | Wikimedia Commons |
| Forecast and typical weather | Open-Meteo forecast and archive |
| Currency and exchange rates | REST Countries, open.er-api.com |
| Visa rules (Indian passport) | Wikipedia "Visa requirements for Indian citizens" |
| News | Bing News RSS through your Cloudflare Worker proxy |
| Trains, buses, flights, hotels, tickets | Distance estimates plus links to IRCTC, redBus, Rome2Rio, Google Flights, Skyscanner, MakeMyTrip, Booking.com, Klook |

Everything you change (order, nights, train or bus, swaps) is recalculated on the phone and costs nothing.

## Optional Claude check
1. Create an Anthropic API key with a monthly spending limit.
2. Create an Apps Script project, paste `backend/Code.gs` and `backend/appsscript.json`.
3. Script properties: `ANTHROPIC_API_KEY`, `APP_PASSCODE`, optional `DAILY_CAP` (default 10).
4. Run `setupCheck`, then Deploy > Web app (Execute as: Me, Who has access: Anyone).
5. In the app: ⚙️ Settings > Claude plan check > paste the `/exec` URL and passcode, then use Costs > Check my plan.

The backend records spend per month using the prices in `CFG` (edit them if Anthropic's prices change).

## Secrets
Never commit keys or documents. The key and passcode live only in Apps Script Script properties; the backend URL
and passcode are typed into the app and stored only in your browser.
