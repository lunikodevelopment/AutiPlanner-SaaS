/**
 * The icon set is generated, so these check the things a regeneration could
 * quietly break: an icon that lost its drawing, a duplicate name that would make
 * the picker ambiguous, or a name that no longer matches what is stored.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  ROUTINE_ICONS,
  findRoutineIcon,
  isRoutineIconName,
  routineIconSvg,
} from "../src/index.js";

test("the set is the one the picker should offer", () => {
  // Not a magic number for its own sake: only these are offered, so a change
  // here is a deliberate change to the picker.
  assert.equal(ROUTINE_ICONS.length, 49);
  assert.equal(new Set(ROUTINE_ICONS.map((icon) => icon.name)).size, 49);
});

test("every icon has a drawing and a label", () => {
  for (const icon of ROUTINE_ICONS) {
    assert.ok(icon.path.length > 20, `${icon.name} has no path data`);
    assert.equal(icon.viewBox, "0 0 256 256", `${icon.name} has an unexpected viewBox`);
    assert.ok(icon.title.trim().length > 0, `${icon.name} has no label`);
    // Phosphor's own naming, which is what gets stored on an item.
    assert.match(icon.name, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${icon.name} is not kebab-case`);
  }
});

test("two icons do not share a label, which would make the picker ambiguous", () => {
  const titles = ROUTINE_ICONS.map((icon) => icon.title);
  assert.equal(new Set(titles).size, titles.length);
});

test("an icon is found by the name stored on an item", () => {
  const tooth = findRoutineIcon("tooth");
  assert.equal(tooth?.title, "Brush teeth");
  // Anything else is simply not drawn, rather than throwing in a render.
  assert.equal(findRoutineIcon("no-such-icon"), undefined);
  assert.equal(findRoutineIcon(undefined), undefined);
  assert.equal(findRoutineIcon(null), undefined);
  assert.equal(isRoutineIconName("tooth"), true);
  assert.equal(isRoutineIconName("no-such-icon"), false);
  assert.equal(isRoutineIconName(42), false);
});

test("an icon draws in the colour of the text around it", () => {
  const svg = routineIconSvg("tooth", 20);
  assert.match(svg, /^<svg viewBox="0 0 256 256" width="20" height="20"/);
  assert.match(svg, /fill="currentColor"/);
  assert.match(svg, /<path d="M[^"]+"\/>/);
  // Decoration: the routine's own words are what should be read out.
  assert.match(svg, /aria-hidden="true"/);
  assert.match(svg, /focusable="false"/);
});

test("an unknown icon draws nothing instead of an empty box", () => {
  assert.equal(routineIconSvg("no-such-icon"), "");
});

test("the substitutions for names Phosphor does not have are recorded", () => {
  // These three came from a list of wanted names; two are spelled differently in
  // Phosphor and one does not exist in any weight.
  assert.ok(findRoutineIcon("coat-hanger") !== undefined, "hanger is coat-hanger in Phosphor");
  assert.ok(findRoutineIcon("recycle") !== undefined, "recycling is recycle in Phosphor");
  assert.ok(findRoutineIcon("wind") !== undefined, "wind stands in for the absent vacuum");
  assert.equal(findRoutineIcon("vacuum"), undefined);
});
