# Tiny Tiffin

Healthy tiffins. Happy kids. Stress-free mornings.

A ready-to-use, installable web app with 100 vegetarian/vegan/egg Indian &
continental kid-tiffin recipes, smart filters, an ingredient-based "what
can I cook?" finder, a weekly planner with nutrition dashboard, ratings,
11 languages, dark mode, and a full admin panel — including Excel bulk
upload. No build step, no npm install. Open `index.html` and it works.

---

## 1. Try it right now

Double-click `index.html`. Everything works locally: filtering, the
ingredient finder, planner, dashboard, ratings, dark mode, contact form.

## 2. Deploying for real (Vercel, free)

1. Unzip this folder, push it to a new GitHub repo (or drag the folder
   straight into Vercel's "New Project" screen — it supports plain
   static sites with zero configuration).
2. Vercel → **New Project → Import** your repo → Framework preset:
   **Other** → Deploy. No build command needed.
3. You'll get a live HTTPS URL immediately, e.g. `tiny-tiffin.vercel.app`.

### Getting rid of ".vercel.app" in the link

This isn't something the app's code can do — it's a hosting setting.
Two honest options:

- **Free, but still ends in `.vercel.app`:** In Vercel → your project →
  Settings → Domains, you can change the subdomain part (the "tiny-tiffin"
  bit) to anything available, e.g. `tiffytiffin.vercel.app`. The
  `.vercel.app` suffix itself can't be removed on the free tier.
- **Fully custom (e.g. `tinytiffin.com`):** Buy a domain from any
  registrar (Namecheap, GoDaddy, Google Domains, etc. — roughly
  $10–15/year), then in Vercel → Settings → Domains → "Add", enter your
  domain and follow the DNS instructions Vercel shows you. Propagation
  usually takes a few minutes to a few hours. This is the only way to
  fully mask Vercel's name.

## 3. The admin panel

Go to `/admin.html` (or tap "Admin" in the app header).

- **Default password:** `tiffin2026` — change `ADMIN_PASSWORD` in
  `admin.js` before sharing the link. This is a convenience gate, not
  real security (it's checked in the browser). Don't use it to protect
  anything sensitive.
- **Add / Edit / Duplicate / Hide-Unhide / Delete** any recipe.
- **Preview** shows exactly what a parent would see.
- **Two image URL fields per recipe** — paste any hosted image link
  (your own site, Cloudinary, Imgur, etc.). No URL? A themed illustration
  is shown automatically so the card never looks broken.
- **Ratings seed fields** — set the starting overall/kid-friendly/
  lunchbox-friendly numbers a recipe shows before real parents rate it.
- **Site Settings** — edit the contact email and developer bio without
  touching code.
- **Bulk upload via Excel** — click "Download sample Excel" for a
  template with the exact columns expected (multi-value fields like
  `ageGroups` or `ingredients` are semicolon-separated, e.g.
  `2-5y;5-10y`). Upload a filled-in `.xlsx` via "Bulk upload Excel" and
  the app validates every row — missing IDs, duplicate IDs, and invalid
  time categories are reported per-row rather than silently failing.
- **Publishing changes**: this is a static site with no backend, so admin
  edits save as a *draft* in your browser only (so you can keep working
  across sessions). When ready, click **Download recipes.js**, replace
  `data/recipes.js` in your project, and redeploy — now it's live for
  everyone. **Export JSON backup** / **Import JSON** let you snapshot or
  restore the whole recipe set any time.

### Going further with a real backend (Firebase/Supabase)

`data/store.js` already isolates every read/write behind
`getRecipes()` / `saveRecipes()`. To make admin edits go live instantly
for every visitor (no redeploy step), swap those two functions for
calls to a real database — the rest of the app doesn't need to change.
Same idea for real photo uploads (swap the image URL fields for a
Cloudinary/Firebase Storage upload widget) and for multi-admin support
(add Firebase Auth in place of the current password gate).

## 4. What's genuinely built vs. what's roadmap

Built and working today: 100 recipes across 4 age brackets (6–12mo,
1–2y, 2–5y, 5–10y) and 5 time buckets (10/15/20/25/30 min), vegetarian/
vegan/egg + Indian/continental tagging, 11 languages (full UI in
English, Hindi, Gujarati, Marathi, French, Spanish, German, Cantonese;
Tamil/Telugu/Bengali cover the core screens and fall back to English for
the newest features), a 6-category rating system, the "what can I cook?"
ingredient finder, a weekly planner with grocery list + saved plans +
no-repeat nudges, a nutrition dashboard, dark mode, a mascot ("Tiffy"),
recipe sharing, contact/developer pages, and the full admin toolkit
described above.

**Deliberately not built** — because they need real infrastructure you'd
have to set up and pay for, or genuinely (as you flagged) belong to a
future phase: AI-generated or photo-extracted recipes, a chat assistant,
voice search, barcode scanning, push notifications, multi-admin/cloud
backup, recipe approval workflows, and community/sharing features. All
of these are listed in-app under **Developer → Future Vision**, and
`data/site-config.js` is where you'd edit that list.

**Worth knowing about ratings:** since this is a static site, "parent
ratings" are stored per-browser and blended into a starting seed number
you set in Admin — they don't yet aggregate across everyone visiting
your site. That requires the backend swap described above.

## 5. Adding a language

Open `data/i18n.js`: copy the `en` block inside `TINY_TIFFIN_STRINGS`,
translate every value, then add `{ code: "xx", label: "Your Language" }`
to `TINY_TIFFIN_LANGUAGES`. Recipe *content* (names, steps, tips) is
currently English/Hindi only — extending that to more languages means
adding the equivalent keys to each recipe object in `data/recipes.js`.

## 6. Recipe data schema

```js
{
  id: "poha", emoji: "🍚", images: ["https://…", "https://…"],
  name: { en: "...", hi: "..." }, desc: { en: "...", hi: "..." },
  ageGroups: ["2-5y","5-10y"], timeCategory: 15,
  dietType: ["vegetarian","vegan"], cuisine: "indian",
  mealType: ["breakfast"], difficulty: "Easy",
  nutritionTags: ["iron","energy"], allergens: ["peanuts"],
  ingredients: ["..."], instructions: ["..."],
  nutrition: { calories, protein_g, iron_mg, calcium_mg, fiber_g, vitaminC_mg },
  packingTip: { en: "...", hi: "..." }, kidTip: { en: "...", hi: "..." },
  ratings: { overall, nutrition, kidFriendly, lunchboxFriendly, pickyEaterFriendly, timeSaver, count },
  hidden: false
}
```

## 7. Privacy note

Favorites, planner, ratings you submit, and theme preference are stored
only in your own browser (`localStorage`) — nothing is sent to a server,
because there isn't one yet. `styles.css` loads Google Fonts; remove the
`@import` line if you'd rather not make that external request.

## 8. Disclaimer

Recipes and nutrition figures are estimates for planning convenience,
not medical advice. Always confirm allergies and dietary needs with
your child's doctor.
