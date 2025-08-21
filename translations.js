// Translation utility for backend TOC titles
const tocTranslations = {
  'en': 'Table of Contents',
  'es': 'Tabla de Contenidos',
  'fr': 'Table des Matières',
  'de': 'Inhaltsverzeichnis',
  'it': 'Indice',
  'id': 'Daftar Isi',
  'ru': 'Содержание',
  'ro': 'Cuprins',
  'hi': 'विषय सूची',
  'ar': 'جدول المحتويات',
  'he': 'תוכן עניינים',
  'yi': 'אינהאַלט',
  'ta': 'பொருளடக்கம்',
  'af': 'Inhoudsopgawe',
  'sq': 'Tabela e Përmbajtjes',
  'bs': 'Sadržaj',
  'ca': 'Taula de Continguts',
  'hr': 'Sadržaj',
  'cs': 'Obsah',
  'da': 'Indhold',
  'nl': 'Inhoudsopgave',
  'et': 'Sisukord',
  'fi': 'Sisällysluettelo',
  'gl': 'Índice',
  'el': 'Περιεχόμενα',
  'ha': 'Teburin Abubuwa',
  'hu': 'Tartalomjegyzék',
  'is': 'Efnisyfirlit',
  'ig': 'Ndepụta Isiokwu',
  'ki': 'Orodha ya Maudhui',
  'lt': 'Turinys',
  'lg': 'Ennyiriza',
  'lv': 'Saturs',
  'mk': 'Содржина',
  'mg': 'Tafiditra',
  'ms': 'Jadual Kandungan',
  'no': 'Innhold',
  'pl': 'Spis Treści',
  'pt': 'Sumário',
  'rn': 'Orodha ya Maudhui',
  'rw': 'Orodha ya Maudhui',
  'sl': 'Kazalo',
  'sk': 'Obsah',
  'sn': 'Mazita ezvinyorwa',
  'sr': 'Sadržaj',
  'st': 'Tafole ea Likahare',
  'sv': 'Innehållsförteckning',
  'tn': 'Tafole ya Dikahare',
  'tr': 'İçindekiler',
  'xh': 'Iindeksa',
  'yo': 'Atọka',
  'vi': 'Mục Lục',
  'zu': 'Isiqephu'
};

/**
 * Get the translated TOC title for a given language
 * @param {string} language - Language code (e.g., 'en', 'es', 'fr')
 * @returns {string} - Translated TOC title
 */
function getTocTitle(language) {
  // Normalize language code (take first part if it contains a dash)
  const langCode = language ? language.split('-')[0].toLowerCase() : 'en';
  
  // Return translation if available, otherwise fallback to English
  return tocTranslations[langCode] || tocTranslations['en'];
}

module.exports = { getTocTitle };
