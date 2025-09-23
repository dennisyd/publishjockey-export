/**
 * BibliographyDetector - Advanced bibliography section detection and URL processing
 * Uses multi-factor analysis to identify bibliography sections regardless of title or language
 * Based on content patterns, structure, and document position rather than section names
 */

class BibliographyDetector {
  constructor(options = {}) {
    this.thresholds = {
      bibliographyScore: options.minScore || 0.6,
      urlDensity: options.urlDensity || 0.25,        // URLs per 100 words
      avgLineLength: options.avgLineLength || 75,     // Characters
      ...options
    };
    
    console.log(`[BIBLIOGRAPHY DETECTOR] Initialized with thresholds:`, this.thresholds);
  }

  /**
   * Detect bibliography sections in markdown content
   * @param {string} markdownContent - Full markdown content
   * @returns {Array} Array of detected bibliography sections with scores
   */
  detectBibliographySections(markdownContent) {
    const sections = this.splitIntoSections(markdownContent);
    const bibliographySections = [];

    console.log(`[BIBLIOGRAPHY DETECTOR] Analyzing ${sections.length} sections for bibliography patterns...`);

    sections.forEach((section, index) => {
      const score = this.calculateBibliographyScore(section, index, sections.length);
      
      console.log(`[BIBLIOGRAPHY DETECTOR] Section ${index + 1} "${section.headerText || 'Untitled'}" score: ${score.toFixed(3)}`);
      
      if (score >= this.thresholds.bibliographyScore) {
        bibliographySections.push({
          section,
          index,
          score,
          startPos: section.startPos,
          endPos: section.endPos
        });
        console.log(`[BIBLIOGRAPHY DETECTOR] ✓ Bibliography detected: "${section.headerText || 'Untitled'}" (score: ${score.toFixed(3)})`);
      }
    });

    console.log(`[BIBLIOGRAPHY DETECTOR] Found ${bibliographySections.length} bibliography sections`);
    return bibliographySections;
  }

  /**
   * Calculate bibliography likelihood score using multiple factors
   * @param {Object} section - Section object with content and metadata
   * @param {number} index - Section index in document
   * @param {number} totalSections - Total number of sections
   * @returns {number} Score between 0 and 1
   */
  calculateBibliographyScore(section, index, totalSections) {
    let score = 0;
    const content = section.content;
    const words = content.split(/\s+/).filter(word => word.length > 0).length;
    
    // Skip very short sections (likely not bibliographies)
    if (words < 20) {
      console.log(`[BIBLIOGRAPHY DETECTOR]   - Too short (${words} words), skipping`);
      return 0;
    }

    // 1. URL DENSITY (40% weight) - Language agnostic
    const urlCount = (content.match(/https?:\/\/[^\s\)]+/g) || []).length;
    const urlDensity = urlCount / (words / 100); // URLs per 100 words
    if (urlDensity > this.thresholds.urlDensity) {
      const urlScore = 0.4 * Math.min(urlDensity / 2, 1); // Cap at 2 URLs per 100 words
      score += urlScore;
      console.log(`[BIBLIOGRAPHY DETECTOR]   - URL density: ${urlDensity.toFixed(2)} per 100 words → +${urlScore.toFixed(3)}`);
    }

    // 2. STRUCTURAL PATTERNS (25% weight) - Language agnostic
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    const avgLineLength = lines.reduce((sum, line) => sum + line.length, 0) / lines.length;
    
    // Bibliographies tend to have longer, more consistent lines
    if (avgLineLength > this.thresholds.avgLineLength) {
      score += 0.15;
      console.log(`[BIBLIOGRAPHY DETECTOR]   - Long lines (${avgLineLength.toFixed(0)} chars avg) → +0.15`);
    }
    
    // List-like structure detection
    const listIndicators = content.match(/^\s*[-*+]\s+/gm) || [];
    const numberedLists = content.match(/^\s*\d+\.\s+/gm) || [];
    if (listIndicators.length > 2 || numberedLists.length > 2) {
      score += 0.1;
      console.log(`[BIBLIOGRAPHY DETECTOR]   - List structure detected → +0.10`);
    }

    // 3. CITATION PATTERNS (20% weight) - Universal academic formats
    let citationScore = 0;
    
    // Years in text (very common in all languages)
    const yearPattern = /\b(19|20)\d{2}\b/g;
    const yearCount = (content.match(yearPattern) || []).length;
    if (yearCount > 3) {
      citationScore += 0.1;
      console.log(`[BIBLIOGRAPHY DETECTOR]   - Multiple years (${yearCount}) → +0.10`);
    }
    
    // DOI patterns (language agnostic)
    if (/doi:10\./i.test(content)) {
      citationScore += 0.05;
      console.log(`[BIBLIOGRAPHY DETECTOR]   - DOI patterns found → +0.05`);
    }
    
    // Page number patterns (pp. p. etc - common across languages)
    if (/\bpp?\.\s*\d+/i.test(content)) {
      citationScore += 0.03;
      console.log(`[BIBLIOGRAPHY DETECTOR]   - Page number patterns → +0.03`);
    }
    
    // Parenthetical citations pattern
    const parentheticalCitations = (content.match(/\([^)]*\d{4}[^)]*\)/g) || []).length;
    if (parentheticalCitations > 2) {
      citationScore += 0.02;
      console.log(`[BIBLIOGRAPHY DETECTOR]   - Parenthetical citations (${parentheticalCitations}) → +0.02`);
    }
    
    score += citationScore;

    // 4. DOCUMENT POSITION (10% weight) - Bibliographies usually at end
    const positionRatio = index / totalSections;
    if (positionRatio > 0.7) { // Last 30% of document
      const positionScore = 0.1 * (positionRatio - 0.7) / 0.3;
      score += positionScore;
      console.log(`[BIBLIOGRAPHY DETECTOR]   - End position (${(positionRatio * 100).toFixed(0)}%) → +${positionScore.toFixed(3)}`);
    }

    // 5. PUNCTUATION DENSITY (5% weight) - Bibliographies are punctuation-heavy
    const punctuationCount = (content.match(/[.,;:()]/g) || []).length;
    const punctuationDensity = punctuationCount / words;
    if (punctuationDensity > 0.3) { // More than 0.3 punctuation marks per word
      score += 0.05;
      console.log(`[BIBLIOGRAPHY DETECTOR]   - High punctuation density (${punctuationDensity.toFixed(2)}) → +0.05`);
    }

    return Math.min(score, 1.0); // Cap at 1.0
  }

  /**
   * Split markdown content into sections based on headers
   * @param {string} content - Markdown content
   * @returns {Array} Array of section objects
   */
  splitIntoSections(content) {
    const headerPattern = /^(#{1,6})\s+(.+)$/gm;
    const sections = [];
    let lastIndex = 0;
    const matches = [...content.matchAll(headerPattern)];

    matches.forEach((match, i) => {
      // Add content before this header as a section (if any)
      if (lastIndex < match.index) {
        const sectionContent = content.substring(lastIndex, match.index).trim();
        if (sectionContent.length > 10) { // Skip very short sections
          sections.push({
            content: sectionContent,
            startPos: lastIndex,
            endPos: match.index,
            hasHeader: false,
            headerText: null
          });
        }
      }
      
      // Find next header or end of document
      const nextMatch = matches[i + 1];
      const endPos = nextMatch ? nextMatch.index : content.length;
      
      const sectionContent = content.substring(match.index, endPos).trim();
      if (sectionContent.length > 10) {
        sections.push({
          content: sectionContent,
          startPos: match.index,
          endPos: endPos,
          hasHeader: true,
          headerLevel: match[1].length,
          headerText: match[2]
        });
      }
      
      lastIndex = endPos;
    });

    // Add final section if any content remains
    if (lastIndex < content.length) {
      const sectionContent = content.substring(lastIndex).trim();
      if (sectionContent.length > 10) {
        sections.push({
          content: sectionContent,
          startPos: lastIndex,
          endPos: content.length,
          hasHeader: false,
          headerText: null
        });
      }
    }

    return sections;
  }

  /**
   * Process only detected bibliography sections with URL breaking
   * @param {string} content - Full markdown content
   * @returns {string} Processed content with URL breaks in bibliography sections only
   */
  processOnlyBibliographies(content) {
    const bibliographySections = this.detectBibliographySections(content);
    
    if (bibliographySections.length === 0) {
      console.log(`[BIBLIOGRAPHY DETECTOR] No bibliography sections detected, returning original content`);
      return content; // No bibliographies detected, return original
    }

    console.log(`[BIBLIOGRAPHY DETECTOR] Processing ${bibliographySections.length} bibliography sections with URL breaks...`);

    let processedContent = content;
    let offset = 0;

    // Process each bibliography section (in reverse order to maintain positions)
    bibliographySections.reverse().forEach((bibSection, i) => {
      console.log(`[BIBLIOGRAPHY DETECTOR] Processing bibliography ${i + 1}: "${bibSection.section.headerText || 'Untitled'}" (score: ${bibSection.score.toFixed(3)})`);
      
      const originalSection = bibSection.section.content;
      const processedSection = this.processUrlsInSection(originalSection);
      
      const startPos = bibSection.startPos - offset;
      const endPos = bibSection.endPos - offset;
      
      processedContent = 
        processedContent.substring(0, startPos) + 
        processedSection + 
        processedContent.substring(endPos);
        
      offset += originalSection.length - processedSection.length;
    });

    console.log(`[BIBLIOGRAPHY DETECTOR] ✓ Completed processing all bibliography sections`);
    return processedContent;
  }

  /**
   * Process URLs in a specific section content
   * @param {string} sectionContent - Content of a bibliography section
   * @returns {string} Content with processed URLs
   */
  processUrlsInSection(sectionContent) {
    const ZERO_WIDTH_SPACE = '\u200B';
    const MAX_URL_LENGTH = 30; // Lower threshold for narrow book columns
    
    console.log(`[BIBLIOGRAPHY DETECTOR] Processing URLs in section (${sectionContent.length} chars)`);
    
    let processedContent = sectionContent;
    let urlsProcessed = 0;

    // Process URLs that are already in \url{} commands (from processUrlsForLatex)
    processedContent = processedContent.replace(/\\url\{([^}]+)\}/g, (match, url) => {
      if (url.length > MAX_URL_LENGTH) {
        urlsProcessed++;
        console.log(`[BIBLIOGRAPHY DETECTOR] Adding breaks to long URL in \\url{}: ${url.substring(0, 40)}... (${url.length} chars)`);
        
        // Add zero-width spaces after common URL separators
        let breakableUrl = url
          .replace(/\//g, `/${ZERO_WIDTH_SPACE}`)      // After slashes
          .replace(/\./g, `.${ZERO_WIDTH_SPACE}`)      // After dots  
          .replace(/\-/g, `-${ZERO_WIDTH_SPACE}`)      // After hyphens
          .replace(/\?/g, `?${ZERO_WIDTH_SPACE}`)      // After question marks
          .replace(/\&/g, `&${ZERO_WIDTH_SPACE}`)      // After ampersands  
          .replace(/\=/g, `=${ZERO_WIDTH_SPACE}`)      // After equals
          .replace(/_/g, `_${ZERO_WIDTH_SPACE}`);      // After underscores
          
        return `\\url{${breakableUrl}}`;
      }
      return match;
    });

    // Process markdown links: [text](url)
    processedContent = processedContent.replace(/\[([^\]]*)\]\((https?:\/\/[^\)]+)\)/g, (match, text, url) => {
      if (url.length > MAX_URL_LENGTH) {
        urlsProcessed++;
        console.log(`[BIBLIOGRAPHY DETECTOR] Adding breaks to markdown link URL: ${url.substring(0, 40)}... (${url.length} chars)`);
        
        const breakableUrl = this.addUrlBreaks(url);
        return `[${text}](${breakableUrl})`;
      }
      return match;
    });
    
    // Process bare URLs that weren't caught by processUrlsForLatex
    processedContent = processedContent.replace(/(https?:\/\/[^\s\(\)\[\]<>"']+)/g, (match, url) => {
      // Skip if it's already in a \url{} command or markdown link
      if (match.includes('\\url{') || match.includes('](')) return match;
      
      if (url.length > MAX_URL_LENGTH) {
        urlsProcessed++;
        console.log(`[BIBLIOGRAPHY DETECTOR] Adding breaks to bare URL: ${url.substring(0, 40)}... (${url.length} chars)`);
        
        const breakableUrl = this.addUrlBreaks(url);
        return `\\url{${breakableUrl}}`;
      }
      return match;
    });

    console.log(`[BIBLIOGRAPHY DETECTOR] ✓ Processed ${urlsProcessed} URLs in section`);
    return processedContent;
  }

  /**
   * Add zero-width space breaks to a URL for better line breaking
   * @param {string} url - URL to process
   * @returns {string} URL with zero-width space breaks
   */
  addUrlBreaks(url) {
    const ZERO_WIDTH_SPACE = '\u200B';
    return url
      .replace(/\//g, `/${ZERO_WIDTH_SPACE}`)
      .replace(/\./g, `.${ZERO_WIDTH_SPACE}`)
      .replace(/\-/g, `-${ZERO_WIDTH_SPACE}`)
      .replace(/\?/g, `?${ZERO_WIDTH_SPACE}`)
      .replace(/\&/g, `&${ZERO_WIDTH_SPACE}`)
      .replace(/\=/g, `=${ZERO_WIDTH_SPACE}`)
      .replace(/_/g, `_${ZERO_WIDTH_SPACE}`);
  }
}

module.exports = { BibliographyDetector };
