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

    const nativeTitle = r.name && r.name[lang] ? r.name[lang] : (title && title.textContent);
    const nativeDesc = r.desc && r.desc[lang] ? r.desc[lang] : (desc && desc.textContent);
    const titleText = r.name && r.name[lang] ? nativeTitle : await translateText(nativeTitle, lang);
    const descText = r.desc && r.desc[lang] ? nativeDesc : await translateText(nativeDesc, lang);
    if (title && titleText) title.textContent = titleText;
    if (desc && descText) desc.textContent = descText;

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

    if (tips[0] && translatedTips[0]) {
      const strong = tips[0].querySelector("strong");
      tips[0].innerHTML = "";
      if (strong) tips[0].appendChild(strong);
      tips[0].appendChild(document.createTextNode(" " + translatedTips[0]));
    }
    if (tips[1] && translatedTips[1]) {
      const strong = tips[1].querySelector("strong");
      tips[1].innerHTML = "";
      if (strong) tips[1].appendChild(strong);
      tips[1].appendChild(document.createTextNode(" " + translatedTips[1]));
    }

    // Translate recipe-specific difficulty, vitamin names and other recipe metadata.
    const difficultyTag = modal.querySelector('.meta-row .tag:not(.time):not(.allergen)');
    if (difficultyTag && r.difficulty) {
      difficultyTag.textContent = await translateText(r.difficulty, lang);
    }
    const vitamin = modal.querySelector('.vitamin-row');
    if (vitamin) {
      const strong = vitamin.querySelector('strong');
      const value = vitamin.textContent.replace(strong ? strong.textContent : '', '').replace(/^🍎\s*/, '').replace(/^:\s*/, '').trim();
      if (value && value !== 'Nutritional profile varies by ingredients') {
        const translatedValue = await translateText(value, lang);
        if (translatedValue) {
          vitamin.innerHTML = '';
          vitamin.appendChild(document.createTextNode('🍎 '));
          if (strong) vitamin.appendChild(strong);
          vitamin.appendChild(document.createTextNode(' ' + translatedValue));
        }
      }
    }

    // Translate recipe-specific allergen names and difficulty if the data has no localized equivalent.
    const metaTags = [...modal.querySelectorAll(".meta-row .tag")];
    const rawAllergens = r.allergens || [];
    const allergenTags = metaTags.filter(x => x.classList.contains("allergen"));
    const translatedAllergens = await translateMany(rawAllergens, lang);
    allergenTags.forEach((el, i) => {
      if (translatedAllergens[i]) el.textContent = "⚠ " + translatedAllergens[i];
    });

    // Translate any remaining visible English recipe-specific text in the modal.
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

  window.tinyTiffinLocalizeRecipe = localizeRecipe;
  window.tinyTiffinLocalizeAIHub = localizeAIHub;
})();
