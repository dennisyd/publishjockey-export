/**
 * FontManager - Open source font detection and fallback system for fancy titles
 * 
 * Handles font detection, fallback chains, and XeLaTeX font configuration generation.
 * Focuses on open source fonts available on Ubuntu servers without additional downloads.
 * 
 * @author PublishJockey Fancy Titles System
 * @version 1.0
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class FontManager {
  constructor(options = {}) {
    this.platform = options.platform || process.platform;
    this.enableFontCache = options.enableFontCache !== false;
    this.fontCache = new Map();
    
    // Open source font definitions with fallback chains
    // NO Microsoft proprietary fonts (Times New Roman, Arial, etc.)
    this.fontDefinitions = {
      // SERIF FAMILIES (for elegant, classical styles)
      serif: [
        'Liberation Serif',     // Primary - open source Times New Roman alternative
        'TeX Gyre Termes',     // High-quality Times New Roman clone  
        'Source Serif Pro',    // Adobe's open source serif
        'Ubuntu',              // Ubuntu default fallback
        'DejaVu Serif',        // Universal fallback
        'serif'                // Generic fallback
      ],
      
      // SANS-SERIF FAMILIES (for modern, minimalist styles)  
      sans: [
        'Liberation Sans',     // Primary - open source Arial alternative
        'TeX Gyre Heros',     // High-quality Helvetica clone
        'Source Sans Pro',    // Adobe's open source sans serif
        'Ubuntu',             // Ubuntu default
        'DejaVu Sans',        // Universal fallback
        'sans-serif'          // Generic fallback
      ],
      
      // MONOSPACE FAMILIES (for technical/programming styles)
      mono: [
        'Liberation Mono',    // Primary - open source Courier alternative
        'Source Code Pro',    // Adobe's open source monospace
        'Ubuntu Mono',        // Ubuntu monospace
        'DejaVu Sans Mono',   // Universal fallback
        'monospace'           // Generic fallback
      ]
    };
    
    // Style-specific font mappings
    this.styleToFontFamily = {
      'classic-literature': 'serif',      // Penguin Classics inspired
      'modern-minimalist': 'sans',        // Apple/design book style
      'academic-press': 'serif',          // University press style
      'classical-ornate': 'serif',        // Norton Classics style
      'technical-programming': 'sans',    // O'Reilly style
      'magazine-style': 'sans',           // Wired/National Geographic
      'luxury-fashion': 'serif',          // High-end book style
      'standard': 'serif'                 // Default LaTeX improved
    };
    
    console.log(`[FONT MANAGER] Initialized for platform: ${this.platform}`);
  }

  /**
   * Detect available fonts on the system using fc-list (Linux/Ubuntu)
   * @returns {Promise<Set<string>>} Set of available font families
   */
  async detectSystemFonts() {
    if (this.fontCache.has('systemFonts') && this.enableFontCache) {
      console.log(`[FONT MANAGER] Using cached font list (${this.fontCache.get('systemFonts').size} fonts)`);
      return this.fontCache.get('systemFonts');
    }
    
    try {
      console.log(`[FONT MANAGER] Detecting system fonts...`);
      
      // Use fc-list to get all font families (Linux/Ubuntu)
      const { stdout } = await execAsync('fc-list : family');
      
      const fontFamilies = new Set();
      const lines = stdout.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        // fc-list returns comma-separated font families per line
        const families = line.split(',').map(f => f.trim());
        families.forEach(family => {
          if (family && family.length > 0) {
            fontFamilies.add(family);
          }
        });
      }
      
      console.log(`[FONT MANAGER] Detected ${fontFamilies.size} font families`);
      
      // Cache the results
      if (this.enableFontCache) {
        this.fontCache.set('systemFonts', fontFamilies);
      }
      
      return fontFamilies;
    } catch (error) {
      console.warn(`[FONT MANAGER] Font detection failed: ${error.message}`);
      
      // Fallback to basic font set that should exist on most Ubuntu systems
      const basicFonts = new Set([
        'Liberation Serif', 'Liberation Sans', 'Liberation Mono',
        'Ubuntu', 'DejaVu Serif', 'DejaVu Sans', 'DejaVu Sans Mono'
      ]);
      
      console.log(`[FONT MANAGER] Using fallback font set (${basicFonts.size} fonts)`);
      return basicFonts;
    }
  }

  /**
   * Find the best available font for a given style
   * @param {string} styleName - The title style name
   * @returns {Promise<Object>} Font configuration object
   */
  async findBestFontForStyle(styleName) {
    const cacheKey = `style_${styleName}`;
    if (this.fontCache.has(cacheKey) && this.enableFontCache) {
      return this.fontCache.get(cacheKey);
    }
    
    console.log(`[FONT MANAGER] Finding best font for style: ${styleName}`);
    
    const systemFonts = await this.detectSystemFonts();
    const fontFamily = this.styleToFontFamily[styleName] || 'serif';
    const candidateFonts = this.fontDefinitions[fontFamily];
    
    // Find the first available font from the candidate list
    let selectedFont = null;
    let fallbackChain = [];
    
    for (const fontName of candidateFonts) {
      if (systemFonts.has(fontName)) {
        if (!selectedFont) {
          selectedFont = fontName;
        }
        fallbackChain.push(fontName);
      }
    }
    
    // If no specific fonts found, use the generic fallback
    if (!selectedFont) {
      selectedFont = candidateFonts[candidateFonts.length - 1]; // Last item is generic
      fallbackChain = [selectedFont];
    }
    
    const fontConfig = {
      primary: selectedFont,
      fallback: fallbackChain,
      family: fontFamily,
      style: styleName,
      available: systemFonts.has(selectedFont)
    };
    
    console.log(`[FONT MANAGER] Selected font for ${styleName}: ${selectedFont} (available: ${fontConfig.available})`);
    
    // Cache the result
    if (this.enableFontCache) {
      this.fontCache.set(cacheKey, fontConfig);
    }
    
    return fontConfig;
  }

  /**
   * Generate XeLaTeX font configuration commands
   * @param {string} styleName - The title style name
   * @returns {Promise<string>} XeLaTeX font commands
   */
  async generateLatexFontConfig(styleName) {
    const fontConfig = await this.findBestFontForStyle(styleName);
    
    let latexCommands = [];
    
    // Generate main font command
    const fallbackList = fontConfig.fallback.join(',');
    latexCommands.push(`% Font configuration for ${styleName} style`);
    latexCommands.push(`% Primary: ${fontConfig.primary} | Family: ${fontConfig.family}`);
    latexCommands.push(`% Fallback chain: ${fallbackList}`);
    latexCommands.push('');
    
    // Set the main document font based on style family
    if (fontConfig.family === 'serif') {
      latexCommands.push(`\\setmainfont{${fontConfig.primary}}`);
    } else if (fontConfig.family === 'sans') {
      latexCommands.push(`\\setsansfont{${fontConfig.primary}}`);
    } else if (fontConfig.family === 'mono') {
      latexCommands.push(`\\setmonofont{${fontConfig.primary}}`);
    }
    
    // Define custom font commands for title styling
    latexCommands.push(`\\newfontfamily\\titlefont{${fontConfig.primary}}`);
    latexCommands.push(`\\newfontfamily\\chapternumberfont{${fontConfig.primary}}[Scale=2.0]`);
    latexCommands.push(`\\newfontfamily\\sectionfont{${fontConfig.primary}}[Scale=1.2]`);
    latexCommands.push('');
    
    const result = latexCommands.join('\n');
    console.log(`[FONT MANAGER] Generated LaTeX config for ${styleName} (${result.split('\n').length} lines)`);
    
    return result;
  }

  /**
   * Validate font compatibility and generate report
   * @returns {Promise<Object>} Comprehensive font compatibility report
   */
  async validateFontCompatibility() {
    console.log(`[FONT MANAGER] Starting comprehensive font compatibility validation...`);
    
    const systemFonts = await this.detectSystemFonts();
    const report = {
      platform: this.platform,
      totalSystemFonts: systemFonts.size,
      timestamp: new Date().toISOString(),
      styles: {},
      fontFamilies: {},
      recommendations: [],
      missingFonts: []
    };
    
    // Test each style
    for (const styleName of Object.keys(this.styleToFontFamily)) {
      const fontConfig = await this.findBestFontForStyle(styleName);
      report.styles[styleName] = {
        selectedFont: fontConfig.primary,
        available: fontConfig.available,
        fallbackChain: fontConfig.fallback,
        fontFamily: fontConfig.family
      };
      
      if (!fontConfig.available) {
        report.missingFonts.push({
          style: styleName,
          requestedFont: fontConfig.primary,
          fallbackUsed: fontConfig.fallback[0]
        });
      }
    }
    
    // Test each font family availability
    for (const [familyName, fontList] of Object.entries(this.fontDefinitions)) {
      report.fontFamilies[familyName] = {
        total: fontList.length,
        available: fontList.filter(font => systemFonts.has(font)),
        missing: fontList.filter(font => !systemFonts.has(font) && !font.includes('serif'))
      };
    }
    
    // Generate recommendations
    if (report.missingFonts.length > 0) {
      report.recommendations.push('Consider installing additional TeX fonts: sudo apt-get install texlive-fonts-extra');
    }
    
    if (report.fontFamilies.serif.available.length < 2) {
      report.recommendations.push('Install additional serif fonts: sudo apt-get install fonts-liberation fonts-texgyre');
    }
    
    if (report.fontFamilies.sans.available.length < 2) {
      report.recommendations.push('Install additional sans fonts: sudo apt-get install fonts-liberation fonts-source-pro');
    }
    
    console.log(`[FONT MANAGER] Validation complete. ${report.styles ? Object.keys(report.styles).length : 0} styles tested, ${report.missingFonts.length} fonts missing`);
    
    return report;
  }

  /**
   * Get installation commands for missing fonts
   * @returns {Promise<Array<string>>} Array of installation commands
   */
  async getMissingFontCommands() {
    const report = await this.validateFontCompatibility();
    const commands = [];
    
    if (report.missingFonts.length > 0) {
      // Standard Ubuntu font packages
      commands.push('sudo apt-get update');
      commands.push('sudo apt-get install fonts-liberation');          // Liberation fonts
      commands.push('sudo apt-get install fonts-texgyre');             // TeX Gyre fonts
      commands.push('sudo apt-get install fonts-source-pro');          // Adobe Source fonts
      commands.push('sudo apt-get install texlive-fonts-extra');       // Additional TeX fonts
      commands.push('sudo fc-cache -fv');                              // Refresh font cache
    }
    
    return commands;
  }
}

module.exports = { FontManager };
