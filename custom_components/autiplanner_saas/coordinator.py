"""Polls the hosted API and holds the agenda window in memory.

One coordinator serves the calendar entity and the sensors for a config entry,
so a single request per interval feeds every entity.
"""

from __future__ import annotations

import datetime as dt
import logging
from dataclasses import dataclass

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryAuthFailed
from homeassistant.helpers import issue_registry as ir
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.util import dt as dt_util

from .api import (
    Agenda,
    AutiPlannerApiError,
    AutiPlannerAuthError,
    AutiPlannerConnectionError,
    RoutineItem,
)
from .client import AutiPlannerClient
from .const import DOCS_URL, DOMAIN

_LOGGER = logging.getLogger(__name__)

#: The repair issue shown while the server cannot be reached.
ISSUE_SERVER_UNREACHABLE = "server_unreachable"


@dataclass(frozen=True)
class AgendaData:
    """One downloaded window, plus the revision the window was read at."""

    items: tuple[RoutineItem, ...]
    revision: int
    issues: tuple[str, ...]
    window_start: str
    window_end: str

    def for_date(self, day: str) -> tuple[RoutineItem, ...]:
        return tuple(item for item in self.items if item.date == day)


class AutiPlannerCoordinator(DataUpdateCoordinator[AgendaData]):
    """Fetches the agenda window around today on a fixed interval."""

    def __init__(
        self,
        hass: HomeAssistant,
        entry: ConfigEntry,
        client: AutiPlannerClient,
        calendar_id: str,
        calendar_name: str,
        window_days: int,
        scan_interval: int,
    ) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name=f"{DOMAIN} {calendar_name}",
            config_entry=entry,
            update_interval=dt.timedelta(seconds=scan_interval),
        )
        self.client = client
        self.calendar_id = calendar_id
        self.calendar_name = calendar_name
        self.window_days = window_days

    async def _async_update_data(self) -> AgendaData:
        today = dt_util.now().date()
        start = today - dt.timedelta(days=self.window_days)
        end = today + dt.timedelta(days=self.window_days)
        try:
            agenda: Agenda = await self.client.agenda(
                start.isoformat(), self.window_days * 2, self.calendar_id
            )
        except AutiPlannerAuthError as error:
            # Stops polling and starts the reauthentication flow.
            raise ConfigEntryAuthFailed(str(error)) from error
        except AutiPlannerConnectionError as error:
            # A repair issue is how a household learns that the server is not
            # running, rather than entity states quietly going stale.
            self._report_unreachable()
            raise UpdateFailed(str(error)) from error
        except AutiPlannerApiError as error:
            raise UpdateFailed(str(error)) from error
        self._clear_unreachable()
        _LOGGER.debug(
            "AutiPlanner %s: %s items at revision %s",
            self.calendar_name,
            len(agenda.items),
            agenda.revision,
        )
        return AgendaData(
            items=agenda.items,
            revision=agenda.revision,
            issues=agenda.issues,
            window_start=start.isoformat(),
            window_end=end.isoformat(),
        )

    def _issue_id(self) -> str:
        entry = self.config_entry
        return f"{ISSUE_SERVER_UNREACHABLE}_{entry.entry_id if entry is not None else self.name}"

    def _report_unreachable(self) -> None:
        """Raises a repair so a stopped or missing app is visible.

        Home Assistant apps must be installed and started by hand, and an
        integration cannot do either, so the issue explains the two steps.
        """
        ir.async_create_issue(
            self.hass,
            DOMAIN,
            self._issue_id(),
            is_fixable=False,
            severity=ir.IssueSeverity.WARNING,
            translation_key=ISSUE_SERVER_UNREACHABLE,
            translation_placeholders={"url": self.client.base_url},
            learn_more_url=DOCS_URL,
        )

    def _clear_unreachable(self) -> None:
        ir.async_delete_issue(self.hass, DOMAIN, self._issue_id())

    def today(self) -> tuple[RoutineItem, ...]:
        if self.data is None:
            return ()
        return self.data.for_date(dt_util.now().date().isoformat())
