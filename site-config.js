/* ==========================================================================
   Tiny Tiffin — Site Configuration
   Version : v1.1 Professional Edition
   ========================================================================= */

window.TINY_TIFFIN_CONFIG = {

  /* -------------------------------------------------------------
     Application
  ------------------------------------------------------------- */

  appName: "Tiny Tiffin",

  version: "v1.1 Professional Edition",

  databaseVersion: "2026.11",

  releaseDate: "August 2026",

  theme: "premium",

  recipeCount: 505,

  latestRelease: true,

  enablePWAUpdateCheck: true,

  enableInstallPrompt: true,

  enableOfflineMode: true,



  /* -------------------------------------------------------------
     EmailJS
  ------------------------------------------------------------- */

  emailjs: {

      enabled: true,

      publicKey: "QhWkCiEaXDlxr-f4G",

      serviceId: "service_cojdevq",

      templateId: "template_qzn6vno"

  },



  /* -------------------------------------------------------------
     AI
  ------------------------------------------------------------- */

  ai: {

      enabled: true,

      adminOnly: true,

      planner: true,

      ingredientScanner: true,

      recipeAdaptation: true,

      shoppingList: true,

      recommendations: true

  },



  /* -------------------------------------------------------------
     Translation
  ------------------------------------------------------------- */

  translation: {

      enabled: true,

      translateRecipeContent: true,

      translateIngredients: true,

      translatePreparation: true,

      translateNutrition: true,

      translateParentTips: true,

      translatePackingTips: true,

      translateDeveloperSection: true,

      translateAdmin: false

  },



  /* -------------------------------------------------------------
     Recipe Database
  ------------------------------------------------------------- */

  recipes: {

      total: 505,

      enableRecipeOfTheDay: true,

      enableWeeklyFeaturedRecipe: true,

      enableTrendingRecipes: true,

      enableHealthySwapTips: true,

      enableNutritionHighlights: true

  },



  /* -------------------------------------------------------------
     Ingredient Explorer
  ------------------------------------------------------------- */

  ingredientExplorer: {

      enabled: true,

      categories: [

          "Fruits",

          "Vegetables",

          "Leafy Greens",

          "Millets",

          "Whole Grains",

          "Paneer",

          "Tofu",

          "Cheese",

          "Eggs",

          "Sprouts",

          "Lentils",

          "Beans",

          "Rice",

          "Quinoa",

          "Oats",

          "Nuts & Seeds"

      ]

  },



  /* -------------------------------------------------------------
     PWA
  ------------------------------------------------------------- */

  pwa: {

      showInstallButton: true,

      showUpdateButton: true,

      autoRefreshAfterUpdate: false,

      notifyUserWhenUpdateAvailable: true

  },



  /* -------------------------------------------------------------
     Developer
  ------------------------------------------------------------- */

  developer: {

      name: "Hardik Desai",

      qrEnabled: true,

      showEmail: false,

      about:

`Tiny Tiffin started with a simple idea inspired by our little family. ❤️

As parents, we often wondered what to pack in a tiffin every day—something healthy, nutritious, colourful and enjoyable for children.

That everyday challenge inspired us to create Tiny Tiffin.

Our goal is simple: help parents prepare delicious, balanced lunchboxes with confidence using practical recipes and modern technology.`,



      currentCapabilities: [

"🤖 AI-powered Tiffin Planner",

"📸 AI Ingredient Scanner",

"🔄 AI Recipe Adaptation",

"🛒 Smart Shopping List",

"🍱 505+ healthy Indian & Continental recipes",

"
