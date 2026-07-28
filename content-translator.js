/* ==========================================================
   Tiny Tiffin — Content Translator Engine v0.3

   Purpose:
   - Dynamic multilingual content translation
   - Recipe title/description translation support
   - Works offline with fallback dictionary
   - AI translation ready architecture
   - Supports future API integration

   Inspired by Nishiv’s little smile ❤️
========================================================== */

const ContentTranslator = (() => {

    const supportedLanguages = {
        en: "English",
        hi: "हिन्दी",
        gu: "ગુજરાતી",
        mr: "मराठी",
        ta: "தமிழ்",
        te: "తెలుగు",
        kn: "ಕನ್ನಡ",
        ml: "മലയാളം",
        bn: "বাংলা",
        ja: "日本語"
    };


    // Common app translations
    const dictionary = {

        en: {
            appName: "Tiny Tiffin",
            welcome: "Making every lunchbox a little more special",
            recipes: "Recipes",
            ingredients: "Ingredients",
            cookingTime: "Cooking Time",
            minutes: "minutes",
            instructions: "Instructions",
            healthy: "Healthy Choice",
            vegetarian: "Vegetarian",
            vegan: "Vegan",
            breakfast: "Breakfast",
            lunchbox: "Lunchbox",
            quickRecipe: "Quick Recipe",
            search: "Search recipes",
            noResults: "No recipes found",
            save: "Save",
            share: "Share"
        },

        hi: {
            appName: "टाइनी टिफिन",
            welcome: "हर लंचबॉक्स को थोड़ा और खास बनाएं",
            recipes: "रेसिपी",
            ingredients: "सामग्री",
            cookingTime: "पकाने का समय",
            minutes: "मिनट",
            instructions: "विधि",
            healthy: "स्वास्थ्यवर्धक विकल्प",
            vegetarian: "शाकाहारी",
            vegan: "वीगन",
            breakfast: "नाश्ता",
            lunchbox: "लंचबॉक्स",
            quickRecipe: "जल्दी बनने वाली रेसिपी",
            search: "रेसिपी खोजें",
            noResults: "कोई रेसिपी नहीं मिली",
            save: "सेव करें",
            share: "शेयर करें"
        },

        gu: {
            appName: "ટાઇની ટિફિન",
            welcome: "દરેક લંચબોક્સને વધુ ખાસ બનાવો",
            recipes: "રેસીપી",
            ingredients: "સામગ્રી",
            cookingTime: "બનાવવાનો સમય",
            minutes: "મિનિટ",
            instructions: "રીત",
            healthy: "હેલ્ધી પસંદગી",
            vegetarian: "શાકાહારી",
            vegan: "વીગન",
            breakfast: "નાસ્તો",
            lunchbox: "લંચબોક્સ",
            quickRecipe: "ઝડપી રેસીપી",
            search: "રેસીપી શોધો",
            noResults: "કોઈ રેસીપી મળી નથી",
            save: "સાચવો",
            share: "શેર કરો"
        },

        ja: {
            appName: "タイニーティフィン",
            welcome: "毎日のお弁当をもっと特別に",
            recipes: "レシピ",
            ingredients: "材料",
            cookingTime: "調理時間",
            minutes: "分",
            instructions: "作り方",
            healthy: "ヘルシー",
            vegetarian: "ベジタリアン",
            vegan: "ヴィーガン",
            breakfast: "朝食",
            lunchbox: "お弁当",
            quickRecipe: "簡単レシピ",
            search: "レシピ検索",
            noResults: "レシピが見つかりません",
            save: "保存",
            share: "共有"
        }

    };


    let currentLanguage = "en";


    function setLanguage(language) {

        if (supportedLanguages[language]) {
            currentLanguage = language;

            localStorage.setItem(
                "tinyTiffinLanguage",
                language
            );
        }

        return currentLanguage;
    }


    function getLanguage() {

        return (
            localStorage.getItem("tinyTiffinLanguage")
            || currentLanguage
        );

    }


    function translate(key) {

        const lang = getLanguage();

        return (
            dictionary[lang]?.[key]
            ||
            dictionary.en[key]
            ||
            key
        );

    }


    /*
      Translate recipe object

      Example:

      {
        title:{
          en:"Vegetable Sandwich"
        }
      }

      returns selected language content
    */

    function translateRecipe(recipe) {

        const lang = getLanguage();

        return {

            ...recipe,

            title:
                recipe.title?.[lang]
                ||
                recipe.title?.en
                ||
                recipe.title,

            description:
                recipe.description?.[lang]
                ||
                recipe.description?.en
                ||
                recipe.description,

            ingredients:
                recipe.ingredients?.[lang]
                ||
                recipe.ingredients?.en
                ||
                recipe.ingredients,

            instructions:
                recipe.instructions?.[lang]
                ||
                recipe.instructions?.en
                ||
                recipe.instructions

        };

    }



    /*
      Future AI Translation Hook

      Can connect with:
      - OpenAI API
      - Google Translate API
      - Azure Translator
    */

    async function aiTranslate(
        text,
        targetLanguage
    ){

        console.log(
            "AI Translation requested:",
            text,
            targetLanguage
        );


        // Placeholder

        return text;

    }



    return {

        languages:
            supportedLanguages,

        setLanguage,

        getLanguage,

        translate,

        translateRecipe,

        aiTranslate

    };


})();


// Global access
window.ContentTranslator = ContentTranslator;
