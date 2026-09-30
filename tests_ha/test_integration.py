"""End-to-end tests against a real Home Assistant.

The hosted API is replaced with an in-memory fake so the tests exercise the
integration the way Home Assistant loads it -- config entry, coordinator,
entities, and services -- without a live server.
"""

from __future__ import annotations

import pytest
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.exceptions import HomeAssistantError
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.autiplanner_saas.api import (
    AccountInfo,
    Agenda,
    AutiPlannerAuthError,
    AutiPlannerConflictError,
    Calendar,
    RoutineItem,
    Session,
)

DOMAIN = "autiplanner_saas"


def _item(uid: str, status: str, date: str = "2026-08-11", day_part: str = "morning") -> RoutineItem:
    return RoutineItem(
        uid=uid,
        title=f"Item {uid}",
        date=date,
        day_part=day_part,
        status=status,
        completed_at="2026-08-11T08:05:00Z" if status == "completed" else None,
    )


class FakeClient:
    """A stand-in for AutiPlannerClient that records what it was asked to do."""

    def __init__(self, *args, **kwargs) -> None:
        self.agenda_calls: list[tuple[str, int, str | None]] = []
        self.commands: list[dict] = []
        self.agenda_result = Agenda(items=(_item("a", "pending"),), revision=3, issues=())
        self.agenda_error: Exception | None = None
        self.command_error: Exception | None = None
        self.feed = "http://example.test/api/feed/cal-1/tok.ics"

    async def agenda(self, start: str, days: int, calendar_id: str | None = None) -> Agenda:
        self.agenda_calls.append((start, days, calendar_id))
        if self.agenda_error is not None:
            raise self.agenda_error
        return self.agenda_result

    async def feed_url(self, calendar_id: str) -> str:
        return self.feed

    async def complete(self, uid, **kwargs):
        return await self._record("complete", uid, kwargs)

    async def mark_missed(self, uid, **kwargs):
        return await self._record("mark_missed", uid, kwargs)

    async def skip(self, uid, **kwargs):
        return await self._record("skip", uid, kwargs)

    async def reset(self, uid, **kwargs):
        return await self._record("reset", uid, kwargs)

    async def delete(self, uid, **kwargs):
        return await self._record("delete", uid, kwargs)

    async def create(self, item, **kwargs):
        return await self._record("create", item.uid, kwargs)

    async def update(self, uid, patch, **kwargs):
        return await self._record("update", uid, kwargs)

    async def _record(self, command, uid, kwargs):
        if self.command_error is not None:
            raise self.command_error
        self.commands.append({"command": command, "uid": uid, **kwargs})
        return _item(uid, "completed")


@pytest.fixture
def fake_client(monkeypatch) -> FakeClient:
    client = FakeClient()
    monkeypatch.setattr(
        "custom_components.autiplanner_saas.AutiPlannerClient",
        lambda *args, **kwargs: client,
    )
    return client


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(
        domain=DOMAIN,
        data={
            "base_url": "http://example.test",
            "email": "home@example.com",
            "token": "secret",
            "account_id": "acct",
            "calendar_id": "cal-1",
            "calendar_name": "Routine",
        },
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_setup_creates_entities(hass: HomeAssistant, fake_client: FakeClient) -> None:
    """The entity ids documented for the integration must exist."""
    await _setup(hass)
    for entity_id in (
        "calendar.routine",
        "sensor.routine_today",
        "sensor.routine_agenda",
        "sensor.routine_calendar_issues",
    ):
        assert hass.states.get(entity_id) is not None, f"{entity_id} was not created"


async def test_calendar_exposes_the_subscription_url(
    hass: HomeAssistant, fake_client: FakeClient
) -> None:
    await _setup(hass)
    state = hass.states.get("calendar.routine")
    assert state is not None
    assert state.attributes["feed_url"] == fake_client.feed


async def test_agenda_sensor_keeps_all_four_outcomes(
    hass: HomeAssistant, fake_client: FakeClient
) -> None:
    fake_client.agenda_result = Agenda(
        items=(
            _item("p", "pending"),
            _item("c", "completed"),
            _item("m", "missed"),
            _item("s", "skipped"),
        ),
        revision=7,
        issues=("unknown-property: ignored",),
    )
    await _setup(hass)

    agenda = hass.states.get("sensor.routine_agenda")
    assert agenda is not None
    assert agenda.state == "4"
    statuses = [row["status"] for row in agenda.attributes["items"]]
    assert statuses == ["pending", "completed", "missed", "skipped"]
    assert agenda.attributes["revision"] == 7

    issues = hass.states.get("sensor.routine_calendar_issues")
    assert issues is not None
    assert int(issues.state) == 1


async def test_service_sends_a_command(hass: HomeAssistant, fake_client: FakeClient) -> None:
    await _setup(hass)
    await hass.services.async_call(
        DOMAIN,
        "mark_missed",
        {"uid": "a", "entity_id": "sensor.routine_agenda"},
        blocking=True,
    )
    assert fake_client.commands[-1]["command"] == "mark_missed"
    assert fake_client.commands[-1]["uid"] == "a"


async def test_complete_defaults_a_timestamp(
    hass: HomeAssistant, fake_client: FakeClient
) -> None:
    """The API rejects a complete without completedAt, so the integration adds one."""
    await _setup(hass)
    await hass.services.async_call(
        DOMAIN,
        "complete",
        {"uid": "a", "entity_id": "sensor.routine_agenda"},
        blocking=True,
    )
    assert fake_client.commands[-1]["command"] == "complete"
    assert fake_client.commands[-1]["completed_at"].endswith("Z")


async def test_a_conflict_surfaces_as_an_error(
    hass: HomeAssistant, fake_client: FakeClient
) -> None:
    await _setup(hass)
    fake_client.command_error = AutiPlannerConflictError(409, "revision_conflict", "stale")
    with pytest.raises(HomeAssistantError):
        await hass.services.async_call(
            DOMAIN,
            "skip",
            {"uid": "a", "entity_id": "sensor.routine_agenda"},
            blocking=True,
        )


async def test_a_rejected_token_is_reauthentication(
    hass: HomeAssistant, fake_client: FakeClient
) -> None:
    fake_client.agenda_error = AutiPlannerAuthError(401, "unauthorized", "session expired")
    entry = MockConfigEntry(
        domain=DOMAIN,
        data={
            "base_url": "http://example.test",
            "email": "home@example.com",
            "token": "expired",
            "account_id": "acct",
            "calendar_id": "cal-1",
            "calendar_name": "Routine",
        },
    )
    entry.add_to_hass(hass)
    await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state is not ConfigEntryState.LOADED


class FakeConfigClient:
    """A client the config flow can sign in with, without a network."""

    def __init__(self) -> None:
        self.calendars = (Calendar(id="cal-1", name="Routine"),)
        self.login_error: Exception | None = None

    async def login(self, email: str, password: str) -> Session:
        if self.login_error is not None:
            raise self.login_error
        return Session(token="tok", account_id="acct", email=email, calendar_id="cal-1")

    async def register(self, email: str, password: str) -> Session:
        return await self.login(email, password)

    async def account(self) -> AccountInfo:
        return AccountInfo(account_id="acct", email="home@example.com", calendars=self.calendars)


@pytest.fixture
def config_client(monkeypatch) -> FakeConfigClient:
    client = FakeConfigClient()
    monkeypatch.setattr(
        "custom_components.autiplanner_saas.config_flow.AutiPlannerClient",
        lambda *args, **kwargs: client,
    )
    return client


async def _sign_in(hass: HomeAssistant, client: FakeConfigClient):
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})
    assert result["type"] is FlowResultType.MENU
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"next_step_id": "sign_in"}
    )
    return await hass.config_entries.flow.async_configure(
        result["flow_id"],
        {"base_url": "http://example.test", "email": "home@example.com", "password": "long enough"},
    )


async def test_config_flow_signs_in_and_creates_entry(
    hass: HomeAssistant, config_client: FakeConfigClient
) -> None:
    result = await _sign_in(hass, config_client)
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["data"]["calendar_id"] == "cal-1"
    assert result["data"]["base_url"] == "http://example.test"


async def test_config_flow_reports_bad_credentials(
    hass: HomeAssistant, config_client: FakeConfigClient
) -> None:
    config_client.login_error = AutiPlannerAuthError(401, "unauthorized", "nope")
    result = await _sign_in(hass, config_client)
    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {"base": "invalid_auth"}
