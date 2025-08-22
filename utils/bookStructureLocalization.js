// Backend book structure localization utility
// This should match the frontend bookStructureLocalization.ts

const localizedStructures = {
  en: {
    front: [
      "Title Page",
      "Copyright",
      "Dedication",
      "Acknowledgments",
      "Foreword",
      "Introduction"
    ],
    main: ["Chapter 1", "Chapter 2", "Chapter 3"],
    back: ["About the Author", "Appendix", "References", "Bibliography", "Index", "Glossary"]
  },
  es: {
    front: [
      "Página de título",
      "Derechos de autor",
      "Dedicatoria",
      "Agradecimientos",
      "Prólogo",
      "Introducción"
    ],
    main: ["Capítulo 1", "Capítulo 2", "Capítulo 3"],
    back: ["Sobre el autor", "Apéndice", "Referencias", "Bibliografía", "Índice", "Glosario"]
  },
  fr: {
    front: [
      "Page de titre",
      "Droits d'auteur",
      "Dédicace",
      "Remerciements",
      "Avant-propos",
      "Introduction"
    ],
    main: ["Chapitre 1", "Chapitre 2", "Chapitre 3"],
    back: ["À propos de l'auteur", "Annexe", "Références", "Bibliographie", "Index", "Glossaire"]
  },
  de: {
    front: [
      "Titelseite",
      "Urheberrecht",
      "Widmung",
      "Danksagungen",
      "Vorwort",
      "Einleitung"
    ],
    main: ["Kapitel 1", "Kapitel 2", "Kapitel 3"],
    back: ["Über den Autor", "Anhang", "Referenzen", "Bibliographie", "Index", "Glossar"]
  },
  it: {
    front: [
      "Pagina del titolo",
      "Diritti d'autore",
      "Dedica",
      "Ringraziamenti",
      "Prefazione",
      "Introduzione"
    ],
    main: ["Capitolo 1", "Capitolo 2", "Capitolo 3"],
    back: ["Sull'autore", "Appendice", "Riferimenti", "Bibliografia", "Indice", "Glossario"]
  },
  ru: {
    front: [
      "Титульная страница",
      "Авторские права",
      "Посвящение",
      "Благодарности",
      "Предисловие",
      "Введение"
    ],
    main: ["Глава 1", "Глава 2", "Глава 3"],
    back: ["Об авторе", "Приложение", "Ссылки", "Библиография", "Указатель", "Глоссарий"]
  },
  ro: {
    front: [
      "Pagina de titlu",
      "Drepturi de autor",
      "Dedicație",
      "Mulțumiri",
      "Prefață",
      "Introducere"
    ],
    main: ["Capitolul 1", "Capitolul 2", "Capitolul 3"],
    back: ["Despre autor", "Anexă", "Referințe", "Bibliografie", "Index", "Glosar"]
  },
  ar: {
    front: [
      "صفحة العنوان",
      "حقوق النشر",
      "إهداء",
      "شكر وتقدير",
      "مقدمة",
      "مقدمة"
    ],
    main: ["الفصل الأول", "الفصل الثاني", "الفصل الثالث"],
    back: ["عن المؤلف", "ملحق", "مراجع", "مصادر", "فهرس", "قاموس"]
  },
  ta: {
    front: [
      "தலைப்பு பக்கம்",
      "பதிப்புரிமை",
      "அர்ப்பணிப்பு",
      "நன்றிகள்",
      "முன்னுரை",
      "அறிமுகம்"
    ],
    main: ["அத்தியாயம் 1", "அத்தியாயம் 2", "அத்தியாயம் 3"],
    back: ["எழுத்தாளர் பற்றி", "இணைப்பு", "குறிப்புகள்", "நூலியல்", "அட்டவணை", "சொற்களஞ்சியம்"]
  }
};

/**
 * Get localized book structure for a given language
 * @param {string} language - Language code (e.g., 'en', 'fr', 'de')
 * @returns {Object} Localized book structure
 */
const getLocalizedBookStructure = (language = 'en') => {
  const normalizedLang = language.toLowerCase().split('-')[0]; // Handle 'en-US' -> 'en'
  return localizedStructures[normalizedLang] || localizedStructures.en;
};

/**
 * Helper function to identify special sections by their matter and position
 * instead of relying on English title keywords
 * @param {Array} sections - Array of sections with matter property
 * @returns {Object} Object with titlePageSection and copyrightSection
 */
const identifySpecialSections = (sections) => {
  let titlePageSection = null;
  let copyrightSection = null;
  
  // Group sections by matter
  const frontMatterSections = sections.filter(s => s.matter === 'front');
  const mainMatterSections = sections.filter(s => s.matter === 'main');
  const backMatterSections = sections.filter(s => s.matter === 'back');
  
  // Title page is typically the first front matter section
  if (frontMatterSections.length > 0) {
    titlePageSection = frontMatterSections[0];
  }
  
  // Copyright is typically the second front matter section
  if (frontMatterSections.length > 1) {
    copyrightSection = frontMatterSections[1];
  }
  
  return { titlePageSection, copyrightSection };
};

module.exports = {
  getLocalizedBookStructure,
  localizedStructures,
  identifySpecialSections
};
