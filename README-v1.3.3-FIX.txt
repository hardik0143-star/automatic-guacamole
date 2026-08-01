Tiny Tiffin v1.3.3

Included fixes:
- Dark-mode Install, Update and Admin controls are visible with high contrast.
- Surprise Me button is readable in dark mode.
- Ingredient Recipe Finder accepts singular/plural and partial ingredient matches.
- Tiffin Mood actions reset conflicting filters and scroll to matching recipes.
- Added sample-recipe-import.json.
- Added one consolidated Basic Stuffed Paratha recipe template with variation guidance.

Admin note:
This package does not contain admin.html/admin.js, so Admin Edit Recipe and India-only analytics cannot be repaired safely here. Upload those files later for a complete admin patch.

AI import note:
A public static website cannot reliably extract recipe details from arbitrary social-media URLs without a server/API because of platform restrictions and cross-origin controls. A safe production design is: paste URL/photo -> server-side extractor/OCR/AI -> preview -> admin approval -> save to store. Do not auto-publish unreviewed content.
