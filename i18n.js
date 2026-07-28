/* Tiny Tiffin i18n basic loader */

const I18n = {

    currentLanguage:
        localStorage.getItem("tinyTiffinLanguage") || "en",

    changeLanguage(language){

        this.currentLanguage = language;

        localStorage.setItem(
            "tinyTiffinLanguage",
            language
        );

        location.reload();

    },

    getCurrentLanguage(){

        return this.currentLanguage;

    }

};


window.I18n = I18n;
