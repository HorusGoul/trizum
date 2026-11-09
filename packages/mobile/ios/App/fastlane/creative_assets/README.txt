Selected App Store creative assets

The manifest.json file selects the exact reviewed files that the next full App Store release will upload and attach. Currently only the approved English and Spanish animated headers are selected.

Editable source: packages/screenshots/src/creative-assets/
Generation, preview, validation, and selection commands: packages/screenshots/docs/creative-assets.md

The headers are 3840x1646, 20 seconds, 60 fps, silent H.264. Their poster timecode is 00:00:10:48. PNG posters are local references; Apple generates the actual video poster from that timecode.

Future selections may include header or search images/videos. Generation writes ignored review drafts. Only an explicit creative:prepare command changes these selected files and manifest. Merge alone does not upload or publish artwork.
