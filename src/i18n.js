/**
 * i18n.js
 * Internationalization for Meco Konfigurator
 */

export const locales = {
  bs: { // Bosnian
    appTitle: "Meco Konfigurator 2026",
    categories: {
      Donji: "Donji",
      Ugaoni: "Ugaoni",
      Gornji: "Gornji",
      Visoki: "Visoki",
      Aparati: "Aparati"
    },
    params: {
      s: "Širina",
      v: "Visina",
      d: "Dubina",
      c: "Cokla",
      brvr: "Broj vrata",
      brp: "Broj polica",
      brf: "Broj fioka",
      brfp: "Plitke fioke",
      brfd: "Duboke fioke",
      brv: "Broj vrata",
      rerna: "Širina rerne",
      dss: "Širina desno",
      lss: "Širina lijevo",
      sl: "Širina lijevo",
      sd: "Širina desno",
      ss: "Širina stuba",
      ds: "Dubina stuba",
      vs: "Visina stuba"
    },
    ui: {
      modules: "MODULI",
      params: "PARAMETRI",
      slideType: "Tip klizača",
      countertop: "RADNA PLOČA",
      plinth: "COKLA",
      addPlan: "DODAJ U PLAN",
      presets: "PREDLOŠCI RASPOREDA",
      searchPlaceholder: "Pretraži module...",
      totalCost: "Ukupna cijena",
      clearPlan: "OBRIŠI SVE",
      exportMpr: "IZVOZ MPR",
      exportPdfOffer: "IZVEZI PDF PONUDU",
      kitchenPlan: "PLAN KUHINJE",
      position: "POZICIJA",
      materialPrices: "CIJENE MATERIJALA",
      materialPricesPerM2: "CIJENE MATERIJALA (€ / m²)",
      edgingPerM: "KANTOVANJE (m')",
      cuttingList: "KROJNA",
      optimik: "OPTIMIK"
    },
    notifications: {
      moduleAdded: "Modul dodat u plan",
      moduleDeleted: "Modul obrisan",
      historyUndo: "Poništeno",
      historyRedo: "Ponavljeno",
      presetApplied: "Predložak primijenjen"
    }
  },
  en: { // English
    appTitle: "Meco Configurator 2026",
    categories: {
      Donji: "Base",
      Ugaoni: "Corner",
      Gornji: "Wall",
      Visoki: "Tall",
      Aparati: "Appliances"
    },
    params: {
      s: "Width",
      v: "Height",
      d: "Depth",
      c: "Plinth",
      brvr: "Door Count",
      brp: "Shelf Count",
      brf: "Drawer Count",
      brfp: "Shallow Drawers",
      brfd: "Deep Drawers",
      brv: "Door Count",
      rerna: "Oven Width",
      dss: "Right Width",
      lss: "Left Width",
      sl: "Left Width",
      sd: "Right Width",
      ss: "Column Width",
      ds: "Column Depth",
      vs: "Column Height"
    },
    ui: {
      modules: "MODULES",
      params: "PARAMETERS",
      slideType: "Slide Type",
      countertop: "COUNTERTOP",
      plinth: "PLINTH",
      addPlan: "ADD TO PLAN",
      presets: "PRESET LAYOUTS",
      searchPlaceholder: "Search modules...",
      totalCost: "Total Cost",
      clearPlan: "CLEAR ALL",
      exportMpr: "EXPORT MPR",
      exportPdfOffer: "EXPORT PDF OFFER",
      kitchenPlan: "KITCHEN PLAN",
      position: "POSITION",
      materialPrices: "MATERIAL PRICES",
      materialPricesPerM2: "MATERIAL PRICES (€ / m²)",
      edgingPerM: "EDGING (m')",
      cuttingList: "CUTTING LIST",
      optimik: "OPTIMIK"
    },
    notifications: {
      moduleAdded: "Module added to plan",
      moduleDeleted: "Module deleted",
      historyUndo: "Undo",
      historyRedo: "Redo",
      presetApplied: "Preset applied"
    }
  }
};

let currentLocale = 'bs';

export function setLocale(lang) {
  if (locales[lang]) currentLocale = lang;
}

export function t(path) {
  const keys = path.split('.');
  let obj = locales[currentLocale];
  for (const key of keys) {
    if (obj[key] !== undefined) obj = obj[key];
    else return path;
  }
  return obj;
}
