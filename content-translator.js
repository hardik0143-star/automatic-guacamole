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
    yue: "zh-CN", ta: "ta", ja: "ja"
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

    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${target}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("translation unavailable");
      const data = await response.json();
      const translated = data && data.responseData && data.responseData.translatedText;
      if (translated && translated.trim()) {
        cache[key] = translated.trim();
        save();
        return translated.trim();
      }
    } catch (_) {}
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
    const sections = [...modal.querySelectorAll("section")];
    const ingredientItems = sections[0] ? [...sections[0].querySelectorAll("li")] : [];
    const stepItems = sections[1] ? [...sections[1].querySelectorAll("li")] : [];
    const tips = [...modal.querySelectorAll(".tip-box")];

    // Translate the complete recipe, not only ingredients and steps.
    const titleSource = r.name?.en || title?.textContent || "";
    const descSource = r.desc?.en || desc?.textContent || "";
    const titleText = r.name?.[lang] || await translateText(titleSource, lang);
    const descText = r.desc?.[lang] || await translateText(descSource, lang);
    if (title && titleText) title.textContent = titleText;
    if (desc && descText) desc.textContent = descText;

    const ingredientTexts = r.ingredients || ingredientItems.map(x => x.textContent);
    const stepTexts = r.instructions || stepItems.map(x => x.textContent);
    const [translatedIngredients, translatedSteps] = await Promise.all([
      translateMany(ingredientTexts, lang), translateMany(stepTexts, lang)
    ]);
    ingredientItems.forEach((el, i) => { if (translatedIngredients[i]) el.textContent = translatedIngredients[i]; });
    stepItems.forEach((el, i) => { if (translatedSteps[i]) el.textContent = translatedSteps[i]; });

    const tipSources = [r.packingTip?.[lang] || r.packingTip?.en || "", r.kidTip?.[lang] || r.kidTip?.en || ""];
    const translatedTips = await translateMany(tipSources, lang);
    tips.forEach((tip, i) => {
      if (!translatedTips[i]) return;
      const strong = tip.querySelector("strong");
      tip.innerHTML = "";
      if (strong) tip.appendChild(strong);
      tip.appendChild(document.createTextNode(" " + translatedTips[i]));
    });

    // Translate recipe-specific metadata that is not already rendered by i18n.
    const difficultyTags = [...modal.querySelectorAll(".meta-row .tag")].filter(el => !el.classList.contains("allergen") && !el.classList.contains("time") && !el.classList.contains("nutri"));
    if (difficultyTags[0]) difficultyTags[0].textContent = await translateText(r.difficulty || difficultyTags[0].textContent, lang);
    const allergenTags = [...modal.querySelectorAll(".meta-row .tag.allergen")];
    const translatedAllergens = await translateMany(r.allergens || [], lang);
    allergenTags.forEach((el, i) => { if (translatedAllergens[i]) el.textContent = "⚠ " + translatedAllergens[i]; });

    // Translate vitamin names shown in the key-vitamins row.
    const vitamin = modal.querySelector(".vitamin-row");
    if (vitamin) {
      const vitamins = getRecipeVitaminsSafe(r);
      if (vitamins.length) {
        const translated = await translateMany(vitamins, lang);
        const strong = vitamin.querySelector("strong");
        vitamin.innerHTML = "🍎 ";
        if (strong) { strong.textContent = (window.tinyTiffinT ? window.tinyTiffinT(lang, "keyVitamins") : "Key Vitamins") + ":"; vitamin.appendChild(strong); }
        vitamin.appendChild(document.createTextNode(" " + translated.join(", ")));
      }
    }
  }

  function getRecipeVitaminsSafe(r) {
    const text = [r.name?.en || "", ...(r.ingredients || [])].join(" ").toLowerCase();
    const vitamins = new Set();
    if (/carrot|sweet potato|pumpkin|spinach|mango|papaya|egg/.test(text)) vitamins.add("Vitamin A");
    if (/milk|curd|yogurt|paneer|cheese|egg|banana|oat/.test(text)) vitamins.add("Vitamin B");
    if (/lemon|orange|tomato|guava|amla|capsicum|broccoli/.test(text)) vitamins.add("Vitamin C");
    if (/spinach|broccoli|cabbage|leafy|egg/.test(text)) vitamins.add("Vitamin K");
    if (/almond|peanut|sunflower|avocado|spinach/.test(text)) vitamins.add("Vitamin E");
    if (/milk|curd|yogurt|paneer|cheese|egg/.test(text)) vitamins.add("Vitamin D");
    return Array.isArray(r.vitamins) && r.vitamins.length ? r.vitamins : Array.from(vitamins);
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

  
  async function localizeVisibleCards(root, lang) {
    if (!root || lang === "en") return;
    const cards = [...root.querySelectorAll(".recipe-card")];
    const items = [];
    cards.forEach(card => {
      const title = card.querySelector("h3");
      const desc = card.querySelector(".desc");
      if (title) items.push({ el: title, text: title.textContent });
      if (desc) items.push({ el: desc, text: desc.textContent });
    });
    const translated = await translateMany(items.map(x => x.text), lang);
    items.forEach((x, i) => { if (translated[i]) x.el.textContent = translated[i]; });
  }

  window.tinyTiffinLocalizeRecipe = localizeRecipe;
  window.tinyTiffinLocalizeVisibleCards = localizeVisibleCards;
  window.tinyTiffinLocalizeAIHub = localizeAIHub;
})();
