# @trizum/tailwindcss-safe-area-capacitor

Workspace-vendored Tailwind CSS safe area helpers for
`capacitor-plugin-safe-area`.

This package is adapted from `tailwindcss-safe-area-capacitor@0.5.1` by Mahyar
Mirrashed after the published package's GitHub repository became unavailable.
That package is itself adapted from `tailwindcss-safe-area` by mvllow. This
workspace package keeps the same utility API while declaring Tailwind CSS v4
support for this workspace.

## Usage

```css
@plugin "@trizum/tailwindcss-safe-area-capacitor";
```

The plugin generates base, offset, and fallback utilities such as:

- `pt-safe`
- `px-safe`
- `pb-safe-offset-4`
- `px-safe-or-4`
- `bottom-safe-offset-6`

All utilities use the `--safe-area-inset-*` custom properties supplied by the
PWA runtime.
