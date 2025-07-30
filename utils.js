// Shared utility functions for all exporters
const fs = require('fs');
const path = require('path');

function removeEmojis(str) {
  return str.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
}

function saveDebugFile(content, filename, directory = 'debug') {
  try {
    const baseDir = path.join(__dirname, directory);
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    const filePath = path.join(baseDir, filename);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`DEBUG: Saved ${filename} to ${filePath}`);
    return filePath;
  } catch (error) {
    console.error(`ERROR: Failed to save debug file ${filename}:`, error);
    return null;
  }
}

function translateAlignmentDivsForDocx(markdown) {
  // Replace ::: {.center} ... ::: with ::: {custom-style="Center"} ... :::
  markdown = markdown.replace(/::: *\{\.center\}/g, '::: {custom-style="Center"}');
  // Replace ::: {.right} ... ::: with ::: {custom-style="Right"} ... :::
  markdown = markdown.replace(/::: *\{\.right\}/g, '::: {custom-style="Right"}');
  return markdown;
}

/**
 * Applies format-specific Cloudinary transformations to image URLs
 * @param {string} imageSrc - Original image URL
 * @param {string} format - Target format (pdf, epub, docx)
 * @param {number} scale - Image scale factor
 * @returns {string} - Transformed URL
 */
function getCloudinaryTransformation(imageSrc, format, scale = 0.6) {
  console.log(`[CLOUDINARY TRANSFORM] Input: ${imageSrc}, format: ${format}, scale: ${scale}`);
  
  // Only apply transformations to Cloudinary URLs
  if (!imageSrc.includes('cloudinary.com')) {
    console.log(`[CLOUDINARY TRANSFORM] Not a Cloudinary URL, returning as-is`);
    return imageSrc;
  }
  
  // Clean the URL first - remove any existing query parameters that might interfere
  const cleanUrl = imageSrc.split('?')[0];
  console.log(`[CLOUDINARY TRANSFORM] Cleaned URL: ${cleanUrl}`);
  
  // Parse URL to inject transformations
  const urlParts = cleanUrl.split('/upload/');
  if (urlParts.length !== 2) {
    console.log(`[CLOUDINARY TRANSFORM] Invalid URL structure, returning original`);
    return imageSrc; // Invalid Cloudinary URL structure
  }
  
  let transformation = '';
  
  if (format === 'pdf') {
    // For PDF, DON'T scale the image - keep original resolution and let LaTeX handle scaling
    // This prevents double-scaling that causes blurriness
    transformation = `f_png,q_95`; // Just convert to high-quality PNG
    console.log(`[CLOUDINARY TRANSFORM] PDF transformation (no scaling): ${transformation}`);
  } else if (format === 'epub') {
    // Web-optimized for e-readers
    const widthPx = Math.round(600 * scale);
    transformation = `w_${widthPx},c_limit,q_80`;
  } else if (format === 'docx') {
    // Document embedding
    const widthPx = Math.round(400 * scale);
    transformation = `w_${widthPx},c_limit,q_80`;
  }
  
  if (!transformation) {
    console.log(`[CLOUDINARY TRANSFORM] No transformation needed, returning original`);
    return imageSrc;
  }
  
  // Construct the transformed URL
  const result = `${urlParts[0]}/upload/${transformation}/${urlParts[1]}`;
  console.log(`[CLOUDINARY TRANSFORM] Result: ${result}`);
  return result;
}

/**
 * Replaces custom image placeholders with format-specific output.
 * Enhanced with Cloudinary optimization support.
 * @param {string} markdown - The markdown content
 * @param {string} format - 'pdf', 'epub', or 'docx'
 * @returns {string} - The processed markdown
 */
function replaceCustomImages(markdown, format) {
  console.log(`[REPLACE CUSTOM IMAGES] Starting replacement for format: ${format}`);
  console.log(`[REPLACE CUSTOM IMAGES] Input markdown length: ${markdown.length}`);
  
  if (format === 'docx') {
    // Translate alignment divs for DOCX before replacing images
    markdown = translateAlignmentDivsForDocx(markdown);
  }
  
  // Find all custom image placeholders first for debugging
  const customImageMatches = [...markdown.matchAll(/\{\{IMAGE:([^|}]*)\|([^|}]*)\|([^|}]*)\}\}/g)];
  console.log(`[REPLACE CUSTOM IMAGES] Found ${customImageMatches.length} custom image(s)`);
  
  customImageMatches.forEach((match, index) => {
    console.log(`[REPLACE CUSTOM IMAGES] Image ${index + 1}: URL="${match[1]}", Alt="${match[2]}", Scale="${match[3]}"`);
  });
  
  let processedCount = 0;
  const result = markdown.replace(/\{\{IMAGE:([^|}]*)\|([^|}]*)\|([^|}]*)\}\}/g, (match, src, alt, scale) => {
    processedCount++;
    console.log(`[REPLACE CUSTOM IMAGES] Processing image ${processedCount}/${customImageMatches.length}`);
    console.log(`[REPLACE CUSTOM IMAGES] Processing: src="${src}", alt="${alt}", scale="${scale}"`);
    
    // Clean and validate inputs
    src = src.replace(/\\/g, '/').trim(); // Always use forward slashes and trim
    scale = parseFloat(scale) || 0.6; // Default scale if empty or invalid
    alt = (alt || '').trim(); // Clean alt text
    
    // If no alt/caption is provided, leave it empty (no caption)
    
    // Validate URL
    if (!src) {
      console.warn(`[REPLACE CUSTOM IMAGES] Empty src for image ${processedCount}, skipping`);
      return match; // Return original if no source
    }
    
    console.log(`[REPLACE CUSTOM IMAGES] Cleaned inputs: src="${src}", alt="${alt}", scale="${scale}"`);
    
    // Apply Cloudinary transformations if applicable
    const optimizedSrc = getCloudinaryTransformation(src, format, scale);
    console.log(`[REPLACE CUSTOM IMAGES] Optimized src: "${optimizedSrc}"`);
    
    // For PDF: Keep full URL so exportPdf.js can download it, then replace with local filename
    // For other formats: Use the optimized URL directly
    const imageSrc = optimizedSrc;
    
    if (format === 'pdf') {
      // For PDF, use a non-floating approach with raw centering and optional caption
      const captionLatex = alt ? `{\itshape ${alt.replace(/([%#&{}_])/g, '\$1')}}` : '';
      const latexLines = [
        '\\begin{center}',
        `\\includegraphics[width=${scale}\\textwidth]{${imageSrc}}`,
        captionLatex,
        '\\end{center}'
      ].filter(Boolean);
      const latexResult = latexLines.join('\n');
      console.log(`[REPLACE CUSTOM IMAGES] Generated LaTeX for image ${processedCount}`);
      console.log(`[REPLACE CUSTOM IMAGES] LaTeX width parameter: width=${scale}\\textwidth`);
      return latexResult;
    } else if (format === 'epub') {
      // HTML: center both image and caption with responsive design
      const percent = Math.round(scale * 100);
      const htmlResult = `<div style="text-align: center;">\n  <img src="${imageSrc}" alt="${alt}" style="max-width:${percent}%; height:auto;" loading="lazy" />` + (alt ? `\n  <div style="text-align: center;"><em>${alt}</em></div>` : '') + `\n</div>`;
      console.log(`[REPLACE CUSTOM IMAGES] Generated HTML for image ${processedCount}`);
      return htmlResult;
    } else if (format === 'docx') {
      // Markdown image only (caption handled by alt text)
      const markdownResult = alt ? `\n![${alt}](${imageSrc})\n` : `\n![](${imageSrc})\n`;
      console.log(`[REPLACE CUSTOM IMAGES] Generated Markdown for image ${processedCount}`);
      return markdownResult;
    } else {
      console.log(`[REPLACE CUSTOM IMAGES] Unknown format "${format}", returning original`);
      return match;
    }
  });
  
  console.log(`[REPLACE CUSTOM IMAGES] Completed processing ${processedCount} images`);
  console.log(`[REPLACE CUSTOM IMAGES] Output markdown length: ${result.length}`);
  
  return result;
}

/**
 * Clears any cached or transformed image references in markdown content
 * Useful for resolving persistent image issues
 */
function clearImageCache(markdown) {
  console.log(`[CACHE CLEAR] Clearing image cache from markdown`);
  
  // Remove any LaTeX includegraphics with Cloudinary URLs
  let cleaned = markdown.replace(/\\includegraphics(?:\[[^\]]*\])?\{https:\/\/res\.cloudinary\.com\/[^}]+\}/g, '');
  
  // Remove any markdown images with Cloudinary URLs  
  cleaned = cleaned.replace(/!\[[^\]]*\]\(https:\/\/res\.cloudinary\.com\/[^)]+\)/g, '');
  
  // Remove empty LaTeX center blocks that might be left behind
  cleaned = cleaned.replace(/\\begin\{center\}\s*\\end\{center\}/g, '');
  
  // Clean up excessive whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  console.log(`[CACHE CLEAR] Removed cached image references`);
  return cleaned;
}

/**
 * Debug function to analyze image content in markdown
 */
function analyzeImageContent(markdown) {
  const analysis = {
    customImages: [],
    cloudinaryUrls: [],
    latexImages: [],
    markdownImages: []
  };
  
  // Find custom {{IMAGE:...}} syntax
  const customMatches = [...markdown.matchAll(/\{\{IMAGE:([^|}]*)\|([^|}]*)\|([^|}]*)\}\}/g)];
  analysis.customImages = customMatches.map(m => ({ url: m[1], alt: m[2], scale: m[3] }));
  
  // Find Cloudinary URLs
  const cloudinaryMatches = [...markdown.matchAll(/https:\/\/res\.cloudinary\.com\/[^\s\[\](){}'"<>]+/g)];
  analysis.cloudinaryUrls = cloudinaryMatches.map(m => m[0]);
  
  // Find LaTeX includegraphics
  const latexMatches = [...markdown.matchAll(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g)];
  analysis.latexImages = latexMatches.map(m => m[1]);
  
  // Find markdown images
  const markdownMatches = [...markdown.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
  analysis.markdownImages = markdownMatches.map(m => ({ alt: m[1], url: m[2] }));
  
  console.log(`[IMAGE ANALYSIS] Custom images: ${analysis.customImages.length}`);
  console.log(`[IMAGE ANALYSIS] Cloudinary URLs: ${analysis.cloudinaryUrls.length}`);
  console.log(`[IMAGE ANALYSIS] LaTeX images: ${analysis.latexImages.length}`);
  console.log(`[IMAGE ANALYSIS] Markdown images: ${analysis.markdownImages.length}`);
  
  return analysis;
}

// Escapes LaTeX special characters in text for PDF export
function escapeLatexSpecialChars(text) {
  // Temporarily replace original backslashes with a placeholder
  text = text.replace(/\\/g, '<<BACKSLASH>>');
  // Escape curly braces first
  text = text.replace(/([{}])/g, '\\$1');
  // Escape other LaTeX special characters (except backslash)
  text = text
    .replace(/([#$%&_])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
  // Replace placeholder with LaTeX backslash
  return text.replace(/<<BACKSLASH>>/g, '\\textbackslash{}');
}

module.exports = { 
  removeEmojis, 
  saveDebugFile, 
  translateAlignmentDivsForDocx,
  getCloudinaryTransformation,
  replaceCustomImages,
  clearImageCache,
  analyzeImageContent,
  escapeLatexSpecialChars // Export the new function
}; 