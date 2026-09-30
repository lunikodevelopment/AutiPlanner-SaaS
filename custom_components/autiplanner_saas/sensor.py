"""Sensors that expose the hosted agenda in normalized form.

A generic to-do entity can only express pending versus completed, so it cannot
carry a missed or skipped routine. The agenda sensors keep the four-state
outcome and the day part verbatim, which is the contract every AutiPlanner
client reads.
"""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.const import EntityCategory
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from . import AutiPlannerRuntimeData
from .api import RoutineItem, item_to_attributes
from .const import (
    ATTR_ISSUES,
    ATTR_REVISION,
    ATTR_WINDOW_END,
    ATTR_WINDOW_START,
    CONF_BASE_URL,
    DOMAIN,
    MANUFACTURER,
)
from .coordinator import AutiPlannerCoordinator

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass, config_entry, async_add_entities: AddEntitiesCallback
) -> None:
    runtime: AutiPlannerRuntimeData = config_entry.runtime_data
    async_add_entities(
        [
            AutiPlannerAgendaSensor(runtime, "today"),
            AutiPlannerAgendaSensor(runtime, "agenda"),
            AutiPlannerIssueSensor(runtime),
        ]
    )


class _AutiPlannerBase(CoordinatorEntity[AutiPlannerCoordinator]):
    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, runtime: AutiPlannerRuntimeData) -> None:
        super().__init__(runtime.coordinator)
        self._runtime = runtime
        self._attr_device_info = {
            "identifiers": {(DOMAIN, runtime.entry.entry_id)},
            "name": runtime.calendar_name,
            "manufacturer": MANUFACTURER,
            "entry_type": "service",
            "configuration_url": runtime.entry.data.get(CONF_BASE_URL),
        }


class AutiPlannerAgendaSensor(_AutiPlannerBase, SensorEntity):
    """A JSON agenda that keeps the four outcomes distinct.

    The state is the number of items, which stays short and readable. The full
    list is in the ``items`` attribute.
    """

    def __init__(self, runtime: AutiPlannerRuntimeData, kind: str) -> None:
        super().__init__(runtime)
        self._kind = kind
        self._attr_unique_id = f"{runtime.entry.entry_id}-{kind}"
        self._attr_name = "Today" if kind == "today" else "Agenda"
        self._attr_icon = "mdi:calendar-today" if kind == "today" else "mdi:format-list-checks"

    def _rows(self) -> tuple[RoutineItem, ...]:
        if self._kind == "today":
            return self.coordinator.today()
        return self.coordinator.data.items if self.coordinator.data else ()

    @property
    def native_value(self) -> int:
        return len(self._rows())

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        data = self.coordinator.data
        return {
            "items": [item_to_attributes(item) for item in self._rows()],
            ATTR_WINDOW_START: data.window_start if data else None,
            ATTR_WINDOW_END: data.window_end if data else None,
            ATTR_REVISION: data.revision if data else None,
            ATTR_ISSUES: list(data.issues) if data else [],
        }


class AutiPlannerIssueSensor(_AutiPlannerBase, SensorEntity):
    """Surfaces calendar import problems so a broken file is visible, not silent."""

    _attr_icon = "mdi:alert-circle-outline"
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    def __init__(self, runtime: AutiPlannerRuntimeData) -> None:
        super().__init__(runtime)
        self._attr_unique_id = f"{runtime.entry.entry_id}-issues"
        self._attr_name = "Calendar issues"

    @property
    def native_value(self) -> int:
        data = self.coordinator.data
        return len(data.issues) if data else 0

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        data = self.coordinator.data
        return {
            "issues": list(data.issues) if data else [],
            ATTR_REVISION: data.revision if data else None,
        }
