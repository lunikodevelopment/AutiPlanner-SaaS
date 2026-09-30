"""The hosted AutiPlanner integration.

Unlike ``custom_components/autiplanner``, which owns a local ``.ics`` file, this
one is a client: the hosted API is the single writer, and every mutation goes
through ``POST /api/command``. The four-state outcome and the day part are the
same contract the on-device integration and the PWA use, so a missed routine is
never stored as completed here either.
"""

from __future__ import annotations

import datetime as dt
import logging
from dataclasses import dataclass

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import AutiPlannerApiError, AutiPlannerAuthError, RoutineItem, RoutineTemplate
from .client import AutiPlannerClient
from .const import (
    ATTR_DAY_PART,
    ATTR_EXPECTED_REVISION,
    ATTR_UID,
    CONF_BASE_URL,
    CONF_CALENDAR_ID,
    CONF_CALENDAR_NAME,
    CONF_SCAN_INTERVAL,
    CONF_TOKEN,
    CONF_WINDOW_DAYS,
    DAY_PARTS,
    DEFAULT_SCAN_INTERVAL,
    DEFAULT_WINDOW_DAYS,
    DOMAIN,
    MAX_SCAN_INTERVAL,
    MAX_WINDOW_DAYS,
    MIN_SCAN_INTERVAL,
    MIN_WINDOW_DAYS,
    OUTCOMES,
    PLATFORMS,
    SERVICE_COMPLETE,
    SERVICE_CREATE,
    SERVICE_DELETE,
    SERVICE_MARK_MISSED,
    SERVICE_RESET,
    SERVICE_SKIP,
    SERVICE_UPDATE,
    SERVICE_ADD_SERIES,
)
from .coordinator import AutiPlannerCoordinator

_LOGGER = logging.getLogger(__name__)


@dataclass
class AutiPlannerRuntimeData:
    """What a loaded config entry hands to its entities."""

    entry: ConfigEntry
    client: AutiPlannerClient
    coordinator: AutiPlannerCoordinator
    calendar_id: str
    calendar_name: str
    #: The read-only subscription URL for Google Calendar / Apple Calendar, when
    #: the server offers one.
    feed_url: str | None = None


#: The entity-facing item schema for `create`. Mirrors the domain contract.
_ITEM_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_UID): cv.string,
        vol.Required("title"): cv.string,
        vol.Required("date"): cv.string,
        vol.Required(ATTR_DAY_PART): vol.In(DAY_PARTS),
        vol.Required("status"): vol.In(OUTCOMES),
        vol.Optional("description"): cv.string,
        vol.Optional("start"): cv.string,
        vol.Optional("due"): cv.string,
        vol.Optional("timezone"): cv.string,
        vol.Optional("completed_at"): cv.string,
        vol.Optional("order"): vol.Coerce(int),
        vol.Optional("icon"): cv.string,
    },
    extra=vol.ALLOW_EXTRA,
)

_SERIES_SCHEMA = vol.Schema(
    {
        vol.Optional("entity_id"): cv.entity_ids,
        vol.Required(ATTR_UID): cv.string,
        vol.Required("title"): cv.string,
        vol.Required("date"): cv.string,
        vol.Required(ATTR_DAY_PART): vol.In(DAY_PARTS),
        vol.Required("recurrence"): dict,
        vol.Optional("description"): cv.string,
        vol.Optional("start"): cv.string,
        vol.Optional("due"): cv.string,
        vol.Optional("timezone"): cv.string,
        vol.Optional("order"): vol.Coerce(int),
        vol.Optional("icon"): cv.string,
        vol.Optional("exdates"): [cv.string],
        vol.Optional(ATTR_EXPECTED_REVISION): vol.Coerce(int),
    },
    extra=vol.ALLOW_EXTRA,
)

_UPDATE_SCHEMA = vol.Schema(
    {
        vol.Optional("entity_id"): cv.entity_ids,
        vol.Required(ATTR_UID): cv.string,
        vol.Optional(ATTR_EXPECTED_REVISION): vol.Coerce(int),
        vol.Optional("title"): cv.string,
        vol.Optional("date"): cv.string,
        vol.Optional(ATTR_DAY_PART): vol.In(DAY_PARTS),
        vol.Optional("status"): vol.In(OUTCOMES),
        vol.Optional("description"): cv.string,
        vol.Optional("start"): cv.string,
        vol.Optional("due"): cv.string,
        vol.Optional("timezone"): cv.string,
        vol.Optional("completed_at"): cv.string,
        vol.Optional("order"): vol.Coerce(int),
        vol.Optional("icon"): cv.string,
    },
    extra=vol.ALLOW_EXTRA,
)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Registers the services once for the whole integration.

    The handlers are ``async def`` rather than lambdas that return a coroutine:
    Home Assistant inspects the function to decide whether to await it, and a
    lambda is treated as synchronous, so the coroutine would be dropped.
    """

    async def _complete(call: ServiceCall) -> None:
        await _run(hass, call, SERVICE_COMPLETE)

    async def _mark_missed(call: ServiceCall) -> None:
        await _run(hass, call, SERVICE_MARK_MISSED)

    async def _skip(call: ServiceCall) -> None:
        await _run(hass, call, SERVICE_SKIP)

    async def _reset(call: ServiceCall) -> None:
        await _run(hass, call, SERVICE_RESET)

    async def _create(call: ServiceCall) -> None:
        await _run(hass, call, SERVICE_CREATE)

    async def _update(call: ServiceCall) -> None:
        await _run(hass, call, SERVICE_UPDATE)

    async def _delete(call: ServiceCall) -> None:
        await _run(hass, call, SERVICE_DELETE)

    async def _add_series(call: ServiceCall) -> None:
        await _run(hass, call, SERVICE_ADD_SERIES)

    handlers = {
        SERVICE_COMPLETE: _complete,
        SERVICE_MARK_MISSED: _mark_missed,
        SERVICE_SKIP: _skip,
        SERVICE_RESET: _reset,
        SERVICE_CREATE: _create,
        SERVICE_UPDATE: _update,
        SERVICE_DELETE: _delete,
        SERVICE_ADD_SERIES: _add_series,
    }
    for name, handler in handlers.items():
        if hass.services.has_service(DOMAIN, name):
            continue
        hass.services.async_register(DOMAIN, name, handler, schema=_service_schema(name))
    return True


def _service_schema(name: str) -> vol.Schema:
    if name in (SERVICE_COMPLETE, SERVICE_MARK_MISSED, SERVICE_SKIP, SERVICE_RESET):
        return vol.Schema(
            {
                vol.Optional("entity_id"): cv.entity_ids,
                vol.Required(ATTR_UID): cv.string,
                vol.Optional("completed_at"): cv.string,
                vol.Optional(ATTR_EXPECTED_REVISION): vol.Coerce(int),
            }
        )
    if name == SERVICE_CREATE:
        return _ITEM_SCHEMA.extend({vol.Optional("entity_id"): cv.entity_ids})
    if name == SERVICE_ADD_SERIES:
        return _SERIES_SCHEMA
    if name == SERVICE_UPDATE:
        return _UPDATE_SCHEMA
    return vol.Schema(
        {
            vol.Optional("entity_id"): cv.entity_ids,
            vol.Required(ATTR_UID): cv.string,
            vol.Optional(ATTR_EXPECTED_REVISION): vol.Coerce(int),
        }
    )


async def _run(hass: HomeAssistant, call: ServiceCall, command: str) -> None:
    """Applies one command to every entry the call targets."""
    payload = dict(call.data)
    targets = _targets(hass, payload.pop("entity_id", None))
    if not targets:
        raise HomeAssistantError(
            "AutiPlanner: no configured AutiPlanner calendar was found"
        )

    uid = payload.get(ATTR_UID)
    expected = payload.get(ATTR_EXPECTED_REVISION)
    for runtime in targets:
        try:
            await _dispatch(runtime, command, uid, expected, payload)
        except AutiPlannerAuthError as error:
            # The stored token is no longer accepted; ask the household to sign
            # in again rather than failing every future service call silently.
            runtime.entry.async_start_reauth(hass)
            raise HomeAssistantError(f"AutiPlanner {command} failed: {error.message}") from error
        except AutiPlannerApiError as error:
            raise HomeAssistantError(f"AutiPlanner {command} failed: {error.message}") from error
        await runtime.coordinator.async_request_refresh()


async def _dispatch(
    runtime: AutiPlannerRuntimeData,
    command: str,
    uid: str | None,
    expected: int | None,
    payload: dict,
) -> None:
    client = runtime.client
    calendar_id = runtime.calendar_id
    if command == SERVICE_COMPLETE:
        await client.complete(
            _require(uid),
            completed_at=_completed_at(payload),
            expected_revision=expected,
            calendar_id=calendar_id,
        )
    elif command == SERVICE_MARK_MISSED:
        await client.mark_missed(_require(uid), expected_revision=expected, calendar_id=calendar_id)
    elif command == SERVICE_SKIP:
        await client.skip(_require(uid), expected_revision=expected, calendar_id=calendar_id)
    elif command == SERVICE_RESET:
        await client.reset(_require(uid), expected_revision=expected, calendar_id=calendar_id)
    elif command == SERVICE_DELETE:
        await client.delete(_require(uid), expected_revision=expected, calendar_id=calendar_id)
    elif command == SERVICE_CREATE:
        await client.create(
            _item_from_service(payload), expected_revision=expected, calendar_id=calendar_id
        )
    elif command == SERVICE_UPDATE:
        await client.update(
            _require(uid),
            _patch_from_service(payload),
            expected_revision=expected,
            calendar_id=calendar_id,
        )
    elif command == SERVICE_ADD_SERIES:
        await client.add_series(
            _series_from_service(payload),
            expected_revision=expected,
            calendar_id=calendar_id,
        )


def _series_from_service(payload: dict) -> RoutineTemplate:
    """Builds a repeating template from a service call.

    No status and no completion timestamp: an outcome belongs to one day, and
    the API rejects a template that carries one.
    """
    recurrence = payload["recurrence"]
    if not isinstance(recurrence, dict):
        raise HomeAssistantError("AutiPlanner: recurrence must be a mapping")
    return RoutineTemplate(
        uid=payload[ATTR_UID],
        title=payload["title"],
        date=payload["date"],
        day_part=payload[ATTR_DAY_PART],
        recurrence=recurrence,
        description=payload.get("description"),
        start=payload.get("start"),
        due=payload.get("due"),
        timezone=payload.get("timezone"),
        order=payload.get("order"),
        icon=payload.get("icon"),
        exdates=payload.get("exdates"),
    )


def _now_timestamp() -> str:
    """Now as an iCalendar-friendly UTC timestamp (whole seconds)."""
    return (
        dt.datetime.now(tz=dt.timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z")
    )


def _completed_at(payload: dict) -> str:
    """The completion timestamp, defaulting to now.

    The API requires ``completedAt`` on a completed item, so supplying the
    integration's clock is friendlier than sending a command it will reject.
    """
    value = payload.get("completed_at")
    if isinstance(value, str) and value:
        return value
    return _now_timestamp()


def _require(uid: str | None) -> str:
    if not uid:
        raise HomeAssistantError("AutiPlanner: uid is required")
    return uid


def _item_from_service(payload: dict) -> RoutineItem:
    status = payload["status"]
    # The API requires completedAt on a completed item and forbids it on any
    # other outcome, so both directions are settled here.
    completed_at = _completed_at(payload) if status == "completed" else None
    return RoutineItem(
        uid=payload[ATTR_UID],
        title=payload["title"],
        date=payload["date"],
        day_part=payload["day_part"],
        status=status,
        description=payload.get("description"),
        start=payload.get("start"),
        due=payload.get("due"),
        timezone=payload.get("timezone"),
        completed_at=completed_at,
        order=payload.get("order"),
        icon=payload.get("icon"),
    )


_PATCH_KEYS = {
    "title": "title",
    "date": "date",
    "day_part": "dayPart",
    "status": "status",
    "description": "description",
    "start": "start",
    "due": "due",
    "timezone": "timezone",
    "completed_at": "completedAt",
    "order": "order",
    "icon": "icon",
}


def _patch_from_service(payload: dict) -> dict:
    patch: dict = {}
    for field, wire in _PATCH_KEYS.items():
        if field in payload and payload[field] is not None:
            patch[wire] = payload[field]
    return patch


def _targets(hass: HomeAssistant, entity_ids: list[str] | None) -> list[AutiPlannerRuntimeData]:
    """Resolves the entries a service call targets.

    With no ``entity_id`` the call applies to every loaded entry, which is what
    a household with one calendar expects from a bare service call.
    """
    entries = hass.config_entries.async_entries(DOMAIN)
    runtimes = {
        entry.entry_id: entry.runtime_data
        for entry in entries
        if getattr(entry, "runtime_data", None) is not None
    }
    if not entity_ids:
        return list(runtimes.values())

    from homeassistant.helpers import entity_registry as er

    registry = er.async_get(hass)
    resolved: list[AutiPlannerRuntimeData] = []
    for entity_id in entity_ids:
        entry = registry.async_get(entity_id)
        # `platform` is the integration; `domain` would be `sensor` or `calendar`.
        if entry is None or entry.platform != DOMAIN:
            continue
        runtime = runtimes.get(entry.config_entry_id or "")
        if runtime is not None and runtime not in resolved:
            resolved.append(runtime)
    return resolved


def _window_days(entry: ConfigEntry) -> int:
    value = entry.options.get(CONF_WINDOW_DAYS, DEFAULT_WINDOW_DAYS)
    try:
        days = int(value)
    except (TypeError, ValueError):
        return DEFAULT_WINDOW_DAYS
    return max(MIN_WINDOW_DAYS, min(MAX_WINDOW_DAYS, days))


def _scan_interval(entry: ConfigEntry) -> int:
    value = entry.options.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL)
    try:
        seconds = int(value)
    except (TypeError, ValueError):
        return DEFAULT_SCAN_INTERVAL
    return max(MIN_SCAN_INTERVAL, min(MAX_SCAN_INTERVAL, seconds))


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Sets up one account+calendar by signing in with the stored token."""
    session = async_get_clientsession(hass)
    client = AutiPlannerClient(session, entry.data[CONF_BASE_URL], entry.data.get(CONF_TOKEN))

    calendar_name = (
        entry.options.get(CONF_CALENDAR_NAME)
        or entry.data.get(CONF_CALENDAR_NAME)
        or "Routine"
    )
    calendar_id = entry.options.get(CONF_CALENDAR_ID) or entry.data[CONF_CALENDAR_ID]
    coordinator = AutiPlannerCoordinator(
        hass,
        entry,
        client,
        calendar_id,
        calendar_name,
        _window_days(entry),
        _scan_interval(entry),
    )
    # Raises ConfigEntryNotReady on a transient failure and ConfigEntryAuthFailed
    # on a rejected token, so the entry is retried or sent to reauth correctly.
    await coordinator.async_config_entry_first_refresh()

    # Best effort: an older server without the feed endpoint must not stop setup.
    feed_url: str | None = None
    try:
        feed_url = await client.feed_url(calendar_id)
    except AutiPlannerApiError as error:
        _LOGGER.debug("AutiPlanner %s: no subscription feed (%s)", calendar_name, error.message)

    entry.runtime_data = AutiPlannerRuntimeData(
        entry=entry,
        client=client,
        coordinator=coordinator,
        calendar_id=calendar_id,
        calendar_name=calendar_name,
        feed_url=feed_url,
    )
    entry.async_on_unload(entry.add_update_listener(_async_update_listener))
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def async_remove_config_entry_device(hass: HomeAssistant, entry: ConfigEntry, device) -> bool:
    """Removing a device from the registry never deletes remote routines."""
    return True


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)
