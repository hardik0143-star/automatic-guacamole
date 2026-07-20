/* Tiny Tiffin — Admin Panel (v2)
   Client-side admin for a static, no-backend build. Edits a draft
   copy of the recipe list in this browser; download a finished
   data/recipes.js to publish. The password gate below is a
   convenience, not real security — see README.md. */

(function () {
  "use strict";

  const ADMIN_PASSWORD = "tiffin2026"; // change this before sharing the admin link

  const AGE_GROUPS = ["6-12m", "1-2y", "2-5y", "5-10y"];
  const TIME_BUCKETS = [10, 15, 20, 25, 30];
  const MEAL_SLOTS = ["breakfast", "lunch", "snack"];
  const NUTRITION_ORDER = ["protein", "iron", "calcium", "immunity", "fiber", "energy", "vitamins"];
  const ALLERGENS = ["nuts", "dairy", "gluten", "soy", "egg"];
  const DIET_TYPES = ["vegetarian", "vegan", "egg"];
  const CUISINES = ["indian", "continental"];

  const EXCEL_COLUMNS = [
    "id", "emoji", "name_en", "name_hi", "desc_en", "ageGroups", "timeCategory", "dietType",
    "cuisine", "mealType", "difficulty", "nutritionTags", "allergens", "ingredients", "instructions",
    "calories", "protein_g", "iron_mg", "calcium_mg", "fiber_g", "vitaminC_mg", "vitamins",
    "packingTip_en", "kidTip_en", "image1", "image2"
  ];

  let recipes = window.TinyTiffinStore.getRecipes().map((r) => JSON.parse(JSON.stringify(r)));
  let authed = sessionGet("tt_admin_authed", false);
  let currentView = "dashboard"; // dashboard | settings

  function sessionGet(key, fallback) { try { const v = sessionStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
  function sessionSet(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }

  const root = document.getElementById("admin-app");

  function render() {
    root.innerHTML = authed ? (currentView === "settings" ? renderSettingsView() : renderDashboard()) : renderLogin();
    attachEvents();
  }

  /* ---------------- login ---------------- */
  function renderLogin() {
    return `
      <div class="admin-login">
        <div class="admin-login-card">
          <div class="brand">${brandMark()} Tiny Tiffin Admin</div>
          <p class="desc">Enter the admin password to manage recipes.</p>
          <input type="password" id="pw-input" placeholder="Admin password" class="search-input" autofocus>
          <button class="btn btn-primary btn-block" id="pw-submit" style="margin-top:12px">Sign in</button>
          <p class="hint">Default password is set in admin.js — change <code>ADMIN_PASSWORD</code> before sharing this link. This gate keeps out casual visitors; it is not secure against a determined one.</p>
          <a class="link-btn" href="index.html">← Back to the app</a>
        </div>
      </div>`;
  }
  function brandMark() {
    return `<svg width="30" height="30" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="100" height="100" rx="22" fill="#2B4E32"/><rect x="12" y="20" width="76" height="32" rx="12" fill="#8C97A5"/>
      <rect x="16" y="40" width="68" height="48" rx="14" fill="#E5A431"/></svg>`;
  }

  /* ---------------- dashboard ---------------- */
  function renderDashboard() {
    const stats = computeStats();
    return `
      <header class="admin-header">
        <div class="brand">${brandMark()} Tiny Tiffin Admin</div>
        <div class="header-controls">
          <button class="admin-link" id="nav-settings">Site Settings</button>
          <a class="admin-link" href="index.html">View app</a>
          <button class="admin-link" id="logout-btn">Sign out</button>
        </div>
      </header>
      <main class="wrap admin-main">
        ${window.TinyTiffinStore.hasDraft() ? `<div class="draft-banner">You're viewing unsaved draft changes stored in this browser. Download the updated file below when you're ready to publish them for everyone.</div>` : ""}

        <section class="release-note-panel">
          <h3>Release Notes</h3>
          <p><strong>${window.TINY_TIFFIN_CONFIG?.version || "v3.0"}</strong> · ${window.TINY_TIFFIN_CONFIG?.releaseDate || ""}</p>
          <p>${window.TINY_TIFFIN_CONFIG?.releaseNotes || "Current application release information."}</p>
        </section>

        <section class="stat-grid">
          <div class="stat-card"><div class="stat-num mono">${stats.total}</div><div class="stat-lbl">Total recipes</div></div>
          <div class="stat-card"><div class="stat-num mono">${stats.visible}</div><div class="stat-lbl">Visible (not hidden)</div></div>
          <div class="stat-card"><div class="stat-num mono">${stats.avgTime}</div><div class="stat-lbl">Avg. cook time (min)</div></div>
          <div class="stat-card"><div class="stat-num mono">${stats.withImages}</div><div class="stat-lbl">Have at least 1 image</div></div>
        </section>

        <section class="admin-toolbar">
          <button class="btn btn-primary" id="add-recipe-btn">+ Add recipe</button>
          <div class="toolbar-right">
            <button class="btn btn-secondary" id="export-btn">Download recipes.js</button>
            <button class="btn btn-secondary" id="export-json-btn">Export JSON backup</button>
            <button class="btn btn-secondary" id="sample-excel-btn">Download sample Excel</button>
            <label class="btn btn-secondary" style="margin:0">Bulk upload Excel<input type="file" id="excel-input" accept=".xlsx,.xls" style="display:none"></label>
            <label class="btn btn-secondary" style="margin:0">Import JSON<input type="file" id="import-input" accept="application/json" style="display:none"></label>
            ${window.TinyTiffinStore.hasDraft() ? `<button class="btn btn-secondary" id="discard-draft-btn">Discard draft</button>` : ""}
          </div>
        </section>
        <div id="import-report"></div>

        <section class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Recipe</th><th>Ages</th><th>Time</th><th>Diet</th><th>Cuisine</th><th>Rating</th><th></th></tr></thead>
            <tbody>
              ${recipes.map((r) => `
                <tr style="${r.hidden ? "opacity:.5" : ""}">
                  <td><span style="margin-right:6px">${r.emoji}</span>${r.name.en}${r.hidden ? " <em>(hidden)</em>" : ""}</td>
                  <td class="mono">${r.ageGroups.join(", ")}</td>
                  <td class="mono">${r.timeCategory} min</td>
                  <td>${(r.dietType || []).map((d) => `<span class="tag diet-${d}">${d}</span>`).join(" ")}</td>
                  <td><span class="tag cuisine-${r.cuisine}">${r.cuisine}</span></td>
                  <td class="mono">${r.ratings ? r.ratings.overall.toFixed(1) : "—"}</td>
                  <td class="row-actions">
                    <button data-preview="${r.id}" title="Preview">👁️</button>
                    <button data-edit="${r.id}" title="Edit">✏️</button>
                    <button data-duplicate="${r.id}" title="Duplicate">📄</button>
                    <button data-toggle-hide="${r.id}" title="${r.hidden ? "Unhide" : "Hide"}">${r.hidden ? "🙈" : "👁"}</button>
                    <button data-delete="${r.id}" title="Delete">🗑️</button>
                  </td>
                </tr>`).join("")}
            </tbody>
          </table>
        </section>
      </main>`;
  }

  function computeStats() {
    const total = recipes.length;
    const visible = recipes.filter((r) => !r.hidden).length;
    const avgTime = total ? Math.round(recipes.reduce((s, r) => s + r.timeCategory, 0) / total) : 0;
    const withImages = recipes.filter((r) => r.images && r.images.length > 0).length;
    return { total, visible, avgTime, withImages };
  }

  /* ---------------- site settings view ---------------- */
  function renderSettingsView() {
    const cfg = window.TINY_TIFFIN_CONFIG || { contactEmail: "", developer: {} };
    return `
      <header class="admin-header">
        <div class="brand">${brandMark()} Site Settings</div>
        <div class="header-controls">
          <button class="admin-link" id="back-to-dashboard">← Back to recipes</button>
        </div>
      </header>
      <main class="wrap admin-main">
        <div class="admin-form" style="max-width:520px">
          <label>Contact email<input type="text" id="cfg-contact-email" value="${escAttr(cfg.contactEmail)}"></label>
          <label>Developer name<input type="text" id="cfg-dev-name" value="${escAttr(cfg.developer.name || "")}"></label>
          <label>Developer email<input type="text" id="cfg-dev-email" value="${escAttr(cfg.developer.email || "")}"></label>
          <label>About the developer<textarea id="cfg-dev-about" rows="3">${cfg.developer.about || ""}</textarea></label>
          <button class="btn btn-primary" id="save-settings">Save settings</button>
          <p class="hint">These changes update this browser's draft only. To publish for everyone, download <code>data/site-config.js</code> content shown below and replace the file in your project (or copy the JS from your browser console: <code>window.TINY_TIFFIN_CONFIG</code>).</p>
        </div>
      </main>`;
  }

  /* ---------------- form ---------------- */
  function emptyRecipe() {
    return {
      id: "", emoji: "🍽️", images: [],
      name: { en: "", hi: "" }, desc: { en: "", hi: "" },
      ageGroups: [], timeCategory: 15, dietType: [], cuisine: "indian",
      mealType: [], difficulty: "Easy", nutritionTags: [], allergens: [],
      ingredients: [""], instructions: [""],
      nutrition: { calories: 0, protein_g: 0, iron_mg: 0, calcium_mg: 0, fiber_g: 0, vitaminC_mg: 0 },
      packingTip: { en: "", hi: "" }, kidTip: { en: "", hi: "" },
      ratings: { overall: 4, nutrition: 4, kidFriendly: 4, lunchboxFriendly: 4, pickyEaterFriendly: 4, timeSaver: 4, count: 1 },
      hidden: false
    };
  }

  function openForm(recipe, previewOnly) {
    const isNew = !recipe;
    const r = recipe ? JSON.parse(JSON.stringify(recipe)) : emptyRecipe();
    if (previewOnly) { openPreview(r); return; }
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop"; backdrop.id = "form-modal";
    backdrop.innerHTML = `
      <div class="modal" style="max-width:680px">
        <button class="modal-close" id="form-close">✕</button>
        <h2>${isNew ? "Add recipe" : "Edit recipe"}</h2>
        <form id="recipe-form" class="admin-form">
          <div class="form-row">
            <label>Emoji<input type="text" name="emoji" value="${r.emoji}" maxlength="4"></label>
            <label>Recipe ID (unique, no spaces)<input type="text" name="id" value="${r.id}" ${isNew ? "" : "readonly"} required></label>
          </div>
          <div class="form-row">
            <label>Name (English)<input type="text" name="name_en" value="${escAttr(r.name.en)}" required></label>
            <label>Name (Hindi)<input type="text" name="name_hi" value="${escAttr(r.name.hi || "")}"></label>
          </div>
          <div class="form-row">
            <label>Description (English)<input type="text" name="desc_en" value="${escAttr(r.desc.en)}"></label>
          </div>
          <div class="form-row">
            <label>Image URL 1 (optional)<input type="text" name="image1" value="${escAttr((r.images && r.images[0]) || "")}" placeholder="https://…"></label>
            <label>Image URL 2 (optional)<input type="text" name="image2" value="${escAttr((r.images && r.images[1]) || "")}" placeholder="https://…"></label>
          </div>
          <p class="hint" style="margin:-6px 0 6px">No image? A themed illustration is shown automatically. Paste any hosted image URL (e.g. from your own site, Imgur, or Cloudinary) — this app doesn't store image files itself.</p>
          <div class="form-row">
            <label>Time category
              <select name="timeCategory">${TIME_BUCKETS.map((m) => `<option value="${m}" ${r.timeCategory === m ? "selected" : ""}>${m} min</option>`).join("")}</select>
            </label>
            <label>Cuisine
              <select name="cuisine">${CUISINES.map((c) => `<option value="${c}" ${r.cuisine === c ? "selected" : ""}>${c}</option>`).join("")}</select>
            </label>
            <label>Difficulty
              <select name="difficulty">${["Easy", "Medium", "Hard"].map((d) => `<option value="${d}" ${r.difficulty === d ? "selected" : ""}>${d}</option>`).join("")}</select>
            </label>
          </div>
          <div class="form-group"><label>Age groups</label>
            <div class="chip-row">${AGE_GROUPS.map((a) => `<label class="check-chip"><input type="checkbox" name="ageGroups" value="${a}" ${r.ageGroups.includes(a) ? "checked" : ""}> ${a}</label>`).join("")}</div>
          </div>
          <div class="form-group"><label>Diet type</label>
            <div class="chip-row">${DIET_TYPES.map((d) => `<label class="check-chip"><input type="checkbox" name="dietType" value="${d}" ${r.dietType.includes(d) ? "checked" : ""}> ${d}</label>`).join("")}</div>
          </div>
          <div class="form-group"><label>Meal type</label>
            <div class="chip-row">${MEAL_SLOTS.map((m) => `<label class="check-chip"><input type="checkbox" name="mealType" value="${m}" ${r.mealType.includes(m) ? "checked" : ""}> ${m}</label>`).join("")}</div>
          </div>
          <div class="form-group"><label>Nutrition tags</label>
            <div class="chip-row">${NUTRITION_ORDER.map((n) => `<label class="check-chip"><input type="checkbox" name="nutritionTags" value="${n}" ${r.nutritionTags.includes(n) ? "checked" : ""}> ${n}</label>`).join("")}</div>
          </div>
          <div class="form-group"><label>Allergens</label>
            <div class="chip-row">${ALLERGENS.map((a) => `<label class="check-chip"><input type="checkbox" name="allergens" value="${a}" ${r.allergens.includes(a) ? "checked" : ""}> ${a}</label>`).join("")}</div>
          </div>
          <div class="form-group"><label>Ingredients (one per line)</label><textarea name="ingredients" rows="4">${r.ingredients.join("\n")}</textarea></div>
          <div class="form-group"><label>Steps (one per line)</label><textarea name="instructions" rows="4">${r.instructions.join("\n")}</textarea></div>
          <div class="form-row">
            <label>Calories<input type="number" name="calories" value="${r.nutrition.calories}"></label>
            <label>Protein (g)<input type="number" name="protein_g" value="${r.nutrition.protein_g}"></label>
            <label>Iron (mg)<input type="number" step="0.1" name="iron_mg" value="${r.nutrition.iron_mg}"></label>
            <label>Calcium (mg)<input type="number" name="calcium_mg" value="${r.nutrition.calcium_mg}"></label>
            <label>Fiber (g)<input type="number" step="0.1" name="fiber_g" value="${r.nutrition.fiber_g || 0}"></label>
            <label>Vitamin C (mg)<input type="number" name="vitaminC_mg" value="${r.nutrition.vitaminC_mg || 0}"></label>
          </div>
          <div class="form-row">
            <label>Packing tip (English)<input type="text" name="packingTip_en" value="${escAttr(r.packingTip.en)}"></label>
            <label>Parent tip (English)<input type="text" name="kidTip_en" value="${escAttr(r.kidTip.en)}"></label>
          </div>
          <div class="form-row">
            <label>Overall rating seed (1-5)<input type="number" step="0.1" min="1" max="5" name="ratingOverall" value="${r.ratings ? r.ratings.overall : 4}"></label>
            <label>Kid-friendly rating<input type="number" step="0.1" min="1" max="5" name="ratingKidFriendly" value="${r.ratings ? r.ratings.kidFriendly : 4}"></label>
            <label>Lunchbox-friendly rating<input type="number" step="0.1" min="1" max="5" name="ratingLunchboxFriendly" value="${r.ratings ? r.ratings.lunchboxFriendly : 4}"></label>
          </div>
          <label class="check-chip" style="align-self:flex-start"><input type="checkbox" name="hidden" ${r.hidden ? "checked" : ""}> Hidden from the app</label>
          <div class="card-actions"><button type="submit" class="btn btn-primary">Save recipe</button></div>
        </form>
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
    document.getElementById("form-close").addEventListener("click", () => backdrop.remove());
    document.getElementById("recipe-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const id = (fd.get("id") || "").toString().trim().toLowerCase().replace(/\s+/g, "-");
      if (!id) { alert("Please give the recipe a unique ID."); return; }
      if (isNew && recipes.some((x) => x.id === id)) { alert("That ID is already used by another recipe."); return; }
      const images = [fd.get("image1"), fd.get("image2")].map((s) => (s || "").trim()).filter(Boolean);
      const updated = {
        id, emoji: fd.get("emoji") || "🍽️", images,
        name: { en: fd.get("name_en"), hi: fd.get("name_hi") || fd.get("name_en") },
        desc: { en: fd.get("desc_en"), hi: fd.get("desc_en") },
        ageGroups: fd.getAll("ageGroups"), timeCategory: Number(fd.get("timeCategory")) || 15,
        dietType: fd.getAll("dietType"), cuisine: fd.get("cuisine"),
        mealType: fd.getAll("mealType"), difficulty: fd.get("difficulty"),
        nutritionTags: fd.getAll("nutritionTags"), allergens: fd.getAll("allergens"),
        ingredients: fd.get("ingredients").split("\n").map((s) => s.trim()).filter(Boolean),
        instructions: fd.get("instructions").split("\n").map((s) => s.trim()).filter(Boolean),
        nutrition: {
          calories: Number(fd.get("calories")) || 0, protein_g: Number(fd.get("protein_g")) || 0,
          iron_mg: Number(fd.get("iron_mg")) || 0, calcium_mg: Number(fd.get("calcium_mg")) || 0,
          fiber_g: Number(fd.get("fiber_g")) || 0, vitaminC_mg: Number(fd.get("vitaminC_mg")) || 0
        },
        packingTip: { en: fd.get("packingTip_en"), hi: r.packingTip.hi || "" },
        kidTip: { en: fd.get("kidTip_en"), hi: r.kidTip.hi || "" },
        ratings: {
          overall: Number(fd.get("ratingOverall")) || 4, nutrition: (r.ratings && r.ratings.nutrition) || 4,
          kidFriendly: Number(fd.get("ratingKidFriendly")) || 4, lunchboxFriendly: Number(fd.get("ratingLunchboxFriendly")) || 4,
          pickyEaterFriendly: (r.ratings && r.ratings.pickyEaterFriendly) || 4, timeSaver: (r.ratings && r.ratings.timeSaver) || 4,
          count: (r.ratings && r.ratings.count) || 1
        },
        hidden: fd.get("hidden") === "on"
      };
      if (isNew) recipes.push(updated); else recipes = recipes.map((x) => (x.id === id ? updated : x));
      window.TinyTiffinStore.saveRecipes(recipes);
      backdrop.remove(); render();
    });
  }

  function openPreview(r) {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal">
        <button class="modal-close" id="preview-close">✕</button>
        <div style="font-size:2.4rem">${r.emoji}</div>
        <h2>${r.name.en}</h2>
        <p class="desc">${r.desc.en}</p>
        <div class="meta-row" style="margin-bottom:14px">
          <span class="tag time">⏱ ${r.timeCategory} min</span>
          <span class="tag cuisine-${r.cuisine}">${r.cuisine}</span>
          ${(r.dietType || []).map((d) => `<span class="tag diet-${d}">${d}</span>`).join("")}
        </div>
        <h4>Ingredients</h4><ul>${r.ingredients.map((i) => `<li>${i}</li>`).join("")}</ul>
        <h4>Steps</h4><ol>${r.instructions.map((s) => `<li>${s}</li>`).join("")}</ol>
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
    document.getElementById("preview-close").addEventListener("click", () => backdrop.remove());
  }

  function escAttr(s) { return String(s || "").replace(/"/g, "&quot;"); }

  /* ---------------- export / import ---------------- */
  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  function exportRecipesJs() {
    const content = `/* Tiny Tiffin — Recipe Database (exported from Admin Panel) */\nwindow.TINY_TIFFIN_RECIPES = ${JSON.stringify(recipes, null, 2)};\n`;
    downloadFile("recipes.js", content, "text/javascript");
  }
  function exportJson() { downloadFile("tiny-tiffin-recipes-backup.json", JSON.stringify(recipes, null, 2), "application/json"); }
  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!Array.isArray(parsed)) throw new Error("not an array");
        recipes = parsed; window.TinyTiffinStore.saveRecipes(recipes); render();
      } catch (e) { alert("That file doesn't look like a valid Tiny Tiffin recipe export."); }
    };
    reader.readAsText(file);
  }

  /* ---------------- Excel bulk upload (SheetJS) ---------------- */
  function loadSheetJS(cb) {
    if (window.XLSX) { cb(); return; }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = cb;
    script.onerror = () => alert("Couldn't load the Excel library — check your internet connection and try again.");
    document.head.appendChild(script);
  }

  function downloadSampleExcel() {
    loadSheetJS(() => {
      const sampleRow = {
        id: "sample-veg-poha", emoji: "🍚", name_en: "Sample Vegetable Poha", name_hi: "सैंपल सब्ज़ी पोहा",
        desc_en: "Short one-line description.", ageGroups: "2-5y;5-10y", timeCategory: 15,
        dietType: "vegetarian;vegan", cuisine: "indian", mealType: "breakfast;snack", difficulty: "Easy",
        nutritionTags: "iron;energy", allergens: "peanuts",
        ingredients: "1 cup poha;2 tbsp peanuts;Salt to taste",
        instructions: "Rinse poha.;Temper peanuts in oil.;Mix and serve.",
        calories: 220, protein_g: 5, iron_mg: 2.1, calcium_mg: 30, fiber_g: 2.5, vitaminC_mg: 8,
        packingTip_en: "Pack lime separately.", kidTip_en: "Cut potato small.",
        image1: "", image2: ""
      };
      const ws = XLSX.utils.json_to_sheet([sampleRow], { header: EXCEL_COLUMNS });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Recipes");
      XLSX.writeFile(wb, "tiny-tiffin-recipe-template.xlsx");
    });
  }

  function splitList(val) {
    return String(val || "").split(";").map((s) => s.trim()).filter(Boolean);
  }

  function importExcel(file) {
    loadSheetJS(() => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
          const errors = [];
          const added = [];
          rows.forEach((row, idx) => {
            const rowNum = idx + 2; // account for header row
            const id = String(row.id || "").trim().toLowerCase().replace(/\s+/g, "-");
            if (!id) { errors.push(`Row ${rowNum}: missing id — skipped.`); return; }
            if (!row.name_en) { errors.push(`Row ${rowNum} (${id}): missing name_en — skipped.`); return; }
            if (recipes.some((r) => r.id === id)) { errors.push(`Row ${rowNum} (${id}): duplicate id already exists — skipped.`); return; }
            if (added.some((r) => r.id === id)) { errors.push(`Row ${rowNum} (${id}): duplicate id within this file — skipped.`); return; }
            const timeCategory = Number(row.timeCategory);
            if (![10, 15, 20, 25, 30].includes(timeCategory)) { errors.push(`Row ${rowNum} (${id}): timeCategory must be 10/15/20/25/30 — skipped.`); return; }
            added.push({
              id, emoji: row.emoji || "🍽️", images: [row.image1, row.image2].map((s) => String(s || "").trim()).filter(Boolean),
              name: { en: row.name_en, hi: row.name_hi || row.name_en },
              desc: { en: row.desc_en || "", hi: row.desc_en || "" },
              ageGroups: splitList(row.ageGroups), timeCategory,
              dietType: splitList(row.dietType), cuisine: row.cuisine || "indian",
              mealType: splitList(row.mealType), difficulty: row.difficulty || "Easy",
              nutritionTags: splitList(row.nutritionTags), allergens: splitList(row.allergens),
              ingredients: splitList(row.ingredients), instructions: splitList(row.instructions),
              nutrition: {
                calories: Number(row.calories) || 0, protein_g: Number(row.protein_g) || 0,
                iron_mg: Number(row.iron_mg) || 0, calcium_mg: Number(row.calcium_mg) || 0,
                fiber_g: Number(row.fiber_g) || 0, vitaminC_mg: Number(row.vitaminC_mg) || 0
              },
              packingTip: { en: row.packingTip_en || "", hi: "" }, kidTip: { en: row.kidTip_en || "", hi: "" },
              ratings: { overall: 4, nutrition: 4, kidFriendly: 4, lunchboxFriendly: 4, pickyEaterFriendly: 4, timeSaver: 4, count: 1 },
              hidden: false
            });
          });
          recipes = recipes.concat(added);
          window.TinyTiffinStore.saveRecipes(recipes);
          const reportEl = document.getElementById("import-report");
          render();
          const freshReportEl = document.getElementById("import-report");
          if (freshReportEl) {
            freshReportEl.innerHTML = `<div class="draft-banner" style="border-color:${errors.length ? "var(--chili)" : "var(--masala)"}">
              Imported ${added.length} recipe(s). ${errors.length ? errors.length + " row(s) had problems:" : "No errors."}
              ${errors.length ? `<ul style="margin:8px 0 0;padding-left:18px">${errors.map((e) => `<li>${e}</li>`).join("")}</ul>` : ""}
            </div>`;
          }
        } catch (err) {
          alert("Couldn't read that Excel file. Make sure it matches the sample template's columns.");
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  /* ---------------- events ---------------- */
  function attachEvents() {
    if (!authed) {
      const submit = document.getElementById("pw-submit");
      const input = document.getElementById("pw-input");
      const tryLogin = () => {
        if (input.value === ADMIN_PASSWORD) { authed = true; sessionSet("tt_admin_authed", true); render(); }
        else { input.value = ""; input.placeholder = "Incorrect password — try again"; input.focus(); }
      };
      if (submit) submit.addEventListener("click", tryLogin);
      if (input) input.addEventListener("keydown", (e) => { if (e.key === "Enter") tryLogin(); });
      return;
    }
    if (currentView === "settings") {
      const back = document.getElementById("back-to-dashboard");
      if (back) back.addEventListener("click", () => { currentView = "dashboard"; render(); });
      const saveBtn = document.getElementById("save-settings");
      if (saveBtn) saveBtn.addEventListener("click", () => {
        window.TINY_TIFFIN_CONFIG.contactEmail = document.getElementById("cfg-contact-email").value;
        window.TINY_TIFFIN_CONFIG.developer.name = document.getElementById("cfg-dev-name").value;
        window.TINY_TIFFIN_CONFIG.developer.email = document.getElementById("cfg-dev-email").value;
        window.TINY_TIFFIN_CONFIG.developer.about = document.getElementById("cfg-dev-about").value;
        alert("Saved for this browser session. Update data/site-config.js in your project to publish these changes.");
      });
      return;
    }
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) logoutBtn.addEventListener("click", () => { authed = false; sessionSet("tt_admin_authed", false); render(); });
    const settingsBtn = document.getElementById("nav-settings");
    if (settingsBtn) settingsBtn.addEventListener("click", () => { currentView = "settings"; render(); });
    const addBtn = document.getElementById("add-recipe-btn");
    if (addBtn) addBtn.addEventListener("click", () => openForm(null));

    root.querySelectorAll("[data-preview]").forEach((btn) => btn.addEventListener("click", () => openForm(recipes.find((r) => r.id === btn.dataset.preview), true)));
    root.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => openForm(recipes.find((r) => r.id === btn.dataset.edit))));
    root.querySelectorAll("[data-duplicate]").forEach((btn) => btn.addEventListener("click", () => {
      const orig = recipes.find((r) => r.id === btn.dataset.duplicate);
      if (!orig) return;
      let newId = orig.id + "-copy", n = 2;
      while (recipes.some((r) => r.id === newId)) { newId = `${orig.id}-copy${n}`; n++; }
      const copy = JSON.parse(JSON.stringify(orig));
      copy.id = newId; copy.name.en = orig.name.en + " (Copy)";
      recipes.push(copy); window.TinyTiffinStore.saveRecipes(recipes); render();
    }));
    root.querySelectorAll("[data-toggle-hide]").forEach((btn) => btn.addEventListener("click", () => {
      recipes = recipes.map((r) => (r.id === btn.dataset.toggleHide ? { ...r, hidden: !r.hidden } : r));
      window.TinyTiffinStore.saveRecipes(recipes); render();
    }));
    root.querySelectorAll("[data-delete]").forEach((btn) => btn.addEventListener("click", () => {
      if (confirm("Delete this recipe? This can't be undone.")) {
        recipes = recipes.filter((r) => r.id !== btn.dataset.delete);
        window.TinyTiffinStore.saveRecipes(recipes); render();
      }
    }));

    const exportBtn = document.getElementById("export-btn");
    if (exportBtn) exportBtn.addEventListener("click", exportRecipesJs);
    const exportJsonBtn = document.getElementById("export-json-btn");
    if (exportJsonBtn) exportJsonBtn.addEventListener("click", exportJson);
    const sampleExcelBtn = document.getElementById("sample-excel-btn");
    if (sampleExcelBtn) sampleExcelBtn.addEventListener("click", downloadSampleExcel);
    const importInput = document.getElementById("import-input");
    if (importInput) importInput.addEventListener("change", (e) => { if (e.target.files[0]) importJson(e.target.files[0]); });
    const excelInput = document.getElementById("excel-input");
    if (excelInput) excelInput.addEventListener("change", (e) => { if (e.target.files[0]) importExcel(e.target.files[0]); });
    const discardBtn = document.getElementById("discard-draft-btn");
    if (discardBtn) discardBtn.addEventListener("click", () => {
      if (confirm("Discard all unsaved draft changes and go back to the published recipes?")) {
        window.TinyTiffinStore.clearDraft();
        recipes = window.TinyTiffinStore.getRecipes().map((r) => JSON.parse(JSON.stringify(r)));
        render();
      }
    });
  }

  render();
})();
