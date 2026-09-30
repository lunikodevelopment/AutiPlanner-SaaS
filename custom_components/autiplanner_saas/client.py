"""The aiohttp transport for the hosted AutiPlanner API.

Only aiohttp is imported here, never Home Assistant, so the client can be
driven from a test without the Home Assistant harness. The Home Assistant side
passes in its shared client session, which keeps the connection pool shared with
the rest of Core instead of opening a second one per config entry.
"""

from __future__ import annotations

import logging
from typing import Any

import aiohttp

from .api import (
    AccountInfo,
    Agenda,
    AutiPlannerApiError,
    AutiPlannerAuthError,
    AutiPlannerConnectionError,
    RoutineItem,
    RoutineTemplate,
    Session,
    build_command,
    error_from_response,
    normalize_base_url,
    parse_account,
    parse_agenda,
    parse_item_response,
    parse_session,
)

_LOGGER = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 30


class AutiPlannerClient:
    """Talks to one AutiPlanner server on behalf of one account."""

    def __init__(
        self,
        session: aiohttp.ClientSession,
        base_url: str,
        token: str | None = None,
        *,
        timeout: int = DEFAULT_TIMEOUT,
    ) -> None:
        self._session = session
        self.base_url = normalize_base_url(base_url)
        self.token = token
        self._timeout = aiohttp.ClientTimeout(total=timeout)

    # -- authentication ----------------------------------------------------

    async def login(self, email: str, password: str) -> Session:
        payload = await self._request(
            "POST", "/api/auth/login", json_body={"email": email, "password": password}
        )
        return parse_session(payload)

    async def register(self, email: str, password: str) -> Session:
        payload = await self._request(
            "POST", "/api/auth/register", json_body={"email": email, "password": password}
        )
        return parse_session(payload)

    # -- reads -------------------------------------------------------------

    async def account(self) -> AccountInfo:
        payload = await self._request("GET", "/api/me")
        return parse_account(payload)

    async def feed_path(self, calendar_id: str) -> str:
        """The subscription path a calendar app can add, minting the token.

        The path is relative; callers prepend :attr:`base_url`. Kept separate
        from a bare string so a server that predates the feed feature surfaces
        as an ``AutiPlannerApiError`` the caller can ignore.
        """
        payload = await self._request("GET", f"/api/calendars/{calendar_id}/feed")
        feed = payload.get("feed")
        path = feed.get("path") if isinstance(feed, dict) else None
        if not isinstance(path, str) or not path:
            raise AutiPlannerApiError(0, "malformed_response", "the server returned no feed path")
        return path

    async def feed_url(self, calendar_id: str) -> str:
        return f"{self.base_url}{await self.feed_path(calendar_id)}"

    async def health(self) -> dict[str, Any]:
        return await self._request("GET", "/api/health", authenticated=False)

    async def agenda(self, start: str, days: int, calendar_id: str | None = None) -> Agenda:
        params: dict[str, str] = {"from": start, "days": str(days)}
        if calendar_id:
            params["calendarId"] = calendar_id
        payload = await self._request("GET", "/api/agenda", params=params)
        return parse_agenda(payload)

    # -- writes ------------------------------------------------------------

    async def command(self, body: dict[str, Any]) -> RoutineItem | None:
        """Applies one command and returns the item the server confirmed."""
        payload = await self._request("POST", "/api/command", json_body=body)
        return parse_item_response(payload)

    async def complete(
        self,
        uid: str,
        *,
        completed_at: str | None = None,
        expected_revision: int | None = None,
        calendar_id: str | None = None,
    ) -> RoutineItem | None:
        return await self._command(
            "complete",
            calendar_id,
            uid=uid,
            completed_at=completed_at,
            expected_revision=expected_revision,
        )

    async def mark_missed(
        self, uid: str, *, expected_revision: int | None = None, calendar_id: str | None = None
    ) -> RoutineItem | None:
        return await self._command(
            "mark_missed", calendar_id, uid=uid, expected_revision=expected_revision
        )

    async def skip(
        self, uid: str, *, expected_revision: int | None = None, calendar_id: str | None = None
    ) -> RoutineItem | None:
        return await self._command(
            "skip", calendar_id, uid=uid, expected_revision=expected_revision
        )

    async def reset(
        self, uid: str, *, expected_revision: int | None = None, calendar_id: str | None = None
    ) -> RoutineItem | None:
        return await self._command(
            "reset", calendar_id, uid=uid, expected_revision=expected_revision
        )

    async def delete(
        self, uid: str, *, expected_revision: int | None = None, calendar_id: str | None = None
    ) -> RoutineItem | None:
        return await self._command(
            "delete", calendar_id, uid=uid, expected_revision=expected_revision
        )

    async def create(
        self,
        item: RoutineItem,
        *,
        expected_revision: int | None = None,
        calendar_id: str | None = None,
    ) -> RoutineItem | None:
        return await self._command(
            "create", calendar_id, item=item, expected_revision=expected_revision
        )

    async def add_series(
        self,
        series: RoutineTemplate,
        *,
        expected_revision: int | None = None,
        calendar_id: str | None = None,
    ) -> RoutineItem | None:
        """Stores a repeating routine. The server expands it on read."""
        return await self._command(
            "add_series", calendar_id, series=series, expected_revision=expected_revision
        )

    async def update(
        self,
        uid: str,
        patch: dict[str, Any],
        *,
        expected_revision: int | None = None,
        calendar_id: str | None = None,
    ) -> RoutineItem | None:
        return await self._command(
            "update",
            calendar_id,
            uid=uid,
            patch=patch,
            expected_revision=expected_revision,
        )

    async def _command(
        self,
        command: str,
        calendar_id: str | None,
        *,
        uid: str | None = None,
        completed_at: str | None = None,
        expected_revision: int | None = None,
        item: RoutineItem | None = None,
        series: RoutineTemplate | None = None,
        patch: dict[str, Any] | None = None,
    ) -> RoutineItem | None:
        body = build_command(
            command,
            uid=uid,
            completed_at=completed_at,
            expected_revision=expected_revision,
            item=item,
            series=series,
            patch=patch,
        )
        if calendar_id:
            body["calendarId"] = calendar_id
        return await self.command(body)

    # -- transport ---------------------------------------------------------

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json_body: dict[str, Any] | None = None,
        params: dict[str, str] | None = None,
        authenticated: bool = True,
    ) -> Any:
        headers = {"accept": "application/json"}
        if authenticated and self.token:
            headers["authorization"] = f"Bearer {self.token}"
        url = f"{self.base_url}{path}"
        try:
            async with self._session.request(
                method,
                url,
                json=json_body,
                params=params,
                headers=headers,
                timeout=self._timeout,
            ) as response:
                payload = await _json(response)
                if response.status >= 400:
                    raise error_from_response(response.status, payload)
                if not isinstance(payload, dict):
                    raise AutiPlannerApiError(
                        response.status, "malformed_response", "the server did not return JSON"
                    )
                return payload
        except AutiPlannerApiError:
            raise
        except (aiohttp.ClientError, TimeoutError) as error:
            raise AutiPlannerConnectionError(
                0, "cannot_connect", f"Could not reach {self.base_url}: {error}"
            ) from error


async def _json(response: aiohttp.ClientResponse) -> Any:
    """Reads a JSON body, tolerating a missing content type.

    A reverse proxy in front of the API may serve an error page without the
    ``application/json`` header. ``content_type=None`` lets the body be read so
    the real message survives instead of becoming a generic failure.
    """
    if response.status == 204:
        return {}
    try:
        return await response.json(content_type=None)
    except ValueError:
        text = await response.text()
        return {"error": {"code": "malformed_response", "message": text[:200]}}
    except aiohttp.ClientError:
        return {}


__all__ = ["AutiPlannerClient", "AutiPlannerAuthError", "AutiPlannerConnectionError"]
