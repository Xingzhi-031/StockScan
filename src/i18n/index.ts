import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import zh from "./zh.json";
import id from "./id.json";

export const LANGS = ["en", "zh", "id"] as const;
export type Lang = (typeof LANGS)[number];

const STORAGE_KEY = "stockscan.lang";

export function readStoredLang(): Lang {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === "en" || raw === "zh" || raw === "id") return raw;
  return "en";
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
    id: { translation: id },
  },
  lng: typeof localStorage === "undefined" ? "en" : readStoredLang(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, lng);
  }
  document.documentElement.lang = lng;
});

export default i18n;
