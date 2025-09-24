/**
 * TitleStyleProcessor - Publisher-inspired chapter title styles and drop caps
 * 
 * Implements 8 distinct publisher-style title formats with drop cap integration.
 * Each style is inspired by major publishers while using only open source fonts.
 * 
 * @author PublishJockey Fancy Titles System
 * @version 1.0
 */

const { FontManager } = require('./FontManager');

class TitleStyleProcessor {
  constructor(options = {}) {
    this.fontManager = new FontManager(options);
    this.enableDebugLogging = options.enableDebugLogging !== false;
    
    // CRITICAL: Only these 6 languages support drop caps (user-selected)
    this.dropCapSupportedLanguages = new Set([
      'en',  // English
      'fr',  // French  
      'it',  // Italian
      'es',  // Spanish
      'pt',  // Portuguese
      'de'   // German
    ]);
    
    // Style definitions - each inspired by major publishers
    this.styleDefinitions = {
      'classic-literature': {
        name: 'Classic Literature',
        inspiration: 'Penguin Classics',
        description: 'Centered layout with decorative rules, elegant typography',
        fontFamily: 'serif',
        features: ['centered', 'decorative-rules', 'large-numbers', 'elegant']
      },
      
      'modern-minimalist': {
        name: 'Modern Minimalist', 
        inspiration: 'Apple/Design Books',
        description: 'Large background numbers with clean sans-serif overlay',
        fontFamily: 'sans',
        features: ['background-numbers', 'overlay-title', 'clean', 'modern']
      },
      
      'academic-press': {
        name: 'Academic Press',
        inspiration: 'University Press',
        description: 'Horizontal rules with professional chapter information',
        fontFamily: 'serif', 
        features: ['horizontal-rules', 'professional', 'authoritative', 'structured']
      },
      
      'classical-ornate': {
        name: 'Classical Ornate',
        inspiration: 'Norton Classics',
        description: 'Text-based ornamental elements with Roman numerals',
        fontFamily: 'serif',
        features: ['text-ornaments', 'roman-numerals', 'ornate', 'classical']
      },
      
      'technical-programming': {
        name: 'Technical/Programming',
        inspiration: "O'Reilly Media",
        description: 'Colored sections with modern sans-serif, approachable',
        fontFamily: 'sans',
        features: ['colored-backgrounds', 'modern', 'approachable', 'technical']
      },
      
      'magazine-style': {
        name: 'Magazine Style', 
        inspiration: 'Wired/National Geographic',
        description: 'Bold dynamic typography with large background elements',
        fontFamily: 'sans',
        features: ['bold-typography', 'dynamic', 'large-elements', 'contemporary']
      },
      
      'luxury-fashion': {
        name: 'Luxury/Fashion',
        inspiration: 'High-end Books',
        description: 'Elegant with gold/bronze accents, sophisticated premium feel',
        fontFamily: 'serif',
        features: ['elegant', 'premium-colors', 'sophisticated', 'luxury']
      },
      
      'standard': {
        name: 'Standard',
        inspiration: 'Improved LaTeX Default',
        description: 'Clean, simple, reliable - always works',
        fontFamily: 'serif',
        features: ['clean', 'simple', 'reliable', 'universal']
      }
    };
    
    // Drop cap styles
    this.dropCapStyles = {
      'traditional': 'Traditional drop cap - letter drops 2-3 lines into paragraph',
      'raised': 'Raised cap - letter sits on baseline but extends upward',
      'decorated': 'Simple border or background for first letter',
      'none': 'No drop cap'
    };
    
    console.log(`[TITLE PROCESSOR] Initialized with ${Object.keys(this.styleDefinitions).length} title styles and ${Object.keys(this.dropCapStyles).length} drop cap options`);
  }

  /**
   * Convert markdown headers to styled chapter titles
   * @param {string} content - Markdown content
   * @param {string} styleName - Title style to apply
   * @param {Object} options - Processing options
   * @returns {Promise<string>} Processed content with styled titles
   */
  async convertMarkdownHeaders(content, styleName = 'standard', options = {}) {
    if (!content || typeof content !== 'string') {
      return content;
    }
    
    const {
      dropCapStyle = 'none',
      userLanguage = null,
      customColors = { primary: '#333333', accent: '#8B4513' }
    } = options;
    
    console.log(`[TITLE PROCESSOR] Processing content with style: ${styleName}, drop caps: ${dropCapStyle}`);
    
    // Check if user's selected language supports drop caps
    const dropCapSupported = this.isDropCapSupported(userLanguage);
    const actualDropCapStyle = dropCapSupported ? dropCapStyle : 'none';
    
    if (actualDropCapStyle !== dropCapStyle) {
      console.log(`[TITLE PROCESSOR] Drop caps disabled for language '${userLanguage}' (only supported: ${Array.from(this.dropCapSupportedLanguages).join(', ')})`);
    }
    
    // Process chapter headers
    let processedContent = await this.processChapterHeaders(content, styleName, customColors);
    
    // Apply drop caps if enabled
    if (actualDropCapStyle !== 'none') {
      processedContent = this.applyDropCaps(processedContent, actualDropCapStyle, styleName);
    }
    
    return processedContent;
  }

  /**
   * Process chapter headers with specific style
   * @param {string} content - Markdown content
   * @param {string} styleName - Style to apply
   * @param {Object} colors - Custom color scheme
   * @returns {Promise<string>} Content with processed headers
   */
  async processChapterHeaders(content, styleName, colors) {
    const lines = content.split('\n');
    const processedLines = [];
    let chapterNumber = 1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Match chapter headers: # Chapter Title or # Chapter 1: Title
      const chapterMatch = line.match(/^#\s+(.+)$/);
      
      if (chapterMatch) {
        const titleText = chapterMatch[1].trim();
        const styledHeader = await this.generateStyledHeader(titleText, chapterNumber, styleName, colors);
        processedLines.push(styledHeader);
        chapterNumber++;
      } else {
        processedLines.push(line);
      }
    }
    
    return processedLines.join('\n');
  }

  /**
   * Generate styled header based on publisher style
   * @param {string} titleText - Chapter title text
   * @param {number} chapterNumber - Chapter number
   * @param {string} styleName - Style to apply
   * @param {Object} colors - Color scheme
   * @returns {Promise<string>} Styled header LaTeX code
   */
  async generateStyledHeader(titleText, chapterNumber, styleName, colors) {
    const fontConfig = await this.fontManager.findBestFontForStyle(styleName);
    
    switch (styleName) {
      case 'classic-literature':
        return this.generateClassicLiteratureHeader(titleText, chapterNumber, fontConfig, colors);
      
      case 'modern-minimalist':
        return this.generateModernMinimalistHeader(titleText, chapterNumber, fontConfig, colors);
      
      case 'academic-press':
        return this.generateAcademicPressHeader(titleText, chapterNumber, fontConfig, colors);
      
      case 'classical-ornate':
        return this.generateClassicalOrnateHeader(titleText, chapterNumber, fontConfig, colors);
      
      case 'technical-programming':
        return this.generateTechnicalProgrammingHeader(titleText, chapterNumber, fontConfig, colors);
      
      case 'magazine-style':
        return this.generateMagazineStyleHeader(titleText, chapterNumber, fontConfig, colors);
      
      case 'luxury-fashion':
        return this.generateLuxuryFashionHeader(titleText, chapterNumber, fontConfig, colors);
      
      case 'standard':
      default:
        return this.generateStandardHeader(titleText, chapterNumber, fontConfig, colors);
    }
  }

  /**
   * Classic Literature Style (Penguin Classics inspired)
   */
  generateClassicLiteratureHeader(titleText, chapterNumber, fontConfig, colors) {
    return `
```{=latex}
\\vspace{2em}
\\begin{center}
  \\titlefont
  \\textcolor[HTML]{${colors.primary.replace('#', '')}}{%
    \\rule{0.3\\textwidth}{0.4pt}
  }
  \\\\[0.5em]
  {\\Large\\scshape Chapter ${chapterNumber}}
  \\\\[0.3em]
  {\\huge\\textbf{${titleText}}}
  \\\\[0.5em]
  \\textcolor[HTML]{${colors.primary.replace('#', '')}}{%
    \\rule{0.3\\textwidth}{0.4pt}
  }
\\end{center}
\\vspace{2em}
```

`;
  }

  /**
   * Modern Minimalist Style (Apple/Design book inspired)
   */
  generateModernMinimalistHeader(titleText, chapterNumber, fontConfig, colors) {
    return `
```{=latex}
\\vspace{2em}
\\begin{center}
  \\sffamily
  % Large background chapter number
  {\\fontsize{120}{120}\\selectfont\\textcolor{lightgray}{${chapterNumber}}}
  \\\\[-2em]
  % Overlaid title text
  {\\Huge\\bfseries\\textcolor[HTML]{${colors.primary.replace('#', '')}}{{${titleText}}}}
\\end{center}
\\vspace{2em}
```

`;
  }

  /**
   * Academic Press Style (University press inspired)
   */
  generateAcademicPressHeader(titleText, chapterNumber, fontConfig, colors) {
    return `
```{=latex}
\\vspace{2em}
\\noindent\\textcolor[HTML]{${colors.primary.replace('#', '')}}{%
  \\rule{\\textwidth}{1pt}
}
\\\\[0.5em]
\\begin{center}
  \\titlefont
  {\\large\\scshape Chapter ${chapterNumber}}
  \\\\[0.3em]  
  {\\Large\\bfseries ${titleText}}
\\end{center}
\\\\[0.5em]
\\noindent\\textcolor[HTML]{${colors.primary.replace('#', '')}}{%
  \\rule{\\textwidth}{1pt}
}
\\vspace{2em}
```

`;
  }

  /**
   * Classical Ornate Style (Norton Classics inspired)
   */
  generateClassicalOrnateHeader(titleText, chapterNumber, fontConfig, colors) {
    const romanNumeral = this.toRomanNumeral(chapterNumber);
    return `
```{=latex}
\\vspace{2em}
\\begin{center}
  \\titlefont
  {\\large ❦ ❦ ❦}
  \\\\[0.5em]
  {\\Large\\scshape Chapter ${romanNumeral}}
  \\\\[0.3em]
  {\\huge\\textit{${titleText}}}
  \\\\[0.5em]
  {\\large ❦ ❦ ❦}
\\end{center}
\\vspace{2em}
```

`;
  }

  /**
   * Technical/Programming Style (O'Reilly inspired)
   */
  generateTechnicalProgrammingHeader(titleText, chapterNumber, fontConfig, colors) {
    return `
```{=latex}
\\vspace{1em}
\\noindent\\colorbox[HTML]{${colors.accent.replace('#', '')}}{{%
  \\parbox{\\textwidth}{%
    \\vspace{0.5em}
    \\centering\\sffamily\\color{white}
    {\\large\\bfseries Chapter ${chapterNumber}}
    \\\\[0.3em]
    {\\Large\\bfseries ${titleText}}
    \\vspace{0.5em}
  }%
}}
\\vspace{1em}
```

`;
  }

  /**
   * Magazine Style (Wired/National Geographic inspired)
   */
  generateMagazineStyleHeader(titleText, chapterNumber, fontConfig, colors) {
    return `
```{=latex}
\\vspace{2em}
\\begin{flushleft}
  \\sffamily
  % Large chapter number
  {\\fontsize{72}{72}\\selectfont\\bfseries\\textcolor[HTML]{${colors.accent.replace('#', '')}}{${chapterNumber}}}
  \\\\[-1em]
  % Dynamic title
  {\\Huge\\bfseries\\textcolor[HTML]{${colors.primary.replace('#', '')}}{{${titleText.toUpperCase()}}}}
\\end{flushleft}
\\vspace{2em}
```

`;
  }

  /**
   * Luxury/Fashion Style (High-end book inspired)
   */
  generateLuxuryFashionHeader(titleText, chapterNumber, fontConfig, colors) {
    return `
```{=latex}
\\vspace{3em}
\\begin{center}
  \\titlefont
  {\\color[HTML]{B8860B}\\large ◊ ◊ ◊ ◊ ◊}
  \\\\[1em]
  {\\Large\\scshape\\textcolor[HTML]{${colors.primary.replace('#', '')}}{Chapter ${chapterNumber}}}
  \\\\[0.5em]
  {\\huge\\textit{\\textcolor[HTML]{${colors.primary.replace('#', '')}}{{${titleText}}}}}
  \\\\[1em]
  {\\color[HTML]{B8860B}\\large ◊ ◊ ◊ ◊ ◊}
\\end{center}
\\vspace{3em}
```

`;
  }

  /**
   * Standard Style (Improved LaTeX default)
   */
  generateStandardHeader(titleText, chapterNumber, fontConfig, colors) {
    return `
```{=latex}
\\vspace{2em}
\\begin{center}
  \\titlefont
  {\\Large Chapter ${chapterNumber}}
  \\\\[0.5em]
  {\\huge\\bfseries ${titleText}}
\\end{center}
\\vspace{2em}
```

`;
  }

  /**
   * Apply drop caps to paragraph content
   * @param {string} content - Content with styled headers
   * @param {string} dropCapStyle - Drop cap style to apply
   * @param {string} titleStyle - Title style (for integration)
   * @returns {string} Content with drop caps applied
   */
  applyDropCaps(content, dropCapStyle, titleStyle) {
    if (dropCapStyle === 'none') return content;
    
    console.log(`[TITLE PROCESSOR] Applying drop caps: ${dropCapStyle}`);
    
    // Find first paragraph after each chapter header
    const lines = content.split('\n');
    const processedLines = [];
    let inLatexBlock = false;
    let foundChapterHeader = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Track LaTeX blocks
      if (line.includes('```{=latex}')) {
        inLatexBlock = true;
        foundChapterHeader = true;
        processedLines.push(line);
        continue;
      }
      
      if (line.includes('```') && inLatexBlock) {
        inLatexBlock = false;
        processedLines.push(line);
        continue;
      }
      
      // Skip LaTeX blocks and empty lines
      if (inLatexBlock || !line.trim()) {
        processedLines.push(line);
        continue;
      }
      
      // Apply drop cap to first paragraph after chapter
      if (foundChapterHeader && line.trim() && !line.startsWith('#') && !line.startsWith('```')) {
        const dropCapLine = this.generateDropCap(line, dropCapStyle, titleStyle);
        processedLines.push(dropCapLine);
        foundChapterHeader = false; // Only first paragraph
      } else {
        processedLines.push(line);
      }
    }
    
    return processedLines.join('\n');
  }

  /**
   * Generate drop cap for a paragraph
   * @param {string} paragraph - First paragraph text
   * @param {string} style - Drop cap style
   * @param {string} titleStyle - Integration with title style
   * @returns {string} Paragraph with drop cap
   */
  generateDropCap(paragraph, style, titleStyle) {
    if (!paragraph || paragraph.length === 0) return paragraph;
    
    const firstChar = paragraph.charAt(0);
    const restOfParagraph = paragraph.substring(1);
    
    switch (style) {
      case 'traditional':
        return `
```{=latex}
\\lettrine{${firstChar}}{${restOfParagraph.substring(0, 3)}}${restOfParagraph.substring(3)}
````;
      
      case 'raised':
        return `
```{=latex}
\\lettrine[nindent=0pt,slope=0pt]{${firstChar}}{${restOfParagraph.substring(0, 3)}}${restOfParagraph.substring(3)}
````;
      
      case 'decorated':
        return `
```{=latex}
\\lettrine[nindent=0pt,findent=2pt]{\\fbox{${firstChar}}}{${restOfParagraph.substring(0, 3)}}${restOfParagraph.substring(3)}
````;
      
      default:
        return paragraph;
    }
  }

  /**
   * Generate XeLaTeX preamble for a style
   * @param {string} styleName - Style name
   * @param {Object} options - Style options
   * @returns {Promise<string>} XeLaTeX preamble
   */
  async generateStylePreamble(styleName, options = {}) {
    const fontConfig = await this.fontManager.generateLatexFontConfig(styleName);
    const { enableDropCaps = false, customColors = {} } = options;
    
    let preamble = [];
    
    // Required packages
    preamble.push('% Fancy Titles System - XeLaTeX Preamble');
    preamble.push('\\usepackage{fontspec}     % Font loading');
    preamble.push('\\usepackage{xcolor}       % Colors');  
    preamble.push('\\usepackage{graphicx}     % Scaling, rotation');
    
    if (enableDropCaps) {
      preamble.push('\\usepackage{lettrine}     % Drop caps');
    }
    
    preamble.push('');
    preamble.push(fontConfig);
    preamble.push('');
    
    // Custom colors
    if (customColors.primary) {
      preamble.push(`\\definecolor{primarycolor}{HTML}{${customColors.primary.replace('#', '')}}`);
    }
    if (customColors.accent) {
      preamble.push(`\\definecolor{accentcolor}{HTML}{${customColors.accent.replace('#', '')}}`);
    }
    
    return preamble.join('\n');
  }

  /**
   * Convert number to Roman numeral
   * @param {number} num - Number to convert
   * @returns {string} Roman numeral
   */
  toRomanNumeral(num) {
    const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    const numerals = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
    let result = '';
    
    for (let i = 0; i < values.length; i++) {
      while (num >= values[i]) {
        result += numerals[i];
        num -= values[i];
      }
    }
    
    return result;
  }

  /**
   * Check if a language supports drop caps (user-selected language)
   * @param {string} languageCode - User-selected language code (en, fr, it, es, pt, de)
   * @returns {boolean} True if language supports drop caps
   */
  isDropCapSupported(languageCode) {
    const supported = this.dropCapSupportedLanguages.has(languageCode);
    
    if (this.enableDebugLogging) {
      console.log(`[TITLE PROCESSOR] Drop cap support check: ${languageCode} → ${supported ? 'SUPPORTED' : 'NOT SUPPORTED'}`);
    }
    
    return supported;
  }

  /**
   * Get available styles information
   * @returns {Object} Available styles and their details
   */
  getAvailableStyles() {
    return {
      styles: this.styleDefinitions,
      dropCaps: this.dropCapStyles,
      supportedLanguages: Array.from(this.dropCapSupportedLanguages).map(langCode => ({
        code: langCode,
        name: this.getLanguageName(langCode),
        dropCapSupported: true
      }))
    };
  }

  /**
   * Get human-readable language name
   * @param {string} langCode - Language code
   * @returns {string} Language name
   */
  getLanguageName(langCode) {
    const names = {
      'en': 'English',
      'fr': 'French', 
      'it': 'Italian',
      'es': 'Spanish',
      'pt': 'Portuguese',
      'de': 'German'
    };
    return names[langCode] || langCode;
  }
}

module.exports = { TitleStyleProcessor };
