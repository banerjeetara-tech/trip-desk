/**
 * Trip Desk backend, Step 1
 * Google Apps Script web app. The app sends one request per section
 * (overview, visa, food, itinerary). Each section asks Claude, with web search,
 * for strict JSON, and the result is cached for a few hours.
 *
 * Script Properties to set (Project Settings > Script properties):
 *   ANTHROPIC_API_KEY  your key from console.anthropic.com
 *   APP_PASSCODE       a passcode you choose; the app must send it
 *   DAILY_CAP          optional, max Claude calls per day (default 80)
 */

const CFG = {
  MODEL: 'claude-sonnet-5-5',
  API_URL: 'https://api.anthropic.com/v1/messages',
  VERSION: '2023-06-01',
  SEARCH_TOOL: 'web_search_20260318',
  MAX_SEARCHES: { overview: 4, visa: 4, food: 3, itinerary: 4, routes: 5, local: 4 },
  MAX_TOKENS: { overview: 2500, visa: 2500, food: 2500, itinerary: 5000, routes: 4500, local: 3500 },
  CACHE_HOURS: 6,
  DEFAULT_DAILY_CAP: 80,
  TZ: 'Asia/Kolkata'
};

const SYSTEM_PROMPT = [
  'You are the research engine of a personal trip-planning app for one traveller.',
  'Search the web for current information before answering.',
  'Prefer official government, immigration, airline, tourism-board and recent first-hand sources.',
  'Never invent facts, prices or URLs. If you cannot find something, use null and explain in "notes".',
  'Money is in Indian rupees (INR) unless a field says otherwise. Say "approx" when a figure is an estimate.',
  'Reply with ONE JSON object and nothing else: no markdown, no commentary, no code fences.'
].join(' ');

/* ---------- web app entry points ---------- */

function doGet() {
  return json_({ ok: true, service: 'Trip Desk', step: 1.1 });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    checkPasscode_(body.passcode);
    switch (body.action) {
      case 'ping':
        return json_({ ok: true, service: 'Trip Desk', step: 1, usageToday: usageToday_() });
      case 'section':
        return json_({ ok: true, result: buildSection_(body) });
      default:
        throw new Error('Unknown action: ' + body.action);
    }
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

/* ---------- run this once from the editor to check your setup ---------- */

function setupCheck() {
  const missing = ['ANTHROPIC_API_KEY', 'APP_PASSCODE'].filter(function (k) { return !prop_(k); });
  if (missing.length) {
    Logger.log('Missing Script properties: ' + missing.join(', '));
    return;
  }
  const res = UrlFetchApp.fetch(CFG.API_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': prop_('ANTHROPIC_API_KEY'), 'anthropic-version': CFG.VERSION },
    payload: JSON.stringify({ model: CFG.MODEL, max_tokens: 20, messages: [{ role: 'user', content: 'Reply with the single word OK.' }] }),
    muteHttpExceptions: true
  });
  Logger.log('Claude API status ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
}

/* ---------- sections ---------- */

function buildSection_(b) {
  const section = b.section;
  if (['overview', 'visa', 'food', 'itinerary', 'routes', 'local'].indexOf(section) < 0) throw new Error('Unknown section: ' + section);
  // Multi-stop: the app may send stops: [{name:'Kanyakumari', nights:2}, ...] in travel order.
  if (Array.isArray(b.stops) && b.stops.length) {
    if (b.stops.length > 6) throw new Error('Please use 6 stops or fewer.');
    b.stops = b.stops.map(function (s) { return { name: String((s && s.name) || '').slice(0, 80), nights: Math.min(14, Math.max(1, Number(s && s.nights) || 2)) }; });
    if (b.stops.some(function (s) { return !s.name; })) throw new Error('Every stop needs a name.');
    b.dest = b.stops.map(function (s) { return s.name; }).join(' > ');
    b.days = b.stops.reduce(function (a, s) { return a + s.nights; }, 0);
  } else {
    b.stops = null;
  }
  if (!b.dest || String(b.dest).length > 200) throw new Error('Please give a destination.');

  const key = cacheKey_(section, b);
  const cache = CacheService.getScriptCache();
  if (!b.refresh) {
    const hit = cache.get(key);
    if (hit) return Object.assign(JSON.parse(hit), { cached: true });
  }

  guard_();
  const r = callClaude_(SYSTEM_PROMPT, promptFor_(section, b), section);
  const out = {
    section: section,
    data: extractJson_(r.text),
    sources: r.sources.slice(0, 12),
    generatedAt: new Date().toISOString(),
    searches: r.searches,
    cached: false
  };
  const s = JSON.stringify(out);
  if (s.length < 95000) cache.put(key, s, CFG.CACHE_HOURS * 3600);
  return out;
}

function context_(b) {
  const today = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd');
  const days = Number(b.days) || 6;
  const lines = [
    'Today: ' + today,
    'Traveller: ' + (Number(b.travellers) || 2) + ' adults flying from ' + (b.from || 'Kolkata') + ', passport: ' + (b.passport || 'India'),
    b.stops
      ? 'Multi-stop trip, in this travel order, starting and ending at ' + (b.from || 'Kolkata') + ': ' + b.stops.map(function (s) { return s.name + ' (' + s.nights + ' nights)'; }).join(' > ')
      : 'Destination: ' + b.dest,
    'Trip length: ' + days + ' days',
    b.free
      ? 'Dates: NOT chosen. Choose the best ' + days + '-day window in the next 12 months, weighing weather, crowds, events and typical fares, and say why.'
      : 'Start date: ' + b.start,
    'Budget style: ' + (b.budget || 'comfort'),
    b.free ? 'Interests: not chosen, pick the best mix for the dates.' : 'Interests: ' + ((b.interests || []).join(', ') || 'general'),
    'Food preference: ' + (b.food || 'both') + ' (veg, nonveg or both)'
  ];
  return lines.join('\n');
}

function promptFor_(section, b) {
  const c = context_(b);
  if (section === 'overview') {
    return c + '\n\nTask: research the best time to visit, weather, events and current travel advisories.\n' +
      'Return JSON: {"window":{"start":"YYYY-MM-DD","end":"YYYY-MM-DD","why":"string"},' +
      '"bestTime":{"verdict":"great|good|okay|poor","monthScores":[12 integers 0-5 Jan to Dec],"note":"string"},' +
      '"weather":{"summary":"string","highC":number,"lowC":number,"rainChancePct":number,"humidityPct":number},' +
      '"events":[{"name":"string","dates":"string","effect":"string"}],' +
      '"advisories":[{"level":"info|caution|warning","text":"string","sourceUrl":"string or null","date":"string or null"}],' +
      '"notes":"string or null"}';
  }
  if (section === 'visa') {
    return c + '\n\nTask: find the current entry rules for this passport and destination from OFFICIAL government sources (immigration, foreign ministry, embassy). ' +
      'Give the URL of the official page for each rule and the date that page says it was updated, if shown.\n' +
      'Return JSON: {"entryType":"string","stayDays":number or null,"passportValidityRule":"string","fee":{"amount":number or null,"currency":"string or null"},' +
      '"processing":"string","requirements":["string"],"applyUrl":"string or null",' +
      '"officialSources":[{"title":"string","url":"string","updated":"string or null"}],' +
      '"confidence":"high|medium|low","notes":"string or null"}';
  }
  if (section === 'food') {
    return c + '\n\nTask: recommend what to eat, using recent reviews and food writing. Respect the food preference (veg means no meat or fish; both means a mix). Name real places only if sources support them.\n' +
      'Return JSON: {"mustTry":[{"dish":"string","type":"veg|nonveg|both","where":"string","priceInr":number or null,"why":"string"}],' +
      '"areas":[{"name":"string","why":"string"}],"tips":["string"],"notes":"string or null"}';
  }
  if (section === 'routes') {
    return c + '\n\nTask: for EACH leg of the trip (home to first stop, stop to stop, last stop back home), find how to travel by train, bus and flight. ' +
      'Use current, real information: actual train names and numbers with typical departure and arrival times, usual classes and approximate fares; typical bus operators or state transport services with approximate fares; and flights only where sensible. ' +
      'Do not invent train numbers or fares. If you cannot confirm something, use null and say so in "notes". Say clearly that live seat availability must be checked on IRCTC, redBus or the operator, since you cannot see it. ' +
      'Prefer the official IRCTC / Indian Railways pages and well-known timetable sites as sources.\n' +
      'Return JSON: {"legs":[{"from":"string","to":"string","distanceKm":number or null,' +
      '"options":[{"mode":"train|bus|flight","name":"string","number":"string or null","departs":"string or null","arrives":"string or null","durationHrs":number or null,"farePerPersonInr":number or null,"classOrType":"string or null","note":"string or null"}],' +
      '"recommended":"train|bus|flight","why":"string","bookUrls":{"train":"https://www.irctc.co.in","bus":"https://www.redbus.in"}}],' +
      '"suggestedOrder":{"stops":["string"],"why":"string"} or null,"notes":"string or null"}';
  }
  if (section === 'local') {
    return c + '\n\nTask: for EACH place on the trip, list the local transport a visitor can actually use (for example tuk-tuk, auto-rickshaw, metro, ferry, scooter hire, app cabs, local buses). ' +
      'For each, explain in one or two plain sentences what it is, give a typical fare range in INR (approx) for a short ride or a day, and one practical tip such as whether to agree the fare first or use the meter. ' +
      'Use recent sources. Do not invent fares.\n' +
      'Return JSON: {"places":[{"place":"string","options":[{"kind":"three|car|bus|boat|scooter|rail|other","name":"string","what":"string","fareInr":"string such as 250 to 700 per short ride","tip":"string","photoQuery":"short phrase to find a photo of this vehicle in this place"}]}],"notes":"string or null"}';
  }
  return c + '\n\nTask: build a day-by-day itinerary. Use real attractions, sensible daily pacing and travel time. Include 2-3 items per day. ' +
    'For paid activities, suggest what to book as a ticket. Give one alternative for each item where sensible.\n' +
    'Return JSON: {"days":[{"day":1,"date":"YYYY-MM-DD or null","title":"string","items":[{"time":"string","kind":"sight|food|ticket|stay|transit","title":"string","area":"string","priceInr":number or null,"note":"string","ticketSearch":"short search phrase for a ticket site or null","alternatives":[{"title":"string","priceInr":number or null}]}]}],' +
    '"estimateInr":{"activities":number,"localTransport":number},"notes":"string or null"}';
}

/* ---------- Claude call ---------- */

function callClaude_(system, user, section) {
  const key = prop_('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set in Script properties.');
  let messages = [{ role: 'user', content: user }];
  const sources = [];
  let searches = 0;

  for (let turn = 0; turn < 4; turn++) {
    const payload = {
      model: CFG.MODEL,
      max_tokens: CFG.MAX_TOKENS[section],
      system: system,
      messages: messages,
      tools: [{ type: CFG.SEARCH_TOOL, name: 'web_search', max_uses: CFG.MAX_SEARCHES[section], allowed_callers: ['direct'] }]
    };
    const res = UrlFetchApp.fetch(CFG.API_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': key, 'anthropic-version': CFG.VERSION },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    const code = res.getResponseCode();
    const raw = res.getContentText();
    let data;
    try { data = JSON.parse(raw); } catch (e) { throw new Error('Claude API ' + code + ': ' + raw.slice(0, 200)); }
    if (code !== 200) throw new Error('Claude API ' + code + ': ' + ((data.error && data.error.message) || raw.slice(0, 200)));

    (data.content || []).forEach(function (blk) {
      if (blk.type === 'server_tool_use') searches++;
      if (blk.type === 'web_search_tool_result' && Array.isArray(blk.content)) {
        blk.content.forEach(function (r) { if (r && r.url) sources.push({ title: r.title || r.url, url: r.url }); });
      }
    });

    if (data.stop_reason === 'pause_turn') {
      messages = messages.concat([{ role: 'assistant', content: data.content }]);
      continue;
    }
    const text = (data.content || []).filter(function (blk) { return blk.type === 'text'; }).map(function (blk) { return blk.text; }).join('\n');
    return { text: text, sources: dedupe_(sources), searches: searches };
  }
  throw new Error('Claude kept pausing. Please try again.');
}

function extractJson_(text) {
  const t = String(text || '');
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Claude did not return JSON. Try again.');
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch (e) {
    throw new Error('Claude returned JSON that could not be read. Try again.');
  }
}

/* ---------- guards and helpers ---------- */

function checkPasscode_(given) {
  const want = prop_('APP_PASSCODE');
  if (!want) throw new Error('APP_PASSCODE is not set in Script properties.');
  if (String(given || '') !== want) throw new Error('Wrong passcode.');
}

function guard_() {
  const props = PropertiesService.getScriptProperties();
  const day = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd');
  const key = 'calls:' + day;
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const n = Number(props.getProperty(key) || 0);
    const cap = Number(prop_('DAILY_CAP')) || CFG.DEFAULT_DAILY_CAP;
    if (n >= cap) throw new Error('Daily limit of ' + cap + ' Claude calls reached. Raise DAILY_CAP if you need more.');
    props.setProperty(key, String(n + 1));
  } finally {
    lock.releaseLock();
  }
}

function usageToday_() {
  const day = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd');
  return Number(PropertiesService.getScriptProperties().getProperty('calls:' + day) || 0);
}

function cacheKey_(section, b) {
  const sig = JSON.stringify([section, b.dest, b.from, b.start, b.days, b.budget, b.interests, b.food, b.free, b.passport, b.travellers, b.stops]);
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sig);
  return 'sec:' + Utilities.base64EncodeWebSafe(bytes);
}

function dedupe_(list) {
  const seen = {};
  return list.filter(function (x) { if (seen[x.url]) return false; seen[x.url] = true; return true; });
}

function prop_(k) {
  return PropertiesService.getScriptProperties().getProperty(k);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
