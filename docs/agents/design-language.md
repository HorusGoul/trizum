# Design language

Read this when styling application UI or design-system components. The app is
monochrome: black, white, and neutral shades carry the interface, and the
user's accent hue appears only where it earns attention. Surfaces are
borderless and generously rounded, in line with current iOS design.

Use the Tailwind `neutral` scale with explicit `dark:` variants. The `accent`
scale follows the user's chosen hue at runtime.

## Color

| Role                                              | Light                     | Dark                      |
| ------------------------------------------------- | ------------------------- | ------------------------- |
| Canvas (page background)                          | `bg-neutral-100`          | `dark:bg-black`           |
| Surface (cards, grouped lists, fields)            | `bg-white`                | `dark:bg-neutral-900`     |
| Fill inside a surface (chips, wells, nested rows) | `bg-neutral-100`          | `dark:bg-neutral-800`     |
| Overlay (menus, popovers, tooltips, dialogs)      | `bg-white`                | `dark:bg-neutral-800`     |
| Sheet                                             | `bg-neutral-100`          | `dark:bg-neutral-900`     |
| Hover / pressed tint on any surface               | `bg-neutral-950/5`, `/10` | `dark:bg-white/10`, `/15` |
| Primary text                                      | `text-neutral-950`        | `dark:text-neutral-50`    |
| Secondary text                                    | `text-neutral-600`        | `dark:text-neutral-400`   |
| Tertiary text, placeholders, disabled             | `text-neutral-400`        | `dark:text-neutral-500`   |

Inside a sheet or overlay, step one shade up for nested surfaces: cards in a
dark sheet use `dark:bg-neutral-800`, fills inside those use
`dark:bg-neutral-700`. Pure black is reserved for the canvas.

### Where accent belongs

- Primary actions: `Button`/`IconButton` with `color="accent"`, the main call to
  action of a screen or sheet. One per view where possible.
- Inline links in prose.
- Selected and checked state of controls: switch, checkbox, radio, selected
  calendar day, the active tab indicator, sliders, and progress bars.
- Focus rings (`ring-accent-500 dark:ring-accent-400`) and the text caret.
- Small details that mark "you" or "current": a badge, a dot, a single icon.

Everything else is neutral: backgrounds, cards, headers, body text, icons,
secondary buttons, dividers, skeletons, empty states, and decorative gradients.
Do not tint surfaces or text with accent. Secondary actions use
`color="neutral"` (soft neutral fill) or `color="transparent"`.

`success`, `warning`, and `danger` keep their meaning for money direction,
validation, and destructive actions. Avatars keep their own palette.

## Borders and elevation

Do not draw borders around containers, cards, fields, buttons, or overlays.
Separate layers with the shade steps above and the elevation tokens:

- `shadow-surface`: cards and fields resting on the canvas.
- `shadow-raised`: floating controls such as a floating action button, a
  sticky bar, or a dragged item.
- `shadow-overlay`: anything that overlaps other UI — menus, popovers, select
  lists, tooltips, toasts, dialogs, and sheets.

The tokens switch in dark mode: resting surfaces lose their shadow and rely on
shade, while raised and overlay layers keep a deep shadow plus a faint top
highlight so a menu stays distinct from the card it covers. Because of this,
never pair them with `dark:shadow-none`. An overlay must always be a different
shade from what it can cover.

Rows inside a grouped list may be separated by a hairline:
`divide-y divide-neutral-950/5 dark:divide-white/10`. Prefer spacing where it
reads well enough. Dashed outlines for drop targets and focus rings are not
borders in this sense.

## Shape

Round more than feels necessary, and keep nested radii concentric (inner radius
= outer radius − padding).

| Element                                          | Radius                       |
| ------------------------------------------------ | ---------------------------- |
| Buttons, icon buttons, chips, badges, tabs       | `rounded-full`               |
| Cards, grouped lists, dialogs, menus, popovers   | `rounded-3xl`                |
| Fields, selects, rows inside menus, small cards  | `rounded-2xl`                |
| Sheets                                           | `rounded-t-[2rem]`           |
| Small controls (checkbox, tiny tags, thumbnails) | `rounded-lg` or `rounded-xl` |

Nothing interactive uses a radius below `rounded-lg`. First and last rows of a
grouped list inherit the group's radius through `overflow-hidden` on the group.
