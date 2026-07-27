/* Tiny Tiffin — dynamic content translation layer
   Recipe data is stored in English for compactness. When a selected language
   does not have a native recipe translation, this layer translates the
   complete recipe content and caches it locally for future offline use.
*/
(function () {
  "use strict";

  const CACHE_KEY = "tt_dynamic_translations_v1";
  const cache = (() => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch (_) { return {}; }
  })();

  const langPair = {
    hi: "hi", gu: "gu", mr: "mr", fr: "fr", es: "es", de: "de",
    yue: "zh-CN", ta: "ta", te: "te", bn: "bn"
  };

  function save() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (_) {}
  }

  function cacheKey(text, lang) {
    return `${lang}|${String(text || "").trim()}`;
  }

  async function translateText(text, lang) {
    text = String(text || "").trim();
    if (!text || lang === "en") return text;
    const key = cacheKey(text, lang);
    if (cache[key]) return cache[key];

    const target = langPair[lang];
    if (!target) return text;

    // Google Translate's public endpoint is used first because it is more
    // reliable for larger recipe text than the previous single-provider call.
    const providers = [
      async () => {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Google translation unavailable");
        const data = await response.json();
        const translated = Array.isArray(data) && Array.isArray(data[0])
          ? data[0].map(x => x && x[0] ? x[0] : "").join("")
          : "";
        if (!translated.trim()) throw new Error("Empty translation");
        return translated.trim();
      },
      async () => {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${target}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("MyMemory unavailable");
        const data = await response.json();
        const translated = data && data.responseData && data.responseData.translatedText;
        if (!translated || !translated.trim() || translated.trim().toLowerCase() === text.toLowerCase()) {
          throw new Error("Empty translation");
        }
        return translated.trim();
      }
    ];

    for (const provider of providers) {
      try {
        const translated = await provider();
        cache[key] = translated;
        save();
        return translated;
      } catch (_) {}
    }
    return text;
  }

  async function translateMany(items, lang) {
    const unique = [...new Set(items.map(x => String(x || "").trim()).filter(Boolean))];
    const result = await Promise.all(unique.map(x => translateText(x, lang)));
    const map = new Map(unique.map((x, i) => [x, result[i]]));
    return items.map(x => map.get(String(x || "").trim()) || x);
  }

  async function localizeRecipe(r, modal, lang) {
    if (!modal || lang === "en") return;

    const title = modal.querySelector("h2");
    const desc = modal.querySelector(".desc");
    const ingredientItems = [...modal.querySelectorAll("section:nth-of-type(1) li")];
    const stepItems = [...modal.querySelectorAll("section:nth-of-type(2) li")];
    const tips = [...modal.querySelectorAll(".tip-box")];

    const hasNativeTitle = !!(r.name && r.name[lang]);
    const hasNativeDesc = !!(r.desc && r.desc[lang]);
    const titleText = r.name && r.name.en ? r.name.en : (title && title.textContent);
    const descText = r.desc && r.desc.en ? r.desc.en : (desc && desc.textContent);
    const [translatedTitle, translatedDesc] = await Promise.all([
      titleText ? (hasNativeTitle ? r.name[lang] : translateText(titleText, lang)) : "",
      descText ? (hasNativeDesc ? r.desc[lang] : translateText(descText, lang)) : ""
    ]);
    if (title && translatedTitle) title.textContent = translatedTitle;
    if (desc && translatedDesc) desc.textContent = translatedDesc;

    const ingredientTexts = r.ingredients || ingredientItems.map(x => x.textContent);
    const stepTexts = r.instructions || stepItems.map(x => x.textContent);
    const translatedIngredients = await translateMany(ingredientTexts, lang);
    const translatedSteps = await translateMany(stepTexts, lang);

    ingredientItems.forEach((el, i) => { if (translatedIngredients[i]) el.textContent = translatedIngredients[i]; });
    stepItems.forEach((el, i) => { if (translatedSteps[i]) el.textContent = translatedSteps[i]; });

    // Difficulty is stored as a compact English enum in the recipe database;
    // translate the visible label without touching admin data.
    const difficultyTag = [...modal.querySelectorAll(".meta-row .tag")].find(el => el.textContent.trim() === String(r.difficulty || "").trim());
    if (difficultyTag) difficultyTag.textContent = await translateText(String(r.difficulty), lang);

    const packingNative = r.packingTip && r.packingTip[lang];
    const kidNative = r.kidTip && r.kidTip[lang];
    const packing = packingNative || (r.packingTip && r.packingTip.en);
    const kid = kidNative || (r.kidTip && r.kidTip.en);
    const tipTexts = [packing, kid].filter(Boolean);
    const translatedTips = await Promise.all(tipTexts.map((x, i) => {
      const native = i === 0 ? packingNative : kidNative;
      return native || translateText(x, lang);
    }));

    const tipLabels = [
      (window.tinyTiffinT && window.tinyTiffinT(lang, "packingTip")) || "Packing tip",
      (window.tinyTiffinT && window.tinyTiffinT(lang, "kidTip")) || "Parent tip"
    ];
    const translatedTipLabels = tipLabels;
    [tips[0], tips[1]].forEach((tip, i) => {
      if (!tip || !translatedTips[i]) return;
      tip.innerHTML = "";
      const strong = document.createElement("strong");
      strong.textContent = (translatedTipLabels[i] || tipLabels[i]) + ":";
      tip.appendChild(strong);
      tip.appendChild(document.createTextNode(" " + translatedTips[i]));
    })

    // Translate every recipe-specific visible tag, including allergens, difficulty,
    // cuisine, diet and nutrition tags, so the recipe modal does not retain English text.
    const metaTags = [...modal.querySelectorAll(".meta-row .tag")];
    const rawTagTexts = metaTags.map(el => el.textContent.replace(/^⚠\s*/, "").trim());
    const translatedTagTexts = await translateMany(rawTagTexts, lang);
    metaTags.forEach((el, i) => {
      if (!translatedTagTexts[i]) return;
      const warning = el.classList.contains("allergen") ? "⚠ " : "";
      el.textContent = warning + translatedTagTexts[i];
    });

    // Translate any remaining visible English recipe-specific text in the modal.
    const vitamin = modal.querySelector(".vitamin-row");
    if (vitamin && !r.name[lang]) {
      // The label itself is already localized by i18n; leave nutrition values untouched.
    }
  }

  async function localizeAIHub(root, lang) {
    if (!root || lang === "en") return;
    const ai = root.querySelector(".ai-hub");
    if (!ai) return;
    const texts = [...ai.querySelectorAll("h2, h3, p, button")].filter(el => !el.closest("textarea") && !el.closest("input"));
    const original = texts.map(el => el.textContent.trim());
    const translated = await translateMany(original, lang);
    texts.forEach((el, i) => { if (translated[i]) el.textContent = translated[i]; });

    const placeholders = [...ai.querySelectorAll("textarea, input")];
    const ph = placeholders.map(el => el.placeholder).filter(Boolean);
    const tph = await translateMany(ph, lang);
    let j = 0;
    placeholders.forEach(el => { if (el.placeholder) el.placeholder = tph[j++]; });
  }


  async function localizeRecipeCards(root, recipes, lang) {
    if (!root || lang === "en") return;
    const cards = [...root.querySelectorAll(".recipe-card[data-id]")];
    await Promise.all(cards.map(async card => {
      const r = recipes.find(x => x.id === card.dataset.id);
      if (!r) return;
      const title = card.querySelector("h3");
      const desc = card.querySelector(".desc");
      const hasNativeTitle = !!(r.name && r.name[lang]);
      const hasNativeDesc = !!(r.desc && r.desc[lang]);
      const titleText = r.name && r.name.en;
      const descText = r.desc && r.desc.en;
      const [tt, dd] = await Promise.all([
        hasNativeTitle ? r.name[lang] : translateText(titleText, lang),
        hasNativeDesc ? r.desc[lang] : translateText(descText, lang)
      ]);
      if (title && tt) title.textContent = tt;
      if (desc && dd) desc.textContent = dd;
      const allergens = [...card.querySelectorAll(".tag.allergen")];
      const raw = (r.allergens || []);
      const translated = await translateMany(raw, lang);
      allergens.forEach((el, i) => { if (translated[i]) el.textContent = "⚠ " + translated[i]; });
    }));
  }

  async function localizeDeveloper(root, config, lang) {
    if (!root || lang === "en" || !config) return;
    const page = root.querySelector(".simple-page");
    if (!page) return;
    const story = page.querySelector(".developer-story");
    const release = page.querySelector(".release-card span");
    const capabilityItems = [...page.querySelectorAll(".dev-future-list li")];

    const texts = [];
    if (story) texts.push(story.innerText);
    if (release) texts.push(release.innerText);
    capabilityItems.forEach(el => texts.push(el.innerText));

    const translated = await Promise.all(texts.map(x => translateText(x, lang)));
    let i = 0;
    if (story) story.innerHTML = translated[i++].replace(/\n/g, "<br><br>");
    if (release) release.textContent = translated[i++];
    capabilityItems.forEach(el => { el.textContent = translated[i++]; });

    const headings = [...page.querySelectorAll("h4")];
    for (const h of headings) {
      h.textContent = await translateText(h.textContent, lang);
    }
    const emailBtn = page.querySelector('a[href^="mailto:"]');
    if (emailBtn) emailBtn.textContent = (window.tinyTiffinT && window.tinyTiffinT(lang, "emailDeveloper")) || await translateText("Email the developer", lang);
  }

  window.tinyTiffinLocalizeRecipe = localizeRecipe;
  window.tinyTiffinLocalizeRecipeCards = localizeRecipeCards;
  window.tinyTiffinLocalizeAIHub = localizeAIHub;
  window.tinyTiffinLocalizeDeveloper = localizeDeveloper;
})();
