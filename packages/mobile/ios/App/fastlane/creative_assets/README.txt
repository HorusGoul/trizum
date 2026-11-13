Selected App Store creative assets

The manifest.json file selects the exact reviewed files that the next full App Store release will upload and attach. It selects the approved English and Spanish animated headers and concept A (Shared adventures) search images, preserving the search concept's original style.

Editable source: packages/screenshots/src/creative-assets/
Generation, preview, validation, and selection commands: packages/screenshots/docs/creative-assets.md

The headers are 3840x1646, 20 seconds, 60 fps, silent H.264. Their poster timecode is 00:00:10:48. PNG posters are local references; Apple generates the actual video poster from that timecode.

The search images are 1920x1280 RGB PNGs without alpha. Generation writes ignored review drafts. Only an explicit creative:prepare command changes these selected files and manifest. Merge alone does not upload or publish artwork.
