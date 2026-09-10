/* Tiny Tiffin — Parent App (v2) */
(function () {
  "use strict";

  /* ---------------- storage: localStorage with in-memory fallback ---------------- */
  const memoryStore = {};
  const storage = {
    get(key, fallback) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw !== null ? JSON.parse(raw) : fallback;
      } catch (e) { return key in memoryStore ? memoryStore[key] : fallback; }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, JSON.stringify(value)); }
      catch (e) { memoryStore[key] = value; }
    }
  };


  /* ---------------- automatic recipe image service ----------------
     Uses Openverse's openly-licensed image search. Images are resolved
     lazily and cached by recipe ID, so future recipes can receive a
     real food photo automatically without changing the recipe schema.
  ------------------------------------------------------------------- */
  const imageCache = storage.get("tt_recipe_image_cache_v1", {});
  const imagePending = new Set();

  function saveImageCache() {
    storage.set("tt_recipe_image_cache_v1", imageCache);
  }

  function imageSearchText(r) {
    const name = recipeName(r);
    const ingredients = (r.ingredients || []).slice(0, 4).join(" ");
    const context = r.fasting ? "Indian fasting vrat food tiffin" : (r.festival ? "Indian festival food tiffin" : "kid friendly healthy tiffin recipe");
    return `${name} ${context} ${ingredients}`.trim();
  }

  async function findRecipeImage(r) {
    if (r.images && r.images.length) return { url: r.images[0], source: "admin" };
    if (imageCache[r.id] && imageCache[r.id].url) return imageCache[r.id];
    if (imagePending.has(r.id)) return null;
    imagePending.add(r.id);

    try {
      const params = new URLSearchParams({
        q: imageSearchText(r),
        page_size: "5",
        category: "photograph",
        size: "medium",
        aspect_ratio: "wide",
        license_type: "commercial"
      });
      const response = await fetch(`https://api.openverse.org/v1/images/?${params.toString()}`);
      if (!response.ok) throw new Error("Image search failed");
      const data = await response.json();
      const result = (data.results || []).find(x => x.thumbnail || x.url);
      if (!result) return null;

      const image = {
        url: result.thumbnail || result.url,
        fullUrl: result.url || result.thumbnail,
        title: result.title || recipeName(r),
        creator: result.creator || "",
        source: result.source || "Openverse",
        license: result.license || "",
        detailUrl: result.detail_url || result.foreign_landing_url || ""
      };
      imageCache[r.id] = image;
      saveImageCache();
      return image;
    } catch (e) {
      return null;
    } finally {
      imagePending.delete(r.id);
    }
  }

  function imageMarkup(r, image) {
    if (!image || !image.url) return `<div class="placeholder-illustration">${r.emoji}</div>`;
    const attribution = image.detailUrl ? ` title="Image source: Openverse"` : "";
    return `<img src="${escapeAttr(image.url)}" alt="${escapeAttr(recipeName(r))}" loading="lazy"${attribution}
      onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="placeholder-illustration" style="display:none">${r.emoji}</div>`;
  }

  function hydrateRecipeImages(scope) {
    const container = scope || root;
    if (!container) return;
    const cards = container.querySelectorAll("[data-auto-image]");
    cards.forEach(card => {
      const id = card.dataset.autoImage;
      const r = getRecipeById(id);
      if (!r) return;
      const apply = image => {
        if (!image) return;
        const wrap = card.querySelector(".recipe-image-wrap");
        if (wrap) wrap.innerHTML = imageMarkup(r, image);
      };
      const cached = r.images && r.images.length ? { url: r.images[0], source: "admin" } : imageCache[r.id];
      if (cached) {
        apply(cached);
        return;
      }
      findRecipeImage(r).then(apply);
    });
  }

  /* ---------------- Smart Buy supported grocery platforms ---------------- */
  const GROCERY_COMPARE_PLATFORMS = [
    { key: "blinkit", label: "BlinkIt" },
    { key: "zepto", label: "Zepto" },
    { key: "swiggy", label: "Swiggy Instamart" },
    { key: "bigbasket", label: "BigBasket" },
    { key: "dmart", label: "DMart" },
    { key: "jiomart", label: "JioMart" },
    { key: "minutes", label: "Flipkart Minutes" },
    { key: "amazon", label: "Amazon" },
    { key: "flipkart", label: "Flipkart" }
  ];

  /* ---------------- constants ---------------- */
  const BASE_RECIPES = window.TinyTiffinStore.getRecipes().filter(r => !r.hidden);
  const FESTIVAL_RECIPES = (window.TINY_TIFFIN_FESTIVAL_RECIPES || []).map(r => ({...r, specialCollection:"festival"}));
  const FASTING_RECIPES = (window.TINY_TIFFIN_FASTING_RECIPES || []).map(r => ({...r, specialCollection:"fasting"}));
  const REGIONAL_RECIPES = [];
  const RECIPES = [...BASE_RECIPES, ...FESTIVAL_RECIPES, ...FASTING_RECIPES];
  let regionalDataLoaded = false;
  let regionalDataLoading = null;

  async function ensureRegionalData() {
    if (regionalDataLoaded) return true;
    if (regionalDataLoading) return regionalDataLoading;
    regionalDataLoading = new Promise((resolve) => {
      const existing = document.querySelector('script[data-tiny-tiffin-regional]');
      if (existing && window.TINY_TIFFIN_REGIONAL_RECIPES) {
        const mapped = window.TINY_TIFFIN_REGIONAL_RECIPES.map(r => ({...r, specialCollection:"regional"}));
        REGIONAL_RECIPES.push(...mapped);
        RECIPES.push(...mapped);
        regionalDataLoaded = true;
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "regional.js?v=2.2";
      script.async = true;
      script.dataset.tinyTiffinRegional = "1";
      script.onload = () => {
        const mapped = (window.TINY_TIFFIN_REGIONAL_RECIPES || []).map(r => ({...r, specialCollection:"regional"}));
        REGIONAL_RECIPES.push(...mapped);
        RECIPES.push(...mapped);
        regionalDataLoaded = true;
        resolve(true);
      };
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
    return regionalDataLoading;
  }
  const CONFIG = window.TINY_TIFFIN_CONFIG || { contactEmail: "", developer: {} };
  const NUTRITION_ORDER = ["protein", "iron", "calcium", "immunity", "fiber", "energy"];
  const NUTRITION_EMOJI = { protein: "🥜", iron: "🥬", calcium: "🥛", immunity: "🍊", fiber: "🌾", energy: "⚡" };
  const AGE_GROUPS = ["6-12m", "1-2y", "2-5y", "5-12y+"];
  const ALL_ALLERGENS = ["nuts", "dairy", "gluten", "soy", "egg"];
  const DIET_TYPES = ["vegetarian", "vegan", "egg"];
  const CUISINES = ["indian", "continental"];
  const INGREDIENT_CATEGORIES = [
    { key: "fruits", terms: ["apple","banana","mango","papaya","orange","strawberry","blueberry","raspberry","grape","watermelon","melon","avocado","pear","peach","plum","kiwi","pineapple","pomegranate","fruit","date","fig"] },
    { key: "vegetables", terms: ["carrot","broccoli","cauliflower","zucchini","courgette","spinach","kale","radish","beetroot","beet","peas","bell pepper","capsicum","pepper","pumpkin","sweet potato","potato","tomato","cucumber","corn","cabbage","lettuce","mushroom","beans","vegetable","okra","eggplant","brinjal","bottle gourd","lauki","drumstick","green bean"] },
    { key: "millets", terms: ["millet","ragi","finger millet","foxtail","barnyard","pearl millet","bajra","jowar","sorghum","kodo","little millet","quinoa","oat","oats","whole grain","brown rice"] },
    { key: "lentils", terms: ["lentil","dal","dhal","moong","mung","sprout","chickpea","chana","rajma","kidney bean","black bean","bean","pulses","toor","urad","masoor"] },
    { key: "paneerCheese", terms: ["paneer","cheese","mozzarella","cheddar","cottage cheese","ricotta"] },
    { key: "tofuPlantProtein", terms: ["tofu","soy","tempeh","plant protein"] },
    { key: "nutsSeeds", terms: ["peanut","almond","cashew","walnut","sesame","chia","flax","seed","nut","tahini"] },
    { key: "egg", terms: ["egg"] }
  ];
  function recipeMatchesIngredientCategory(r, category) {
    if (!category || category === "all") return true;
    const cat = INGREDIENT_CATEGORIES.find(x => x.key === category);
    if (!cat) return true;
    const hay = [r.name?.en || "", ...(r.ingredients || [])].join(" ").toLowerCase();
    return cat.terms.some(term => hay.includes(term));
  }
  const TIME_BUCKETS = [10, 15, 20, 25, 30];
  const DAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const MEAL_SLOTS = ["breakfast", "lunch", "snack"];
  const STAPLES = ["salt", "water", "oil", "ghee", "turmeric", "mustard seed", "cumin", "asafoetida",
    "curry leaves", "sugar", "jaggery", "cardamom", "garam masala", "chaat masala", "ajwain",
    "cinnamon", "bay leaf", "black salt", "pepper", "oregano", "paprika", "baking powder"];

  /* ---------------- state ---------------- */
  const state = {
    lang: storage.get("tt_lang", "en"),
    theme: storage.get("tt_theme", "light"),
    tab: "find",
    favorites: new Set(storage.get("tt_favorites", [])),
    planner: storage.get("tt_planner", {}),
    savedPlans: storage.get("tt_saved_plans", []),
    userRatings: storage.get("tt_user_ratings", {}),
    filters: {
      age: "all", time: "any", meal: "all", nutrition: new Set(), ingredientCategory: "all",
      allergyExclude: new Set(), diet: "all", cuisine: "all", smartSearch: ""
    },
    matchInput: "",
    aiInput: "",
    aiResults: [],
    aiPlan: []
  };

  function t(key) { return window.tinyTiffinT(state.lang, key); }

  // Central recipe lookup used by every recipe card, planner, favourites, AI,
  // festival and fasting collection. Keeping one lookup prevents View Recipe
  // from failing for recipes outside the main recipe library.
  function getRecipeById(id) {
    const key = String(id);
    return RECIPES.find(r => String(r.id) === key) || null;
  }

  function recipeName(r) { return r.name[state.lang] || r.name.en; }
  function recipeDesc(r) { return r.desc[state.lang] || r.desc.en; }
  function applyTheme() { document.documentElement.setAttribute("data-theme", state.theme); }
  applyTheme();

  /* ---------------- install prompt (Add to Home Screen) ---------------- */
  let deferredInstallPrompt = null;
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  let updateCheckInProgress = false;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = document.getElementById("install-btn");
    if (btn) btn.style.display = "inline-flex";
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    const btn = document.getElementById("install-btn");
    if (btn) btn.style.display = "none";
  });

  function saveFavorites() { storage.set("tt_favorites", Array.from(state.favorites)); }
  function savePlanner() { storage.set("tt_planner", state.planner); }
  function saveSavedPlans() { storage.set("tt_saved_plans", state.savedPlans); }
  function saveUserRatings() { storage.set("tt_user_ratings", state.userRatings); }
  function saveLang() { storage.set("tt_lang", state.lang); }
  function saveTheme() { storage.set("tt_theme", state.theme); }

  /* ---------------- ratings ---------------- */
  function displayedRatings(r) {
    const base = r.ratings || { overall: 4, nutrition: 4, kidFriendly: 4, lunchboxFriendly: 4, pickyEaterFriendly: 4, timeSaver: 4, count: 1 };
    const mine = state.userRatings[r.id];
    const baseCount = Math.max(1, Number(base.count) || 1);
    if (!mine) return { ...base, count: baseCount };
    const n = baseCount + 1;
    const merge = (key) => {
      const baseValue = Number(base[key]) || 0;
      const myValue = Number(mine[key]) || Number(mine.overall) || baseValue;
      return Math.round(((baseValue * baseCount) + myValue) / n * 10) / 10;
    };
    return {
      overall: merge("overall"), nutrition: merge("nutrition"), kidFriendly: merge("kidFriendly"),
      lunchboxFriendly: merge("lunchboxFriendly"), pickyEaterFriendly: merge("pickyEaterFriendly"),
      timeSaver: merge("timeSaver"), count: n, userRating: mine
    };
  }
  function starsHTML(value, size) {
    let out = `<span class="stars" style="${size ? `font-size:${size}` : ""}">`;
    const rounded = Math.round(value);
    for (let i = 1; i <= 5; i++) out += `<span class="star ${i <= rounded ? "filled" : ""}">★</span>`;
    return out + "</span>";
  }

  /* ---------------- filtering ---------------- */
  function isStaple(ingText) {
    const lower = ingText.toLowerCase();
    return STAPLES.some(s => lower.includes(s));
  }
  function matchesFilters(r) {
    const f = state.filters;
    if (f.age !== "all") {
      const selectedAge = f.age === "5-12y+" ? "5-10y" : f.age;
      if (!r.ageGroups.includes(selectedAge) && !r.ageGroups.includes(f.age)) return false;
    }
    if (f.time !== "any" && r.timeCategory > Number(f.time)) return false;
    if (f.meal !== "all" && !r.mealType.includes(f.meal)) return false;
    if (f.nutrition.size > 0 && !Array.from(f.nutrition).every(n => r.nutritionTags.includes(n))) return false;
    if (f.diet !== "all" && !r.dietType.includes(f.diet)) return false;
    if (f.cuisine !== "all" && r.cuisine !== f.cuisine) return false;
    if (f.allergyExclude.size > 0) {
      for (const a of f.allergyExclude) if (r.allergens.includes(a)) return false;
    }
    if (!recipeMatchesIngredientCategory(r, f.ingredientCategory)) return false;
    if (f.smartSearch.trim()) {
      const q = f.smartSearch.trim().toLowerCase();
      const hay = [
        recipeName(r), r.ingredients.join(" "), r.nutritionTags.join(" "),
        r.ageGroups.join(" "), String(r.timeCategory), r.cuisine, r.mealType.join(" "), r.dietType.join(" ")
      ].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }
  function hasDiscoveryCriteria() {
    const f = state.filters;
    return f.age !== "all" || f.time !== "any" || f.meal !== "all" ||
      f.nutrition.size > 0 || f.ingredientCategory !== "all" ||
      f.allergyExclude.size > 0 || f.diet !== "all" || f.cuisine !== "all" ||
      f.smartSearch.trim().length > 0;
  }
  function filteredRecipes() { return hasDiscoveryCriteria() ? RECIPES.filter(matchesFilters) : []; }

  /* ---------------- toast ---------------- */
  let toastTimer = null;
  function toast(msg) {
    let el = document.getElementById("tt-toast");
    if (!el) { el = document.createElement("div"); el.id = "tt-toast"; el.className = "toast"; document.body.appendChild(el); }
    el.textContent = msg; el.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.display = "none"; }, 2400);
  }

  /* ---------------- mascot ---------------- */
  function premiumLogoSVG(size = 42) { return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" role="img" aria-label="Tiny Tiffin"><defs><linearGradient id="ttGold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#FFE59A"/><stop offset=".5" stop-color="#D9A93F"/><stop offset="1" stop-color="#9A6518"/></linearGradient></defs><rect x="2" y="2" width="60" height="60" rx="18" fill="#123D2B" stroke="url(#ttGold)" stroke-width="3"/><path d="M15 35h34l-3 10H18z" fill="#1D5A3D" stroke="url(#ttGold)" stroke-width="2"/><path d="M19 32c2-9 24-9 26 0z" fill="url(#ttGold)"/><path d="M32 20c0-6 4-10 9-12-1 6-4 10-9 12z" fill="#69B94D"/><path d="M31 21c-5-1-9-5-10-10 6 1 9 4 10 10z" fill="#4D9E42"/><path d="M32 20v10" stroke="#F7E6AA" stroke-width="2" stroke-linecap="round"/><circle cx="32" cy="42" r="2" fill="#FFE59A"/></svg>`; }

  function mascotSVG(size) {
    size = size || 34;
    return `<svg class="mascot-face" width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="100" height="100" rx="22" fill="#2B4E32"/>
      <path d="M38 14 a12 12 0 0 1 24 0" stroke="#8C97A5" stroke-width="5" fill="none"/>
      <rect x="12" y="20" width="76" height="32" rx="12" fill="#8C97A5"/>
      <rect x="16" y="40" width="68" height="48" rx="14" fill="#E5A431"/>
      <circle cx="36" cy="62" r="6" fill="#20272B"/><circle cx="64" cy="62" r="6" fill="#20272B"/>
      <circle cx="38.5" cy="59.5" r="2" fill="#fff"/><circle cx="66.5" cy="59.5" r="2" fill="#fff"/>
      <path d="M38 72 q12 10 24 0" stroke="#20272B" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <circle cx="22" cy="63" r="5" fill="#C1440E" opacity="0.45"/><circle cx="78" cy="63" r="5" fill="#C1440E" opacity="0.45"/>
    </svg>`;
  }

  /* ---------------- rendering ---------------- */
  const premiumStyle = document.createElement("link");
  premiumStyle.rel = "stylesheet";
  premiumStyle.href = "premium-ui.css?v=1.3.1";
  document.head.appendChild(premiumStyle);

  const root = document.getElementById("app");

  function render() {
    document.documentElement.lang = state.lang === "yue" ? "zh-HK" : state.lang;
    root.innerHTML = `
      ${renderHeader()}
      <main class="wrap">
        ${state.tab === "find" ? renderFindTab() : ""}
        ${state.tab === "match" ? renderMatchTab() : ""}
        ${state.tab === "planner" ? renderPlannerTab() : ""}
        ${state.tab === "dashboard" ? renderDashboardTab() : ""}
        ${state.tab === "favorites" ? renderFavoritesTab() : ""}
        ${state.tab === "contact" ? renderContactTab() : ""}
        ${state.tab === "developer" ? renderDeveloperTab() : ""}
        ${state.tab === "ai" ? renderAITab() : ""}
        ${state.tab === "shopping" ? renderShoppingTab() : ""}
        ${state.tab === "festival" ? renderFestivalTab() : ""}
        ${state.tab === "fasting" ? renderFastingTab() : ""}
        ${state.tab === "regional" ? renderRegionalTab() : ""}
      </main>
      <footer class="app-footer">
        <div style="margin-bottom:10px">
          <a href="#" data-footer-tab="contact" style="margin-right:14px">${t("navContact")}</a>
          <a href="#" data-footer-tab="developer">${t("navDeveloper")}</a>
        </div>
        ${t("footerNote")}
      </footer>
    `;
    attachHeaderEvents();
    if (state.tab === "find") attachFindEvents();
    if (state.tab === "match") attachMatchEvents();
    if (state.tab === "planner") attachPlannerEvents();
    if (state.tab === "favorites") attachFavoritesEvents();
    if (state.tab === "contact") attachContactEvents();
    if (state.tab === "ai") {
      attachAIEvents();
      if (window.tinyTiffinLocalizeAIHub) window.tinyTiffinLocalizeAIHub(root, state.lang);
    }
    if (state.tab === "shopping") attachShoppingEvents();
    if (state.tab === "shopping") attachSmartShoppingLiveEvents();
    if (state.tab === "festival") attachFestivalEvents();
    if (state.tab === "fasting") attachFastingEvents();
    if (state.tab === "regional") attachRegionalEvents();
    hydrateRecipeImages(root);
    if (window.tinyTiffinLocalizeRecipeCards) window.tinyTiffinLocalizeRecipeCards(root, RECIPES, state.lang);
    if (state.tab === "developer" && window.tinyTiffinLocalizeDeveloper) window.tinyTiffinLocalizeDeveloper(root, CONFIG, state.lang);
    root.querySelectorAll("[data-footer-tab]").forEach(a => {
      a.addEventListener("click", (e) => { e.preventDefault(); state.tab = a.dataset.footerTab; render(); window.scrollTo(0, 0); });
    });
  }

  function renderHeader() {
    const langOptions = window.TINY_TIFFIN_LANGUAGES.map(l =>
      `<option value="${l.code}" ${l.code === state.lang ? "selected" : ""}>${l.label}</option>`).join("");
    const tabs = [
      ["find", "⌕", t("navFind")],
      ["match", "🍳", t("navMatch")],
      ["planner", "🗓️", t("navPlanner")],
      ["dashboard", "🥗", t("navDashboard")],
      ["favorites", "♡", `${t("navFavorites")} (${state.favorites.size})`],
      ["ai", "✨", "Tiny Tiffin AI"],
      ["shopping", "🛒", "Smart Shopping"],
      ["festival", "🎉", festivalT("festivalTitle")],
      ["fasting", "🙏", fastingT("title")],
      ["regional", "🌍", "Regional Recipes"]
    ];
    return `
      <header class="app-header">
        <div class="wrap header-row">
          <div class="brand-wrap"><div class="mascot brand"><span class="brand-icon-wrap premium-logo-mark" aria-hidden="true">${premiumLogoSVG(42)}</span><span>Tiny Tiffin</span></div><div class="app-tagline">${t("tagline")}</div></div>
          <div class="header-controls">
            <button class="theme-toggle install-action" id="install-btn" aria-label="Install app">⬇️ Install</button>
            <button class="theme-toggle install-action" id="update-btn" aria-label="Check for software update">↻ Update</button>
            <button class="theme-toggle" id="theme-toggle" aria-label="${t('darkMode')}">${state.theme === "dark" ? "☀️" : "🌙"}</button>
            <select class="lang-select" id="lang-select" aria-label="Language">${langOptions}</select>
            <a class="admin-link" href="admin.html">${t("adminLink")}</a>
          </div>
        </div>
        <div class="wrap tabs">
          ${tabs.map(([id, icon, label]) => `<button class="tab-btn ${state.tab === id ? "active" : ""}" data-tab="${id}" title="${label}" aria-label="${label}"><span class="tab-icon">${icon}</span><span class="tab-label">${label}</span></button>`).join("")}
        </div>
      </header>
    `;
  }

  function attachHeaderEvents() {
    document.getElementById("lang-select").addEventListener("change", (e) => { state.lang = e.target.value; saveLang(); render(); });
    document.getElementById("theme-toggle").addEventListener("click", () => {
      state.theme = state.theme === "dark" ? "light" : "dark"; saveTheme(); applyTheme(); render();
    });
    const installBtn = document.getElementById("install-btn");
    if (installBtn) {
      if (isStandalone) installBtn.style.display = "none";
      installBtn.addEventListener("click", async () => {
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          await deferredInstallPrompt.userChoice;
          deferredInstallPrompt = null;
          installBtn.style.display = "none";
        } else {
          const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
          alert(isIOS
            ? "To install: tap the Share icon in Safari, then \"Add to Home Screen\"."
            : "To install: open your browser menu (⋮) and tap \"Add to Home screen\" or \"Install app\".");
        }
      });
    }
    const updateBtn = document.getElementById("update-btn");
    if (updateBtn) {
      updateBtn.addEventListener("click", async () => {
        if (updateCheckInProgress) return;
        updateCheckInProgress = true;
        updateBtn.disabled = true;
        updateBtn.textContent = "↻ Checking…";
        try {
          if ("serviceWorker" in navigator) {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) await reg.update();
          }
          alert(`Tiny Tiffin ${CONFIG.version || "v1.0"} is up to date. If a new version was just deployed, reload once to receive it.`);
          window.location.reload();
        } catch (err) {
          alert("Update check could not be completed. Please refresh the app and try again.");
          updateBtn.disabled = false;
          updateBtn.textContent = "↻ Update";
          updateCheckInProgress = false;
        }
      });
    }
    root.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const nextTab = btn.dataset.tab;
        if (nextTab === "regional") {
          btn.disabled = true;
          const ok = await ensureRegionalData();
          btn.disabled = false;
          if (!ok) {
            toast("Regional recipes could not load. Please check your connection and try again.");
            return;
          }
        }
        state.tab = nextTab;
        render();
        window.scrollTo(0, 0);
      });
    });
  }

  /* ---------- image / placeholder ---------- */
  function recipeImageHTML(r) {
    const manual = r.images && r.images.length > 0;
    const cached = !manual ? imageCache[r.id] : null;
    const image = manual ? { url: r.images[0], source: "admin" } : cached;
    return `<div class="recipe-image-wrap" data-auto-image="${escapeAttr(r.id)}">${imageMarkup(r, image)}</div>`;
  }

  /* ---------- Smart Shopping ---------- */
  window.tinyTiffinRunShopping = function(forcedQuery) {
    const input=document.getElementById('shop-search');
    const box=document.getElementById('shop-results');
    if(!box) return false;
    const q=(forcedQuery || (input&&input.value) || '').trim();
    if(!q){ if(input) input.focus(); box.innerHTML='<div class="shop-notice">Please enter a product or ingredient first.</div>'; return false; }
    const liveOnly=!!document.getElementById('shop-live-only')?.checked;
    if(liveOnly){
      box.innerHTML='<div class="shop-notice"><strong>Live results only is enabled.</strong><br>Verified live-price APIs are not connected yet. Turn off this option to see working store search cards.</div>';
      return false;
    }
    const query=encodeURIComponent(q);
    const stores=[
      ['Amazon India','🛒',`https://www.amazon.in/s?k=${query}&tag=tinytiffin-21`],
      ['Amazon Fresh','🥬',`https://www.amazon.in/fresh/s?k=${query}&tag=tinytiffin-21`],
      ['Flipkart','🛍️',`https://www.flipkart.com/search?q=${query}`],
      ['BigBasket','🧺',`https://www.bigbasket.com/ps/?q=${query}`],
      ['Blinkit','⚡',`https://blinkit.com/s/?q=${query}`],
      ['Zepto','🚴',`https://www.zeptonow.com/search?query=${query}`]
    ];
    const safe=typeof escapeHTML==='function'?escapeHTML(q):q.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    box.innerHTML=`<div class="shop-summary"><strong>Store results for “${safe}”</strong><br><span>Tap a store to check its latest price and delivery availability.</span></div><div class="shop-grid">${stores.map(x=>`<article class="shop-card"><div class="shop-store">${x[1]} ${x[0]}</div><h3>${safe}</h3><p>Open the retailer to view the current price.</p><a class="btn btn-primary" target="_blank" rel="sponsored noopener noreferrer" href="${x[2]}">Open ${x[0]}</a></article>`).join('')}</div>`;
    setTimeout(()=>box.scrollIntoView({behavior:'smooth',block:'start'}),50);
    return false;
  };

  function renderShoppingTab() {
    return `
      ${renderSmartShoppingLivePanel()}
      <section class="ai-hub smart-shopping-hub">
        <div class="ai-card">
          <h3>How Smart Buy works</h3>
          <p class="ai-muted">Search a grocery item, compare the same or closest matching pack across supported stores, then tap the store price you prefer to open that retailer.</p>
        </div>
      </section>`;
  }

  function attachShoppingEvents() {}


  /* ---------- v2.3 Smart Shopping live price comparison ---------- */
  let smartShoppingLiveResults = [];
  let smartShoppingSelectedQuery = "";
  let smartShoppingLocation = { pincode: storage.get("tt_grocery_pincode", ""), latitude: null, longitude: null };

  function normalizeShoppingQuery(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  let smartBuySort = "top";

  function smartBuyStoreLogo(platform) {
    const logos = {
      blinkit: "🟨", zepto: "🟪", swiggy: "🟧", bigbasket: "🟩",
      amazon: "🛒", flipkart: "🟦", dmart: "🟢", jiomart: "🔵"
    };
    return logos[platform] || "🏪";
  }

  function sortSmartGroups(groups) {
    const copy = groups.slice();
    if (smartBuySort === "lowest") {
      return copy.sort((a,b) => (Number(a.lowestPrice) || Infinity) - (Number(b.lowestPrice) || Infinity));
    }
    if (smartBuySort === "savings") {
      return copy.sort((a,b) => (Number(b.bestSaving) || 0) - (Number(a.bestSaving) || 0));
    }
    return copy.sort((a,b) => (Number(b.matchScore) || 0) - (Number(a.matchScore) || 0));
  }

  function renderSmartShoppingResults(data) {
    smartShoppingLiveResults = data.items || [];
    if (!smartShoppingLiveResults.length) {
      return `<div class="shop-notice">No live matches were returned for this search.</div>`;
    }

    const item = smartShoppingLiveResults[0];
    const groups = sortSmartGroups((item.productGroups || []).slice());
    if (!groups.length) {
      return `<div class="shop-notice">No comparable live products were returned for <strong>${escapeHTML(item.query)}</strong>.</div>`;
    }

    return `
      <div class="smart-buy-toolbar">
        <div class="smart-buy-progress"><span>Live comparison</span><strong>${groups.length} matches</strong></div>
        <div class="smart-buy-tabs">
          <button class="chip ${smartBuySort==="top"?"active":""}" data-smart-sort="top">Top Matches</button>
          <button class="chip ${smartBuySort==="savings"?"active":""}" data-smart-sort="savings">Best Savings</button>
          <button class="chip ${smartBuySort==="lowest"?"active":""}" data-smart-sort="lowest">Lowest Price</button>
        </div>
      </div>

      <div class="smart-product-grid">
        ${groups.map((g, idx) => {
          const available = (g.offers || []).filter(o => o.available !== false && Number.isFinite(Number(o.price)));
          const cheapest = available.slice().sort((a,b)=>Number(a.price)-Number(b.price))[0] || null;
          const visibleOffers = (g.offers || []).slice().sort((a,b)=>(Number(a.price)||Infinity)-(Number(b.price)||Infinity));
          return `<article class="smart-product-card">
            <div class="smart-product-image">
              ${g.image ? `<img src="${escapeAttr(g.image)}" alt="${escapeAttr(g.productName || item.query)}" loading="lazy" referrerpolicy="no-referrer">` : `<div class="smart-product-placeholder">🛍️</div>`}
            </div>
            <div class="smart-product-body">
              ${g.brand ? `<div class="smart-brand">${escapeHTML(g.brand)}</div>` : ""}
              <h3>${escapeHTML(g.productName || item.query)}</h3>
              <div class="smart-pack">${escapeHTML(g.packSize || "Pack size unavailable")}</div>

              <div class="smart-store-price-list">
                ${visibleOffers.map(o => {
                  const isCheapest = cheapest && o.platform === cheapest.platform && Number(o.price) === Number(cheapest.price);
                  return `<button class="smart-store-price-row ${isCheapest ? "best" : ""}" 
                                  data-store-url="${escapeAttr(o.buyUrl || groceryFallbackUrl(o.platform, g.productName || item.query, smartShoppingLocation.pincode))}"
                                  ${o.available === false ? 'aria-label="Open store - item currently out of stock"' : ''}>
                    <span class="smart-store-name">${smartBuyStoreLogo(o.platform)} ${escapeHTML(o.platformLabel || o.platform)}</span>
                    <span class="smart-row-pack">${escapeHTML(o.packSize || g.packSize || "")}${o.delivery ? ` · ${escapeHTML(String(o.delivery))}` : ""}</span>
                    <span class="smart-row-price">${money(o.price)}</span>
                    ${isCheapest ? `<span class="smart-best-dot">✓</span>` : ""}
                  </button>`;
                }).join("")}
              </div>

              <div class="smart-card-footer">
                <div>
                  ${cheapest ? `<strong>From ${money(cheapest.price)}</strong>` : `<strong>Price unavailable</strong>`}
                  ${cheapest && cheapest.inventory != null ? `<small>${cheapest.inventory} in stock${cheapest.delivery ? ` · ${escapeHTML(String(cheapest.delivery))}` : ""}</small>` :
                    (g.bestSaving ? `<small>Save up to ${money(g.bestSaving)}</small>` : `<small>Tap a store to view</small>`)}
                </div>
                <button class="smart-add-btn" data-smart-add="${idx}" aria-label="Choose product">+</button>
              </div>
            </div>
          </article>`;
        }).join("")}
      </div>
      <p class="compare-disclaimer">Tap any store row to open that retailer. Prices, stock, pack sizes and delivery can change after comparison.</p>
    `;
  }

  async function runSmartShoppingLiveSearch(query, resultBox, button) {
    const q = normalizeShoppingQuery(query);
    if (!q) {
      resultBox.innerHTML = `<div class="shop-notice">Enter an ingredient or grocery item, for example Paneer or Idli Batter.</div>`;
      return;
    }
    if (!(smartShoppingLocation.latitude && smartShoppingLocation.longitude)) {
      resultBox.innerHTML = `<div class="shop-notice">Tap <strong>Use location</strong> first. This live-price API requires latitude/longitude because grocery prices and availability vary by nearby store.</div>`;
      return;
    }

    button.disabled = true;
    button.textContent = "Checking live prices…";
    resultBox.innerHTML = `<div class="compare-loading">Comparing current prices, pack sizes and availability across supported stores…</div>`;

    try {
      const response = await fetch("/api/compare-prices", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          pincode: smartShoppingLocation.pincode || "",
          latitude: smartShoppingLocation.latitude || null,
          longitude: smartShoppingLocation.longitude || null,
          items: [{ original: q, query: q }],
          platforms: GROCERY_COMPARE_PLATFORMS.map(p => p.key)
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        resultBox.innerHTML = `<div class="shop-notice"><strong>${escapeHTML(data.message || "Live comparison is temporarily unavailable.")}</strong><br>Try again shortly.</div>`;
        return;
      }
      resultBox.innerHTML = renderSmartShoppingResults(data);
      const openStore = (el) => {
        const url = el.dataset.storeUrl;
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      };
      resultBox.querySelectorAll(".smart-store-price-row").forEach(btn => {
        btn.addEventListener("click", () => openStore(btn));
      });
      resultBox.querySelectorAll("[data-smart-sort]").forEach(btn => {
        btn.addEventListener("click", () => {
          smartBuySort = btn.dataset.smartSort;
          resultBox.innerHTML = renderSmartShoppingResults(data);
          resultBox.querySelectorAll(".smart-store-price-row").forEach(row => row.addEventListener("click", () => openStore(row)));
          resultBox.querySelectorAll("[data-smart-sort]").forEach(sortBtn => sortBtn.addEventListener("click", () => {
            smartBuySort = sortBtn.dataset.smartSort;
            runSmartShoppingLiveSearch(q, resultBox, button);
          }));
        });
      });
    } catch (e) {
      resultBox.innerHTML = `<div class="shop-notice"><strong>Could not reach the live price service.</strong><br>Please try again shortly.</div>`;
    } finally {
      button.disabled = false;
      button.textContent = "Compare Live Prices";
    }
  }

  function renderSmartShoppingLivePanel() {
    const pin = smartShoppingLocation.pincode || "";
    return `
      <section class="smart-live-panel">
        <div class="smart-live-hero">
          <div>
            <div class="festival-kicker">⚡ Smart Buy</div>
            <h2>Compare the same product across stores</h2>
            <p>Search Paneer, Idli Batter, Milk, Oats or any grocery item. Tiny Tiffin groups matching products and shows each store price together so you can choose quickly.</p>
          </div>
          <div class="smart-live-icon">🛒</div>
        </div>

        <div class="smart-live-controls">
          <input id="smart-live-query" class="search-input" placeholder="Search Paneer, Idli Batter, Milk, Banana..." value="${escapeAttr(smartShoppingSelectedQuery)}">
          <input id="smart-live-pin" class="search-input smart-pin-input" inputmode="numeric" maxlength="6" placeholder="PIN code" value="${escapeAttr(pin)}">
          <button class="btn btn-secondary" id="smart-live-location" type="button">📍 Use location</button>
          <button class="btn btn-primary" id="smart-live-compare" type="button">Compare Live Prices</button>
        </div>

        <div class="smart-quick-items">
          ${["Paneer","Idli Batter","Milk","Banana","Bread","Tofu"].map(x => `<button class="chip" data-smart-quick="${escapeAttr(x)}">${escapeHTML(x)}</button>`).join("")}
        </div>
        <small id="smart-live-location-status" class="smart-location-note">Prices and stock vary by location. Tap “Use location” before comparing so Tiny Tiffin can request live store-specific prices. Coordinates are used only for the comparison request.</small>
        <div id="smart-live-results" class="smart-live-results"></div>
      </section>
    `;
  }

  function attachSmartShoppingLiveEvents() {
    const query = document.getElementById("smart-live-query");
    const pin = document.getElementById("smart-live-pin");
    const compare = document.getElementById("smart-live-compare");
    const results = document.getElementById("smart-live-results");
    const status = document.getElementById("smart-live-location-status");
    const loc = document.getElementById("smart-live-location");

    if (!query || !pin || !compare || !results) return;

    query.addEventListener("input", () => smartShoppingSelectedQuery = query.value);
    pin.addEventListener("input", () => {
      smartShoppingLocation.pincode = pin.value.replace(/\D/g,"").slice(0,6);
      pin.value = smartShoppingLocation.pincode;
      if (smartShoppingLocation.pincode.length === 6) storage.set("tt_grocery_pincode", smartShoppingLocation.pincode);
    });

    compare.addEventListener("click", () => runSmartShoppingLiveSearch(query.value, results, compare));
    query.addEventListener("keydown", e => { if (e.key === "Enter") compare.click(); });

    document.querySelectorAll("[data-smart-quick]").forEach(btn => btn.addEventListener("click", () => {
      query.value = btn.dataset.smartQuick;
      smartShoppingSelectedQuery = query.value;
      compare.click();
    }));

    if (loc) loc.addEventListener("click", () => {
      if (!navigator.geolocation) {
        status.textContent = "Location is not supported by this browser. Please enter a PIN code.";
        return;
      }
      status.textContent = "Requesting location…";
      navigator.geolocation.getCurrentPosition(
        pos => {
          smartShoppingLocation.latitude = Number(pos.coords.latitude.toFixed(6));
          smartShoppingLocation.longitude = Number(pos.coords.longitude.toFixed(6));
          status.textContent = "Location captured for this live comparison.";
        },
        () => status.textContent = "Location permission was not available. Please enter your PIN code.",
        {enableHighAccuracy:false,timeout:10000,maximumAge:300000}
      );
    });
  }

  function openGroceryCompareModal(recipe) {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.id = "grocery-compare-modal";
    const savedPin = storage.get("tt_grocery_pincode", "");
    backdrop.innerHTML = `
      <div class="modal grocery-compare-modal" role="dialog" aria-modal="true" aria-label="Compare grocery prices">
        <button class="modal-close" id="compare-close">✕</button>
        <h2>🛒 Compare Grocery Prices</h2>
        <p class="desc">Compare one ingredient or your complete recipe basket across supported Indian grocery platforms. Exact availability depends on your location.</p>

        <div class="compare-location">
          <label><strong>Delivery PIN code</strong>
            <input id="compare-pincode" class="search-input" inputmode="numeric" maxlength="6" placeholder="e.g. 411057" value="${escapeAttr(savedPin)}">
          </label>
          <button class="btn btn-secondary" id="compare-use-location" type="button">📍 Use my location</button>
          <small id="compare-location-status">Your precise location is used only for this comparison and is not stored.</small>
        </div>

        <div class="compare-select-actions">
          <button class="link-btn" id="compare-select-all" type="button">Select all</button>
          <button class="link-btn" id="compare-clear-all" type="button">Clear</button>
        </div>
        <div class="compare-ingredient-list">
          ${(recipe.ingredients || []).map((ing, idx) => `<label class="compare-ingredient">
            <input type="checkbox" data-compare-ing="${idx}" checked>
            <span>${escapeHTML(ing)}</span>
          </label>`).join("")}
        </div>
        <div class="compare-actions">
          <button class="btn btn-primary" id="compare-run" type="button">Compare selected ingredients</button>
        </div>
        <div id="compare-results" class="compare-results"></div>
      </div>`;

    document.body.appendChild(backdrop);
    const close = () => backdrop.remove();
    backdrop.addEventListener("click", e => { if (e.target === backdrop) close(); });
    backdrop.querySelector("#compare-close").addEventListener("click", close);

    backdrop.querySelector("#compare-select-all").addEventListener("click", () => {
      backdrop.querySelectorAll("[data-compare-ing]").forEach(x => x.checked = true);
    });
    backdrop.querySelector("#compare-clear-all").addEventListener("click", () => {
      backdrop.querySelectorAll("[data-compare-ing]").forEach(x => x.checked = false);
    });

    const locationState = { pincode: savedPin, latitude: null, longitude: null };
    const pinInput = backdrop.querySelector("#compare-pincode");
    pinInput.addEventListener("input", () => {
      locationState.pincode = pinInput.value.replace(/\D/g, "").slice(0, 6);
      pinInput.value = locationState.pincode;
      if (locationState.pincode.length === 6) storage.set("tt_grocery_pincode", locationState.pincode);
    });

    backdrop.querySelector("#compare-use-location").addEventListener("click", () => {
      const status = backdrop.querySelector("#compare-location-status");
      if (!navigator.geolocation) {
        status.textContent = "Location is not supported by this browser. Please enter your PIN code.";
        return;
      }
      status.textContent = "Requesting your location…";
      navigator.geolocation.getCurrentPosition(
        pos => {
          locationState.latitude = Number(pos.coords.latitude.toFixed(6));
          locationState.longitude = Number(pos.coords.longitude.toFixed(6));
          status.textContent = "Location captured for this comparison. You can also enter your PIN code for more accurate platform coverage.";
        },
        () => status.textContent = "Location permission was not available. Please enter your PIN code.",
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    });

    backdrop.querySelector("#compare-run").addEventListener("click", () => {
      const selected = Array.from(backdrop.querySelectorAll("[data-compare-ing]:checked"))
        .map(x => recipe.ingredients[Number(x.dataset.compareIng)])
        .filter(Boolean);
      compareRecipePrices(recipe, selected, locationState, backdrop.querySelector("#compare-results"), backdrop.querySelector("#compare-run"));
    });
  }

  function openRecipeModal(id) {
    const r = getRecipeById(id);
    if (!r) return;
    const rt = displayedRatings(r);
    const images = (r.images && r.images.length) ? r.images.slice(0, 2) : (imageCache[r.id] ? [imageCache[r.id].url] : []);
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.id = "recipe-modal";
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="${recipeName(r)}">
        <button class="modal-close" id="modal-close">✕</button>
        ${images.length ? `<div class="modal-gallery">${images.map(src => `<div class="recipe-image-wrap"><img src="${src}" alt="${recipeName(r)}"></div>`).join("")}</div>`
          : `<div class="recipe-image-wrap" style="aspect-ratio:2/1;margin-bottom:14px"><div class="placeholder-illustration" style="font-size:3.4rem">${r.emoji}</div></div>`}
        <h2>${recipeName(r)}</h2>
        <p class="desc">${recipeDesc(r)}</p>
        <div class="rating-row" style="margin-bottom:10px">${starsHTML(rt.overall)} <span>${rt.overall.toFixed(1)} (${rt.count})</span>
          <button class="link-btn" id="share-btn" style="margin-left:auto">${t("shareRecipe")}</button>
        </div>
        <div class="meta-row" style="margin-bottom:14px">
          <span class="tag time">⏱ ${r.timeCategory} min</span>
          <span class="tag">${r.difficulty}</span>
          <span class="tag cuisine-${r.cuisine}">${t("cuisine" + capitalize(r.cuisine))}</span>
          ${r.dietType.map(d => `<span class="tag diet-${d}">${t("diet" + capitalize(d))}</span>`).join("")}
          ${r.nutritionTags.map(n => `<span class="tag nutri">${NUTRITION_EMOJI[n]} ${t("nutritionGoals")[n]}</span>`).join("")}
          ${r.allergens.map(a => `<span class="tag allergen">⚠ ${a}</span>`).join("")}
        </div>
        <section>
          <h4>${t("ingredients")}</h4>
          <ul>${r.ingredients.map(i => `<li>${i}</li>`).join("")}</ul>
        </section>
        <section>
          <h4>${t("steps")}</h4>
          <ol>${r.instructions.map(s => `<li>${s}</li>`).join("")}</ol>
        </section>
        <section>
          <h4>${t("nutrition")}</h4>
          <div class="nutri-grid">
            <div class="nutri-cell"><div class="val mono">${r.nutrition.calories}</div><div class="lbl">${t("calories")}</div></div>
            <div class="nutri-cell"><div class="val mono">${r.nutrition.protein_g}g</div><div class="lbl">${t("protein")}</div></div>
            <div class="nutri-cell"><div class="val mono">${r.nutrition.iron_mg}mg</div><div class="lbl">${t("iron")}</div></div>
            <div class="nutri-cell"><div class="val mono">${r.nutrition.calcium_mg}mg</div><div class="lbl">${t("calcium")}</div></div>
          </div>
        </section>
        <div class="tip-box"><strong>💡 ${t("packingTip")}:</strong> ${r.packingTip[state.lang] || r.packingTip.en}</div>
        <div class="tip-box kid"><strong>👪 ${t("kidTip")}:</strong> ${r.kidTip[state.lang] || r.kidTip.en}</div>
        <div class="card-actions">
          <button class="btn btn-secondary" id="modal-fav" data-fav="${r.id}">${state.favorites.has(r.id) ? "♥ " + t("removeFavorite") : "♡ " + t("addFavorite")}</button>
          <button class="btn btn-primary" id="modal-plan">${t("addToPlanner")}</button>
          <button class="btn btn-secondary" id="ai-adapt">🤖 ${t("aiAdapt")}</button>
          <button class="btn btn-secondary" id="compare-grocery-prices">🛒 Compare Grocery Prices</button>
        </div>
        <div class="rate-form" id="rate-form">
          <strong>${state.userRatings[r.id] ? t("updateRating") : t("rateThis")}</strong>
          ${["overall", "nutrition", "kidFriendly", "lunchboxFriendly", "pickyEaterFriendly", "timeSaver"].map(k => `
            <div class="rating-breakdown">
              <span>${k === "overall" ? t("ratingOverall") : t("rating" + capitalize(k))}</span>
              <span class="star-picker" data-rate-key="${k}">${[1, 2, 3, 4, 5].map(i => `<span class="star" data-val="${i}">★</span>`).join("")}</span>
            </div>`).join("")}
          <button class="btn btn-primary" id="submit-rating">${t("submitRating")}</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    playRecipeBurst();
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });
    document.getElementById("modal-close").addEventListener("click", closeModal);
    document.getElementById("modal-fav").addEventListener("click", () => {
      if (state.favorites.has(r.id)) state.favorites.delete(r.id); else state.favorites.add(r.id);
      saveFavorites(); closeModal(); render();
      toast(state.favorites.has(r.id) ? t("removeFavorite") : t("addFavorite"));
    });
    document.getElementById("modal-plan").addEventListener("click", () => { closeModal(); openPlannerPicker(r.id); });
    document.getElementById("ai-adapt").addEventListener("click", () => {
      const instruction = prompt("How would you like to adapt this recipe? Example: Make it egg-free or vegan.");
      if (!instruction) return;
      const result = aiAdaptRecipe(r, instruction);
      toast(result.title);
      alert(result.notes.join("\n\n") + "\n\n" + result.caution);
    });
    const compareBtn = document.getElementById("compare-grocery-prices");
    if (compareBtn) compareBtn.addEventListener("click", () => openGroceryCompareModal(r));
    const shareBtn = document.getElementById("share-btn");
    if (shareBtn) shareBtn.addEventListener("click", () => shareRecipe(r));

    const existingUserRating = state.userRatings[r.id] || {};
    const pending = {
      overall: Number(existingUserRating.overall) || 0,
      nutrition: Number(existingUserRating.nutrition) || 0,
      kidFriendly: Number(existingUserRating.kidFriendly) || 0,
      lunchboxFriendly: Number(existingUserRating.lunchboxFriendly) || 0,
      pickyEaterFriendly: Number(existingUserRating.pickyEaterFriendly) || 0,
      timeSaver: Number(existingUserRating.timeSaver) || 0
    };
    backdrop.querySelectorAll(".star-picker").forEach(picker => {
      const key = picker.dataset.rateKey;
      const existing = pending[key];
      if (existing) picker.querySelectorAll(".star").forEach(s => s.classList.toggle("filled", Number(s.dataset.val) <= existing));
      picker.querySelectorAll(".star").forEach(starEl => {
        starEl.addEventListener("click", () => {
          const val = Number(starEl.dataset.val);
          pending[key] = val;
          picker.querySelectorAll(".star").forEach(s => s.classList.toggle("filled", Number(s.dataset.val) <= val));
        });
      });
    });
    document.getElementById("submit-rating").addEventListener("click", () => {
      if (!pending.overall) { toast(t("rateThis")); return; }
      Object.keys(pending).forEach(k => { if (!pending[k]) pending[k] = pending.overall; });
      state.userRatings[r.id] = pending;
      saveUserRatings();
      toast(t("thanksForRating"));
      closeModal();
      render();
    });
    if (window.tinyTiffinLocalizeRecipe) window.tinyTiffinLocalizeRecipe(r, backdrop, state.lang);
  }
  function closeModal() { const m = document.getElementById("recipe-modal"); if (m) m.remove(); }

  function shareRecipe(r) {
    const url = `${location.origin}${location.pathname}#recipe=${r.id}`;
    const text = `${recipeName(r)} — ${recipeDesc(r)}`;
    if (navigator.share) {
      navigator.share({ title: recipeName(r), text, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(`${text}\n${url}`).then(() => toast(t("shareCopied"))).catch(() => toast(url));
    } else {
      toast(url);
    }
  }

  /* ---------- Planner picker ---------- */
  function openPlannerPicker(recipeId) {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop"; backdrop.id = "planner-picker";
    backdrop.innerHTML = `
      <div class="modal" style="max-width:420px">
        <button class="modal-close" id="picker-close">✕</button>
        <h2>${t("addToPlanner")}</h2>
        <div class="picker-list">
          ${DAY_KEYS.map(day => MEAL_SLOTS.map(slot => `
            <div class="picker-item">
              <span>${t("days")[DAY_KEYS.indexOf(day)]} · ${t(slot)}</span>
              <button data-day="${day}" data-slot="${slot}">+</button>
            </div>`).join("")).join("")}
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
    document.getElementById("picker-close").addEventListener("click", () => backdrop.remove());
    backdrop.querySelectorAll("[data-day]").forEach(btn => {
      btn.addEventListener("click", () => {
        addToPlanner(btn.dataset.day, btn.dataset.slot, recipeId);
        backdrop.remove();
        if (state.tab === "planner") render();
      });
    });
  }

  function addToPlanner(day, slot, recipeId) {
    const key = `${day}-${slot}`;
    const existingId = state.planner[key];
    if (existingId && existingId !== recipeId) {
      const existing = getRecipeById(existingId);
      const incoming = getRecipeById(recipeId);
      const replace = window.confirm(`${day} ${slot} already has "${existing ? recipeName(existing) : "a recipe"}".\n\nReplace it with "${incoming ? recipeName(incoming) : "the new recipe"}"?`);
      if (!replace) {
        state.tab = "planner";
        render();
        setTimeout(() => {
          const el = document.querySelector(`[data-planner-slot="${key}"]`);
          if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("planner-highlight"); }
        }, 50);
        return;
      }
    }
    const alreadyUsed = Object.values(state.planner).includes(recipeId);
    state.planner[key] = recipeId;
    savePlanner();
    toast(alreadyUsed ? t("noRepeatWarning") : t("addToPlanner"));
  }

  /* ---------- Planner tab ---------- */
  function renderPlannerTab() {
    const hasAny = Object.keys(state.planner).length > 0;
    return `
      <section style="padding-top:26px">
        <div class="header-row" style="margin-bottom:10px">
          <h2 class="display" style="color:var(--masala);margin:0">${t("plannerTitle")}</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-secondary" id="save-plan-btn">${t("savePlanAs")}</button>
            <button class="btn btn-secondary" id="load-plan-btn">${t("loadPlan")}</button>
          </div>
        </div>
        <div class="planner-grid">
          ${DAY_KEYS.map((day, i) => `
            <div class="planner-day">
              <h4>${t("days")[i]}</h4>
              ${MEAL_SLOTS.map(slot => {
                const key = `${day}-${slot}`;
                const recipeId = state.planner[key];
                const r = recipeId ? getRecipeById(recipeId) : null;
                if (r) return `<div class="planner-slot" data-planner-slot="${key}"><span>${r.emoji} ${recipeName(r)}</span><button data-remove="${key}">✕</button></div>`;
                return `<button class="planner-add" data-add="${day}|${slot}">+ ${t(slot)}</button>`;
              }).join("")}
            </div>`).join("")}
        </div>
        <button class="btn btn-primary" id="grocery-btn" ${hasAny ? "" : "disabled"}>${t("groceryList")}</button>
      </section>
    `;
  }

  function attachPlannerEvents() {
    root.querySelectorAll("[data-remove]").forEach(btn => btn.addEventListener("click", () => { delete state.planner[btn.dataset.remove]; savePlanner(); render(); }));
    root.querySelectorAll("[data-add]").forEach(btn => btn.addEventListener("click", () => openSlotPicker(...btn.dataset.add.split("|"))));
    const groceryBtn = document.getElementById("grocery-btn");
    if (groceryBtn) groceryBtn.addEventListener("click", openGroceryModal);
    const saveBtn = document.getElementById("save-plan-btn");
    if (saveBtn) saveBtn.addEventListener("click", () => {
      const name = prompt(t("planNamePrompt"));
      if (!name) return;
      state.savedPlans.push({ name, planner: { ...state.planner } });
      saveSavedPlans();
      toast(t("savePlanAs"));
    });
    const loadBtn = document.getElementById("load-plan-btn");
    if (loadBtn) loadBtn.addEventListener("click", openLoadPlanModal);
  }

  function openLoadPlanModal() {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal" style="max-width:420px">
        <button class="modal-close" id="load-close">✕</button>
        <h2>${t("savedPlans")}</h2>
        <div class="picker-list">
          ${state.savedPlans.length ? state.savedPlans.map((p, i) => `
            <div class="picker-item"><span>${p.name}</span><button data-load="${i}">${t("loadPlan")}</button></div>
          `).join("") : `<p class="desc">${t("plannerEmpty")}</p>`}
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
    document.getElementById("load-close").addEventListener("click", () => backdrop.remove());
    backdrop.querySelectorAll("[data-load]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.planner = { ...state.savedPlans[Number(btn.dataset.load)].planner };
        savePlanner(); backdrop.remove(); render();
      });
    });
  }

  function openSlotPicker(day, slot) {
    const options = state.favorites.size > 0 ? Array.from(state.favorites) : BASE_RECIPES.map(r => r.id).slice(0, 8);
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal" style="max-width:420px">
        <button class="modal-close" id="slot-close">✕</button>
        <h2>${t("days")[DAY_KEYS.indexOf(day)]} · ${t(slot)}</h2>
        <p class="desc">${t("plannerAddFrom")}</p>
        <div class="picker-list">
          ${options.map(id => {
            const r = getRecipeById(id);
            if (!r) return "";
            return `<div class="picker-item"><span>${r.emoji} ${recipeName(r)}</span><button data-pick="${id}">${t("addToPlanner")}</button></div>`;
          }).join("")}
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
    backdrop.querySelector("#slot-close").addEventListener("click", () => backdrop.remove());
    backdrop.querySelectorAll("[data-pick]").forEach(btn => {
      btn.addEventListener("click", () => { addToPlanner(day, slot, btn.dataset.pick); backdrop.remove(); render(); });
    });
  }

  function openGroceryModal() {
    const counts = {};
    Object.values(state.planner).forEach(id => {
      const r = getRecipeById(id);
      if (!r) return;
      r.ingredients.forEach(ing => { counts[ing] = (counts[ing] || 0) + 1; });
    });
    const items = Object.keys(counts).sort();
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal">
        <button class="modal-close" id="grocery-close">✕</button>
        <h2>${t("groceryTitle")}</h2>
        ${items.length ? `<ul>${items.map(i => `<li><label><input type="checkbox"> ${i}${counts[i] > 1 ? ` <span class="mono" style="color:var(--ink-soft)">×${counts[i]}</span>` : ""}</label></li>`).join("")}</ul>` : `<p class="desc">${t("groceryEmpty")}</p>`}
        <div class="card-actions"><button class="btn btn-secondary" id="print-list">${t("printList")}</button></div>
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
    backdrop.querySelector("#grocery-close").addEventListener("click", () => backdrop.remove());
    const printBtn = backdrop.querySelector("#print-list");
    if (printBtn) printBtn.addEventListener("click", () => window.print());
  }

  /* ---------- Match tab (Emergency Ingredient Mode) ---------- */
  function renderMatchTab() {
    const results = computeMatches(state.matchInput);
    return `
      <section style="padding-top:26px;max-width:640px;margin:0 auto">
        <h2 class="display" style="color:var(--masala)">${t("navMatch")}</h2>
        <p class="sub" style="text-align:left;margin:0 0 16px">${t("matchIntro")}</p>
        <div class="smart-search-bar">
          <input type="text" id="match-input" placeholder="${t('matchPlaceholder')}" value="${escapeAttr(state.matchInput)}">
        </div>
        <p style="font-size:.78rem;color:var(--ink-soft);margin:6px 0 20px">${t("matchHint")}</p>
      </section>
      <section class="wrap" id="match-results">${renderMatchResults(results)}</section>
    `;
  }
  function renderMatchResults(results) {
    if (!state.matchInput.trim()) return `<div class="empty-state">${mascotSVG(56)}<p style="margin-top:10px">${t("matchNoneTitle")}</p></div>`;
    let html = "";
    if (results.full.length) {
      html += `<h3 style="color:var(--masala)">${t("matchFullTitle")}</h3><div class="recipe-grid" style="margin-bottom:28px">${results.full.map(m => recipeCardHTML(m.recipe)).join("")}</div>`;
    }
    if (results.partial.length) {
      html += `<h3 style="color:var(--turmeric-dark)">${t("matchPartialTitle")}</h3><div class="recipe-grid">${results.partial.map(m => matchCardHTML(m)).join("")}</div>`;
    }
    if (!results.full.length && !results.partial.length) html += `<div class="empty-state">${mascotSVG(56)}<p style="margin-top:10px">${t("matchNoneTitle")}</p></div>`;
    return html;
  }
  function matchCardHTML(m) {
    const base = recipeCardHTML(m.recipe);
    const missingNote = `<div class="tip-box" style="margin:8px 0 0"><strong>${t("missingLabel")}:</strong> ${m.missing.join(", ")}</div>`;
    return base.replace('<div class="card-actions">', missingNote + '<div class="card-actions">');
  }
  function computeMatches(inputStr) {
    const terms = inputStr.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    const full = [], partial = [];
    if (!terms.length) return { full, partial };
    RECIPES.forEach(r => {
      const core = r.ingredients.filter(i => !isStaple(i));
      if (!core.length) return;
      const matched = core.filter(i => terms.some(term => i.toLowerCase().includes(term)));
      const missing = core.filter(i => !matched.includes(i));
      if (matched.length === 0) return;
      if (missing.length === 0) full.push({ recipe: r, missing: [] });
      else partial.push({ recipe: r, missing });
    });
    partial.sort((a, b) => a.missing.length - b.missing.length);
    return { full, partial: partial.slice(0, 12) };
  }
  function attachMatchEvents() {
    const input = document.getElementById("match-input");
    if (input) input.addEventListener("input", (e) => {
      state.matchInput = e.target.value;
      document.getElementById("match-results").innerHTML = renderMatchResults(computeMatches(state.matchInput));
      attachCardEvents();
    });
    attachCardEvents();
  }

  /* ---------- Tiny Tiffin AI features (local, privacy-friendly) ---------- */
  function aiTokens(text) {
    return String(text || "").toLowerCase().split(/[,\n]+/).map(x => x.trim()).filter(Boolean);
  }
  function aiRecipeMatches(ingredients) {
    const terms = aiTokens(ingredients);
    if (!terms.length) return RECIPES.slice(0, 8);
    return RECIPES.map(r => {
      const hay = [recipeName(r), r.ingredients.join(" "), r.nutritionTags.join(" "), r.cuisine].join(" ").toLowerCase();
      const score = terms.reduce((n, term) => n + (hay.includes(term) ? 1 : 0), 0);
      return { r, score };
    }).filter(x => x.score > 0).sort((a,b) => b.score - a.score).slice(0, 12).map(x => x.r);
  }
  function aiAdaptRecipe(r, instruction) {
    const q = String(instruction || "").toLowerCase();
    const substitutions = [];
    if (q.includes("egg-free") || q.includes("without egg") || q.includes("no egg")) substitutions.push("Replace egg with mashed banana, flax egg or extra paneer/tofu depending on the recipe.");
    if (q.includes("vegan") || q.includes("dairy-free") || q.includes("without dairy")) substitutions.push("Replace milk/curd/paneer/cheese with suitable plant-based alternatives such as soy or oat products.");
    if (q.includes("paneer")) substitutions.push("Paneer can generally be replaced with tofu, mashed chickpeas or cooked sprouts.");
    if (q.includes("broccoli")) substitutions.push("Broccoli can be replaced with cauliflower, zucchini or finely chopped spinach.");
    if (q.includes("cheese")) substitutions.push("Cheese can be reduced or replaced with paneer, tofu or nutritional yeast depending on the recipe.");
    if (!substitutions.length) substitutions.push("Try reducing salt and spice for younger children, and adjust texture by chopping or mashing ingredients more finely.");
    return { title: `AI adaptation: ${recipeName(r)}`, notes: substitutions, caution: "AI suggestions are cooking ideas. Check ingredients and allergies before serving your child." };
  }
  function aiBuildPlan() {
    const requested = state.aiInput || "";
    const terms = aiTokens(requested);
    const maxTime = (requested.match(/(10|15|20|25|30)\s*(?:min|minutes?)/i) || [])[1];
    let pool = aiRecipeMatches(terms.join(","));
    if (maxTime) pool = pool.filter(r => r.timeCategory <= Number(maxTime));
    if (!pool.length) pool = RECIPES.slice(0, 20);
    return DAY_KEYS.slice(0, 5).map((day, i) => ({ day, recipe: pool[i % pool.length] }));
  }
  function renderAITab() {
    const matches = state.aiResults;
    return `<section class="ai-hub">
      <div class="ai-hero"><div class="ai-badge">🤖 AI-POWERED</div><h2 class="display">Tiny Tiffin AI</h2><p class="sub">Your smart tiffin companion for planning, ingredients, adaptations and shopping.</p></div>
      <div class="ai-grid">
        <article class="ai-card"><h3>🗓️ AI Tiffin Planner</h3><p>Tell Tiny Tiffin what your child needs and get a practical 5-day plan.</p><textarea id="ai-plan-input" class="search-input" rows="3" placeholder="Example: vegetarian, no nuts, under 20 minutes, high protein">${escapeAttr(state.aiInput)}</textarea><button class="btn btn-primary" id="ai-plan-btn">Create AI Plan</button><div id="ai-plan-results"></div></article>
        <article class="ai-card"><h3>📸 AI Ingredient Scanner</h3><p>Upload a photo of ingredients. Confirm the ingredients you recognise, then find matching recipes.</p><input id="ai-image-input" type="file" accept="image/*" class="search-input"><img id="ai-preview" class="ai-preview" alt="Ingredient preview" style="display:none"><input id="ai-scan-text" class="search-input" placeholder="Detected ingredients (edit if needed)"><button class="btn btn-secondary" id="ai-scan-btn">Find Recipes</button></article>
        <article class="ai-card"><h3>🔄 AI Recipe Adaptation</h3><p>Open any recipe and ask for egg-free, vegan, dairy-free or ingredient substitutions.</p><p class="ai-muted">Use the “AI Adapt” button inside a recipe.</p></article>
        <article class="ai-card"><h3>🛒 Smart Shopping List</h3><p>Build a combined shopping list from your weekly planner, with duplicate ingredients grouped together.</p><button class="btn btn-secondary" id="ai-shop-btn">Create Smart Shopping List</button></article>
      </div>
      ${matches.length ? `<h3 class="ai-section-title">Suggested recipes</h3><section class="recipe-grid">${matches.map(recipeCardHTML).join("")}</section>` : ""}
    </section>`;
  }
  function attachAIEvents() {
    const planInput = document.getElementById("ai-plan-input");
    if (planInput) planInput.addEventListener("input", e => state.aiInput = e.target.value);
    const planBtn = document.getElementById("ai-plan-btn");
    if (planBtn) planBtn.addEventListener("click", () => {
      state.aiInput = planInput.value;
      state.aiPlan = aiBuildPlan();
      const out = document.getElementById("ai-plan-results");
      out.innerHTML = `<div class="ai-plan-list">${state.aiPlan.map(x => `<div><strong>${x.day}</strong><span>${x.recipe.emoji} ${recipeName(x.recipe)}</span><button class="link-btn" data-ai-add="${x.day}|${x.recipe.id}">Add</button></div>`).join("")}</div>`;
      out.querySelectorAll("[data-ai-add]").forEach(btn => btn.addEventListener("click", () => { addToPlanner(btn.dataset.aiAdd.split("|")[0], "lunch", btn.dataset.aiAdd.split("|")[1]); toast("Added to weekly planner"); }));
    });
    const img = document.getElementById("ai-image-input");
    if (img) img.addEventListener("change", () => { const file = img.files && img.files[0]; if (!file) return; const preview = document.getElementById("ai-preview"); preview.src = URL.createObjectURL(file); preview.style.display = "block"; });
    const scanBtn = document.getElementById("ai-scan-btn");
    if (scanBtn) scanBtn.addEventListener("click", () => { state.aiResults = aiRecipeMatches(document.getElementById("ai-scan-text").value); render(); });
    const shopBtn = document.getElementById("ai-shop-btn");
    if (shopBtn) shopBtn.addEventListener("click", openGroceryModal);
    attachCardEvents();
  }

  /* ---------- Nutrition dashboard ---------- */
  function renderDashboardTab() {
    const plannedIds = Object.values(state.planner);
    const plannedRecipes = plannedIds.map(id => RECIPES.find(r => r.id === id)).filter(Boolean);
    if (!plannedRecipes.length) {
      return `<section style="padding-top:26px"><h2 class="display" style="color:var(--masala)">${t("dashboardTitle")}</h2>
        <div class="empty-state">${mascotSVG(56)}<p style="margin-top:10px">${t("dashboardEmpty")}</p></div></section>`;
    }
    const counts = {};
    NUTRITION_ORDER.forEach(n => { counts[n] = plannedRecipes.filter(r => r.nutritionTags.includes(n)).length; });
    const max = Math.max(...Object.values(counts), 1);
    const low = NUTRITION_ORDER.filter(n => counts[n] === 0);
    return `
      <section style="padding-top:26px;max-width:640px;margin:0 auto">
        <h2 class="display" style="color:var(--masala)">${t("dashboardTitle")}</h2>
        <p class="sub" style="text-align:left;margin:0 0 20px">${t("dashboardIntro")}</p>
        ${NUTRITION_ORDER.map(n => `
          <div class="dash-bar-row">
            <span>${NUTRITION_EMOJI[n]} ${t("nutritionGoals")[n]}</span>
            <div class="dash-bar-track"><div class="dash-bar-fill" style="width:${(counts[n] / max) * 100}%"></div></div>
            <span class="mono">${counts[n]}</span>
          </div>`).join("")}
        ${low.length ? `<div class="dash-suggestion">${low.map(n => t("nutritionGoals")[n]).join(", ")} — ${t("dashboardTryAdd")}</div>` : ""}
      </section>
    `;
  }

  /* ---------- Favorites tab ---------- */
  function renderFavoritesTab() {
    const favRecipes = RECIPES.filter(r => state.favorites.has(r.id));
    return `
      <section style="padding-top:26px">
        <h2 class="display" style="color:var(--masala)">${t("favoritesTitle")}</h2>
        <div class="recipe-grid">
          ${favRecipes.length ? favRecipes.map(recipeCardHTML).join("") : `<div class="empty-state">${mascotSVG(56)}<p style="margin-top:10px">${t("favoritesEmpty")}</p></div>`}
        </div>
      </section>
    `;
  }
  function attachFavoritesEvents() { attachCardEvents(); }

  /* ---------- Contact tab ---------- */
  let contactCategory = "feedback";
  function renderContactTab() {
    const cats = [["feedback", t("contactCategoryFeedback")], ["suggestion", t("contactCategorySuggestion")], ["bug", t("contactCategoryBug")], ["feature", t("contactCategoryFeature")]];
    return `
      <div class="simple-page">
        <h2>${t("contactTitle")}</h2>
        <p class="desc">${t("contactIntro")}</p>
        <div class="category-pick">${cats.map(([id, label]) => `<button class="chip ${contactCategory === id ? "active" : ""}" data-cat="${id}">${label}</button>`).join("")}</div>
        <div class="admin-form">
          <label>${t("contactSubjectLabel")}<input type="text" id="contact-subject" class="search-input"></label>
          <label>${t("contactMessageLabel")}<textarea id="contact-message" rows="5" class="search-input" style="width:100%"></textarea></label>
          <button class="btn btn-primary" id="contact-send">${t("contactButton")}</button>
          <p id="contact-status" role="status" style="font-size:.82rem;color:var(--ink-soft)">${t("contactFormNote")}</p>
        </div>
      </div>`;
  }
  function attachContactEvents() {
    root.querySelectorAll("[data-cat]").forEach(btn => btn.addEventListener("click", () => { contactCategory = btn.dataset.cat; render(); }));
    const sendBtn = document.getElementById("contact-send");
    if (!sendBtn) return;
    sendBtn.addEventListener("click", () => {
      const subjectEl = document.getElementById("contact-subject");
      const messageEl = document.getElementById("contact-message");
      const statusEl = document.getElementById("contact-status");
      const subject = (subjectEl.value || contactCategory).trim();
      const message = (messageEl.value || "").trim();
      if (!message) { statusEl.textContent = "Please enter a message before sending."; messageEl.focus(); return; }
      const recipient = "tinytiffin13@gmail.com";
      const categoryLabel = contactCategory.charAt(0).toUpperCase() + contactCategory.slice(1);
      const mailSubject = `Tiny Tiffin – ${categoryLabel}: ${subject}`;
      const mailBody = `Category: ${categoryLabel}\nSubject: ${subject}\n\nMessage:\n${message}\n\nSent from Tiny Tiffin`;
      statusEl.textContent = "Opening your email app…";
      const mailto = `mailto:${recipient}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
      window.location.href = mailto;
      setTimeout(() => { statusEl.textContent = `Your email app should now be open with ${recipient} already selected.`; }, 500);
    });
  }

  /* ---------- Developer tab ----------
     Version is read from CONFIG.version so the Developer tab remains
     synchronized with the canonical version in site-config.js.
  */
  function renderDeveloperTab() {
    const dev = CONFIG.developer || {};
    const purpose = dev.purpose || "Tiny Tiffin helps parents quickly discover healthy, colourful and child-friendly vegetarian tiffin ideas, plan the week and make everyday lunchbox decisions easier.";
    return `
      <div class="simple-page">
        <h2>${t("developerTitle")}</h2>
        <p><strong>${t("developerBuiltBy")}:</strong> ${dev.name || "Hardik Desai"}</p>
        <h4 style="margin:22px 0 8px">Purpose of Tiny Tiffin</h4>
        <p class="desc">${purpose}</p>
        <p class="desc developer-story">${(dev.about || t("developerNote")).replace(/\n{2,}/g, "\n").replace(/\n/g, "<br>")}</p>
        <h4 style="margin:22px 0 8px">Version information</h4>
        <div class="release-card"><strong>${CONFIG.version || dev.version || "v1.0"}</strong> · ${CONFIG.releaseDate || dev.releaseDate || ""}<br><span>${CONFIG.releaseNotes || dev.releaseNotes || ""}</span></div>
        ${dev.currentCapabilities && dev.currentCapabilities.length ? `<h4 style="margin:22px 0 8px">Current capabilities</h4><ul class="dev-future-list">${dev.currentCapabilities.map(f => `<li>${f}</li>`).join("")}</ul>` : ""}
        ${dev.comingSoon && dev.comingSoon.length ? `<h4 style="margin:22px 0 8px">Coming soon</h4><ul class="dev-future-list">${dev.comingSoon.map(f => `<li>${f}</li>`).join("")}</ul>` : ""}
      </div>`;
  }

  function escapeAttr(s) { return String(s).replace(/"/g, "&quot;"); }
  function escapeHTML(s) {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
    }[ch]));
  }

  /* ---------------- shared-link handling ---------------- */
  function openFromHash() {
    const m = location.hash.match(/recipe=([\w-]+)/);
    if (m && RECIPES.some(r => r.id === m[1])) openRecipeModal(m[1]);
  }

  /* ---------------- lightweight local visit telemetry ----------------
     This is intentionally privacy-friendly and device-local. A static app cannot
     provide trustworthy global India/international counts without a backend or
     analytics provider. */
  function recordLocalVisit() {
    try {
      const key = "tt_local_visit_stats";
      const stats = JSON.parse(localStorage.getItem(key) || '{"total":0,"india":0,"international":0}');
      const sessionKey = "tt_visit_session_recorded";
      if (sessionStorage.getItem(sessionKey)) return;
      const isIndia = /(^|\.)in$/i.test(Intl.DateTimeFormat().resolvedOptions().timeZone || "") ||
        /^hi(-|$)|^gu(-|$)/i.test(navigator.language || "");
      stats.total += 1;
      stats[isIndia ? "india" : "international"] += 1;
      localStorage.setItem(key, JSON.stringify(stats));
      sessionStorage.setItem(sessionKey, "1");
    } catch (e) {}
  }

  /* ---------------- init ---------------- */
  recordLocalVisit();
  render();
  openFromHash();

  window.TinyTiffinApp = { state, render };
})();
