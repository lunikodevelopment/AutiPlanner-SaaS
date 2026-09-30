/**
 * Regenerates the routine icon set from Phosphor Icons.
 *
 * The icons are inlined rather than loaded from a font or a second HACS plugin:
 * both clients render them from this one list, the card keeps working with no
 * extra install step, and a missing dependency cannot make the icons disappear.
 * Only the icons below are included, in this order, which is the order the
 * picker shows them in.
 *
 * Run it from the repository root after `pnpm install`:
 *
 *   pnpm --filter @autiplanner/icons generate
 *
 * Then commit the result. `check-icons` in CI fails if it is stale.
 *
 * Phosphor is MIT licensed. The notice is copied next to the output.
 */
import { existsSync, readFileSync } from "node:fs";
import { readFile, writeFile, copyFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const packageDir = path.resolve(import.meta.dirname, "..");
const outFile = path.join(packageDir, "src", "icons.ts");
const licenseOut = path.join(packageDir, "LICENSE-phosphor");
// Resolved through the package, not assumed at the repository root: pnpm keeps
// a dependency in the package that declared it, and the root has no copy. The
// package does not export its own package.json, so the entry point is resolved
// and the directory holding the matching manifest is where the assets are.
const phosphor = findPackageDir(
  path.dirname(createRequire(path.join(packageDir, "package.json")).resolve("@phosphor-icons/core")),
  "@phosphor-icons/core",
);

function findPackageDir(start, expectedName) {
  let directory = start;
  for (let depth = 0; depth < 10; depth += 1) {
    const manifest = path.join(directory, "package.json");
    if (existsSync(manifest)) {
      const parsed = JSON.parse(readFileSync(manifest, "utf8"));
      if (parsed.name === expectedName) return directory;
    }
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  throw new Error(`could not find the ${expectedName} package from ${start}`);
}

/**
 * The set the picker offers, in order.
 *
 * `name` is the Phosphor kebab-case name and is what gets stored on an item.
 * `title` is what the picker says, written as the thing a household is trying
 * to express rather than the name of the drawing. `note` records anywhere the
 * list could not be followed exactly.
 */
const WANTED = [
  { name: "sun", title: "Morning / wake up" },
  { name: "moon-stars", title: "Evening / bedtime" },
  { name: "alarm", title: "Wake-up alarm" },
  { name: "tooth", title: "Brush teeth" },
  { name: "shower", title: "Shower" },
  { name: "hand-soap", title: "Wash hands" },
  { name: "t-shirt", title: "Get dressed" },
  { name: "pill", title: "Take medication" },
  { name: "fork-knife", title: "Eat meal" },
  { name: "bowl-steam", title: "Meal" },
  { name: "cooking-pot", title: "Cooking" },
  { name: "coffee", title: "Coffee / drink break" },
  { name: "drop", title: "Drink water" },
  { name: "shopping-cart", title: "Grocery shopping" },
  { name: "basket", title: "Shopping / groceries" },
  { name: "washing-machine", title: "Wash clothing / laundry" },
  {
    name: "coat-hanger",
    title: "Hang / put away clothing",
    note: "Phosphor spells this coat-hanger, not hanger.",
  },
  { name: "broom", title: "Cleaning" },
  {
    name: "wind",
    title: "Vacuuming",
    note: "Phosphor has no vacuum icon in any weight; wind stands in for it.",
  },
  { name: "spray-bottle", title: "Clean surfaces" },
  { name: "trash", title: "Take out trash" },
  {
    name: "recycle",
    title: "Recycling",
    note: "Phosphor spells this recycle, not recycling.",
  },
  { name: "bed", title: "Sleep / rest" },
  { name: "chair", title: "Rest break" },
  { name: "person-simple-walk", title: "Walking" },
  { name: "car", title: "Car trip" },
  { name: "bus", title: "Bus trip" },
  { name: "map-pin", title: "Go somewhere / destination" },
  { name: "phone-call", title: "Call someone" },
  { name: "chat-circle-text", title: "Send message" },
  { name: "video-conference", title: "Video call" },
  { name: "users-three", title: "Meeting / social activity" },
  { name: "game-controller", title: "PC / console gaming time" },
  { name: "headphones", title: "Music / sensory break" },
  { name: "television-simple", title: "TV time" },
  { name: "book-open", title: "Reading" },
  { name: "laptop", title: "Computer time / computer task" },
  { name: "briefcase", title: "Work" },
  { name: "calendar-blank", title: "Appointment" },
  { name: "calendar-check", title: "Confirmed appointment" },
  { name: "stethoscope", title: "Doctor appointment" },
  { name: "hospital", title: "Hospital / medical appointment" },
  { name: "bell", title: "Reminder" },
  { name: "timer", title: "Timed task / focus time" },
  { name: "list-checks", title: "Checklist / routine" },
  { name: "check-square", title: "Task" },
  { name: "check-circle", title: "Completed task" },
  { name: "repeat", title: "Recurring routine" },
  { name: "flag", title: "Important task" },
];

const WEIGHT = "regular";

async function readIcon(name) {
  const file = path.join(phosphor, "assets", WEIGHT, `${name}.svg`);
  let svg;
  try {
    svg = await readFile(file, "utf8");
  } catch (error) {
    throw new Error(
      `Phosphor has no ${WEIGHT} icon called "${name}". ` +
        `Check the name against node_modules/@phosphor-icons/core/assets/${WEIGHT}/.`,
    );
  }
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1];
  const paths = [...svg.matchAll(/d="([^"]+)"/g)].map((match) => match[1]);
  if (!viewBox || paths.length === 0) {
    throw new Error(`could not read ${name} out of ${file}`);
  }
  // Joined with a space rather than stored as a list: an icon here is one
  // drawing, and the clients only ever hand the whole thing to a <path>.
  return { viewBox, path: paths.join(" ") };
}

const entries = [];
for (const wanted of WANTED) {
  const { viewBox, path: d } = await readIcon(wanted.name);
  entries.push({ ...wanted, viewBox, path: d });
}

const dupe = entries.map((entry) => entry.name);
if (new Set(dupe).size !== dupe.length) {
  throw new Error("the icon set contains a duplicate name");
}

const body = entries
  .map((entry) => {
    const note = entry.note === undefined ? "" : `\n    // ${entry.note}`;
    return `  {${note}
    name: ${JSON.stringify(entry.name)},
    title: ${JSON.stringify(entry.title)},
    viewBox: ${JSON.stringify(entry.viewBox)},
    path: ${JSON.stringify(entry.path)},
  },`;
  })
  .join("\n");

const output = `/**
 * The routine icons. GENERATED by tools/make-phosphor-icons.mjs, do not edit.
 *
 * ${entries.length} icons drawn from Phosphor Icons (MIT), weight "${WEIGHT}", inlined as
 * path data so neither client needs an icon font, a network request, or a
 * second HACS plugin to draw a routine. Only these icons are offered; the
 * picker shows them in this order.
 */

export interface RoutineIcon {
  /** Phosphor's kebab-case name. This is what is stored on a routine item. */
  readonly name: string;
  /** What the picker calls it, written as the intent rather than the drawing. */
  readonly title: string;
  readonly viewBox: string;
  /** SVG path data for a single-colour drawing using currentColor. */
  readonly path: string;
}

export const ROUTINE_ICONS: readonly RoutineIcon[] = [
${body}
];
`;

await writeFile(outFile, output);
await copyFile(path.join(phosphor, "LICENSE"), licenseOut).catch(async () => {
  // Some publishes name it differently; copy whatever licence file is there.
  const { readdir } = await import("node:fs/promises");
  const files = await readdir(phosphor);
  const licence = files.find((file) => /^licen[cs]e/i.test(file));
  if (licence === undefined) throw new Error("Phosphor shipped no licence file");
  await copyFile(path.join(phosphor, licence), licenseOut);
});

console.log(`[icons] wrote ${entries.length} icons to ${path.relative(path.resolve(packageDir, "..", ".."), outFile)}`);
