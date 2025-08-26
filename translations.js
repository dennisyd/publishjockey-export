// Translation utility for backend TOC titles
// Using Unicode escape sequences for better performance and reliability
// Yancy Dennis - Updated to use Unicode escape sequences and added debugging
const tocTranslations = {
  'en': 'Table of Contents',
  'es': 'Tabla de Contenidos',
  'fr': 'Table des Mati\u00E8res',  // è
  'de': 'Inhaltsverzeichnis',
  'it': 'Indice',
  'id': 'Daftar Isi',
  'ru': '\u0421\u043E\u0434\u0435\u0440\u0436\u0430\u043D\u0438\u0435',  // Содержание
  'ro': 'Cuprins',
  'hi': '\u0935\u093F\u0937\u092F \u0938\u0942\u091A\u0940',  // विषय सूची
  'ar': '\u062C\u062F\u0648\u0644 \u0627\u0644\u0645\u062D\u062A\u0648\u064A\u0627\u062A',  // جدول المحتويات
  'ta': '\u0BAA\u0BCB\u0BB0\u0BC1\u0BB3\u0BA4\u0BCD\u0BA4\u0BC1',  // பொருளடக்கம்
  'hr': 'Sadr\u017Eaj',  // ž
  'cs': 'Obsah',
  'da': 'Indhold',
  'nl': 'Inhoudsopgave',
  'et': 'Sisukord',
  'fi': 'Sis\u00E4llysluettelo',  // ä
  'gl': '\u00CDndice',  // Í
  'el': '\u03A0\u03B5\u03C1\u03B9\u03B5\u03C7\u03CC\u03BC\u03B5\u03BD\u03B1',  // Περιεχόμενα
  'ha': 'Teburin Abubuwa',
  'hu': 'Tartalomjegyz\u00E9k',  // é
  'is': 'Efnisyfirlit',
  'ig': 'Ndep\u1EE5ta Isiokwu',  // ụ
  'ki': 'Orodha ya Maudhui',
  'lt': 'Turinys',
  'lg': 'Ennyiriza',
  'lv': 'Saturs',
  'mk': '\u0421\u043E\u0434\u0440\u0436\u0438\u043D\u0430',  // Содржина
  'mg': 'Tafiditra',
  'ms': 'Jadual Kandungan',
  'no': 'Innhold',
  'pl': 'Spis Tre\u015Bci',  // ś
  'pt': 'Sum\u00E1rio',  // á
  'rn': 'Orodha ya Maudhui',
  'rw': 'Orodha ya Maudhui',
  'sl': 'Kazalo',
  'sk': 'Obsah',
  'sn': 'Mazita ezvinyorwa',
  'sr': 'Sadr\u017Eaj',  // ž
  'st': 'Tafole ea Likahare',
  'sv': 'Inneh\u00E5llsf\u00F6rteckning',  // å, ö
  'tn': 'Tafole ya Dikahare',
  'tr': '\u0130\u00E7indekiler',  // İ, ç
  'xh': 'Uluhlu Lweziqulatho',  // isiXhosa: Table of Contents
  'yo': 'At\u1ECDka',  // ọ
  'vi': 'M\u1EE5c L\u1EE5c',  // ụ, ụ
  'zu': 'Isiqephu',
  
  // Missing Indic Languages
  'bn': '\u09AC\u09BF\u09B7\u09AF\u09BC \u09A4\u09BE\u09B2\u09BF\u0995\u09BE',  // বিষয় তালিকা
  'gu': '\u0AB5\u0ABF\u0AB7\u0AAF \u0AAF\u0ABE\u0AA6\u0AC0',  // વિષય યાદી
  'te': '\u0C35\u0C3F\u0C37\u0C2F \u0C38\u0C42\u0C1A\u0C3F',  // విషయ సూచి
  'kn': '\u0CB5\u0CBF\u0CB7\u0CAF \u0CB8\u0CC2\u0C9A\u0CBF',  // ವಿಷಯ ಸೂಚಿ
  'ml': '\u0D35\u0D3F\u0D37\u0D2F \u0D38\u0D42\u0D1A\u0D3F\u0D15',  // വിഷയ സൂചിക
  'pa': '\u0A35\u0A3F\u0A38\u0A3C\u0A47 \u0A26\u0A40 \u0A38\u0A42\u0A1A\u0A40',  // ਵਿਸ਼ੇ ਦੀ ਸੂਚੀ
  'or': '\u0B2C\u0B3F\u0B37\u0B2F \u0B24\u0B3E\u0B32\u0B3F\u0B15\u0B3E',  // ବିଷୟ ତାଲିକା
  
  // Missing African Languages  
  'sw': 'Jedwali la Yaliyomo',
  
  // Missing Asian Language
  'tl': 'Talaan ng mga Nilalaman'
};

/**
 * Get the translated TOC title for a given language
 * @param {string} language - Language code (e.g., 'en', 'es', 'fr')
 * @returns {string} - Translated TOC title
 */
function getTocTitle(language) {
  // Normalize language code (take first part if it contains a dash)
  const langCode = language ? language.split('-')[0].toLowerCase() : 'en';
  
  // Debug logging
  console.log(`[TOC TRANSLATION] Requested language: "${language}", normalized: "${langCode}"`);
  console.log(`[TOC TRANSLATION] Available translations:`, Object.keys(tocTranslations));
  console.log(`[TOC TRANSLATION] Translation found: "${tocTranslations[langCode] || tocTranslations['en']}"`);
  
  // Return translation if available, otherwise fallback to English
  return tocTranslations[langCode] || tocTranslations['en'];
}

module.exports = { getTocTitle };
