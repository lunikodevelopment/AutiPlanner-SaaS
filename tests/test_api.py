"""Unit tests for the pure API helpers.

These run with the standard library only, no Home Assistant and no aiohttp, so
the wire shaping stays verifiable on its own. ``api.py`` is loaded from its file
path because importing the package would pull in Home Assistant through
``__init__.py``.
"""

from __future__ import annotations

import importlib.util
import pathlib
import sys
import unittest

_API_PATH = (
    pathlib.Path(__file__).resolve().parents[1]
    / "custom_components"
    / "autiplanner_saas"
    / "api.py"
)
_spec = importlib.util.spec_from_file_location("autiplanner_saas_api", _API_PATH)
assert _spec is not None and _spec.loader is not None
api = importlib.util.module_from_spec(_spec)
# dataclasses resolves annotations through sys.modules, so register before exec.
sys.modules[_spec.name] = api
_spec.loader.exec_module(api)


class NormalizeBaseUrlTests(unittest.TestCase):
    def test_strips_a_trailing_slash(self) -> None:
        self.assertEqual(api.normalize_base_url("http://host:8080/"), "http://host:8080")

    def test_requires_a_scheme(self) -> None:
        with self.assertRaises(ValueError):
            api.normalize_base_url("host:8080")

    def test_rejects_an_empty_value(self) -> None:
        with self.assertRaises(ValueError):
            api.normalize_base_url("   ")


class ErrorMappingTests(unittest.TestCase):
    def test_a_401_is_an_auth_error(self) -> None:
        error = api.error_from_response(401, {"error": {"code": "unauthorized", "message": "no"}})
        self.assertIsInstance(error, api.AutiPlannerAuthError)
        self.assertEqual(error.code, "unauthorized")

    def test_a_409_is_a_conflict(self) -> None:
        error = api.error_from_response(
            409, {"error": {"code": "revision_conflict", "message": "stale"}}
        )
        self.assertIsInstance(error, api.AutiPlannerConflictError)

    def test_an_html_body_still_yields_a_message(self) -> None:
        error = api.error_from_response(502, "<html>bad gateway</html>")
        self.assertEqual(error.status, 502)
        self.assertIn("502", error.message)


class RoutineItemTests(unittest.TestCase):
    def test_round_trips_the_wire_shape(self) -> None:
        payload = {
            "uid": "a@example",
            "title": "Brush teeth",
            "date": "2026-08-11",
            "dayPart": "morning",
            "status": "missed",
            "description": "two minutes",
        }
        item = api.RoutineItem.from_payload(payload)
        self.assertEqual(item.day_part, "morning")
        self.assertEqual(item.status, "missed")
        # A missed item carries no completedAt at all.
        self.assertNotIn("completedAt", item.to_payload())
        self.assertEqual(item.to_payload(), payload)

    def test_rejects_an_unknown_outcome(self) -> None:
        with self.assertRaises(api.AutiPlannerApiError):
            api.RoutineItem.from_payload(
                {"uid": "a", "title": "t", "date": "2026-08-11", "dayPart": "morning", "status": "done"}
            )

    def test_rejects_an_unknown_day_part(self) -> None:
        with self.assertRaises(api.AutiPlannerApiError):
            api.RoutineItem.from_payload(
                {"uid": "a", "title": "t", "date": "2026-08-11", "dayPart": "dawn", "status": "pending"}
            )


class ParseAgendaTests(unittest.TestCase):
    def test_reads_items_revision_and_issues(self) -> None:
        agenda = api.parse_agenda(
            {
                "items": [
                    {
                        "uid": "a",
                        "title": "t",
                        "date": "2026-08-11",
                        "dayPart": "night",
                        "status": "pending",
                    }
                ],
                "revision": 4,
                "issues": ["unknown-property: X-UNKNOWN"],
            }
        )
        self.assertEqual(len(agenda.items), 1)
        self.assertEqual(agenda.revision, 4)
        self.assertEqual(agenda.issues, ("unknown-property: X-UNKNOWN",))

    def test_defaults_a_missing_revision_to_zero(self) -> None:
        agenda = api.parse_agenda({"items": []})
        self.assertEqual(agenda.revision, 0)


class ParseSessionTests(unittest.TestCase):
    def test_reads_the_token_and_calendar(self) -> None:
        session = api.parse_session(
            {"token": "abc", "account": {"id": "acct", "email": "a@b"}, "calendarId": "cal"}
        )
        self.assertEqual(session.token, "abc")
        self.assertEqual(session.calendar_id, "cal")

    def test_rejects_a_missing_token(self) -> None:
        with self.assertRaises(api.AutiPlannerApiError):
            api.parse_session({"account": {"id": "acct"}})


class BuildCommandTests(unittest.TestCase):
    def test_includes_only_the_fields_provided(self) -> None:
        body = api.build_command("mark_missed", uid="a")
        self.assertEqual(body, {"command": "mark_missed", "uid": "a"})

    def test_create_carries_the_item(self) -> None:
        item = api.RoutineItem(
            uid="a", title="t", date="2026-08-11", day_part="evening", status="pending"
        )
        body = api.build_command("create", item=item)
        self.assertEqual(body["item"]["dayPart"], "evening")

    def test_add_series_carries_the_rule(self) -> None:
        series = api.RoutineTemplate(
            uid="swimming@example",
            title="Swimming",
            date="2026-09-30",
            day_part="afternoon",
            recurrence={"freq": "weekly", "byDay": ["WE"]},
            start="2026-09-30T15:00:00",
        )
        body = api.build_command("add_series", series=series)
        self.assertEqual(body["command"], "add_series")
        self.assertEqual(body["series"]["recurrence"], {"freq": "weekly", "byDay": ["WE"]})
        self.assertEqual(body["series"]["dayPart"], "afternoon")
        self.assertEqual(body["series"]["start"], "2026-09-30T15:00:00")

    def test_a_series_carries_no_completion(self) -> None:
        """An outcome belongs to one day, so a template must not smuggle one in.

        The API rejects a template that carries status or completedAt, which is
        why the payload is built from a type that has no such fields.
        """
        series = api.RoutineTemplate(
            uid="meds@example",
            title="Medication",
            date="2026-09-30",
            day_part="morning",
            recurrence={"freq": "daily"},
        )
        payload = series.to_payload()
        self.assertNotIn("status", payload)
        self.assertNotIn("completedAt", payload)
        self.assertNotIn("routineId", payload)
        self.assertEqual(payload["recurrence"], {"freq": "daily"})

    def test_excluded_dates_survive_the_wire(self) -> None:
        series = api.RoutineTemplate(
            uid="meds@example",
            title="Medication",
            date="2026-09-30",
            day_part="morning",
            recurrence={"freq": "daily"},
            exdates=["2026-10-05"],
        )
        body = api.build_command("add_series", series=series)
        self.assertEqual(body["series"]["exdates"], ["2026-10-05"])

    def test_rejects_an_unknown_command(self) -> None:
        with self.assertRaises(ValueError):
            api.build_command("explode")


class ParseAccountTests(unittest.TestCase):
    def test_reads_calendars(self) -> None:
        account = api.parse_account(
            {
                "account": {"id": "acct", "email": "a@b"},
                "calendars": [{"id": "c1", "name": "Routine"}, {"id": "c2"}],
            }
        )
        self.assertEqual(account.email, "a@b")
        self.assertEqual(len(account.calendars), 2)
        self.assertEqual(account.calendars[1].name, "Routine")


if __name__ == "__main__":
    unittest.main()
