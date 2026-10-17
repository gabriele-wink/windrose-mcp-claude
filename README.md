# WindRose MCP for Claude

Connect **Claude** to [WindRose](https://windroses.world): live readings, history, climatology and records from the public WindRose network of personal weather stations and from **your own stations**, plus the app's models (heat-stress indices, pollutant dispersion), forecasts, the official hardware manuals, and your alerts and monitoring.

Ask things like:

- *Where is it raining right now in northern Italy?*
- *Which stations within 50 km of Verona had the strongest gusts this week?*
- *Compare October rain totals across the stations of Lombardy.*
- *What is the all-time record low at my station, and how does this month compare with its normals?*
- *How do I calibrate the rain collector on my Vantage Vue?*
- *Alert me when the gust at my station goes above 60 km/h.* (Business)

The server is hosted by WindRose — there is nothing to install for Claude.ai, Claude Desktop or Claude Code. This repo holds the setup guide, example configs and a tiny optional stdio bridge.

## Requirements

- A WindRose account on the **Pro** plan (read-only tools) or **Business** (all tools, including creating and deleting alerts and monitoring windows).
- Server URL: `https://app.windroses.world/api/mcp.php` (MCP Streamable HTTP).

## Claude.ai and Claude Desktop — from the connector directory (recommended)

WindRose is listed in Claude's connector directory: **https://claude.ai/directory/connectors/windrose**

1. In Claude open **Settings → Connectors** (or **Browse connectors**), search for **WindRose** and click **Connect**.
2. A WindRose page asks you to sign in and to allow access. That's it.

Sign-in uses OAuth 2.1 (PKCE, dynamic client registration). You can disconnect at any time from Claude, or from **WindRose → Settings → API & MCP access → Connected AI apps**.

Prefer adding it by hand? **Settings → Connectors → Add custom connector** with the URL `https://app.windroses.world/api/mcp.php` works the same way.

## Claude Code

With sign-in (OAuth):

```bash
claude mcp add --transport http windrose https://app.windroses.world/api/mcp.php
# then inside Claude Code run /mcp and choose "Authenticate"
```

Or with an API key (WindRose → Settings → API & MCP access → Generate key; the token is `<key_id>.<key_secret>`):

```bash
claude mcp add --transport http windrose https://app.windroses.world/api/mcp.php \
  --header "Authorization: Bearer wr_xxxxxxxxxxxxxxxx.your_key_secret_here"
```

A project-scoped config is in [`examples/mcp.json`](examples/mcp.json) (save it as `.mcp.json`; it reads the key from the `WINDROSE_API_KEY` environment variable).

## Claude Desktop with a local config file (stdio bridge)

For setups that only accept stdio servers, this repo is also a zero-dependency Node package that forwards stdio to the remote server with your API key. Add to `claude_desktop_config.json` ([example](examples/claude_desktop_config.json)):

```json
{
  "mcpServers": {
    "windrose": {
      "command": "npx",
      "args": ["-y", "github:gabriele-wink/windrose-mcp-claude"],
      "env": { "WINDROSE_API_KEY": "wr_xxxxxxxxxxxxxxxx.your_key_secret_here" }
    }
  }
}
```

Requires Node.js 18+. Optional `WINDROSE_MCP_URL` points the bridge at another WindRose host.

## Tools

All values are metric, with the unit in the key name (`temp_c`, `gust_kmh`, `pressure_hpa`, `rain_mm`, `rain_rate_mm_h`…); unix times are `ts`.

| Tool | Access | What it answers |
|---|---|---|
| `network_now` | public | Latest reading of every station the user can see (all PUBLIC stations of the WindRose network + the user's own), filtered and sorted. |
| `network_daily` | public | One number per station over a date range, from daily summaries (kept forever): sector studies across the network. |
| `list_stations` | public | Find stations (public network + the user's own) by name/place text, area or source, with ids, position, source and last reading time. |
| `station_info` | public | Metadata of one station: place, coordinates, elevation, timezone, data source, what it measures now, how much history exists (daily summaries and full-resolution archive) and the retention. |
| `station_current` | public | Live reading of any visible station: every outdoor quantity, derived indices (heat index, wind chill, THW, WBGT, UTCI, wet bulb) and air quality; hardware/indoor values for the owner only. |
| `station_daily` | public | Daily summaries of one station (one row per local day, up to 731 days): min/max/avg temperature with times, humidity, dew point, pressure, rain, max rain rate, mean wind, max gust with time and direction, solar, UV, evapotranspiration. |
| `station_climatology` | public | Monthly climatology of one station from its daily summaries: per month temperature means/extremes, rain total and rain days, frost/hot days, tropical nights, gusts, ET; plus normals by calendar month across years. |
| `station_records` | public | Records of one station over its history or a range: highest/lowest temperature with time, warmest/coldest day, wettest day and month, max rain rate, strongest gust, pressure extremes, max UV. |
| `station_series` | public | Time series of one station: raw archive records (max 3 days) or hourly aggregates (max 31 days): temperature, humidity, dew point, wind, gust, direction, rain, rain rate, pressure, solar, UV. |
| `compute_indices` | public | Comfort and heat-stress calculator for any conditions (real or hypothetical): dew point, heat index, wind chill, humidex, wet bulb, WBGT (Dimiceli and Liljegren) and UTCI with its stress category. |
| `dispersion` | public | Pollutant dispersion screening (the model behind the app's plume map): EPA ISC3/SCREEN3 Gaussian plume, Cirillo-Poli below 1 m/s. |
| `forecast` | public | Weather forecast (Open-Meteo model, NOT a station) at any point or at a station: daily and hourly temperature, rain and probability, wind, gusts, pressure, clouds, UV, sunrise/sunset. |
| `climate_era5` | public | Historical daily weather from the ERA5 reanalysis (Open-Meteo model, NOT a station) at any point or station, up to 3 years per call: compare a station with the model, fill gaps, climate context. |
| `sun_times` | public | Sunrise, sunset, solar noon, civil twilight and day length at a point or station on a date. |
| `search_manual` | public | Search the official manuals of the supported hardware (Davis Vantage Pro2/Vue, WeatherLink Live/Console, AirLink; Ecowitt gateways, WS69/WS90 arrays, HP2550; Netatmo; WeatherFlow Tempest; AcuRite Atlas). |
| `list_manuals` | public | The manuals indexed for search_manual: brand, model, link, when last checked for a newer revision. |
| `search` | public | Search WindRose: stations (public network + the user's own) by name or place, and the indexed hardware manuals. |
| `fetch` | public | Full content of a search result: "station:<id>" (metadata + live reading) or "manual:<slug>:<page>" (that page of the manual). |
| `account_plan` | owner | The user's plan, its limits (stations, history, AI, exports, alerts, monitoring, API/MCP) and current usage. |
| `alert_sensors` | public | Catalog of the quantities an alert rule can watch (key, label, unit family, yes/no flags). |
| `list_alerts` | owner | The user's alert rules (all stations, or one): sensor, operator, threshold (metric), cooldown, mode, enabled, last triggered. |
| `create_alert` | write | Create a push alert rule on one of the user's stations. |
| `delete_alert` | write | Delete one of the user's alert rules by id (list_alerts gives ids). |
| `set_alert_enabled` | write | Pause or resume one of the user's alert rules. |
| `list_monitors` | owner | The user's monitoring windows (scheduled 1-minute recordings, max 4 h each): station, name, start/end, sample count. |
| `monitor_samples` | owner | Samples recorded by one of the user's monitors (metric: temp, humidity, dew point, wind, gust, pressure, rain rate, UV). |
| `create_monitor` | write | Schedule a monitoring window on one of the user's stations: the station is read every minute from starts_at to ends_at (max 4 h). |
| `delete_monitor` | write | Delete one of the user's monitors and its samples. |

*Access*: **public** = the public WindRose network plus your own stations; **owner** = your account only; **write** = changes your account, Business plan only, and Claude asks before running it.

The server also exposes **resources** (`windrose://docs/conventions`, `windrose://docs/capabilities`, `windrose://stations/mine`, `windrose://station/{id}`) and **prompts** (`rain_now`, `station_report`, `sector_study`, `compare_stations`).

## Data and privacy

- You see every **public** station and **your own** stations. Other users' private stations are never reachable; hardware, indoor and console values are visible only to the station owner.
- Forecasts and ERA5 data come from Open-Meteo models, not from stations — the tools say so.
- Derived indices (heat index, WBGT, UTCI…) and the dispersion model are estimates, not certified measurements.
- Station names are written by their owners and reach the model as text. Tools that change your account always need your confirmation in the client.

## Troubleshooting

| Symptom | Fix |
|---|---|
| 401 *Missing or malformed token* | Reconnect (OAuth) or check the key format `<key_id>.<key_secret>`. |
| 403 *MCP access is not included* | MCP needs the Pro or Business plan. |
| 429 *Rate limit exceeded* | 60 requests per minute per key or connection; wait a minute. |
| Write tools missing | Creating/deleting alerts and monitors needs Business, and the `mcp:write` permission granted at sign-in. |

## Italiano

Collega Claude a WindRose: in Claude.ai/Desktop apri **Impostazioni → Connettori**, cerca **WindRose** nella directory (https://claude.ai/directory/connectors/windrose) e premi **Connetti**, poi accedi con il tuo account WindRose. Serve il piano Pro (sola lettura) o Business (anche allerte e monitoraggi). In Claude Code: `claude mcp add --transport http windrose https://app.windroses.world/api/mcp.php` e poi `/mcp`.

## License

MIT — see [LICENSE](LICENSE). The WindRose service itself is subject to the [WindRose terms](https://windroses.world).
