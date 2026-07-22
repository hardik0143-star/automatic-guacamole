# Tiny Tiffin v4.0

Tiny Tiffin is a kid-friendly vegetarian Indian and continental tiffin discovery and planning web app.

## v4.0 highlights

- Added 10 South Indian recipes:
  - Plain Dosa
  - Mysore Masala Dosa
  - Rava Dosa
  - Set Dosa
  - Neer Dosa
  - Pesarattu
  - Bisi Bele Bath
  - Kesari Bath
  - Vegetable Uttapam
  - Soft Idli
- Added **Quick Tiffin Mood** shortcuts:
  - ⚡ Quick & Easy
  - 💪 Protein Power
  - 🌈 Colourful & Nutritious
- Updated the Developer section:
  - Removed admin-related capabilities
  - Removed the Coming Soon section
  - Removed the requested sentence from the developer story
- Recipe library now contains 165+ ideas.

## Deployment

This is a static web application and can be deployed to GitHub Pages, Vercel, Netlify, or another static hosting service.

The main entry point is `index.html`.

## Important files

- `index.html` — application shell
- `app.js` — application logic
- `recipes.js` — recipe database
- `site-config.js` — version, release notes, developer information
- `i18n.js` — translations
- `styles.css` — styling
- `manifest.json` and `sw.js` — PWA support

## Disclaimer

Recipes and nutrition figures are estimates for planning convenience, not medical advice. Always confirm allergies and dietary needs with your child's doctor.


## v1.0 AI capabilities
This release adds a local, privacy-friendly AI experience layer: AI Tiffin Planner, ingredient image upload/scanning workflow, AI recipe adaptation suggestions, and Smart Shopping List generation. These features work from the bundled recipe library without requiring an external API key.
