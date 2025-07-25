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
 * Gets Cloudinary transformation URL for specific book format
 * @param {string} cloudinaryUrl - Original Cloudinary URL
 * @param {string} format - 'pdf', 'epub', or 'docx'
 * @param {number} scale - Image scale factor
 * @returns {string} - Optimized Cloudinary URL
 */
function getCloudinaryTransformation(cloudinaryUrl, format, scale = 0.6) {
  // Check if this is a Cloudinary URL
  if (!cloudinaryUrl.includes('cloudinary.com')) {
    return cloudinaryUrl; // Return unchanged if not Cloudinary
  }
  
  // Extract the transformation part and image path
  const urlParts = cloudinaryUrl.split('/upload/');
  if (urlParts.length !== 2) return cloudinaryUrl;
  
  const baseUrl = urlParts[0] + '/upload/';
  const imagePath = urlParts[1];
  
  let transformation = '';
  
  if (format === 'pdf') {
    // High-quality for print: DPI-aware, lossless compression
    const widthPx = Math.round(scale * 800); // Assume 800px max width for PDF
    transformation = `w_${widthPx},c_limit,f_auto,q_auto:best,dpr_2.0`;
  } else if (format === 'epub') {
    // Web-optimized: smaller file size, progressive loading
    const widthPx = Math.round(scale * 600); // Smaller for EPUB
    transformation = `w_${widthPx},c_limit,f_auto,q_auto:good,fl_progressive`;
  } else if (format === 'docx') {
    // Balanced: good quality, reasonable file size
    const widthPx = Math.round(scale * 700);
    transformation = `w_${widthPx},c_limit,f_auto,q_auto:good`;
  }
  
  return `${baseUrl}${transformation}/${imagePath}`;
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