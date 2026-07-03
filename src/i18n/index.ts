import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import bn from "./locales/bn.json";
import en from "./locales/en.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      bn: { translation: bn },
      en: { translation: en },
    },
    fallbackLng: "en",
    supportedLngs: ["bn", "en"],
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: "lang",
      caches: ["localStorage"],
    },
    // First visit (nothing stored yet) defaults to English; Bangla is the
    // switchable secondary. A saved choice in localStorage always wins.
    lng: typeof window !== "undefined" && !localStorage.getItem("lang") ? "en" : undefined,
  });

// Keep <html lang> in sync
const applyHtmlLang = (lng: string) => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng;
    document.documentElement.setAttribute("data-lang", lng);
  }
};
applyHtmlLang(i18n.language || "en");
i18n.on("languageChanged", applyHtmlLang);

export default i18n;
