/**
 * The routine icon set, and the two things both clients do with it: look one up
 * by the name stored on a routine item, and draw it.
 *
 * The icons are inlined rather than fetched from an icon font or a second HACS
 * plugin, so nothing has to be installed alongside the card and no network
 * request stands between a household and reading their routine.
 */
import { ROUTINE_ICONS, type RoutineIcon } from "./icons.js";

export { ROUTINE_ICONS };
export type { RoutineIcon };

const BY_NAME: ReadonlyMap<string, RoutineIcon> = new Map(
  ROUTINE_ICONS.map((icon) => [icon.name, icon]),
);

/** The icon stored on an item, or undefined when there is none or it is unknown. */
export function findRoutineIcon(name: string | null | undefined): RoutineIcon | undefined {
  if (name === null || name === undefined) return undefined;
  return BY_NAME.get(name);
}

/**
 * Whether a stored value names an icon in this set.
 *
 * A name from a newer release, or a typo, is not a reason to reject a routine:
 * the item still exists, it just draws without a picture.
 */
export function isRoutineIconName(value: unknown): value is string {
  return typeof value === "string" && BY_NAME.has(value);
}

/**
 * One icon as an inline SVG.
 *
 * Single colour, sized by the caller through CSS: `fill` is `currentColor` so an
 * icon takes the colour of the text beside it instead of fighting the theme.
 * `aria-hidden` because an icon is decoration: the routine's own words are what
 * a screen reader should read.
 */
export function routineIconSvg(name: string, size = 24): string {
  const icon = findRoutineIcon(name);
  if (icon === undefined) return "";
  return (
    `<svg viewBox="${icon.viewBox}" width="${size}" height="${size}" fill="currentColor" ` +
    `aria-hidden="true" focusable="false"><path d="${icon.path}"/></svg>`
  );
}

/** The picker's label for an icon, so a name shown in a list reads as intent. */
export function routineIconTitle(name: string): string | undefined {
  return findRoutineIcon(name)?.title;
}
