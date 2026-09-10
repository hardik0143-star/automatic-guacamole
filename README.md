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
- Recipe library now contains 200+ ideas.

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
This release adds a local, privacy-friendly AI experience layer: Tiny Tiffin AI Assistant, AI Tiffin Planner, ingredient image upload/scanning workflow, AI recipe adaptation suggestions, and Smart Shopping List generation. These features work from the bundled recipe library without requiring an external API key.


## Latest update
- Restored visible Install App and Software Update controls.
- PWA icons now use the Tiny Tiffin mascot with a matching AI badge.
- Service-worker cache version bumped so deployed updates can refresh correctly.
- Version remains synchronized from `site-config.js` (`v1.0`).


## Part C recipe expansion
- Added 30 additional unique recipes for ages 6–12 months.
- Added 30 additional unique recipes for ages 1–2 years.
- Added fruit purées, soft fruit combinations, toddler meals and soft finger-food ideas.
- Existing Part B recipes were retained; new recipe IDs and English titles were checked against the existing database to avoid intentional duplication.


## 500+ recipe library expansion
- Added 200 additional original, vegetarian, kid-friendly recipe ideas.
- The recipe library now contains 505 recipes.
- Added quick Indian and continental recipes designed around everyday ingredients and generally 15–30 minute preparation windows.
- New combinations include paneer, millets, quinoa, oats, chickpeas, sprouts, broccoli, mushrooms, zucchini, spinach, beetroot, carrots, bell peppers, sweet potato, whole grains and colourful vegetables.
- New English titles were checked against the existing recipe database to avoid intentional title duplication.


## Latest update — v1.0
- Removed Vitamins from the front-page nutrition goal list.
- Added ingredient-category discovery for fruits, vegetables, millets & grains, lentils & pulses, paneer & cheese, tofu & plant protein, nuts & seeds, and egg.
- Added a small Tiny Tiffin QR code in the header for opening/downloading the app.
- Improved user-side localisation for tiffin moods, ingredient categories, recipe cards, recipe titles, descriptions, ingredients, steps, tips and recipe tags. The Admin section is intentionally excluded from user-side translation.


## Smart Shopping Compare
The UI is included. Live prices require approved provider API credentials configured as Vercel environment variables. The starter `/api/compare` endpoint intentionally returns no fabricated prices and falls back to direct store searches.


## Grocery Price Comparison (v2.0)

Tiny Tiffin now includes a secure `POST /api/compare-prices` Vercel serverless endpoint.

### Vercel environment variables

Add these in **Vercel → Project → Settings → Environment Variables**:

- `QUICKCOMMERCE_API_KEY` — required for live comparisons.
- `QUICKCOMMERCE_API_BASE_URL` — optional. Defaults to:
  `https://api.quickcommerceapi.com/api/v1/groupsearch`

Never put the API key in `app.js`, `site-config.js`, GitHub, or any browser-delivered JavaScript.

### Supported provider adapters

The current endpoint can request Blinkit, Zepto, Swiggy Instamart, BigBasket,
Amazon, Flipkart / Minutes, DMart, and JioMart where the upstream provider
returns coverage for the supplied PIN code/location.

The interface never invents prices. When the API is missing or unavailable it
shows a clear error and safe store-opening links instead.

### How users use it

Open any recipe → **Compare Grocery Prices** → choose one or more ingredients →
enter PIN code or use location → **Compare selected ingredients**.

The result can show product name, matched pack size, price, MRP, discount,
availability, delivery information when supplied by the provider, alternatives,
cheapest item, and basket totals by platform.


## Regional Recipes (v2.1)

- 32 India state-wise recipes across 16 states.
- 24 international country-wise recipes across 12 countries.
- Dedicated Regional Recipes tab with India/International switching and location filters.
- Added Indo-Chinese Style Chili Tofu to the main database as a Tiny Tiffin kid-friendly adaptation inspired by The Foodie Takes Flight.
- The new additions were checked against existing recipe names to avoid duplicates.
