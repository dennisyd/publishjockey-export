/**
 * XeLaTeX URL Processor - Document-wide URL overflow handling
 * 
 * Optimized for XeLaTeX with zero-width spaces (U+200B) for perfect line breaking
 * Processes all URL types in a single pass across the entire document
 * 
 * @author PublishJockey Team
 * @version 2.0
 */

class XeLaTeXUrlProcessor {
  constructor(options = {}) {
    this.maxUrlLength = options.maxUrlLength || 50;
    this.enableCloudinaryBreaks = options.enableCloudinaryBreaks !== false;
    this.enableRegularBreaks = options.enableRegularBreaks !== false;
    this.enableBareUrlWrapping = options.enableBareUrlWrapping !== false;
    
    // Zero-width space for XeLaTeX line breaking
    this.ZERO_WIDTH_SPACE = '\u200B';
    
    // Regex patterns for different URL types
    this.patterns = {
      // Image URLs with optional scale comments: ![alt](url)<!-- scale:1.0 -->
      imageUrl: /!\[([^\]]*)\]\((https?:\/\/[^\)]+)\)(<!--\s*scale:[^>]*-->)?/gi,
      
      // Regular markdown links: [text](url)
      markdownLink: /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/gi,
      
      // Bare URLs in text (not already in markdown syntax)
      bareUrl: /(^|[^(\[])((https?:\/\/)[^\s\(\)\[\]<>"']+)/gi
    };
    
    console.log(`[XELATEX URL PROCESSOR] Initialized with maxLength: ${this.maxUrlLength}`);
  }

  /**
   * Process all URLs in markdown content using single-pass document-wide approach
   * @param {string} content - Full markdown content
   * @returns {string} Processed content with breakable URLs
   */
  processMarkdown(content) {
    if (!content || typeof content !== 'string') return content;
    
    console.log(`[XELATEX URL PROCESSOR] Processing document (${content.length} chars)`);
    let processedContent = content;
    let totalUrlsProcessed = 0;

    // STEP 1: Process image URLs (highest priority to preserve image rendering)
    const imageMatches = [...content.matchAll(this.patterns.imageUrl)];
    console.log(`[XELATEX URL PROCESSOR] Found ${imageMatches.length} image URLs`);
    
    processedContent = processedContent.replace(this.patterns.imageUrl, (match, alt, url, comment) => {
      if (url.length > this.maxUrlLength) {
        const breakableUrl = this.insertCloudinaryBreaks(url);
        totalUrlsProcessed++;
        console.log(`[XELATEX URL PROCESSOR] Processed image URL: ${url.substring(0, 50)}... (${url.length} chars)`);
        return `![${alt}](${breakableUrl})${comment || ''}`;
      }
      return match;
    });

    // STEP 2: Process regular markdown links
    const linkMatches = [...content.matchAll(this.patterns.markdownLink)];
    console.log(`[XELATEX URL PROCESSOR] Found ${linkMatches.length} markdown links`);
    
    processedContent = processedContent.replace(this.patterns.markdownLink, (match, text, url) => {
      if (url.length > this.maxUrlLength) {
        const breakableUrl = this.insertRegularBreaks(url);
        totalUrlsProcessed++;
        console.log(`[XELATEX URL PROCESSOR] Processed markdown link: ${url.substring(0, 50)}... (${url.length} chars)`);
        return `[${text}](${breakableUrl})`;
      }
      return match;
    });

    // STEP 3: Process bare URLs (most complex - avoid conflicts with already processed URLs)
    if (this.enableBareUrlWrapping) {
      processedContent = processedContent.replace(this.patterns.bareUrl, (match, prefix, fullUrl, protocol) => {
        // Skip if URL is already in markdown syntax or LaTeX commands
        if (match.includes('](') || match.includes('\\url{') || match.includes('![')) {
          return match;
        }
        
        if (fullUrl.length > this.maxUrlLength) {
          const breakableUrl = this.insertRegularBreaks(fullUrl);
          totalUrlsProcessed++;
          console.log(`[XELATEX URL PROCESSOR] Processed bare URL: ${fullUrl.substring(0, 50)}... (${fullUrl.length} chars)`);
          return `${prefix}${breakableUrl}`;
        }
        return match;
      });
    }

    console.log(`[XELATEX URL PROCESSOR] ✓ Processed ${totalUrlsProcessed} long URLs document-wide`);
    return processedContent;
  }

  /**
   * Insert XeLaTeX-optimized breaks for Cloudinary URLs
   * @param {string} url - Cloudinary URL
   * @returns {string} URL with strategic zero-width spaces
   */
  insertCloudinaryBreaks(url) {
    if (!this.enableCloudinaryBreaks) return url;
    
    return url
      // Break after /upload/ - common Cloudinary pattern
      .replace(/\/upload\//g, `/upload/${this.ZERO_WIDTH_SPACE}`)
      // Break after version numbers /v1234567/
      .replace(/\/v(\d+)\//g, `/v$1/${this.ZERO_WIDTH_SPACE}`)
      // Break before query parameters
      .replace(/\?/g, `${this.ZERO_WIDTH_SPACE}?`)
      // Break after common separators in paths
      .replace(/([\/\-_])/g, `$1${this.ZERO_WIDTH_SPACE}`)
      // Break after dots (but not in domain)
      .replace(/\.(?=.*\/)/g, `.${this.ZERO_WIDTH_SPACE}`)
      // Break after ampersands in query strings
      .replace(/&/g, `&${this.ZERO_WIDTH_SPACE}`);
  }

  /**
   * Insert XeLaTeX-optimized breaks for regular URLs
   * @param {string} url - Regular URL
   * @returns {string} URL with strategic zero-width spaces
   */
  insertRegularBreaks(url) {
    if (!this.enableRegularBreaks) return url;
    
    // Parse URL to avoid breaking the domain
    const urlParts = url.match(/^(https?:\/\/[^\/]+)(\/.*)?(.*)$/);
    if (!urlParts) return url; // Fallback for malformed URLs
    
    const [, domain, path = '', rest = ''] = urlParts;
    
    // Only process the path and query parts, leave domain intact
    const processedPath = (path + rest)
      .replace(/([\/\-_\.])/g, `$1${this.ZERO_WIDTH_SPACE}`)
      .replace(/\?/g, `${this.ZERO_WIDTH_SPACE}?`)
      .replace(/&/g, `&${this.ZERO_WIDTH_SPACE}`)
      .replace(/=/g, `=${this.ZERO_WIDTH_SPACE}`);
    
    return domain + processedPath;
  }

  /**
   * Quick check if content needs URL processing
   * @param {string} content - Content to check
   * @returns {boolean} True if content has URLs longer than threshold
   */
  needsProcessing(content) {
    if (!content) return false;
    
    const urls = content.match(/https?:\/\/[^\s\(\)\[\]<>"']+/gi) || [];
    return urls.some(url => url.length > this.maxUrlLength);
  }

  /**
   * Get processing statistics for debugging
   * @param {string} originalContent - Original content
   * @param {string} processedContent - Processed content  
   * @returns {Object} Processing statistics
   */
  getProcessingStats(originalContent, processedContent) {
    const originalUrls = originalContent.match(/https?:\/\/[^\s\(\)\[\]<>"']+/gi) || [];
    const processedUrls = processedContent.match(/https?:\/\/[^\s\(\)\[\]<>"']+/gi) || [];
    
    return {
      totalUrls: originalUrls.length,
      longUrls: originalUrls.filter(url => url.length > this.maxUrlLength).length,
      avgUrlLength: originalUrls.reduce((sum, url) => sum + url.length, 0) / originalUrls.length || 0,
      zeroWidthSpacesInserted: (processedContent.match(/\u200B/g) || []).length,
      processingEnabled: {
        cloudinary: this.enableCloudinaryBreaks,
        regular: this.enableRegularBreaks,
        bareUrls: this.enableBareUrlWrapping
      }
    };
  }
}

module.exports = { XeLaTeXUrlProcessor };
