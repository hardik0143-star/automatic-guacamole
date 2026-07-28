/* ==========================================================
   Tiny Tiffin — Internationalization Engine v0.3

   Purpose:
   - Manage application languages
   - Dynamic UI translation
   - Connect with ContentTranslator
   - Persist user language preference
   - Support future RTL / AI translation expansion

   Inspired by Nishiv’s little smile ❤️
========================================================== */


const I18n = (() => {


    const defaultLanguage = "en";


    const languages = {

        en: {
            name: "English",
            nativeName: "English",
            direction: "ltr"
        },

        hi: {
            name: "Hindi",
            nativeName: "हिन्दी",
            direction: "ltr"
        },

        gu: {
            name: "Gujarati",
            nativeName: "ગુજરાતી",
            direction: "ltr"
        },

        mr: {
            name: "Marathi",
            nativeName: "मराठी",
            direction: "ltr"
        },

        ta: {
            name: "Tamil",
            nativeName: "தமிழ்",
            direction: "ltr"
        },

        te: {
            name: "Telugu",
            nativeName: "తెలుగు",
            direction: "ltr"
        },

        kn: {
            name: "Kannada",
            nativeName: "ಕನ್ನಡ",
            direction: "ltr"
        },

        ml: {
            name: "Malayalam",
            nativeName: "മലയാളം",
            direction: "ltr"
        },

        bn: {
            name: "Bengali",
            nativeName: "বাংলা",
            direction: "ltr"
        },

        ja: {
            name: "Japanese",
            nativeName: "日本語",
            direction: "ltr"
        }

    };


    let currentLanguage =
        localStorage.getItem(
            "tinyTiffinLanguage"
        )
        ||
        defaultLanguage;



    /*
       Change application language
    */

    function changeLanguage(language){


        if(!languages[language]){

            console.warn(
                "Unsupported language:",
                language
            );

            return;

        }


        currentLanguage = language;


        localStorage.setItem(
            "tinyTiffinLanguage",
            language
        );


        document.documentElement.lang =
            language;


        document.documentElement.dir =
            languages[language].direction;


        // Sync translator engine

        if(window.ContentTranslator){

            ContentTranslator.setLanguage(
                language
            );

        }


        refreshUI();


        dispatchLanguageEvent();

    }





    /*
       Translate complete UI

       Elements require:
       data-i18n="translationKey"

       Example:

       <button data-i18n="recipes">
       </button>

    */

    function refreshUI(){


        if(!window.ContentTranslator){

            return;

        }


        const elements =
            document.querySelectorAll(
                "[data-i18n]"
            );


        elements.forEach(element=>{


            const key =
                element.dataset.i18n;


            const translation =
                ContentTranslator.translate(
                    key
                );


            if
