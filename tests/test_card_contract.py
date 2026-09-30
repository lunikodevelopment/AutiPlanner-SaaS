"""The card and the integration must agree on what a routine item looks like.

The dashboard card is written in TypeScript and reads the agenda sensors, so
nothing in the type system connects it to ``item_to_attributes``. This test pins
the shape the card depends on, and regenerates the fixture the card's
contract test runs against, so a change on either side that the other does not
expect fails here rather than in a dashboard.
"""

from __future__ import annotations

import importlib.util
import json
import pathlib
import re
import sys
import unittest

# `api.py` and `const.py` are loaded from their file paths, as in test_api.py:
# importing the package would pull in Home Assistant, and this suite runs on the
# standard library alone.
_MODULE_PATHS = {
    "autiplanner_saas_api": "custom_components/autiplanner_saas/api.py",
    "autiplanner_saas_const": "custom_components/autiplanner_saas/const.py",
}
for _name, _relative in _MODULE_PATHS.items():
    _path = pathlib.Path(__file__).resolve().parents[1] / _relative
    _spec = importlib.util.spec_from_file_location(_name, _path)
    assert _spec is not None and _spec.loader is not None
    _module = importlib.util.module_from_spec(_spec)
    # dataclasses resolves annotations through sys.modules, so register first.
    sys.modules[_name] = _module
    _spec.loader.exec_module(_module)

api = sys.modules["autiplanner_saas_api"]
const = sys.modules["autiplanner_saas_const"]

RoutineItem = api.RoutineItem
item_to_attributes = api.item_to_attributes

FIXTURE = (
    pathlib.Path(__file__).resolve().parents[1]
    / "apps"
    / "card"
    / "test"
    / "fixtures"
    / "agenda-state.json"
)
CARD_SOURCE = (
    pathlib.Path(__file__).resolve().parents[1] / "apps" / "card" / "src" / "index.ts"
)
CORE_MODEL = (
    pathlib.Path(__file__).resolve().parents[1] / "packages" / "core" / "src" / "model.ts"
)

#: The fields the card's type guard requires before it will draw an item. An
#: item missing any of them is skipped, which would show up as an empty card
#: with no explanation.
REQUIRED = ("uid", "title", "date", "dayPart", "status")

#: The sensor attributes the card reads. `window_start` and `window_end` are
#: deliberately absent: the card shows its own day headings and never needed
#: them, so they are not part of the contract.
EXPECTED_ATTRIBUTES = {
    "items",
    "window_start",
    "window_end",
    "revision",
    "autiplanner_issues",
}


def _items() -> list[RoutineItem]:
    return [
        RoutineItem(
            uid="medication-20260930@example",
            title="Take morning medication",
            date="2026-09-30",
            day_part="morning",
            status="pending",
            start="2026-09-30T08:30:00",
        ),
        RoutineItem(
            uid="walk-20260930@example",
            title="Evening walk",
            date="2026-09-30",
            day_part="evening",
            status="completed",
            start="2026-09-30T18:00:00",
            completed_at="2026-09-30T18:10:00",
        ),
        RoutineItem(
            uid="breathing-20260930@example",
            title="Breathing exercise",
            date="2026-09-30",
            day_part="afternoon",
            status="missed",
        ),
        RoutineItem(
            uid="bath-20260930@example",
            title="Bath time",
            date="2026-09-30",
            day_part="night",
            status="skipped",
        ),
    ]


def _state() -> dict[str, object]:
    items = _items()
    return {
        "state": len(items),
        "attributes": {
            "items": [item_to_attributes(item) for item in items],
            "window_start": "2026-09-16",
            "window_end": "2026-10-14",
            "revision": 12,
            "autiplanner_issues": [],
        },
    }


class CardContractTest(unittest.TestCase):
    def test_every_item_carries_the_fields_the_card_requires(self) -> None:
        for item in _items():
            payload = item_to_attributes(item)
            for field in REQUIRED:
                self.assertIn(field, payload, f"{item.uid} is missing {field}")
                self.assertIsInstance(payload[field], str)

    def test_the_four_outcomes_and_day_parts_are_the_ones_the_card_knows(self) -> None:
        # The card deliberately keeps one list of its own, `STATUSES`, because
        # it has to check an untrusted value at runtime and the domain's
        # `RoutineStatus` is a compile-time type. That copy is the one place the
        # two languages can drift, so it is compared against the domain here.
        card = CARD_SOURCE.read_text(encoding="utf-8")
        match = re.search(r"const STATUSES: readonly string\[\] = \[([^\]]*)\]", card)
        self.assertIsNotNone(match, "the card no longer declares its STATUSES list")
        card_statuses = re.findall(r'"([^"]+)"', match.group(1))
        self.assertEqual(card_statuses, const.OUTCOMES)

        # Day parts are not duplicated: the card asks the shared package, so
        # there is nothing to keep in step.
        self.assertIn("DAY_PARTS", card)
        self.assertIn('from "@autiplanner/core"', card)

        # And the shared package's own list must match the domain's, since that
        # is where the card's headings and labels come from.
        core = CORE_MODEL.read_text(encoding="utf-8")
        match = re.search(r"export const DAY_PARTS = \[([^\]]*)\]", core)
        self.assertIsNotNone(match, "packages/core no longer declares DAY_PARTS")
        core_day_parts = re.findall(r'"([^"]+)"', match.group(1))
        self.assertEqual(core_day_parts, const.DAY_PARTS)

    def test_the_fixture_is_what_the_integration_produces(self) -> None:
        # Not self-healing on purpose. The fixture is committed, so a change to
        # the item shape shows up in the diff and gets reviewed, rather than
        # being quietly rewritten by the test that is supposed to police it.
        expected = json.dumps(_state(), indent=2) + "\n"
        if not FIXTURE.exists():
            self.fail(f"missing {FIXTURE}; regenerate it with:\n{expected}")
        actual = FIXTURE.read_text(encoding="utf-8")
        if actual != expected:
            self.fail(
                "the card fixture is stale. The integration's item shape changed.\n"
                f"Regenerate with:\n{expected}"
            )
        state = json.loads(actual)
        self.assertEqual(set(state["attributes"]), EXPECTED_ATTRIBUTES)
        for payload in state["attributes"]["items"]:
            for field in REQUIRED:
                self.assertIn(field, payload)

    def test_a_decided_item_still_has_a_status_the_card_can_draw(self) -> None:
        # completedAt is only present once an item is decided. The card must not
        # depend on it, or a completed routine would vanish from the dashboard.
        decided = item_to_attributes(
            RoutineItem(
                uid="done@example",
                title="Done",
                date="2026-09-30",
                day_part="morning",
                status="completed",
                completed_at="2026-09-30T09:00:00",
            )
        )
        self.assertIn("completedAt", decided)
        self.assertEqual(decided["status"], "completed")
        self.assertNotIn("start", decided)


if __name__ == "__main__":
    unittest.main()
