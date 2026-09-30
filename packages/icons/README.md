# @autiplanner/icons

The routine icons, shared by the Home Assistant card and the web app.

`src/icons.ts` is **generated** from [Phosphor Icons](https://phosphoricons.com)
and committed. Both clients inline it, so a routine draws with no icon font no
network request and no second HACS plugin to install alongside the card.

Only the icons the picker offers are in the file, in the order the picker shows
them. There are no extras: a picker with a thousand options is not a picker.

## Regenerating

```bash
pnpm install
pnpm --filter @autiplanner/icons generate
```

The list of wanted icons, and the wording each one is offered under, lives at the
top of `tools/make-phosphor-icons.mjs`. Names are Phosphor's kebab-case names,
because that is what gets stored on a routine item. The generator refuses a name
Phosphor does not have rather than emitting an icon that draws nothing.

Three names in the original wish list are not Phosphor names, and the generator
notes each one where it is defined:

| Wanted | Used | Why |
|---|---|---|
| Hanger | `coat-hanger` | Phosphor's spelling |
| Recycling | `recycle` | Phosphor's spelling |
| Vacuum | `wind` | Phosphor has no vacuum icon in any of its six weights |

## Licence

The icons are Phosphor Icons, MIT licensed. The notice is at
[`LICENSE-phosphor`](LICENSE-phosphor). Phosphor's SVGs are redistributed here as
inlined path data; nothing about the drawing is modified.
