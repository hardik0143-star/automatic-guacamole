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
    const ingredientItems = [...modal.querySelectorAll("section:nth-of-type(1) li")];
    const stepItems = [...modal.querySelectorAll("section:nth-of-type(2) li")];
    const tips = [...modal.querySelectorAll(".tip-box")];

    const titleText = r.name && r.name[lang] ? r.name[lang] : (title && title.textContent);
    const descText = r.desc && r.desc[lang] ? r.desc[lang] : (desc && desc.textContent);
    const [translatedTitle, translatedDesc] = await Promise.all([
      titleText ? translateText(titleText, lang) : "",
      descText ? translateText(descText, lang) : ""
    ]);
    if (title && translatedTitle) title.textContent = translatedTitle;
    if (desc && translatedDesc) desc.textContent = translatedDesc;

    const ingredientTexts = r.ingredients || ingredientItems.map(x => x.textContent);
    const stepTexts = r.instructions || stepItems.map(x => x.textContent);
    const translatedIngredients = await translateMany(ingredientTexts, lang);
    const translatedSteps = await translateMany(stepTexts, lang);

    ingredientItems.forEach((el, i) => { if (translatedIngredients[i]) el.textContent = translatedIngredients[i]; });
    stepItems.forEach((el, i) => { if (translatedSteps[i]) el.textContent = translatedSteps[i]; });

    const packing = r.packingTip && (r.packingTip[lang] || r.packingTip.en);
    const kid = r.kidTip && (r.kidTip[lang] || r.kidTip.en);
    const tipTexts = [packing, kid].filter(Boolean);
    const translatedTips = await translateMany(tipTexts, lang);

    const tipLabels = ["Packing tip", "Parent tip"];
    const translatedTipLabels = await translateMany(tipLabels, lang);
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
      const titleText = r.name && r.name[lang] ? r.name[lang] : (r.name && r.name.en);
      const descText = r.desc && r.desc[lang] ? r.desc[lang] : (r.desc && r.desc.en);
      const [tt, dd] = await Promise.all([translateText(titleText, lang), translateText(descText, lang)]);
      if (title && tt) title.textContent = tt;
      if (desc && dd) desc.textContent = dd;
      const allergens = [...card.querySelectorAll(".tag.allergen")];
      const raw = (r.allergens || []);
      const translated = await translateMany(raw, lang);
      allergens.forEach((el, i) => { if (translated[i]) el.textContent = "⚠ " + translated[i]; });
    }));
  }

  window.tinyTiffinLocalizeRecipe = localizeRecipe;
  window.tinyTiffinLocalizeRecipeCards = localizeRecipeCards;
  window.tinyTiffinLocalizeAIHub = localizeAIHub;
})();
