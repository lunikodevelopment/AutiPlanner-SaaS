"""Config flow for the hosted AutiPlanner integration.

The flow signs in against the API, stores the bearer token in the config entry,
and lets the household pick which of their calendars this entry tracks. Signing
in is verified before the entry is created, so a wrong address or password is a
form error rather than a broken entry.
"""

from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.selector import (
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectOptionDict,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
    TextSelector,
    TextSelectorConfig,
    TextSelectorType,
)

from .api import (
    AccountInfo,
    AutiPlannerApiError,
    AutiPlannerAuthError,
    AutiPlannerConnectionError,
    Session,
    normalize_base_url,
)
from .client import AutiPlannerClient
from .const import (
    CONF_ACCOUNT_ID,
    CONF_BASE_URL,
    CONF_CALENDAR_ID,
    CONF_CALENDAR_NAME,
    CONF_EMAIL,
    CONF_SCAN_INTERVAL,
    CONF_TOKEN,
    CONF_WINDOW_DAYS,
    DEFAULT_SCAN_INTERVAL,
    DEFAULT_WINDOW_DAYS,
    DOMAIN,
    MAX_SCAN_INTERVAL,
    MAX_WINDOW_DAYS,
    MIN_SCAN_INTERVAL,
    MIN_WINDOW_DAYS,
)

_LOGGER = logging.getLogger(__name__)

DEFAULT_BASE_URL = "http://homeassistant.local:8080"


def _credentials_schema(defaults: dict[str, Any] | None = None) -> vol.Schema:
    defaults = defaults or {}
    return vol.Schema(
        {
            vol.Required(
                CONF_BASE_URL, default=defaults.get(CONF_BASE_URL, DEFAULT_BASE_URL)
            ): TextSelector(TextSelectorConfig(type=TextSelectorType.URL)),
            vol.Required(CONF_EMAIL, default=defaults.get(CONF_EMAIL, "")): TextSelector(
                TextSelectorConfig(type=TextSelectorType.EMAIL, autocomplete="username")
            ),
            vol.Required("password"): TextSelector(
                TextSelectorConfig(type=TextSelectorType.PASSWORD, autocomplete="current-password")
            ),
        }
    )


class AutiPlannerConfigFlow(ConfigFlow, domain=DOMAIN):
    """Sign in to a hosted AutiPlanner server."""

    VERSION = 1

    def __init__(self) -> None:
        self._base_url: str = ""
        self._email: str = ""
        self._token: str = ""
        self._account: AccountInfo | None = None

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Ask whether to sign in to an existing account or make a new one."""
        return self.async_show_menu(
            step_id="user",
            menu_options=["sign_in", "register"],
            description_placeholders={"default_url": DEFAULT_BASE_URL},
        )

    async def async_step_sign_in(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            session, errors = await self._authenticate(user_input, register=False)
            if session is not None:
                await self._store_session(session, user_input)
                return await self._choose_calendar()
        return self.async_show_form(
            step_id="sign_in",
            data_schema=_credentials_schema(user_input),
            errors=errors,
            description_placeholders={"default_url": DEFAULT_BASE_URL},
        )

    async def async_step_register(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            session, errors = await self._authenticate(user_input, register=True)
            if session is not None:
                await self._store_session(session, user_input)
                return await self._choose_calendar()
        return self.async_show_form(
            step_id="register",
            data_schema=_credentials_schema(user_input),
            errors=errors,
            description_placeholders={"default_url": DEFAULT_BASE_URL},
        )

    async def async_step_calendar(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Pick a calendar when the account has more than one."""
        assert self._account is not None
        if user_input is not None:
            return await self._create_entry(user_input[CONF_CALENDAR_ID])
        return self.async_show_form(
            step_id="calendar",
            data_schema=vol.Schema(
                {vol.Required(CONF_CALENDAR_ID): _calendar_selector(self._account)}
            ),
        )

    async def async_step_reauth(self, entry_data: dict[str, Any]) -> ConfigFlowResult:
        return await self.async_step_reauth_confirm()

    async def async_step_reauth_confirm(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        entry = self._get_reauth_entry()
        errors: dict[str, str] = {}
        if user_input is not None:
            credentials = {
                CONF_BASE_URL: entry.data[CONF_BASE_URL],
                CONF_EMAIL: entry.data[CONF_EMAIL],
                "password": user_input["password"],
            }
            session, errors = await self._authenticate(credentials, register=False)
            if session is not None:
                self.hass.config_entries.async_update_entry(
                    entry, data={**entry.data, CONF_TOKEN: session.token}
                )
                return self.async_abort(reason="reauth_successful")
        return self.async_show_form(
            step_id="reauth_confirm",
            data_schema=vol.Schema(
                {
                    vol.Required("password"): TextSelector(
                        TextSelectorConfig(
                            type=TextSelectorType.PASSWORD, autocomplete="current-password"
                        )
                    )
                }
            ),
            description_placeholders={"email": entry.data[CONF_EMAIL]},
            errors=errors,
        )

    # -- helpers -----------------------------------------------------------

    async def _authenticate(
        self, user_input: dict[str, Any], *, register: bool
    ) -> tuple[Session | None, dict[str, str]]:
        try:
            base_url = normalize_base_url(user_input[CONF_BASE_URL])
        except ValueError:
            return None, {"base": "invalid_url"}
        client = AutiPlannerClient(async_get_clientsession(self.hass), base_url)
        try:
            if register:
                return await client.register(user_input[CONF_EMAIL], user_input["password"]), {}
            return await client.login(user_input[CONF_EMAIL], user_input["password"]), {}
        except AutiPlannerAuthError:
            return None, {"base": "invalid_auth"}
        except AutiPlannerConnectionError:
            return None, {"base": "cannot_connect"}
        except AutiPlannerApiError as error:
            return None, {"base": _error_key(error)}

    async def _store_session(self, session: Session, user_input: dict[str, Any]) -> None:
        self._base_url = normalize_base_url(user_input[CONF_BASE_URL])
        self._email = user_input[CONF_EMAIL]
        self._token = session.token
        client = AutiPlannerClient(
            async_get_clientsession(self.hass), self._base_url, session.token
        )
        try:
            self._account = await client.account()
        except AutiPlannerApiError:
            # The account lookup is only needed to name the calendars. The
            # calendar id the sign-in returned is enough to set the entry up.
            from .api import Calendar

            calendar_id = session.calendar_id or ""
            self._account = AccountInfo(
                account_id=session.account_id,
                email=session.email,
                calendars=(Calendar(id=calendar_id, name="Routine"),)
                if calendar_id
                else (),
            )

    async def _choose_calendar(self) -> ConfigFlowResult:
        assert self._account is not None
        calendars = self._account.calendars
        if not calendars:
            return self.async_abort(reason="no_calendars")
        if len(calendars) == 1:
            return await self._create_entry(calendars[0].id)
        return await self.async_step_calendar()

    async def _create_entry(self, calendar_id: str) -> ConfigFlowResult:
        assert self._account is not None
        calendar = next(
            (entry for entry in self._account.calendars if entry.id == calendar_id),
            self._account.calendars[0],
        )
        await self.async_set_unique_id(f"{self._account.account_id}:{calendar.id}")
        self._abort_if_unique_id_configured()
        return self.async_create_entry(
            title=calendar.name,
            data={
                CONF_BASE_URL: self._base_url,
                CONF_EMAIL: self._email,
                CONF_TOKEN: self._token,
                CONF_ACCOUNT_ID: self._account.account_id,
                CONF_CALENDAR_ID: calendar.id,
                CONF_CALENDAR_NAME: calendar.name,
            },
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> AutiPlannerOptionsFlow:
        return AutiPlannerOptionsFlow()


class AutiPlannerOptionsFlow(OptionsFlow):
    """Changes the poll window, the interval, or which calendar is tracked."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        current = self.config_entry.options
        errors: dict[str, str] = {}
        account = await self._account()
        if user_input is not None:
            data: dict[str, Any] = {
                CONF_WINDOW_DAYS: user_input[CONF_WINDOW_DAYS],
                CONF_SCAN_INTERVAL: user_input[CONF_SCAN_INTERVAL],
            }
            selected = user_input.get(CONF_CALENDAR_ID)
            if selected and selected != self.config_entry.data[CONF_CALENDAR_ID]:
                data[CONF_CALENDAR_ID] = selected
                data[CONF_CALENDAR_NAME] = _calendar_name(account, selected)
            return self.async_create_entry(title="", data=data)

        schema_fields: dict[Any, Any] = {
            vol.Required(
                CONF_WINDOW_DAYS,
                default=current.get(CONF_WINDOW_DAYS, DEFAULT_WINDOW_DAYS),
            ): NumberSelector(
                NumberSelectorConfig(
                    min=MIN_WINDOW_DAYS, max=MAX_WINDOW_DAYS, mode=NumberSelectorMode.BOX
                )
            ),
            vol.Required(
                CONF_SCAN_INTERVAL,
                default=current.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL),
            ): NumberSelector(
                NumberSelectorConfig(
                    min=MIN_SCAN_INTERVAL, max=MAX_SCAN_INTERVAL, mode=NumberSelectorMode.BOX
                )
            ),
        }
        if account is not None and len(account.calendars) > 1:
            schema_fields[
                vol.Optional(
                    CONF_CALENDAR_ID, default=self.config_entry.data[CONF_CALENDAR_ID]
                )
            ] = _calendar_selector(account)
        return self.async_show_form(
            step_id="init", data_schema=vol.Schema(schema_fields), errors=errors
        )

    async def _account(self) -> AccountInfo | None:
        entry = self.config_entry
        client = AutiPlannerClient(
            async_get_clientsession(self.hass), entry.data[CONF_BASE_URL], entry.data[CONF_TOKEN]
        )
        try:
            return await client.account()
        except AutiPlannerApiError:
            return None


def _calendar_selector(account: AccountInfo) -> SelectSelector:
    return SelectSelector(
        SelectSelectorConfig(
            options=[
                SelectOptionDict(value=calendar.id, label=calendar.name)
                for calendar in account.calendars
            ],
            mode=SelectSelectorMode.DROPDOWN,
        )
    )


def _calendar_name(account: AccountInfo | None, calendar_id: str) -> str:
    if account is not None:
        for calendar in account.calendars:
            if calendar.id == calendar_id:
                return calendar.name
    return "Routine"


def _error_key(error: AutiPlannerApiError) -> str:
    if error.code == "email_taken":
        return "email_taken"
    if error.code == "registration_closed":
        return "registration_closed"
    if error.code == "invalid_email":
        return "invalid_email"
    if error.code == "invalid_password":
        return "invalid_password"
    _LOGGER.warning("AutiPlanner config flow: %s (%s)", error.message, error.code)
    return "unknown"


__all__ = ["AutiPlannerConfigFlow", "AutiPlannerOptionsFlow"]
