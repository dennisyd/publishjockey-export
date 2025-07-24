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
 * Replaces custom image placeholders with format-specific output.
 * @param {string} markdown - The markdown content
 * @param {string} format - 'pdf', 'epub', or 'docx'
 * @returns {string} - The processed markdown
 */
function replaceCustomImages(markdown, format) {
  if (format === 'docx') {
    // Translate alignment divs for DOCX before replacing images
    markdown = translateAlignmentDivsForDocx(markdown);
  }
  return markdown.replace(/\{\{IMAGE:([^|}]+)\|([^|}]+)\|([^|}]+)\}\}/g, (match, src, alt, scale) => {
    src = src.replace(/\\/g, '/'); // Always use forward slashes
    scale = parseFloat(scale);
    
    // Extract just the filename from the path for PDF (since images are copied to temp dir)
    const imageFilename = format === 'pdf' ? path.basename(src) : src;
    
    if (format === 'pdf') {
      // For PDF, use a non-floating approach with raw centering and caption
      return `
\\begin{center}
\\includegraphics[width=${scale}\\textwidth]{${imageFilename}}

{\\itshape ${alt.replace(/([%#&{}_])/g, '\\$1')}}
\\end{center}
`;
    } else if (format === 'epub') {
      // HTML: center both image and caption
      const percent = Math.round(scale * 100);
      return `<div style="text-align: center;">\n  <img src="${src}" alt="${alt}" style="max-width:${percent}%;" />\n  <div style="text-align: center;"><em>${alt}</em></div>\n</div>`;
    } else if (format === 'docx') {
      // Markdown image only (caption handled by alt text)
      return `\n![${alt}](${src})\n`;
    } else {
      return match;
    }
  });
}

module.exports = { removeEmojis, saveDebugFile, replaceCustomImages }; 