const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { getTocTitle } = require('./translations');

// Use custom Pandoc version if available, fallback to system pandoc
// Handle Windows vs Linux defaults properly
const PANDOC_PATH = process.env.PANDOC_PATH || 
  (process.platform === 'win32' ? 'pandoc' : '/root/.cache/pandoc-3.6.4');

/**
 * Exports an EPUB using Pandoc.
 * @param {string} assembledPath - Path to the assembled markdown file.
 * @param {string} outputPath - Path to output the .epub file.
 * @param {Object} options - { title, author, tocDepth, language }
 */
function exportEpub(assembledPath, outputPath, options = {}) {
  // Use the persistent epub-style.css file
  const cssFile = path.join(__dirname, 'epub-style.css');

  // Read the CSS and inject the selected font-family
  let css = fs.readFileSync(cssFile, 'utf8');
  let fontFamily = options.fontFamily;
  if (!fontFamily) {
    const platform = os.platform();
    if (platform === 'win32') fontFamily = 'Times New Roman';
    else fontFamily = 'Liberation Serif';
  }
  // Replace the body font-family in the CSS
  css = css.replace(/font-family:[^;]+;/, `font-family: ${fontFamily}, serif;`);

  // Write the temp CSS file
  const tempCssFile = path.join(__dirname, `epub-style-${Date.now()}.css`);
  fs.writeFileSync(tempCssFile, css, 'utf8');

  const baseArgs = [
    assembledPath,
    '-f', 'markdown',
    '-o', outputPath,
    '--toc',
    '--toc-depth=2',
    '--css', tempCssFile,
    `--variable=toc-title:${getTocTitle(options.language || 'en')}`,
    '--variable=toc-unnumbered:true',
    '--standalone',
    '--top-level-division=chapter',
    // Enhanced image handling for better EPUB compatibility
    '--variable=graphics:true',
    '--variable=document-css:true'
  ];

  if (options.title) baseArgs.push('--metadata', `title=${options.title}`);
  if (options.author) baseArgs.push('--metadata', `author=${options.author}`);

  try {
    execFileSync(PANDOC_PATH, baseArgs, { stdio: 'inherit' });
    console.log(`EPUB successfully created at ${outputPath}`);
  } catch (error) {
    console.error('EPUB generation error:', error);
    throw error;
  } finally {
    // Clean up the temp CSS file
    if (fs.existsSync(tempCssFile)) fs.unlinkSync(tempCssFile);
  }
}

module.exports = { exportEpub }; 