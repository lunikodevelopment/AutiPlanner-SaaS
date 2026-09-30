"""Calendar entity for the hosted AutiPlanner API.

The entity is read-only. Routine outcomes are not ``VEVENT`` semantics, so the
calendar platform never accepts create/update/delete. Mutations go through the
AutiPlanner services, which preserve the four-state outcome.
"""

from __future__ import annotations

import datetime as dt
import logging
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from homeassistant.components.calendar import CalendarEntity, CalendarEvent
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import ConfigEntryAuthFailed, HomeAssistantError
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.util import dt as dt_util

from . import AutiPlannerRuntimeData
from .api import AutiPlannerApiError, AutiPlannerAuthError, RoutineItem
from .const import (
    ATTR_FEED_URL,
    ATTR_ISSUES,
    ATTR_REVISION,
    CONF_BASE_URL,
    DOMAIN,
    MANUFACTURER,
)
from .coordinator import AutiPlannerCoordinator

_LOGGER = logging.getLogger(__name__)

#: AutiPlanner day parts are all-day items unless a start time is given. A timed
#: item still needs an end, so a short default duration is used.
_DEFAULT_DURATION = dt.timedelta(minutes=30)

_OUTCOME_SYMBOL = {
    "pending": "○",
    "completed": "✓",
    "missed": "✕",
    "skipped": "—",
}


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    async_add_entities(
        [AutiPlannerCalendar(config_entry.runtime_data)]
    )


class AutiPlannerCalendar(CoordinatorEntity[AutiPlannerCoordinator], CalendarEntity):
    """Exposes routine items as calendar events with the full outcome."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:calendar-check"
    _attr_name = None

    def __init__(self, runtime: AutiPlannerRuntimeData) -> None:
        super().__init__(runtime.coordinator)
        self._runtime = runtime
        self._attr_unique_id = f"{runtime.entry.entry_id}-calendar"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, runtime.entry.entry_id)},
            "name": runtime.calendar_name,
            "manufacturer": MANUFACTURER,
            "entry_type": "service",
            "configuration_url": runtime.entry.data.get(CONF_BASE_URL),
        }

    @property
    def event(self) -> CalendarEvent | None:
        """The next upcoming event, for the state and the frontend card."""
        data = self.coordinator.data
        if data is None:
            return None
        tz = _zone()
        now = dt_util.now()
        upcoming: list[CalendarEvent] = []
        for item in data.items:
            if item.status in ("missed", "skipped"):
                continue
            event = _to_event(item, tz)
            if event is None:
                continue
            if _start_of(event, tz) >= now:
                upcoming.append(event)
        if not upcoming:
            return None
        return min(upcoming, key=lambda event: _start_of(event, tz))

    @property
    def extra_state_attributes(self) -> dict[str, object]:
        data = self.coordinator.data
        return {
            ATTR_REVISION: data.revision if data else None,
            ATTR_ISSUES: "; ".join(data.issues) if data else "",
            # Copy this into Google Calendar ("From URL") or Apple Calendar
            # ("Add subscription calendar").
            ATTR_FEED_URL: self._runtime.feed_url,
        }

    async def async_get_events(
        self, hass: HomeAssistant, start_date: dt.datetime, end_date: dt.datetime
    ) -> list[CalendarEvent]:
        """Return events in a range, fetching that range from the API.

        The coordinator only holds a window around today, but the calendar
        panel asks for whatever month the household is looking at. Fetching the
        requested range keeps the entity correct without polling a year at a
        time.
        """
        tz = _zone()
        start_day = dt_util.as_local(start_date).date()
        end_day = dt_util.as_local(end_date).date()
        days = max(1, min(90, (end_day - start_day).days or 1))
        try:
            agenda = await self._runtime.client.agenda(
                start_day.isoformat(), days, self._runtime.calendar_id
            )
        except AutiPlannerAuthError as error:
            raise ConfigEntryAuthFailed(str(error)) from error
        except AutiPlannerApiError as error:
            raise HomeAssistantError(str(error)) from error

        events: list[CalendarEvent] = []
        for item in agenda.items:
            event = _to_event(item, tz)
            if event is None:
                continue
            if _start_of(event, tz) < end_date and _end_of(event, tz) > start_date:
                events.append(event)
        events.sort(key=lambda event: _start_of(event, tz))
        return events


def _start_of(event: CalendarEvent, tz: ZoneInfo) -> dt.datetime:
    return _as_datetime(event.start, tz)


def _end_of(event: CalendarEvent, tz: ZoneInfo) -> dt.datetime:
    return _as_datetime(event.end, tz)


def _as_datetime(value: dt.date | dt.datetime, tz: ZoneInfo) -> dt.datetime:
    """All-day events are dates; compare them at local midnight."""
    if isinstance(value, dt.datetime):
        return value.astimezone(tz) if value.tzinfo else value.replace(tzinfo=tz)
    return dt.datetime.combine(value, dt.time.min, tzinfo=tz)


def _to_event(item: RoutineItem, tz: ZoneInfo) -> CalendarEvent | None:
    """Maps one routine item onto a calendar event.

    The AutiPlanner outcome is carried in the summary glyph and the description,
    so a client that only understands standard calendar events still receives a
    coherent event and never mistakes a missed routine for a completed one.
    """
    start = _local_start(item, tz)
    if start is None:
        return None
    all_day = item.start is None
    end = start + dt.timedelta(days=1) if all_day else start + _DEFAULT_DURATION
    parts = [f"Outcome: {item.status}", f"Day part: {item.day_part}"]
    if item.completed_at:
        parts.append(f"Completed: {item.completed_at}")
    if item.description:
        parts.append(item.description)
    # CalendarEvent.start and end must be the same type, and an all-day event
    # must use a date rather than a datetime.
    return CalendarEvent(
        start=start.date() if all_day else start,
        end=end.date() if all_day else end,
        summary=f"{_OUTCOME_SYMBOL.get(item.status, '○')} {item.title}",
        description="\n".join(parts),
        uid=item.uid,
    )


def _local_start(item: RoutineItem, tz: ZoneInfo) -> dt.datetime | None:
    """Resolves an event start without guessing a timezone.

    An all-day item uses the stored local date. A zoned item uses its ``TZID``.
    A UTC timestamp is converted; a floating timestamp is a local clock and is
    attached to the Home Assistant timezone.
    """
    try:
        day = dt.date.fromisoformat(item.date)
    except ValueError:
        _LOGGER.warning("AutiPlanner: item %s has an unreadable date %r", item.uid, item.date)
        return None
    if item.start is None:
        return dt.datetime.combine(day, dt.time.min, tzinfo=tz)
    if item.start.endswith("Z"):
        try:
            stamp = dt.datetime.fromisoformat(item.start.replace("Z", "+00:00"))
        except ValueError:
            return dt.datetime.combine(day, dt.time.min, tzinfo=tz)
        return stamp.astimezone(tz)
    try:
        clock = dt.time.fromisoformat(item.start.split("T", 1)[1])
    except (IndexError, ValueError):
        return dt.datetime.combine(day, dt.time.min, tzinfo=tz)
    zone = tz
    if item.timezone:
        zone = _zone_from_name(item.timezone) or tz
    return dt.datetime.combine(day, clock, tzinfo=zone)


def _zone() -> ZoneInfo:
    return dt_util.get_default_time_zone()


def _zone_from_name(name: str) -> ZoneInfo | None:
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return None
