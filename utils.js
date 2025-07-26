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
  // Only apply transformations to Cloudinary URLs
  if (!imageSrc.includes('cloudinary.com')) {
    return imageSrc;
  }
  
  // Parse URL to inject transformations
  const urlParts = imageSrc.split('/upload/');
  if (urlParts.length !== 2) {
    return imageSrc; // Invalid Cloudinary URL structure
  }
  
  let transformation = '';
  
  if (format === 'pdf') {
    // High-quality for print, avoid auto parameters that cause issues
    const widthPx = Math.round(800 * scale);
    transformation = `w_${widthPx},c_limit,q_90`;
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
    return imageSrc;
  }
  
  // Construct the transformed URL
  return `${urlParts[0]}/upload/${transformation}/${urlParts[1]}`;
}

/**
 * Replaces custom image placeholders with format-specific output.
 * Enhanced with Cloudinary optimization support.
 * @param {string} markdown - The markdown content
 * @param {string} format - 'pdf', 'epub', or 'docx'
 * @returns {string} - The processed markdown
 */
function replaceCustomImages(markdown, format) {
  if (format === 'docx') {
    // Translate alignment divs for DOCX before replacing images
    markdown = translateAlignmentDivsForDocx(markdown);
  }
  
  return markdown.replace(/\{\{IMAGE:([^|}]*)\|([^|}]*)\|([^|}]*)\}\}/g, (match, src, alt, scale) => {
    src = src.replace(/\\/g, '/'); // Always use forward slashes
    scale = parseFloat(scale) || 0.6; // Default scale if empty or invalid
    
    // Provide default alt text if empty
    if (!alt || alt.trim() === '') {
      alt = 'Image';
    }
    
    // Apply Cloudinary transformations if applicable
    const optimizedSrc = getCloudinaryTransformation(src, format, scale);
    
    // For PDF: Keep full URL so prepareMarkdownForPDF can download it, then replace with local filename
    // For other formats: Use the optimized URL directly
    const imageSrc = optimizedSrc;
    
    if (format === 'pdf') {
      // For PDF, use a non-floating approach with raw centering and caption
      return `
\\begin{center}
\\includegraphics[width=${scale}\\textwidth]{${imageSrc}}

{\\itshape ${alt.replace(/([%#&{}_])/g, '\\$1')}}
\\end{center}
`;
    } else if (format === 'epub') {
      // HTML: center both image and caption with responsive design
      const percent = Math.round(scale * 100);
      return `<div style="text-align: center;">\n  <img src="${imageSrc}" alt="${alt}" style="max-width:${percent}%; height:auto;" loading="lazy" />\n  <div style="text-align: center;"><em>${alt}</em></div>\n</div>`;
    } else if (format === 'docx') {
      // Markdown image only (caption handled by alt text)
      return `\n![${alt}](${imageSrc})\n`;
    } else {
      return match;
    }
  });
}

module.exports = { removeEmojis, saveDebugFile, replaceCustomImages, getCloudinaryTransformation }; 