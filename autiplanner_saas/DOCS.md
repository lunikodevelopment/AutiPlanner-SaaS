# AutiPlanner (hosted) app

Runs the AutiPlanner server — the API and the offline-first web app — on your
Home Assistant. The AutiPlanner integration can then talk to it, and you can also
open the planner in a browser.

All state lives in the app's `/data` volume, which Supervisor persists and
includes in Home Assistant backups.

## Install

1. In Home Assistant, open **Settings → Apps → Install app**.
2. On the **⋮** menu choose **Repositories**, add
   `https://github.com/lunikodevelopment/AutiPlanner-SaaS`, and close.
3. Install **AutiPlanner (hosted)** and start it.
4. Open it from the sidebar or from the address on the app's **Info** tab.

The app needs the published image, `ghcr.io/lunikodevelopment/autiplanner-saas`.
That container package must be public; if the install fails with a pull error,
make the package public (see the repository README).

## First run

Open the web app and select **Create account**. That account owns the routines.
Registration is on by default so the first account can be made; to close it
afterwards, edit the app configuration and set `ALLOW_REGISTRATION` to `"false"`,
then restart the app.

## Connect Home Assistant entities

Install the AutiPlanner integration (HACS, or copy
`custom_components/autiplanner_saas`), then add it and sign in with the same
account. Leave the server address at the default if the app uses port `8080`.

See [`docs/HA_INTEGRATION.md`](../docs/HA_INTEGRATION.md).

## Add the routine to Google Calendar or Apple Calendar

The server publishes a read-only `.ics` feed for each calendar.

- **Google Calendar**: **Other calendars → + → From URL**, paste the feed URL.
  Google refreshes subscribed calendars on its own schedule, and it must be able
  to reach the URL from the internet.
- **Apple Calendar**: **File → New Calendar Subscription**, paste the feed URL.
  Apple Calendar can reach a Home Assistant address on the same network.

Get the URL from the planner's **Subscribe in Google or Apple Calendar** section,
from the `feed_url` attribute of the `calendar.<name>` entity, or from
`GET /api/me`. The URL contains a secret token; **New URL** in the web app
invalidates the previous one.

## Ports

The web interface and API listen on port `8080` inside the app, published on the
host as `8080`. Change the host port on the app's **Configuration** tab if
something else already uses it, and use the same address in the integration.
