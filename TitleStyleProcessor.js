/**
 * TitleStyleProcessor - Clean Version Without Template Literal Conflicts
 * 
 * This fixes the SyntaxError by avoiding JavaScript template literals (backticks) 
 * which conflict with markdown code fences in LaTeX generation.
 */

class TitleStyleProcessor {
  constructor(userLanguage = 'en', fontManager = null) {
    this.userLanguage = userLanguage;
    this.dropCapStyle = 'traditional'; // Default, will be overridden in processChapterContent
    this.fontManager = fontManager; // Store the fontManager instance
    
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

  async processChapterContent(content, titleStyle = 'standard', dropCapStyle = 'none') {
    if (!content || content.length === 0) return content;
    
    console.log("[TITLE PROCESSOR] Processing content with style: " + titleStyle + ", language: " + this.userLanguage);
    
    const chapterPattern = /^(#+)\s+(.+)$/gm;
    let chapterNumber = 1;
    let match;
    const replacements = [];
    
    // Collect all matches first
    while ((match = chapterPattern.exec(content)) !== null) {
      const [fullMatch, hashes, titleText] = match;
      if (hashes.length === 1) {
        const styledHeader = await this.generateStyledHeader(titleText.trim(), chapterNumber, titleStyle);
        replacements.push({
          original: fullMatch,
          replacement: styledHeader,
          index: match.index
        });
        chapterNumber++;
      }
    }
    
    // Apply replacements in reverse order to preserve indices
    // REPLACE original header with fancy version but preserve TOC functionality
    let result = content;
    for (let i = replacements.length - 1; i >= 0; i--) {
      const { original, replacement, index } = replacements[i];
      // Extract just the title text for TOC metadata
      const titleText = original.replace(/^#+\s+/, '').trim();
      // Create a fancy replacement that includes TOC metadata
      const fancyWithTOC = replacement + '\n```{=latex}\n\\addcontentsline{toc}{chapter}{' + titleText + '}\n```';
      result = result.slice(0, index) + fancyWithTOC + result.slice(index + original.length);
    }

    if (this.isDropCapSupported() && dropCapStyle !== 'none') {
      result = this.applyDropCaps(result, dropCapStyle);
    }

    return result;
  }

  async generateStyledHeader(titleText, chapterNumber, styleName) {
    const colors = this.colorSchemes[styleName] || this.colorSchemes.standard;

    switch (styleName) {
      case 'classic_literature':
        return await this.generateClassicLiteratureHeader(titleText, chapterNumber, colors, styleName);
      case 'modern_minimalist':
        return await this.generateModernMinimalistHeader(titleText, chapterNumber, colors, styleName);
      case 'academic_press':
        return await this.generateAcademicPressHeader(titleText, chapterNumber, colors, styleName);
      case 'classical_ornate':
        return await this.generateClassicalOrnateHeader(titleText, chapterNumber, colors, styleName);
      case 'technical_programming':
        return await this.generateTechnicalProgrammingHeader(titleText, chapterNumber, colors, styleName);
      case 'magazine_style':
        return await this.generateMagazineStyleHeader(titleText, chapterNumber, colors, styleName);
      case 'luxury_fashion':
        return await this.generateLuxuryFashionHeader(titleText, chapterNumber, colors, styleName);
      case 'standard':
      default:
        return await this.generateStandardHeader(titleText, chapterNumber, colors, styleName);
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

  // SAFE METHOD: Generate LaTeX without template literals and handle titlefont
  async wrapLatex(content, includeTitleFont = false, styleName = 'standard') {
    // Check if content uses \titlefont and replace it with direct font selection
    if (content.includes('\\titlefont')) {
      const fontConfig = await this.fontManager.getFontConfigForStyle(styleName);
      // Replace \titlefont with direct font selection to avoid redefinition conflicts
      const directFontSelection = '\\fontspec{' + fontConfig.title + '}';
      const processedContent = content.replace(/\\titlefont/g, directFontSelection);
      return '```{=latex}\n' + processedContent + '\n```\n\n';
    }
    return '```{=latex}\n' + content + '\n```\n\n';
  }

  // All title generation methods use safe string concatenation
  async generateClassicLiteratureHeader(titleText, chapterNumber, colors, styleName = 'classic_literature') {
    const latex = [
      '\\clearpage',
      '\\vspace{3em}',
      '\\begin{center}',
      '  \\titlefont',
      '  \\textcolor[HTML]{' + colors.primary.replace('#', '') + '}{\\rule{0.3\\textwidth}{0.4pt}}',
      '  \\vspace{0.5em}',
      '  {\\huge\\textbf{' + titleText + '}}',
      '  \\vspace{0.5em}',
      '  \\textcolor[HTML]{' + colors.primary.replace('#', '') + '}{\\rule{0.3\\textwidth}{0.4pt}}',
      '\\end{center}',
      '\\vspace{2em}'
    ].join('\n');
    return await this.wrapLatex(latex, true, styleName);
  }

  async generateModernMinimalistHeader(titleText, chapterNumber, colors, styleName = 'modern_minimalist') {
    const latex = [
      '\\clearpage',
      '\\vspace{3em}',
      '\\begin{center}',
      '  \\sffamily',
      '  {\\Huge\\bfseries\\textcolor[HTML]{' + colors.primary.replace('#', '') + '}{' + titleText + '}}',
      '\\end{center}',
      '\\vspace{2em}'
    ].join('\n');
    return await this.wrapLatex(latex, true, styleName);
  }

  async generateAcademicPressHeader(titleText, chapterNumber, colors, styleName = 'academic_press') {
    const latex = [
      '\\clearpage',
      '\\vspace{3em}',
      '\\noindent\\textcolor[HTML]{' + colors.primary.replace('#', '') + '}{\\rule{\\textwidth}{1pt}}',
      '\\vspace{0.5em}',
      '\\begin{center}',
      '  \\titlefont',
      '  {\\Large\\bfseries ' + titleText + '}',
      '\\end{center}',
      '\\vspace{0.5em}',
      '\\noindent\\textcolor[HTML]{' + colors.primary.replace('#', '') + '}{\\rule{\\textwidth}{1pt}}',
      '\\vspace{2em}'
    ].join('\n');
    return await this.wrapLatex(latex, true, styleName);
  }

  async generateClassicalOrnateHeader(titleText, chapterNumber, colors, styleName = 'classical_ornate') {
    const latex = [
      '\\clearpage',
      '\\vspace{3em}',
      '\\begin{center}',
      '  \\titlefont',
      '  {\\large ❦ ❦ ❦}',
      '  \\vspace{0.5em}',
      '  {\\huge\\textit{' + titleText + '}}',
      '  \\vspace{0.5em}',
      '  {\\large ❦ ❦ ❦}',
      '\\end{center}',
      '\\vspace{2em}'
    ].join('\n');
    return await this.wrapLatex(latex, true, styleName);
  }

  async generateTechnicalProgrammingHeader(titleText, chapterNumber, colors, styleName = 'technical_programming') {
    const latex = [
      '\\clearpage',
      '\\vspace{2em}',
      '\\noindent\\colorbox[HTML]{' + colors.accent.replace('#', '') + '}{%',
      '  \\parbox{\\textwidth}{%',
      '    \\vspace{0.5em}',
      '    \\centering\\sffamily\\color{white}',
      '    {\\Large\\bfseries ' + titleText + '}',
      '    \\vspace{0.5em}',
      '  }%',
      '}',
      '\\vspace{1em}'
    ].join('\n');
    return await this.wrapLatex(latex, true, styleName);
  }

  async generateMagazineStyleHeader(titleText, chapterNumber, colors, styleName = 'magazine_style') {
    const latex = [
      '\\clearpage',
      '\\vspace{3em}',
      '\\begin{flushleft}',
      '  \\sffamily',
      '  {\\Huge\\bfseries\\textcolor[HTML]{' + colors.primary.replace('#', '') + '}{' + titleText.toUpperCase() + '}}',
      '\\end{flushleft}',
      '\\vspace{2em}'
    ].join('\n');
    return await this.wrapLatex(latex, true, styleName);
  }

  async generateLuxuryFashionHeader(titleText, chapterNumber, colors, styleName = 'luxury_fashion') {
    const latex = [
      '\\clearpage',
      '\\vspace{3em}',
      '\\begin{center}',
      '  \\titlefont',
      '  {\\color[HTML]{B8860B}\\large ◊ ◊ ◊ ◊ ◊}',
      '  \\vspace{1em}',
      '  {\\huge\\textit{\\textcolor[HTML]{' + colors.primary.replace('#', '') + '}{' + titleText + '}}}',
      '  \\vspace{1em}',
      '  {\\color[HTML]{B8860B}\\large ◊ ◊ ◊ ◊ ◊}',
      '\\end{center}',
      '\\vspace{3em}'
    ].join('\n');
    return await this.wrapLatex(latex, true, styleName);
  }

  async generateStandardHeader(titleText, chapterNumber, colors, styleName = 'standard') {
    const latex = [
      '\\clearpage',
      '\\vspace{3em}',
      '\\begin{center}',
      '  \\titlefont',
      '  {\\huge\\bfseries ' + titleText + '}',
      '\\end{center}',
      '\\vspace{2em}'
    ].join('\n');
    return await this.wrapLatex(latex, true, styleName);
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
    
    // Clean the paragraph - remove any leading/trailing whitespace and line breaks
    const cleanParagraph = paragraph.trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
    
    if (cleanParagraph.length < 4) {
      return paragraph; // Not enough text for drop cap
    }
    
    const firstChar = cleanParagraph.charAt(0);
    const rest = cleanParagraph.substring(1);
    
    // Ensure we have enough text for the small caps part
    if (rest.length < 3) {
      return paragraph; // Not enough text for drop cap
    }
    
    // Get the small caps part (next 2-3 characters) and remaining text
    const smallCaps = rest.substring(0, 2); // Use only 2 chars for small caps to be safe
    const remainingText = rest.substring(2);
    
    // Escape any special LaTeX characters in the text parts
    const escapeLatex = (text) => {
      return text.replace(/[{}]/g, '\\$&').replace(/[%$&#^_~]/g, '\\$&');
    };
    
    const safeFirstChar = escapeLatex(firstChar);
    const safeSmallCaps = escapeLatex(smallCaps);
    const safeRemaining = escapeLatex(remainingText);
    
    let latexContent = '';
    switch (style) {
      case 'traditional':
        latexContent = '\\lettrine{' + safeFirstChar + '}{' + safeSmallCaps + '}' + safeRemaining;
        break;
      case 'raised':
        latexContent = '\\lettrine[nindent=0pt,slope=0pt]{' + safeFirstChar + '}{' + safeSmallCaps + '}' + safeRemaining;
        break;
      case 'decorated':
        latexContent = '\\lettrine[nindent=0pt,findent=2pt]{\\fbox{' + safeFirstChar + '}}{' + safeSmallCaps + '}' + safeRemaining;
        break;
      default:
        return paragraph;
    }
    
    // Debug: Log the generated LaTeX
    console.log('[DROP CAP DEBUG] Original paragraph:', paragraph.substring(0, 50) + '...');
    console.log('[DROP CAP DEBUG] Generated LaTeX:', latexContent);
    console.log('[DROP CAP DEBUG] First char: "' + safeFirstChar + '", Small caps: "' + safeSmallCaps + '"');
    
    // Return LaTeX directly wrapped in markdown code blocks
    return '```{=latex}\n' + latexContent + '\n```\n\n';
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

    const inspirations = {
      classic_literature: 'Penguin Classics',
      modern_minimalist: 'Apple/Design books',
      academic_press: 'University Press publications',
      classical_ornate: 'Norton Classics',
      technical_programming: 'O\'Reilly Media',
      magazine_style: 'Wired/National Geographic',
      luxury_fashion: 'High-end fashion books',
      standard: 'Traditional LaTeX styling'
    };

    const features = {
      classic_literature: ['elegant horizontal rules', 'traditional typography', 'centered layout'],
      modern_minimalist: ['large background numbers', 'clean sans-serif', 'overlaid text'],
      academic_press: ['horizontal divider rules', 'professional appearance', 'formal layout'],
      classical_ornate: ['decorative ornaments', 'Roman numerals', 'italicized titles'],
      technical_programming: ['colored background boxes', 'monospace elements', 'technical styling'],
      magazine_style: ['dynamic large numbers', 'bold typography', 'left-aligned layout'],
      luxury_fashion: ['diamond ornaments', 'premium typography', 'gold accents'],
      standard: ['balanced spacing', 'reliable fonts', 'clean presentation']
    };

    return {
      name: styleName,
      description: descriptions[styleName] || 'Unknown style',
      inspiration: inspirations[styleName] || 'Classic publishing',
      features: features[styleName] || ['professional typography'],
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
  async convertMarkdownHeaders(markdown, titleStyle = 'classic_literature') {
    if (!markdown || markdown.length === 0) {
      return markdown;
    }

    console.log("[TITLE PROCESSOR] Converting markdown headers with style: " + titleStyle);
    
    // Use the existing processChapterContent method which handles header conversion
    return await this.processChapterContent(markdown, titleStyle, 'none');
  }
}

module.exports = { TitleStyleProcessor };