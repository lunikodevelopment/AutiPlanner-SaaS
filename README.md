# AutiPlanner SaaS

A hosted version of AutiPlanner: a multi-tenant API plus an installable
Progressive Web App that keeps working with no network.

This is the sibling of the [AutiPlanner](../AutiPlanner) repository. That one
runs inside Home Assistant and owns its own `.ics` file. This one is the hosted
alternative for people who do not run Home Assistant: it serves many households
from one API and works offline in the browser.

Both share the same domain packages, so the four-state outcome — pending,
completed, missed, skipped — means the same thing in each. A missed item is
never stored as completed here either.

## Quick start

```bash
docker compose up --build
```

Then open <http://localhost:8080> and create an account. State lives in
`./data`.

Without Docker:

```bash
corepack enable
pnpm install
pnpm build                 # bundles the PWA into apps/web/dist
DATA_DIR=./data pnpm start # API + PWA on http://localhost:8080
```

## The image

CI builds the image, starts it, and checks that it serves the PWA and that a
registration round trip works. On `main` and on `v*` tags it also publishes to
GitHub Container Registry:

```bash
docker pull ghcr.io/lunikodevelopment/autiplanner-saas:latest
docker run -d -p 8080:8080 -v autiplanner-data:/data \
  ghcr.io/lunikodevelopment/autiplanner-saas:latest
```

The image is public, so it can be pulled anonymously. If you fork this
repository and keep the fork private, the package stays private too: authenticate
with a token that has `read:packages`, or make the package public.

## Offline behaviour

The PWA is offline-first, not offline-tolerant.

- The app shell is precached by the service worker, so it opens with no network.
- The agenda is cached in IndexedDB and rendered immediately on load.
- A change made offline is applied to the local list straight away using the
  same functions the server uses, marked **not synced**, and queued.
- The queue is replayed in order when the network returns, each command carrying
  a stable idempotency key so a retry is not applied twice.
- A conflict stops the queue and shows the stored version. The server is
  authoritative, so the superseded command is dropped and you are asked to make
  the change again.

Reading happens after writing on every sync. Reading first would briefly revert
the interface to the pre-change state and make an offline edit look as though it
undid itself the moment the network returned.

## Home Assistant

There are two pieces, and they are independent:

- **The app** (`autiplanner_saas/`) runs this server on Home Assistant OS. Add
  `https://github.com/lunikodevelopment/AutiPlanner-SaaS` as an app repository
  and install **AutiPlanner (hosted)**. It needs the published image
  `ghcr.io/lunikodevelopment/autiplanner-saas`; see [the app notes](autiplanner_saas/DOCS.md).
- **The integration** (`custom_components/autiplanner_saas`) connects Home
  Assistant to the API: a calendar entity, agenda sensors, and
  `complete` / `mark_missed` / `skip` / `reset` plus CRUD actions. Install it
  through HACS (add this repository as an **Integration**) or copy the folder.

The integration is a client. It never owns a calendar file; the API is the single
writer. The same four-state outcome and day part are preserved end to end. Full
guide: [`docs/HA_INTEGRATION.md`](docs/HA_INTEGRATION.md).

## Subscribe from Google Calendar or Apple Calendar

Each calendar has a read-only `text/calendar` feed, addressed by a secret token
so calendar software that cannot send an `Authorization` header can still fetch
it:

```text
GET /api/feed/<calendarId>/<token>.ics
```

- **Google Calendar**: Other calendars → **+** → **From URL**. Google must be able
  to reach the URL from the internet.
- **Apple Calendar**: File → **New Calendar Subscription**. It can reach a Home
  Assistant address on the same network.

Find the URL in the web app's **Subscribe in Google or Apple Calendar** section,
in the `feed_url` attribute of the `calendar.<name>` entity, or as `feedPath` on
each calendar from `GET /api/me`. Rotating the token (web app, or
`POST /api/calendars/<id>/feed/rotate`) invalidates the old URL.


## How it is put together

```
apps/api     Node HTTP API, accounts, calendars, and the command endpoint
apps/web     The PWA. TypeScript bundled with esbuild, no framework.
packages/    Domain contracts and the iCalendar profile, shared with AutiPlanner
custom_components/autiplanner_saas  Home Assistant integration (a client of this API)
autiplanner_saas/                   Home Assistant app that runs this server
```

There is no database. State is files:

| What | Where |
|---|---|
| Accounts, scrypt password hashes, hashed session tokens | `<DATA_DIR>/accounts.json` |
| Routine data | `<DATA_DIR>/calendars/<accountId>/<calendarId>.ics` |
| Revision, updated at, applied-command ledger | `<DATA_DIR>/calendars/<accountId>/<calendarId>.meta.json` |

Every write replaces the file atomically, so a crash cannot leave a truncated
calendar. Keeping the calendar as an `.ics` file is deliberate: a household can
pull their routine out, in the same format the Home Assistant integration uses.

## API

All routes are under `/api`. Authentication is an `HttpOnly` session cookie, or
`Authorization: Bearer <token>` for non-browser clients.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness. No authentication. |
| `POST` | `/api/auth/register` | Create an account and a default calendar. |
| `POST` | `/api/auth/login` | Start a session. |
| `POST` | `/api/auth/logout` | End the session and revoke the token. |
| `GET` | `/api/me` | Account and calendars. |
| `GET` | `/api/agenda?from=YYYY-MM-DD&days=14` | Items for a window. |
| `GET` | `/api/sync?since=<revision>&from=&days=` | `changed: false` when nothing moved. |
| `POST` | `/api/command` | Apply one command. |
| `POST` | `/api/calendars` | Add a calendar. |
| `DELETE` | `/api/calendars/:id` | Remove a calendar. |
| `GET` | `/api/calendars/:id/feed` | The subscription feed path, minting the token on first read. |
| `POST` | `/api/calendars/:id/feed/rotate` | Replace the feed token, invalidating the old URL. |
| `GET` | `/api/feed/:calendarId/:token.ics` | The read-only `.ics` feed. No authentication; the token is the credential. |

A command is one of `complete`, `mark_missed`, `skip`, `reset`, `create`,
`update`, `delete`. The response always carries the resulting item, never a bare
boolean, so a client can confirm what was actually stored.

Optimistic concurrency uses the calendar revision that `GET /api/agenda`
returns. Pass it as `expectedRevision`; a stale value is a `409` with
`error.code = revision_conflict` and nothing is written.

```bash
curl -sS -X POST http://localhost:8080/api/command \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"command":"mark_missed","uid":"walk@example","expectedRevision":4}'
```

## Configuration

See [`.env.example`](.env.example). The ones that matter:

| Variable | Default | Purpose |
|---|---|---|
| `DATA_DIR` | `./data` | The whole state. Back this up. |
| `PORT` | `8080` | Listen port. |
| `ALLOW_REGISTRATION` | `true` | Set `false` for a private instance. |
| `TOKEN_TTL_DAYS` | `365` | Session lifetime. |
| `AUTH_RATE_LIMIT_PER_MINUTE` | `20` | Per client address, on the auth routes. |
| `SERVE_WEB` | `true` | Serve the PWA from the API. |

## Testing

```bash
pnpm test        # domain packages, API integration tests, PWA logic + jsdom run
pnpm typecheck
./tools/check.sh # naming and .gitignore guards
```

The PWA tests boot the real application in a DOM and take it through an offline
cycle — tap while offline, observe the queued state, come back online, confirm
it syncs. The unit tests cover the queue rules separately.

## Known limits

Be aware of these before relying on it.

- **`accounts.json` is rewritten in full on every account change**, under one
  lock. A token change for one household blocks writes for all of them, and the
  cost grows with the number of accounts.
- **One process only.** The locks, the revision counters, and the loaded
  calendars are per-process. Two instances behind a load balancer would clobber
  each other. It cannot run on serverless or autoscaling.
- **Nothing is evicted from memory**, and the agenda is a linear scan. Fine for
  hundreds of calendars, not millions.

The upgrade path, in order of effort: SQLite with WAL for accounts, tokens, and
calendar metadata, keeping the `.ics` files as the calendar payload — that
removes the full-file rewrite and the global lock without changing anything
else. Postgres only if multiple API instances are genuinely needed, which would
mean moving calendar storage into the database and replacing the per-calendar
lock with a row or advisory lock.

## Security

- Passwords are hashed with scrypt and a per-account salt.
- Session tokens are stored only as SHA-256 hashes, so a leaked `accounts.json`
  cannot be replayed.
- The session cookie is `HttpOnly` and `SameSite=Lax`. Mutating routes require a
  JSON body, which a cross-site form post cannot produce.
- Auth routes are rate limited per client address.
- Registration compares against a dummy hash for unknown emails so response
  time does not reveal whether an account exists.

Serve it over HTTPS in any real deployment: the session cookie sets `Secure`
when the request arrives over a forwarded HTTPS connection, but the API itself
does not terminate TLS.

## License

MIT. See [LICENSE](LICENSE). The `.ics` profile and domain packages are shared
with AutiPlanner; Navet, if you integrate it, remains under its own license.
