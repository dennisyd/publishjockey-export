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
  },
  hi: {
    front: [
      "शीर्षक पृष्ठ",
      "कॉपीराइट",
      "समर्पण",
      "आभार",
      "प्रस्तावना",
      "परिचय"
    ],
    main: ["अध्याय 1", "अध्याय 2", "अध्याय 3"],
    back: ["लेखक के बारे में", "परिशिष्ट", "संदर्भ", "ग्रंथसूची", "सूची", "शब्दकोश"]
  },
  is: {
    front: [
      "Titilsíða",
      "Höfundarréttur",
      "Tilefni",
      "Þakkir",
      "Formáli",
      "Inngangur"
    ],
    main: ["Kafli 1", "Kafli 2", "Kafli 3"],
    back: ["Um höfundinn", "Viðauki", "Tilvísanir", "Heimildaskrá", "Yfirlit", "Orðaskýringar"]
  },
  hr: {
    front: [
      "Naslovnica",
      "Autorska prava",
      "Posveta",
      "Zahvale",
      "Predgovor",
      "Uvod"
    ],
    main: ["Poglavlje 1", "Poglavlje 2", "Poglavlje 3"],
    back: ["O autoru", "Dodatak", "Reference", "Bibliografija", "Kazalo", "Rječnik"]
  },
  pt: {
    front: [
      "Página de título",
      "Direitos autorais",
      "Dedicatória",
      "Agradecimentos",
      "Prefácio",
      "Introdução"
    ],
    main: ["Capítulo 1", "Capítulo 2", "Capítulo 3"],
    back: ["Sobre o autor", "Apêndice", "Referências", "Bibliografia", "Índice", "Glossário"]
  },
  pl: {
    front: [
      "Strona tytułowa",
      "Prawa autorskie",
      "Dedykacja",
      "Podziękowania",
      "Przedmowa",
      "Wprowadzenie"
    ],
    main: ["Rozdział 1", "Rozdział 2", "Rozdział 3"],
    back: ["O autorze", "Dodatek", "Bibliografia", "Indeks", "Słownik"]
  },
  nl: {
    front: [
      "Titelpagina",
      "Auteursrechten",
      "Opdracht",
      "Dankwoord",
      "Voorwoord",
      "Inleiding"
    ],
    main: ["Hoofdstuk 1", "Hoofdstuk 2", "Hoofdstuk 3"],
    back: ["Over de auteur", "Bijlage", "Referenties", "Bibliografie", "Index", "Woordenlijst"]
  },
  sv: {
    front: [
      "Titelsida",
      "Upphovsrätt",
      "Dedikation",
      "Tack",
      "Förord",
      "Inledning"
    ],
    main: ["Kapitel 1", "Kapitel 2", "Kapitel 3"],
    back: ["Om författaren", "Bilaga", "Referenser", "Bibliografi", "Index", "Ordlista"]
  },
  da: {
    front: [
      "Titelblad",
      "Ophavsret",
      "Dedikation",
      "Tak",
      "Forord",
      "Indledning"
    ],
    main: ["Kapitel 1", "Kapitel 2", "Kapitel 3"],
    back: ["Om forfatteren", "Bilag", "Referencer", "Bibliografi", "Indeks", "Ordliste"]
  },
  no: {
    front: [
      "Tittelside",
      "Opphavsrett",
      "Dedikasjon",
      "Takk",
      "Forord",
      "Innledning"
    ],
    main: ["Kapittel 1", "Kapittel 2", "Kapittel 3"],
    back: ["Om forfatteren", "Vedlegg", "Referanser", "Bibliografi", "Indeks", "Ordliste"]
  },
  fi: {
    front: [
      "Otsikkosivu",
      "Tekijänoikeudet",
      "Omistuskirjoitus",
      "Kiitokset",
      "Esipuhe",
      "Johdanto"
    ],
    main: ["Luku 1", "Luku 2", "Luku 3"],
    back: ["Kirjoittajasta", "Liite", "Viitteet", "Bibliografia", "Hakemisto", "Sanasto"]
  },
  cs: {
    front: [
      "Titulní stránka",
      "Autorská práva",
      "Věnování",
      "Poděkování",
      "Předmluva",
      "Úvod"
    ],
    main: ["Kapitola 1", "Kapitola 2", "Kapitola 3"],
    back: ["O autorovi", "Příloha", "Reference", "Bibliografie", "Rejstřík", "Slovník"]
  },
  sk: {
    front: [
      "Titulná strana",
      "Autorské práva",
      "Venovanie",
      "Poďakovanie",
      "Predslov",
      "Úvod"
    ],
    main: ["Kapitola 1", "Kapitola 2", "Kapitola 3"],
    back: ["O autorovi", "Príloha", "Referencie", "Bibliografia", "Register", "Slovník"]
  },
  hu: {
    front: [
      "Címlap",
      "Szerzői jogok",
      "Ajánlás",
      "Köszönetnyilvánítás",
      "Előszó",
      "Bevezetés"
    ],
    main: ["Fejezet 1", "Fejezet 2", "Fejezet 3"],
    back: ["A szerzőről", "Függelék", "Hivatkozások", "Bibliográfia", "Tárgymutató", "Szótár"]
  },
  tr: {
    front: [
      "Başlık sayfası",
      "Telif hakkı",
      "İthaf",
      "Teşekkürler",
      "Önsöz",
      "Giriş"
    ],
    main: ["Bölüm 1", "Bölüm 2", "Bölüm 3"],
    back: ["Yazar hakkında", "Ek", "Kaynaklar", "Bibliyografya", "Dizin", "Sözlük"]
  },
  el: {
    front: [
      "Σελίδα τίτλου",
      "Πνευματικά δικαιώματα",
      "Αφιέρωση",
      "Ευχαριστίες",
      "Πρόλογος",
      "Εισαγωγή"
    ],
    main: ["Κεφάλαιο 1", "Κεφάλαιο 2", "Κεφάλαιο 3"],
    back: ["Σχετικά με τον συγγραφέα", "Παράρτημα", "Βιβλιογραφία", "Ευρετήριο", "Γλωσσάρι"]
  },
  et: {
    front: [
      "Pealkirjaleht",
      "Autoriõigused",
      "Pühendus",
      "Tänud",
      "Eessõna",
      "Sissejuhatus"
    ],
    main: ["Peatükk 1", "Peatükk 2", "Peatükk 3"],
    back: ["Autori kohta", "Lisa", "Viited", "Bibliograafia", "Indeks", "Sõnastik"]
  },
  gl: {
    front: [
      "Páxina de título",
      "Dereitos de autor",
      "Dedicatoria",
      "Agradecementos",
      "Prólogo",
      "Introdución"
    ],
    main: ["Capítulo 1", "Capítulo 2", "Capítulo 3"],
    back: ["Sobre o autor", "Apéndice", "Referencias", "Bibliografía", "Índice", "Glosario"]
  },
  lv: {
    front: [
      "Virsraksta lapa",
      "Autortiesības",
      "Veltījums",
      "Pateicības",
      "Ievads",
      "Ievads"
    ],
    main: ["Nodaļa 1", "Nodaļa 2", "Nodaļa 3"],
    back: ["Par autoru", "Pielikums", "Atsauces", "Bibliogrāfija", "Rādītājs", "Vārdnīca"]
  },
  lt: {
    front: [
      "Antraštės puslapis",
      "Autorių teisės",
      "Paskyrimas",
      "Padėkos",
      "Pratarmė",
      "Įvadas"
    ],
    main: ["Skyrius 1", "Skyrius 2", "Skyrius 3"],
    back: ["Apie autorių", "Priedas", "Nuorodos", "Bibliografija", "Rodyklė", "Žodynėlis"]
  },
  mk: {
    front: [
      "Страница на наслов",
      "Авторски права",
      "Посвета",
      "Благодарности",
      "Предговор",
      "Вовед"
    ],
    main: ["Поглавје 1", "Поглавје 2", "Поглавје 3"],
    back: ["За авторот", "Додаток", "Референци", "Библиографија", "Индекс", "Речник"]
  },
  sr: {
    front: [
      "Страница наслова",
      "Ауторска права",
      "Посвета",
      "Захвалности",
      "Предговор",
      "Увод"
    ],
    main: ["Поглавље 1", "Поглавље 2", "Поглавље 3"],
    back: ["О аутору", "Додатак", "Референце", "Библиографија", "Индекс", "Речник"]
  },
  sl: {
    front: [
      "Naslovna stran",
      "Avtorske pravice",
      "Posvetilo",
      "Zahvala",
      "Predgovor",
      "Uvod"
    ],
    main: ["Poglavje 1", "Poglavje 2", "Poglavje 3"],
    back: ["O avtorju", "Dodatek", "Reference", "Bibliografija", "Kazalo", "Slovar"]
  },
  vi: {
    front: [
      "Trang tiêu đề",
      "Bản quyền",
      "Lời đề tặng",
      "Lời cảm ơn",
      "Lời tựa",
      "Giới thiệu"
    ],
    main: ["Chương 1", "Chương 2", "Chương 3"],
    back: ["Về tác giả", "Phụ lục", "Tài liệu tham khảo", "Thư mục", "Mục lục", "Từ điển"]
  },
  id: {
    front: [
      "Halaman judul",
      "Hak cipta",
      "Persembahan",
      "Ucapan terima kasih",
      "Kata pengantar",
      "Pendahuluan"
    ],
    main: ["Bab 1", "Bab 2", "Bab 3"],
    back: ["Tentang penulis", "Lampiran", "Referensi", "Bibliografi", "Indeks", "Glosarium"]
  },
  ms: {
    front: [
      "Halaman judul",
      "Hak cipta",
      "Dedikasi",
      "Penghargaan",
      "Kata pengantar",
      "Pengenalan"
    ],
    main: ["Bab 1", "Bab 2", "Bab 3"],
    back: ["Tentang penulis", "Lampiran", "Rujukan", "Bibliografi", "Indeks", "Glosari"]
  },
  tl: {
    front: [
      "Pahina ng pamagat",
      "Karapatang-ari",
      "Pag-aalay",
      "Pasasalamat",
      "Paunang salita",
      "Panimula"
    ],
    main: ["Kabanata 1", "Kabanata 2", "Kabanata 3"],
    back: ["Tungkol sa may-akda", "Apéndise", "Mga sanggunian", "Bibliyograpiya", "Indeks", "Talahulugan"]
  },
  ha: {
    front: [
      "Shafi na Take",
      "Hakkin Mallaka",
      "Sadaukarwa",
      "Godiya",
      "Gabatarwa",
      "Gabatarwa"
    ],
    main: ["Babbi 1", "Babbi 2", "Babbi 3"],
    back: ["Game da marubuci", "Ƙari", "Nassoshi", "Littattafai", "Fihirisa", "Kamus"]
  },
  ig: {
    front: [
      "Ihu Akwụkwọ",
      "Ikike Nke Onye Odee",
      "Nraranye",
      "Ekele",
      "Okwu Mmalite",
      "Okwu Mmalite"
    ],
    main: ["Isi 1", "Isi 2", "Isi 3"],
    back: ["Banyere onye odee", "Ihe mgbakwunye", "Ntụaka", "Akụkọ ihe mere eme", "Ndepụta", "Ọkọwa okwu"]
  },
  ki: {
    front: [
      "Ũrũa wa Mũtĩ",
      "Ũtonga wa Mũtĩ",
      "Gĩtĩo",
      "Ũtugi",
      "Ũtonga wa Mbere",
      "Ũtonga wa Mbere"
    ],
    main: ["Gĩcigo 1", "Gĩcigo 2", "Gĩcigo 3"],
    back: ["Kũhũthĩra mũtĩ", "Gĩtĩo", "Mĩhĩrĩga", "Thomo cia mũtĩ", "Kĩrĩndĩro", "Kĩama"]
  },
  rw: {
    front: [
      "Urupapuro rw'Umutekano",
      "Uburenganzira bw'Umwanditsi",
      "Guharanira",
      "Urakoze",
      "Intangiriro",
      "Intangiriro"
    ],
    main: ["Umutekano 1", "Umutekano 2", "Umutekano 3"],
    back: ["Ibyerekeye umwanditsi", "Inyongera", "Inyandiko", "Ibuku", "Urutonde", "Inkoranyamagambo"]
  },
  rn: {
    front: [
      "Urupapuro rw'Umutekano",
      "Uburenganzira bw'Umwanditsi",
      "Guharanira",
      "Urakoze",
      "Intangiriro",
      "Intangiriro"
    ],
    main: ["Umutekano 1", "Umutekano 2", "Umutekano 3"],
    back: ["Ibyerekeye umwanditsi", "Inyongera", "Inyandiko", "Ibuku", "Urutonde", "Inkoranyamagambo"]
  },
  lg: {
    front: [
      "Olupapula lw'Ekifo",
      "Obuyinza bw'Omuwandiisi",
      "Okusasula",
      "Okwebaza",
      "Entandikwa",
      "Entandikwa"
    ],
    main: ["Ekisenge 1", "Ekisenge 2", "Ekisenge 3"],
    back: ["Ebikwata ku muwandiisi", "Ekiwandiiko eky'okugatta", "Ebiragiro", "Ebitabo", "Ennukuta", "Ekikula"]
  },
  mg: {
    front: [
      "Pejy Fiadidiana",
      "Zo Lalan'ny Mpanoratra",
      "Fanolorana",
      "Fisaorana",
      "Teny Aloha",
      "Fampidirana"
    ],
    main: ["Toko 1", "Toko 2", "Toko 3"],
    back: ["Momba ny mpanoratra", "Ampidirina", "Fanondroana", "Bibliografia", "Index", "Rakibolana"]
  },
  sn: {
    front: [
      "Peji reZita",
      "Kodzero dzeMunyori",
      "Kuzvipira",
      "Kutenda",
      "Shoko reKutanga",
      "Sumo"
    ],
    main: ["Chitsauko 1", "Chitsauko 2", "Chitsauko 3"],
    back: ["Nezve munyori", "Wedzero", "Mareferensi", "Bhuku reMabhuku", "Indekisi", "Duramazwi"]
  },
  st: {
    front: [
      "Leqheka laSehlooho",
      "Litokelo tsa Mongoli",
      "Tlhokomelo",
      "Leboha",
      "Polelo ea Pele",
      "Tlhaloso"
    ],
    main: ["Khaolo 1", "Khaolo 2", "Khaolo 3"],
    back: ["Ka mongoli", "Kopano", "Litšupiso", "Buka ea libuka", "Tafole ea likarolo", "Buka ea mantsoe"]
  },
  sw: {
    front: [
      "Ukurasa wa Jina",
      "Haki za Mwandishi",
      "Kujitolea",
      "Shukrani",
      "Maneno ya Utangulizi",
      "Utangulizi"
    ],
    main: ["Sura 1", "Sura 2", "Sura 3"],
    back: ["Kuhusu mwandishi", "Kiambatisho", "Marejeleo", "Bibliografia", "Fahirisi", "Kamusi"]
  },
  tn: {
    front: [
      "Tsebe ya Thaetlele",
      "Ditshwanelo tsa Mongwadi",
      "Go Ithopela",
      "Go Leboga",
      "Lefoko la Pele",
      "Tlhaloso"
    ],
    main: ["Kgaolo 1", "Kgaolo 2", "Kgaolo 3"],
    back: ["Ka ga mongwadi", "Tlatsetso", "Ditlhabololo", "Buka ya dibuka", "Tafole ya dikarolo", "Buka ya mafoko"]
  },
  xh: {
    front: [
      "Iphepha leGama",
      "Amalungelo oMbhali",
      "Inikelelo",
      "Enkosi",
      "Intshayelelo",
      "Intshayelelo"
    ],
    main: ["Isahluko 1", "Isahluko 2", "Isahluko 3"],
    back: ["Malunga nombhali", "Inexelo", "Iimbekiselo", "Ibhaliyografi", "Inkqubo", "Idikshinari"]
  },
  yo: {
    front: [
      "Ojú Ìwé Orúkọ",
      "Ọ̀tọ̀ Àwọn Akọ̀wé",
      "Ìfúnni",
      "Ọpẹ́",
      "Ọ̀rọ̀ Ìbẹ̀rẹ̀",
      "Ìfihàn"
    ],
    main: ["Orí 1", "Orí 2", "Orí 3"],
    back: ["Nípa akọ̀wé", "Àfikún", "Ìtọ́ka sí", "Ìwé ìtàn", "Àkójọ", "Àwọn òrò"]
  },
  zu: {
    front: [
      "Ikhasi Lezihloko",
      "Amalungelo Omlobi",
      "Ukuzinikela",
      "Ukubonga",
      "Isandulelo",
      "Isingeniso"
    ],
    main: ["Isahluko 1", "Isahluko 2", "Isahluko 3"],
    back: ["Mayelana nombhali", "Isihlomelo", "Izinkomba", "Ibhalografi", "Inkomba", "Isichazamazwi"]
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
