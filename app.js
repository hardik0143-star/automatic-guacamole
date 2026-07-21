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
    return `${name} food recipe ${ingredients}`.trim();
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
      const r = RECIPES.find(x => x.id === id);
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

  /* ---------------- constants ---------------- */
  const RECIPES = window.TinyTiffinStore.getRecipes().filter(r => !r.hidden);
  const CONFIG = window.TINY_TIFFIN_CONFIG || { contactEmail: "", developer: {} };
  const NUTRITION_ORDER = ["protein", "iron", "calcium", "immunity", "fiber", "energy", "vitamins"];
  const NUTRITION_EMOJI = { protein: "🥜", iron: "🥬", calcium: "🥛", immunity: "🍊", fiber: "🌾", energy: "⚡", vitamins: "🍎" };
  const AGE_GROUPS = ["6-12m", "1-2y", "2-5y", "5-10y"];
  const ALL_ALLERGENS = ["nuts", "dairy", "gluten", "soy", "egg"];
  const DIET_TYPES = ["vegetarian", "vegan", "egg"];
  const CUISINES = ["indian", "continental"];
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
      age: "all", time: "any", meal: "all", nutrition: new Set(),
      allergyExclude: new Set(), diet: "all", cuisine: "all", smartSearch: ""
    },
    matchInput: ""
  };

  function t(key) { return window.tinyTiffinT(state.lang, key); }
  function recipeName(r) { return r.name[state.lang] || r.name.en; }
  function recipeDesc(r) { return r.desc[state.lang] || r.desc.en; }
  function applyTheme() { document.documentElement.setAttribute("data-theme", state.theme); }
  applyTheme();

  /* ---------------- install prompt (Add to Home Screen) ---------------- */
  let deferredInstallPrompt = null;
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
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

  /* ---------------- vitamins ---------------- */
  function getRecipeVitamins(r) {
    if (Array.isArray(r.vitamins) && r.vitamins.length) return r.vitamins;
    const text = [r.name?.en || "", ...(r.ingredients || [])].join(" ").toLowerCase();
    const vitamins = new Set();
    if (/carrot|sweet potato|pumpkin|spinach|mango|papaya|egg/.test(text)) vitamins.add("Vitamin A");
    if (/milk|curd|yogurt|paneer|cheese|egg|banana|oat/.test(text)) vitamins.add("Vitamin B");
    if (/lemon|orange|tomato|guava|amla|capsicum|broccoli/.test(text)) vitamins.add("Vitamin C");
    if (/spinach|broccoli|cabbage|leafy|egg/.test(text)) vitamins.add("Vitamin K");
    if (/almond|peanut|sunflower|avocado|spinach/.test(text)) vitamins.add("Vitamin E");
    if (/milk|curd|yogurt|paneer|cheese|egg/.test(text)) vitamins.add("Vitamin D");
    return Array.from(vitamins);
  }

  /* ---------------- filtering ---------------- */
  function isStaple(ingText) {
    const lower = ingText.toLowerCase();
    return STAPLES.some(s => lower.includes(s));
  }
  function matchesFilters(r) {
    const f = state.filters;
    if (f.age !== "all" && !r.ageGroups.includes(f.age)) return false;
    if (f.time !== "any" && r.timeCategory > Number(f.time)) return false;
    if (f.meal !== "all" && !r.mealType.includes(f.meal)) return false;
    if (f.nutrition.size > 0 && !Array.from(f.nutrition).every(n => n === "vitamins" ? getRecipeVitamins(r).length > 0 : r.nutritionTags.includes(n))) return false;
    if (f.diet !== "all" && !r.dietType.includes(f.diet)) return false;
    if (f.cuisine !== "all" && r.cuisine !== f.cuisine) return false;
    if (f.allergyExclude.size > 0) {
      for (const a of f.allergyExclude) if (r.allergens.includes(a)) return false;
    }
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
  function filteredRecipes() { return RECIPES.filter(matchesFilters); }

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
  const root = document.getElementById("app");

  function render() {
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
    hydrateRecipeImages(root);
    root.querySelectorAll("[data-footer-tab]").forEach(a => {
      a.addEventListener("click", (e) => { e.preventDefault(); state.tab = a.dataset.footerTab; render(); window.scrollTo(0, 0); });
    });
  }

  function renderHeader() {
    const langOptions = window.TINY_TIFFIN_LANGUAGES.map(l =>
      `<option value="${l.code}" ${l.code === state.lang ? "selected" : ""}>${l.label}</option>`).join("");
    const tabs = [
      ["find", t("navFind")], ["match", t("navMatch")], ["planner", t("navPlanner")],
      ["dashboard", t("navDashboard")], ["favorites", `${t("navFavorites")} (${state.favorites.size})`]
    ];
    return `
      <header class="app-header">
        <div class="wrap header-row">
          <div class="brand-wrap"><div class="mascot brand">${mascotSVG(38)} Tiny Tiffin</div><div class="app-tagline">Making Every Lunchbox a Little More Special</div></div>
          <div class="header-controls">
            <button class="theme-toggle" id="install-btn" aria-label="Install app" style="display:none">⬇️ Install</button>
            <button class="theme-toggle" id="theme-toggle" aria-label="${t('darkMode')}">${state.theme === "dark" ? "☀️" : "🌙"}</button>
            <select class="lang-select" id="lang-select" aria-label="Language">${langOptions}</select>
            <a class="admin-link" href="admin.html">${t("adminLink")}</a>
          </div>
        </div>
        <div class="wrap tabs">
          ${tabs.map(([id, label]) => `<button class="tab-btn ${state.tab === id ? "active" : ""}" data-tab="${id}">${label}</button>`).join("")}
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
      if (deferredInstallPrompt && !isStandalone) installBtn.style.display = "inline-flex";
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
    root.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => { state.tab = btn.dataset.tab; render(); window.scrollTo(0, 0); });
    });
  }

  /* ---------- image / placeholder ---------- */
  function recipeImageHTML(r) {
    const manual = r.images && r.images.length > 0;
    const cached = !manual ? imageCache[r.id] : null;
    const image = manual ? { url: r.images[0], source: "admin" } : cached;
    return `<div class="recipe-image-wrap" data-auto-image="${escapeAttr(r.id)}">${imageMarkup(r, image)}</div>`;
  }

  /* ---------- Find tab ---------- */
  function renderFindTab() {
    const results = filteredRecipes();
    return `
      <section class="hero">
        <h1 class="display">${t("heroTitle")}</h1>
        <p class="sub">${t("heroSub")}</p>
        <button class="btn btn-secondary surprise-btn" id="surprise-recipe">✨ Surprise Me with a Recipe</button>
        <div class="mood-picker" aria-label="Quick tiffin ideas">
          <span class="mood-label">Choose a tiffin mood:</span>
          <button class="mood-chip" data-mood="quick">⚡ Quick & Easy</button>
          <button class="mood-chip" data-mood="protein">💪 Protein Power</button>
          <button class="mood-chip" data-mood="colourful">🌈 Colourful & Nutritious</button>
        </div>
        <div class="tiffin-handle" aria-hidden="true"></div>
        <div class="tiffin-stack" role="group" aria-label="${t('heroTitle')}">
          ${NUTRITION_ORDER.map(n => `
            <button class="tiffin-tier ${state.filters.nutrition.has(n) ? "active" : ""}" data-nutri="${n}">
              <span class="tier-emoji">${NUTRITION_EMOJI[n]}</span> ${t("nutritionGoals")[n] || capitalize(n)}
            </button>`).join("")}
        </div>
      </section>

      <div class="smart-search-bar">
        <input type="text" id="smart-search" placeholder="${t('searchPlaceholder')}" value="${escapeAttr(state.filters.smartSearch)}">
      </div>

      <section class="filters">
        <div class="filter-group">
          <label>${t("filterAge")}</label>
          <div class="chip-row">
            <button class="chip ${state.filters.age === "all" ? "active" : ""}" data-age="all">${t("all")}</button>
            ${AGE_GROUPS.map(a => `<button class="chip ${state.filters.age === a ? "active" : ""}" data-age="${a}">${a}</button>`).join("")}
          </div>
        </div>
        <div class="filter-group">
          <label>${t("filterTime")}</label>
          <div class="chip-row">
            <button class="chip ${state.filters.time === "any" ? "active" : ""}" data-time="any">${t("anyTime")}</button>
            ${TIME_BUCKETS.map(m => `<button class="chip ${state.filters.time === String(m) ? "active" : ""}" data-time="${m}">${t("min" + m)}</button>`).join("")}
          </div>
        </div>
        <div class="filter-group">
          <label>${t("filterMeal")}</label>
          <div class="chip-row">
            <button class="chip ${state.filters.meal === "all" ? "active" : ""}" data-meal="all">${t("all")}</button>
            ${MEAL_SLOTS.map(m => `<button class="chip ${state.filters.meal === m ? "active" : ""}" data-meal="${m}">${t(m)}</button>`).join("")}
          </div>
        </div>
        <div class="filter-group">
          <label>${t("filterDiet")}</label>
          <div class="chip-row">
            <button class="chip ${state.filters.diet === "all" ? "active" : ""}" data-diet="all">${t("all")}</button>
            ${DIET_TYPES.map(d => `<button class="chip ${state.filters.diet === d ? "active" : ""}" data-diet="${d}">${t("diet" + capitalize(d))}</button>`).join("")}
          </div>
        </div>
        <div class="filter-group">
          <label>${t("filterCuisine")}</label>
          <div class="chip-row">
            <button class="chip ${state.filters.cuisine === "all" ? "active" : ""}" data-cuisine="all">${t("all")}</button>
            ${CUISINES.map(c => `<button class="chip ${state.filters.cuisine === c ? "active" : ""}" data-cuisine="${c}">${t("cuisine" + capitalize(c))}</button>`).join("")}
          </div>
        </div>
        <div class="filter-group">
          <label>${t("filterAllergy")}</label>
          <div class="chip-row">
            ${ALL_ALLERGENS.map(a => `<button class="chip allergy ${state.filters.allergyExclude.has(a) ? "active" : ""}" data-allergy="${a}">${a}</button>`).join("")}
          </div>
        </div>
        <div class="filters-foot">
          <span>${results.length} ${t("resultsCount")}</span>
          <button class="link-btn" id="clear-filters">${t("clearFilters")}</button>
        </div>
      </section>

      <section class="recipe-grid" id="recipe-grid">
        ${results.length ? results.map(r => recipeCardHTML(r)).join("") : emptyStateHTML()}
      </section>
    `;
  }
  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function emptyStateHTML() {
    return `<div class="empty-state">${mascotSVG(56)}<p style="margin-top:10px">${t("mascotGreeting")}</p></div>`;
  }

  function recipeCardHTML(r) {
    const isFav = state.favorites.has(r.id);
    const rt = displayedRatings(r);
    return `
      <article class="recipe-card pop-in" data-id="${r.id}">
        ${recipeImageHTML(r)}
        <div class="card-top">
          <div class="card-emoji">${r.emoji}</div>
          <button class="fav-btn ${isFav ? "active" : ""}" data-fav="${r.id}" aria-label="${t('addFavorite')}">${isFav ? "♥" : "♡"}</button>
        </div>
        <h3>${recipeName(r)}</h3>
        <p class="desc">${recipeDesc(r)}</p>
        <div class="rating-row">${starsHTML(rt.overall)} <span>${rt.overall.toFixed(1)}</span></div>
        <div class="meta-row">
          <span class="tag time">⏱ ${r.timeCategory} min</span>
          <span class="tag cuisine-${r.cuisine}">${t("cuisine" + capitalize(r.cuisine))}</span>
          ${r.dietType.map(d => `<span class="tag diet-${d}">${t("diet" + capitalize(d))}</span>`).join("")}
          ${r.allergens.map(a => `<span class="tag allergen">⚠ ${a}</span>`).join("")}
        </div>
        <div class="card-actions">
          <button class="btn btn-primary btn-block" data-view="${r.id}">${t("viewRecipe")}</button>
        </div>
      </article>
    `;
  }

  function attachFindEvents() {
    const surpriseBtn = document.getElementById("surprise-recipe");
    if (surpriseBtn) surpriseBtn.addEventListener("click", () => {
      const pool = filteredRecipes();
      const choice = (pool.length ? pool : RECIPES)[Math.floor(Math.random() * (pool.length ? pool.length : RECIPES.length))];
      openRecipeModal(choice.id);
    });
    root.querySelectorAll(".mood-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const mood = btn.dataset.mood;
        state.filters.time = "any";
        state.filters.nutrition.clear();
        if (mood === "quick") state.filters.time = "15";
        if (mood === "protein") state.filters.nutrition.add("protein");
        if (mood === "colourful") state.filters.nutrition.add("vitamins");
        render();
      });
    });
    root.querySelectorAll(".tiffin-tier").forEach(btn => {
      btn.addEventListener("click", () => { const n = btn.dataset.nutri;
        if (state.filters.nutrition.has(n)) state.filters.nutrition.delete(n); else state.filters.nutrition.add(n);
        render(); });
    });
    root.querySelectorAll("[data-age]").forEach(btn => btn.addEventListener("click", () => { state.filters.age = btn.dataset.age; render(); }));
    root.querySelectorAll("[data-time]").forEach(btn => btn.addEventListener("click", () => { state.filters.time = btn.dataset.time; render(); }));
    root.querySelectorAll("[data-meal]").forEach(btn => btn.addEventListener("click", () => { state.filters.meal = btn.dataset.meal; render(); }));
    root.querySelectorAll("[data-diet]").forEach(btn => btn.addEventListener("click", () => { state.filters.diet = btn.dataset.diet; render(); }));
    root.querySelectorAll("[data-cuisine]").forEach(btn => btn.addEventListener("click", () => { state.filters.cuisine = btn.dataset.cuisine; render(); }));
    root.querySelectorAll("[data-allergy]").forEach(btn => {
      btn.addEventListener("click", () => {
        const a = btn.dataset.allergy;
        if (state.filters.allergyExclude.has(a)) state.filters.allergyExclude.delete(a); else state.filters.allergyExclude.add(a);
        render();
      });
    });
    const searchInput = document.getElementById("smart-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        state.filters.smartSearch = e.target.value;
        const grid = document.getElementById("recipe-grid");
        const results = filteredRecipes();
        grid.innerHTML = results.length ? results.map(recipeCardHTML).join("") : emptyStateHTML();
        attachCardEvents();
        const countEl = root.querySelector(".filters-foot span");
        if (countEl) countEl.textContent = `${results.length} ${t("resultsCount")}`;
      });
    }
    const clearBtn = document.getElementById("clear-filters");
    if (clearBtn) clearBtn.addEventListener("click", () => {
      state.filters = { age: "all", time: "any", meal: "all", nutrition: new Set(), allergyExclude: new Set(), diet: "all", cuisine: "all", smartSearch: "" };
      render();
    });
    attachCardEvents();
  }

  function attachCardEvents() {
    root.querySelectorAll("[data-fav]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.fav;
        if (state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
        saveFavorites(); render();
      });
    });
    root.querySelectorAll("[data-view]").forEach(btn => btn.addEventListener("click", () => openRecipeModal(btn.dataset.view)));
  }

  /* ---------- Recipe modal (with gallery + ratings) ---------- */
  function playRecipeBurst() {
    const layer = document.createElement("div");
    layer.className = "star-burst";
    const stars = ["✦", "★", "✧", "✦", "★", "✧", "★", "✦"];
    stars.forEach((s, i) => {
      const el = document.createElement("span");
      el.className = "burst-star";
      el.textContent = s;
      el.style.left = "50%"; el.style.top = "42%";
      const angle = (Math.PI * 2 * i) / stars.length;
      const distance = 100 + Math.random() * 100;
      el.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
      el.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
      layer.appendChild(el);
    });
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 1100);
  }

  function showSparkleBurst() {
    const burst = document.createElement("div");
    burst.className = "sparkle-burst";
    const symbols = ["✦", "✧", "★", "✦", "✨", "★", "✧", "✦"];
    symbols.forEach((symbol, i) => {
      const star = document.createElement("span");
      star.className = "sparkle-star";
      star.textContent = symbol;
      star.style.left = "50%";
      star.style.top = "42%";
      const angle = (Math.PI * 2 * i) / symbols.length;
      const distance = 90 + Math.random() * 130;
      star.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
      star.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
      burst.appendChild(star);
    });
    document.body.appendChild(burst);
    setTimeout(() => burst.remove(), 1000);
  }

  function openRecipeModal(id) {
    const r = RECIPES.find(x => x.id === id);
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
        <div class="vitamin-row">🍎 <strong>Key Vitamins:</strong> ${getRecipeVitamins(r).join(", ") || "Nutritional profile varies by ingredients"}</div>
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
        </div>
        <div class="rate-form" id="rate-form">
          <strong>${state.userRatings[r.id] ? "Update your rating" : t("rateThis")}</strong>
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
      const existing = RECIPES.find(r => r.id === existingId);
      const incoming = RECIPES.find(r => r.id === recipeId);
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
                const r = recipeId ? RECIPES.find(x => x.id === recipeId) : null;
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
    const options = state.favorites.size > 0 ? Array.from(state.favorites) : RECIPES.map(r => r.id).slice(0, 8);
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal" style="max-width:420px">
        <button class="modal-close" id="slot-close">✕</button>
        <h2>${t("days")[DAY_KEYS.indexOf(day)]} · ${t(slot)}</h2>
        <p class="desc">${t("plannerAddFrom")}</p>
        <div class="picker-list">
          ${options.map(id => {
            const r = RECIPES.find(x => x.id === id);
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
      const r = RECIPES.find(x => x.id === id);
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
          <p style="font-size:.78rem;color:var(--ink-soft)">${t("contactFormNote")}</p>
        </div>
      </div>
    `;
  }
  function attachContactEvents() {
    root.querySelectorAll("[data-cat]").forEach(btn => btn.addEventListener("click", () => { contactCategory = btn.dataset.cat; render(); }));
    const sendBtn = document.getElementById("contact-send");
    if (sendBtn) sendBtn.addEventListener("click", () => {
      const subject = document.getElementById("contact-subject").value || contactCategory;
      const message = document.getElementById("contact-message").value || "";
      const mailto = `mailto:${CONFIG.contactEmail}?subject=${encodeURIComponent(`[Tiny Tiffin ${contactCategory}] ${subject}`)}&body=${encodeURIComponent(message)}`;
      window.location.href = mailto;
    });
  }

  /* ---------- Developer tab ---------- */
  function renderDeveloperTab() {
    const dev = CONFIG.developer || {};
    return `
      <div class="simple-page">
        <h2>${t("developerTitle")}</h2>
        <p><strong>${t("developerBuiltBy")}:</strong> ${dev.name || ""}</p>
        <p><a href="mailto:${dev.email || ""}" class="btn btn-secondary" style="display:inline-flex;text-decoration:none">✉️ Email the developer</a></p>
        <p class="desc developer-story">${(dev.about || t("developerNote")).replace(/\\n/g, "<br><br>")}</p>
        <div class="release-card"><strong>${dev.version || "v3.0"}</strong> · ${dev.releaseDate || ""}<br><span>${dev.releaseNotes || ""}</span></div>
        ${dev.currentCapabilities && dev.currentCapabilities.length ? `<h4 style="margin:22px 0 8px">Current capabilities</h4><ul class="dev-future-list">${dev.currentCapabilities.map(f => `<li>${f}</li>`).join("")}</ul>` : ""}
        ${dev.comingSoon && dev.comingSoon.length ? `<h4 style="margin:22px 0 8px">Coming soon</h4><ul class="dev-future-list">${dev.comingSoon.map(f => `<li>${f}</li>`).join("")}</ul>` : ""}
      </div>
    `;
  }

  function escapeAttr(s) { return String(s).replace(/"/g, "&quot;"); }

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
