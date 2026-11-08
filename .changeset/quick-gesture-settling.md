---
"@trizum/pwa": patch
"@trizum/ui": patch
---

Improve gallery flick dismissal and backdrop tracking, pull-to-refresh resistance and cancellation, calculator cursor dragging, and toast swipe direction. Respect reduced motion when gallery and refresh gestures settle.

Allow shared and calculator sheets to stretch above their highest snap point with resistance and spring back on release.

Stretch one continuous sheet surface, including its background, border, and shadow, to the screen edge during upward overdrag and spring-back. Keep the content and snap-point measurements unchanged.

Align the calculator sheet and bottom fill across mobile widths, and restore the gallery backdrop when reopening during its exit animation.
