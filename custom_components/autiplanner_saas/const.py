"""Constants for the hosted AutiPlanner integration.

The names mirror ``custom_components/autiplanner`` in the sibling repository so
a household that runs both can move automations across with only the domain
changing. The four-state outcome and the day part mean the same thing here as
they do there, because both read the same domain packages.
"""

from __future__ import annotations

DOMAIN = "autiplanner_saas"
PLATFORMS = ["calendar", "sensor"]

# --- Config entry data -----------------------------------------------------
CONF_BASE_URL = "base_url"
CONF_EMAIL = "email"
CONF_TOKEN = "token"
CONF_ACCOUNT_ID = "account_id"
CONF_CALENDAR_ID = "calendar_id"
CONF_CALENDAR_NAME = "calendar_name"

# --- Config entry options --------------------------------------------------
CONF_WINDOW_DAYS = "window_days"
CONF_SCAN_INTERVAL = "scan_interval"

#: The API refuses a window longer than 90 days. The integration asks for
#: ``2 * window_days`` around today, so the per-side window is bounded at 45.
DEFAULT_WINDOW_DAYS = 14
MIN_WINDOW_DAYS = 1
MAX_WINDOW_DAYS = 45

DEFAULT_SCAN_INTERVAL = 60
MIN_SCAN_INTERVAL = 15
MAX_SCAN_INTERVAL = 3600

# --- Service and attribute names ------------------------------------------
ATTR_UID = "uid"
ATTR_DAY_PART = "day_part"
ATTR_OUTCOME = "autiplanner_outcome"
ATTR_EXPECTED_REVISION = "expected_revision"
ATTR_REVISION = "revision"
ATTR_ISSUES = "autiplanner_issues"
ATTR_WINDOW_START = "window_start"
ATTR_WINDOW_END = "window_end"
ATTR_FEED_URL = "feed_url"

SERVICE_COMPLETE = "complete"
SERVICE_MARK_MISSED = "mark_missed"
SERVICE_SKIP = "skip"
SERVICE_RESET = "reset"
SERVICE_CREATE = "create"
SERVICE_UPDATE = "update"
SERVICE_DELETE = "delete"
SERVICE_ADD_SERIES = "add_series"

OUTCOME_SERVICES = (SERVICE_COMPLETE, SERVICE_MARK_MISSED, SERVICE_SKIP, SERVICE_RESET)

OUTCOMES = ["pending", "completed", "missed", "skipped"]
DAY_PARTS = ["morning", "afternoon", "evening", "night"]

MANUFACTURER = "AutiPlanner"

#: Where the setup guide lives, used on the repair issue.
DOCS_URL = "https://github.com/lunikodevelopment/AutiPlanner-SaaS/blob/main/docs/HA_INTEGRATION.md"
