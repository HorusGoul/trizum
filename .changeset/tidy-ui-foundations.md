---
"@trizum/ui": minor
"@trizum/icon-sprite": minor
---

Add the internal React design system package with copied PWA components, shared
styles and fonts, Lingui catalogs, consumer-generated icons, and local Storybook.
The PWA continues to use its original components until follow-up migrations.

Allow icon generation to exclude shared generated directories so catalog type
files do not cause unused icons to be bundled by consumers.
