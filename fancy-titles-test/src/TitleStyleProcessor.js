/**
 * TitleStyleProcessor - Clean Version Without Template Literal Conflicts
 * 
 * This fixes the SyntaxError by avoiding JavaScript template literals (backticks) 
 * which conflict with markdown code fences in LaTeX generation.
 */

class TitleStyleProcessor {
  constructor(options = {}) {
    this.userLanguage = options.userLanguage || 'en';
    this.dropCapStyle = options.dropCapStyle || 'traditional';
    
    // Only 6 languages support drop caps for cultural appropriateness
    this.dropCapSupportedLanguages = new Set(['en', 'fr', 'it', 'es', 'pt', 'de']);
    
    // 8 publisher-inspired title styles
    this.titleStyles = [
      'classic_literature',    // Penguin Classics inspired
      'modern_minimalist',     // Apple/Design books
      'academic_press',        // University Press
      'classical_ornate',      // Norton Classics
      'technical_programming', // O'Reilly
      'magazine_style',        // Wired/National Geographic
      'luxury_fashion',        // High-end books
      'standard'               // Improved LaTeX default
    ];

    // Color schemes for different styles
    this.colorSchemes = {
      classic_literature: { primary: '#2C3E50', accent: '#E74C3C' },
      modern_minimalist: { primary: '#34495E', accent: '#95A5A6' },
      academic_press: { primary: '#1B4F72', accent: '#5DADE2' },
      classical_ornate: { primary: '#7D3C98', accent: '#BB8FCE' },
      technical_programming: { primary: '#117A65', accent: '#52C4B0' },
      magazine_style: { primary: '#D35400', accent: '#F39C12' },
      luxury_fashion: { primary: '#8B4513', accent: '#DAA520' },
      standard: { primary: '#2C3E50', accent: '#3498DB' }
    };

    console.log("[TITLE PROCESSOR] Initialized for language: " + this.userLanguage + ", Drop caps enabled: " + this.isDropCapSupported());
  }

  isDropCapSupported() {
    return this.dropCapSupportedLanguages.has(this.userLanguage);
  }

  processChapterContent(content, titleStyle = 'classic_literature') {
    if (!content || content.length === 0) return content;
    
    console.log("[TITLE PROCESSOR] Processing content with style: " + titleStyle + ", language: " + this.userLanguage);
    
    const chapterPattern = /^(#+)\s+(.+)$/gm;
    let chapterNumber = 1;
    
    content = content.replace(chapterPattern, (match, hashes, titleText) => {
      if (hashes.length === 1) {
        const styledHeader = this.generateStyledHeader(titleText.trim(), chapterNumber, titleStyle);
        chapterNumber++;
        return styledHeader;
      }
      return match;
    });

    if (this.isDropCapSupported()) {
      content = this.applyDropCaps(content, this.dropCapStyle);
    }

    return content;
  }

  generateStyledHeader(titleText, chapterNumber, styleName) {
    const colors = this.colorSchemes[styleName] || this.colorSchemes.standard;

    switch (styleName) {
      case 'classic_literature':
        return this.generateClassicLiteratureHeader(titleText, chapterNumber, colors);
      case 'modern_minimalist':
        return this.generateModernMinimalistHeader(titleText, chapterNumber, colors);
      case 'academic_press':
        return this.generateAcademicPressHeader(titleText, chapterNumber, colors);
      case 'classical_ornate':
        return this.generateClassicalOrnateHeader(titleText, chapterNumber, colors);
      case 'technical_programming':
        return this.generateTechnicalProgrammingHeader(titleText, chapterNumber, colors);
      case 'magazine_style':
        return this.generateMagazineStyleHeader(titleText, chapterNumber, colors);
      case 'luxury_fashion':
        return this.generateLuxuryFashionHeader(titleText, chapterNumber, colors);
      case 'standard':
      default:
        return this.generateStandardHeader(titleText, chapterNumber, colors);
    }
  }

  getFontConfiguration() {
    return {
      main: 'Liberation Serif',
      sans: 'Liberation Sans',
      mono: 'Liberation Mono',
      serif: 'TeX Gyre Termes',
      title: 'TeX Gyre Heros'
    };
  }

  toRomanNumeral(num) {
    const romanNumerals = [['XL', 40], ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]];
    let result = '';
    for (const [numeral, value] of romanNumerals) {
      while (num >= value) {
        result += numeral;
        num -= value;
      }
    }
    return result;
  }

  // SAFE METHOD: Generate LaTeX without template literals
  wrapLatex(content) {
    return '```{=latex}\n' + content + '\n```\n\n';
  }

  // All title generation methods use safe string concatenation
  generateClassicLiteratureHeader(titleText, chapterNumber, colors) {
    const latex = [
      '\\vspace{2em}',
      '\\begin{center}',
      '  \\titlefont',
      '  \\textcolor[HTML]{' + colors.primary.replace('#', '') + '}{\\rule{0.3\\textwidth}{0.4pt}}',
      '  \\\\[0.5em]',
      '  {\\Large\\scshape Chapter ' + chapterNumber + '}',
      '  \\\\[0.3em]',
      '  {\\huge\\textbf{' + titleText + '}}',
      '  \\\\[0.5em]',
      '  \\textcolor[HTML]{' + colors.primary.replace('#', '') + '}{\\rule{0.3\\textwidth}{0.4pt}}',
      '\\end{center}',
      '\\vspace{2em}'
    ].join('\n');
    return this.wrapLatex(latex);
  }

  generateModernMinimalistHeader(titleText, chapterNumber, colors) {
    const latex = [
      '\\vspace{2em}',
      '\\begin{center}',
      '  \\sffamily',
      '  {\\fontsize{120}{120}\\selectfont\\textcolor{lightgray}{' + chapterNumber + '}}',
      '  \\\\[-2em]',
      '  {\\Huge\\bfseries\\textcolor[HTML]{' + colors.primary.replace('#', '') + '}{' + titleText + '}}',
      '\\end{center}',
      '\\vspace{2em}'
    ].join('\n');
    return this.wrapLatex(latex);
  }

  generateAcademicPressHeader(titleText, chapterNumber, colors) {
    const latex = [
      '\\vspace{2em}',
      '\\noindent\\textcolor[HTML]{' + colors.primary.replace('#', '') + '}{\\rule{\\textwidth}{1pt}}',
      '\\\\[0.5em]',
      '\\begin{center}',
      '  \\titlefont',
      '  {\\large\\scshape Chapter ' + chapterNumber + '}',
      '  \\\\[0.3em]',
      '  {\\Large\\bfseries ' + titleText + '}',
      '\\end{center}',
      '\\\\[0.5em]',
      '\\noindent\\textcolor[HTML]{' + colors.primary.replace('#', '') + '}{\\rule{\\textwidth}{1pt}}',
      '\\vspace{2em}'
    ].join('\n');
    return this.wrapLatex(latex);
  }

  generateClassicalOrnateHeader(titleText, chapterNumber, colors) {
    const romanNumeral = this.toRomanNumeral(chapterNumber);
    const latex = [
      '\\vspace{2em}',
      '\\begin{center}',
      '  \\titlefont',
      '  {\\large ❦ ❦ ❦}',
      '  \\\\[0.5em]',
      '  {\\Large\\scshape Chapter ' + romanNumeral + '}',
      '  \\\\[0.3em]',
      '  {\\huge\\textit{' + titleText + '}}',
      '  \\\\[0.5em]',
      '  {\\large ❦ ❦ ❦}',
      '\\end{center}',
      '\\vspace{2em}'
    ].join('\n');
    return this.wrapLatex(latex);
  }

  generateTechnicalProgrammingHeader(titleText, chapterNumber, colors) {
    const latex = [
      '\\vspace{1em}',
      '\\noindent\\colorbox[HTML]{' + colors.accent.replace('#', '') + '}{%',
      '  \\parbox{\\textwidth}{%',
      '    \\vspace{0.5em}',
      '    \\centering\\sffamily\\color{white}',
      '    {\\large\\bfseries Chapter ' + chapterNumber + '}',
      '    \\\\[0.3em]',
      '    {\\Large\\bfseries ' + titleText + '}',
      '    \\vspace{0.5em}',
      '  }%',
      '}',
      '\\vspace{1em}'
    ].join('\n');
    return this.wrapLatex(latex);
  }

  generateMagazineStyleHeader(titleText, chapterNumber, colors) {
    const latex = [
      '\\vspace{2em}',
      '\\begin{flushleft}',
      '  \\sffamily',
      '  {\\fontsize{72}{72}\\selectfont\\bfseries\\textcolor[HTML]{' + colors.accent.replace('#', '') + '}{' + chapterNumber + '}}',
      '  \\\\[-1em]',
      '  {\\Huge\\bfseries\\textcolor[HTML]{' + colors.primary.replace('#', '') + '}{' + titleText.toUpperCase() + '}}',
      '\\end{flushleft}',
      '\\vspace{2em}'
    ].join('\n');
    return this.wrapLatex(latex);
  }

  generateLuxuryFashionHeader(titleText, chapterNumber, colors) {
    const latex = [
      '\\vspace{3em}',
      '\\begin{center}',
      '  \\titlefont',
      '  {\\color[HTML]{B8860B}\\large ◊ ◊ ◊ ◊ ◊}',
      '  \\\\[1em]',
      '  {\\Large\\scshape\\textcolor[HTML]{' + colors.primary.replace('#', '') + '}{Chapter ' + chapterNumber + '}}',
      '  \\\\[0.5em]',
      '  {\\huge\\textit{\\textcolor[HTML]{' + colors.primary.replace('#', '') + '}{' + titleText + '}}}',
      '  \\\\[1em]',
      '  {\\color[HTML]{B8860B}\\large ◊ ◊ ◊ ◊ ◊}',
      '\\end{center}',
      '\\vspace{3em}'
    ].join('\n');
    return this.wrapLatex(latex);
  }

  generateStandardHeader(titleText, chapterNumber, colors) {
    const latex = [
      '\\vspace{2em}',
      '\\begin{center}',
      '  \\titlefont',
      '  {\\Large Chapter ' + chapterNumber + '}',
      '  \\\\[0.5em]',
      '  {\\huge\\bfseries ' + titleText + '}',
      '\\end{center}',
      '\\vspace{2em}'
    ].join('\n');
    return this.wrapLatex(latex);
  }

  applyDropCaps(content, dropCapStyle = 'traditional') {
    if (!this.isDropCapSupported()) {
      console.log("[TITLE PROCESSOR] Drop caps disabled for language: " + this.userLanguage);
      return content;
    }

    // Simple drop cap application - find paragraphs after LaTeX headers
    const latexPattern = /```\{=latex\}[\s\S]*?```/g;
    const sections = content.split(latexPattern);
    const headers = content.match(latexPattern) || [];
    
    let result = sections[0];
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      const paragraphs = section.split('\n\n').filter(p => p.trim().length > 50);
      
      if (paragraphs.length > 0) {
        const firstPara = paragraphs[0].trim();
        const dropCapPara = this.generateDropCap(firstPara, dropCapStyle);
        const modifiedSection = section.replace(firstPara, dropCapPara);
        result += headers[i-1] + modifiedSection;
      } else {
        result += headers[i-1] + section;
      }
    }

    return result;
  }

  // CORRECTED VERSION: Drop cap without template literals
  generateDropCap(paragraph, style = 'traditional') {
    if (!paragraph || paragraph.length === 0) return paragraph;
    
    const firstChar = paragraph.charAt(0);
    const rest = paragraph.substring(1);
    
    let latexContent = '';
    switch (style) {
      case 'traditional':
        latexContent = '\\lettrine{' + firstChar + '}{' + rest.substring(0, 3) + '}' + rest.substring(3);
        break;
      case 'raised':
        latexContent = '\\lettrine[nindent=0pt,slope=0pt]{' + firstChar + '}{' + rest.substring(0, 3) + '}' + rest.substring(3);
        break;
      case 'decorated':
        latexContent = '\\lettrine[nindent=0pt,findent=2pt]{\\fbox{' + firstChar + '}}{' + rest.substring(0, 3) + '}' + rest.substring(3);
        break;
      default:
        return paragraph;
    }
    
    return this.wrapLatex(latexContent);
  }

  generateStylePreamble(styleName, fontConfig) {
    const basePackages = [
      '\\usepackage{xcolor}',
      '\\usepackage{graphicx}',
      '\\usepackage{geometry}',
      '\\usepackage[sf,sl]{titlesec}'
    ];

    const dropCapPackages = this.isDropCapSupported() ? ['\\usepackage{lettrine}'] : [];
    
    const fontCommands = [
      '\\setmainfont{' + fontConfig.main + '}[',
      '  BoldFont = * Bold,',
      '  ItalicFont = * Italic,',
      '  BoldItalicFont = * Bold Italic',
      ']',
      '\\setsansfont{' + fontConfig.sans + '}',
      '\\setmonofont{' + fontConfig.mono + '}',
      '\\newfontfamily\\titlefont{' + fontConfig.title + '}'
    ];

    return [...basePackages, ...dropCapPackages, '% Font Configuration', ...fontCommands, '% Style: ' + styleName].join('\n');
  }

  getAvailableStyles() {
    return [...this.titleStyles];
  }

  getStyleInfo(styleName) {
    const colors = this.colorSchemes[styleName] || this.colorSchemes.standard;
    const descriptions = {
      classic_literature: 'Penguin Classics inspired - elegant rules and traditional typography',
      modern_minimalist: 'Apple/Design books inspired - large background numbers, clean sans-serif',
      academic_press: 'University Press inspired - horizontal rules, professional appearance',
      classical_ornate: 'Norton Classics inspired - decorative elements, Roman numerals',
      technical_programming: 'O\'Reilly inspired - colored boxes, technical appearance',
      magazine_style: 'Wired/National Geographic inspired - dynamic layout, bold typography',
      luxury_fashion: 'High-end books inspired - ornate decorations, premium feel',
      standard: 'Improved LaTeX default - clean and reliable'
    };

    return {
      name: styleName,
      description: descriptions[styleName] || 'Unknown style',
      colors: colors,
      dropCapsSupported: this.isDropCapSupported(),
      language: this.userLanguage
    };
  }

  /**
   * Get human-readable language name from language code
   * @param {string} languageCode - ISO language code (e.g., 'en', 'fr')
   * @returns {string} Human-readable language name
   */
  getLanguageName(languageCode) {
    const languageNames = {
      'en': 'English',
      'fr': 'French', 
      'it': 'Italian',
      'es': 'Spanish',
      'pt': 'Portuguese',
      'de': 'German',
      'zh': 'Chinese',
      'ja': 'Japanese',
      'ko': 'Korean',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'bn': 'Bengali',
      'ru': 'Russian',
      'th': 'Thai',
      'vi': 'Vietnamese',
      'tr': 'Turkish',
      'pl': 'Polish',
      'nl': 'Dutch',
      'sv': 'Swedish',
      'da': 'Danish',
      'no': 'Norwegian',
      'fi': 'Finnish',
      'cs': 'Czech',
      'hu': 'Hungarian',
      'ro': 'Romanian',
      'bg': 'Bulgarian',
      'hr': 'Croatian',
      'sk': 'Slovak',
      'sl': 'Slovenian',
      'et': 'Estonian',
      'lv': 'Latvian',
      'lt': 'Lithuanian',
      'el': 'Greek',
      'he': 'Hebrew',
      'fa': 'Persian',
      'ur': 'Urdu',
      'ta': 'Tamil',
      'te': 'Telugu',
      'gu': 'Gujarati',
      'kn': 'Kannada',
      'ml': 'Malayalam',
      'pa': 'Punjabi',
      'or': 'Odia',
      'mr': 'Marathi',
      'as': 'Assamese'
    };

    return languageNames[languageCode] || languageCode.toUpperCase();
  }

  /**
   * Convert markdown headers to styled chapter titles
   * This is used by the test system to generate sample documents
   * @param {string} markdown - Markdown content with headers
   * @param {string} titleStyle - Title style to apply
   * @returns {string} Processed markdown with styled headers
   */
  convertMarkdownHeaders(markdown, titleStyle = 'classic_literature') {
    if (!markdown || markdown.length === 0) {
      return markdown;
    }

    console.log("[TITLE PROCESSOR] Converting markdown headers with style: " + titleStyle);
    
    // Use the existing processChapterContent method which handles header conversion
    return this.processChapterContent(markdown, titleStyle);
  }
}

module.exports = { TitleStyleProcessor };