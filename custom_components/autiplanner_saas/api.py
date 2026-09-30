"""Pure helpers for the hosted AutiPlanner HTTP API.

This module deliberately imports neither Home Assistant nor aiohttp, so the
request shaping, the response parsing, and the error mapping can be unit tested
on their own. ``client.py`` is the thin transport on top of it.

The wire format is camelCase (``dayPart``, ``completedAt``); the integration
prefers snake_case internally. The conversion lives here so it happens in one
place and cannot drift between the calendar entity, the sensors, and the
services.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

#: Commands a client may send. Mirrors the API's ``CommandName``.
COMMANDS = (
    "complete",
    "mark_missed",
    "skip",
    "reset",
    "create",
    "update",
    "delete",
    "add_series",
)

DAY_PARTS = ("morning", "afternoon", "evening", "night")
STATUSES = ("pending", "completed", "missed", "skipped")

#: The server rejects a window longer than this. Keep the two in step.
MAX_WINDOW_DAYS = 90


class AutiPlannerApiError(Exception):
    """An error the API reported, or that happened while talking to it."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


class AutiPlannerAuthError(AutiPlannerApiError):
    """The session token is missing, expired, or rejected (HTTP 401)."""


class AutiPlannerConflictError(AutiPlannerApiError):
    """An optimistic-concurrency check failed (HTTP 409)."""


class AutiPlannerConnectionError(AutiPlannerApiError):
    """The server could not be reached at all (no HTTP status)."""


def normalize_base_url(value: str) -> str:
    """Returns a usable base URL, or raises ``ValueError``.

    A trailing slash is stripped because every request path already begins with
    one, and a doubled slash is rejected by some reverse proxies.
    """
    url = value.strip().rstrip("/")
    if not url:
        raise ValueError("Enter the address of the AutiPlanner server")
    if not url.startswith(("http://", "https://")):
        raise ValueError("The address must start with http:// or https://")
    return url


def error_from_response(status: int, payload: Any) -> AutiPlannerApiError:
    """Maps an error body onto the right exception type.

    The API answers with ``{"error": {"code", "message"}}``. Anything else is
    surfaced verbatim rather than swallowed, so a proxy's HTML error page still
    tells the household something useful.
    """
    code = "http_error"
    message = f"The server answered with HTTP {status}"
    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict):
            if isinstance(error.get("code"), str):
                code = error["code"]
            if isinstance(error.get("message"), str):
                message = error["message"]
    if status == 401:
        return AutiPlannerAuthError(status, code, message)
    if status == 409:
        return AutiPlannerConflictError(status, code, message)
    return AutiPlannerApiError(status, code, message)


@dataclass(frozen=True)
class RoutineItem:
    """One routine item, in the integration's own shape."""

    uid: str
    title: str
    date: str
    day_part: str
    status: str
    description: str | None = None
    start: str | None = None
    due: str | None = None
    timezone: str | None = None
    completed_at: str | None = None
    order: int | None = None
    routine_id: str | None = None
    revision: int | None = None

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> RoutineItem:
        """Reads one item as the API sends it. Raises on a malformed record."""
        day_part = payload.get("dayPart")
        if day_part not in DAY_PARTS:
            raise AutiPlannerApiError(
                0, "malformed_item", f"unknown day part: {day_part!r}"
            )
        status = payload.get("status")
        if status not in STATUSES:
            raise AutiPlannerApiError(0, "malformed_item", f"unknown outcome: {status!r}")
        return cls(
            uid=str(payload.get("uid", "")),
            title=str(payload.get("title", "")),
            date=str(payload.get("date", "")),
            day_part=day_part,
            status=status,
            description=_opt_str(payload.get("description")),
            start=_opt_str(payload.get("start")),
            due=_opt_str(payload.get("due")),
            timezone=_opt_str(payload.get("timezone")),
            completed_at=_opt_str(payload.get("completedAt")),
            order=_opt_int(payload.get("order")),
            routine_id=_opt_str(payload.get("routineId")),
            revision=_opt_int(payload.get("revision")),
        )

    def to_payload(self) -> dict[str, Any]:
        """Back to the wire shape, omitting absent fields.

        Absent is not the same as null: a missed or skipped item carries no
        ``completedAt`` at all, and the API validates that.
        """
        payload: dict[str, Any] = {
            "uid": self.uid,
            "title": self.title,
            "date": self.date,
            "dayPart": self.day_part,
            "status": self.status,
        }
        optional = {
            "description": self.description,
            "start": self.start,
            "due": self.due,
            "timezone": self.timezone,
            "completedAt": self.completed_at,
            "order": self.order,
            "routineId": self.routine_id,
            "revision": self.revision,
        }
        for key, value in optional.items():
            if value is not None:
                payload[key] = value
        return payload


@dataclass(frozen=True)
class Agenda:
    """An agenda window plus the revision that writes are checked against."""

    items: tuple[RoutineItem, ...]
    revision: int
    issues: tuple[str, ...]


@dataclass(frozen=True)
class Session:
    """The result of signing in or registering."""

    token: str
    account_id: str
    email: str
    calendar_id: str | None


@dataclass(frozen=True)
class Calendar:
    id: str
    name: str


def parse_session(payload: dict[str, Any]) -> Session:
    token = payload.get("token")
    if not isinstance(token, str) or not token:
        raise AutiPlannerApiError(0, "malformed_response", "the server returned no token")
    account = payload.get("account") if isinstance(payload.get("account"), dict) else {}
    calendar_id = payload.get("calendarId")
    return Session(
        token=token,
        account_id=str(account.get("id", "")),
        email=str(account.get("email", "")),
        calendar_id=calendar_id if isinstance(calendar_id, str) else None,
    )


def parse_account(payload: dict[str, Any]) -> AccountInfo:
    account = payload.get("account") if isinstance(payload.get("account"), dict) else {}
    raw_calendars = payload.get("calendars")
    calendars: list[Calendar] = []
    if isinstance(raw_calendars, list):
        for entry in raw_calendars:
            if not isinstance(entry, dict):
                continue
            calendar_id = entry.get("id")
            if not isinstance(calendar_id, str) or not calendar_id:
                continue
            name = entry.get("name")
            calendars.append(
                Calendar(id=calendar_id, name=name if isinstance(name, str) and name else "Routine")
            )
    return AccountInfo(
        account_id=str(account.get("id", "")),
        email=str(account.get("email", "")),
        calendars=tuple(calendars),
    )


@dataclass(frozen=True)
class AccountInfo:
    account_id: str
    email: str
    calendars: tuple[Calendar, ...]


def parse_agenda(payload: dict[str, Any]) -> Agenda:
    raw_items = payload.get("items")
    items: list[RoutineItem] = []
    if isinstance(raw_items, list):
        for entry in raw_items:
            if isinstance(entry, dict):
                items.append(RoutineItem.from_payload(entry))
    revision = payload.get("revision")
    raw_issues = payload.get("issues")
    issues: list[str] = []
    if isinstance(raw_issues, list):
        issues = [str(issue) for issue in raw_issues]
    return Agenda(
        items=tuple(items),
        revision=revision if isinstance(revision, int) and not isinstance(revision, bool) else 0,
        issues=tuple(issues),
    )


def parse_item_response(payload: dict[str, Any]) -> RoutineItem | None:
    item = payload.get("item")
    if isinstance(item, dict):
        return RoutineItem.from_payload(item)
    return None


@dataclass(frozen=True)
class RoutineTemplate:
    """A repeating routine, before it is sent to the server.

    Occurrences are expanded by the server for whatever window a reader asks
    for, so this carries the rule and never a list of dates. Completion has no
    place here: an outcome belongs to one day, not to the rule.
    """

    uid: str
    title: str
    date: str
    day_part: str
    recurrence: dict[str, Any]
    description: str | None = None
    start: str | None = None
    due: str | None = None
    timezone: str | None = None
    order: int | None = None
    exdates: list[str] | None = None

    def to_payload(self) -> dict[str, Any]:
        """Back to the wire shape, omitting absent fields."""
        payload: dict[str, Any] = {
            "uid": self.uid,
            "title": self.title,
            "date": self.date,
            "dayPart": self.day_part,
            "recurrence": dict(self.recurrence),
        }
        optional = {
            "description": self.description,
            "start": self.start,
            "due": self.due,
            "timezone": self.timezone,
            "order": self.order,
            "exdates": self.exdates,
        }
        for key, value in optional.items():
            if value is not None:
                payload[key] = list(value) if isinstance(value, list) else value
        return payload


def build_command(
    command: str,
    *,
    uid: str | None = None,
    completed_at: str | None = None,
    expected_revision: int | None = None,
    item: RoutineItem | None = None,
    series: RoutineTemplate | None = None,
    patch: dict[str, Any] | None = None,
    client_command_id: str | None = None,
) -> dict[str, Any]:
    """Builds the body for ``POST /api/command``."""
    if command not in COMMANDS:
        raise ValueError(f"command must be one of {', '.join(COMMANDS)}")
    body: dict[str, Any] = {"command": command}
    if uid is not None:
        body["uid"] = uid
    if completed_at is not None:
        body["completedAt"] = completed_at
    if expected_revision is not None:
        body["expectedRevision"] = expected_revision
    if client_command_id is not None:
        body["clientCommandId"] = client_command_id
    if item is not None:
        body["item"] = item.to_payload()
    if series is not None:
        body["series"] = series.to_payload()
    if patch is not None:
        body["patch"] = patch
    return body


def item_to_attributes(item: RoutineItem) -> dict[str, Any]:
    """The client-facing shape used on the agenda sensors.

    Mirrors ``itemPayload`` in the API and ``_normalized`` in the sibling
    integration, so the three never disagree about what a routine item looks
    like.
    """
    return item.to_payload()


def _opt_str(value: Any) -> str | None:
    return value if isinstance(value, str) and value != "" else None


def _opt_int(value: Any) -> int | None:
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    return value
