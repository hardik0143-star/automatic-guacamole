/* Tiny Tiffin — Site configuration
   Edit these values directly. Nothing here requires touching app.js. */
window.TINY_TIFFIN_CONFIG = {
  contactEmail: "Hardypharmacy26@gmail.com",
  version: "v1.0",
  releaseDate: "July 2026",
  amazonAffiliateEnabled: true,
  analyticsNamespace: "tiny-tiffin-v1",
  amazonAssociateTag: "tinytiffin-21",
  /* Static-site admin controls. Change this password before publishing.
     For real security, move admin authentication to a backend service. */
  adminPassword: "Nishiv@2023",
  aiFeatures: {
    planner: true,
    ingredientScanner: true,
    recipeAdaptation: true,
    smartShoppingList: true,
    assistant: true
  },
  releaseNotes: "Amazon Fresh affiliate shopping update: updated all shopping buttons to be labelled Amazon Fresh and route users directly to the Amazon Fresh grocery destination using the configured Associates tag, with transparent messaging that availability and delivery options depend on the shopper’s location. Weekly planner shopping remains supported. Introduced Tiny Tiffin AI capabilities: AI Tiffin Planner, Ingredient Scanner workflow, AI Recipe Adaptation and Smart Shopping List. Added 40 new complementary-food recipes for ages 6–12 months and 60 additional age-specific recipes: 30 for 6–12 months and 30 for 1–2 years, including fruit purées, soft fruit combinations, toddler meals and finger-food ideas. Version numbering reset to v1.0 as the new AI-enabled product baseline.",
  developer: {
    name: "Hardik Desai",
    email: "Hardypharmacy26@gmail.com",
    about: "Tiny Tiffin started with a simple idea inspired by our little family ♥️\n\nAs parents, we often found ourselves wondering what to pack in a tiffin every day - something healthy, nutritious, interesting, and something children would actually enjoy eating.\n\nThat small, everyday challenge inspired us to create Tiny Tiffin.\n\nThis is our first web application, built with love, curiosity, and the desire to create something useful for parents like us.",
    currentCapabilities: [
      "🗓️ AI-powered tiffin planning with personalised recipe suggestions",
      "📸 AI-powered ingredient scanner workflow with image upload and ingredient confirmation",
      "🔄 AI-powered recipe adaptation suggestions for substitutions and dietary preferences",
      "🛒 Smart shopping list generation from the weekly planner",
      "Smart recipe search and multi-ingredient filtering",
      "Nutrition-focused recipe discovery",
      "Weekly tiffin planning",
      "Filters for age, time, cuisine and allergens",
      "Multi-language support: Indian and international languages with dynamic recipe translation",
      "Recipe content can be translated into the selected language, including titles, descriptions, ingredients, steps, tips and allergens",
      "Visitor analytics with total, India and international aggregate counts",
      "Recipe images and nutrition information",
      "Healthy recipe library with 305+ Indian and continental food ideas, including 82 recipes for ages 6–12 months and 65 recipes for ages 1–2 years",
      "PWA installation and offline support",
      "Dark mode with accessibility-focused readability",
      "Version tracking and release notes"
    ]  }
};
