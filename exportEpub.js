const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { getTocTitle } = require('./translations');
const AdmZip = require('adm-zip');

// Use custom Pandoc version if available, fallback to system pandoc
// Handle Windows vs Linux defaults properly
const PANDOC_PATH = process.env.PANDOC_PATH ||
  (process.platform === 'win32' ? 'pandoc' : '/root/.cache/pandoc-3.6.4');

/**
 * Sanitizes XHTML files in the EPUB text directory for EPUB 3.3 compliance
 * @param {string} epubTextDir - Path to the EPUB text directory containing XHTML files
 */
function sanitizeXhtmlFiles(epubTextDir) {
  console.log(`[EPUB Sanitization] Scanning XHTML files in: ${epubTextDir}`);

  if (!fs.existsSync(epubTextDir)) {
    console.log(`[EPUB Sanitization] Text directory not found: ${epubTextDir}`);
    return;
  }

  // Recursively find all .xhtml files
  const xhtmlFiles = getAllXhtmlFiles(epubTextDir);
  console.log(`[EPUB Sanitization] Found ${xhtmlFiles.length} XHTML files to sanitize`);

  xhtmlFiles.forEach(filePath => {
    try {
      console.log(`[EPUB Sanitization] Processing: ${path.relative(epubTextDir, filePath)}`);

      let content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;

      // Fix malformed <img> tags
      content = fixImgTags(content);

      // Fix other potential markup issues
      content = fixMarkupIssues(content);

      // Only write if content changed
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[EPUB Sanitization] Fixed markup in: ${path.relative(epubTextDir, filePath)}`);
      }
    } catch (fileError) {
      console.error(`[EPUB Sanitization] Error processing file ${filePath}:`, fileError);
      // Continue with other files instead of crashing
    }
  });

  console.log(`[EPUB Sanitization] XHTML sanitization complete`);
}

/**
 * Recursively finds all .xhtml files in a directory
 * @param {string} dir - Directory to search
 * @returns {string[]} Array of file paths
 */
function getAllXhtmlFiles(dir) {
  const files = [];

  function scanDirectory(currentDir) {
    const items = fs.readdirSync(currentDir);

    items.forEach(item => {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (item.endsWith('.xhtml')) {
        files.push(fullPath);
      }
    });
  }

  scanDirectory(dir);
  return files;
}

/**
 * Fixes malformed <img> tags and other markup issues
 * @param {string} content - XHTML content to fix
 * @returns {string} Fixed content
 */
function fixImgTags(content) {
  let fixed = content;

  // Fix missing equals sign in alt attribute: alt"Cover" → alt="Cover"
  // This catches: <img ... alt"value" ...>
  fixed = fixed.replace(/<img([^>]*?)\s+alt"([^"]*)"([^>]*?)>/gi, (match, before, altValue, after) => {
    console.log(`[EPUB Sanitization] Fixed alt attribute without =: alt"${altValue}"`);
    return `<img${before} alt="${altValue}"${after}>`;
  });

  // Fix missing equals sign for any attribute directly followed by quote
  // This catches: <img ... src"value" ...> or any other attribute
  fixed = fixed.replace(/<img([^>]*?)\s+(\w+)"([^"]*)"([^>]*?)>/gi, (match, before, attr, value, after) => {
    console.log(`[EPUB Sanitization] Fixed ${attr} attribute without =: ${attr}"${value}"`);
    return `<img${before} ${attr}="${value}"${after}>`;
  });

  // Ensure all <img> tags are self-closing
  fixed = fixed.replace(/<img([^>]*?)(?<!\/)>/gi, '<img$1 />');

  // Add alt attribute if missing
  fixed = fixed.replace(/<img(?![^>]*\salt\s*=)([^>]*?)\/?>/gi, (match, attrs) => {
    console.log(`[EPUB Sanitization] Added missing alt attribute`);
    return `<img alt=""${attrs} />`;
  });

  return fixed;
}

/**
 * Fixes other potential markup issues in XHTML
 * @param {string} content - XHTML content to fix
 * @returns {string} Fixed content
 */
function fixMarkupIssues(content) {
  return content
    // Ensure <meta> tags are self-closing
    .replace(/<meta([^>]*)(?<!\/)>/gi, '<meta$1 />')

    // Ensure <link> tags are self-closing
    .replace(/<link([^>]*)(?<!\/)>/gi, '<link$1 />')

    // Fix unquoted attributes (basic cases)
    .replace(/<(\w+)([^>]*)\s(\w+)=([^"\s>]+)([^>]*?)>/gi, (match, tag, before, attr, value, after) => {
      // Only fix simple cases to avoid breaking complex attributes
      if (!value.includes(' ') && !value.includes('=')) {
        return `<${tag}${before} ${attr}="${value}"${after}>`;
      }
      return match;
    });
}

/**
 * Ensures a file is UTF-8 encoded
 * @param {string} filePath - Path to the file to check/fix
 */
function ensureUtf8Encoding(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath);
  let encoding = 'utf8';

  // Detect encoding by checking BOM
  if (content.length >= 3) {
    if (content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF) {
      // UTF-8 BOM
      encoding = 'utf8';
    } else if (content[0] === 0xFF && content[1] === 0xFE) {
      // UTF-16 LE BOM
      encoding = 'utf16le';
    } else if (content[0] === 0xFE && content[1] === 0xFF) {
      // UTF-16 BE BOM
      encoding = 'utf16be';
    }
  }

  if (encoding !== 'utf8') {
    console.log(`[EPUB Encoding] Converting ${filePath} from ${encoding} to UTF-8`);
    const utf8Content = content.toString('utf8');
    fs.writeFileSync(filePath, utf8Content, 'utf8');
  } else {
    // Ensure it's properly written as UTF-8 even if it was already UTF-8
    const utf8Content = content.toString('utf8');
    fs.writeFileSync(filePath, utf8Content, 'utf8');
  }
}

/**
 * Sanitizes a generated EPUB file for EPUB 3.3 compliance
 * Extracts the EPUB, sanitizes XHTML files, ensures UTF-8 encoding, and repackages
 * @param {string} epubPath - Path to the generated EPUB file
 */
async function sanitizeGeneratedEpub(epubPath) {
  console.log(`[EPUB Sanitization] Starting EPUB sanitization for: ${epubPath}`);

  if (!fs.existsSync(epubPath)) {
    console.error(`[EPUB Sanitization] EPUB file not found: ${epubPath}`);
    return;
  }

  const tempDir = path.join(os.tmpdir(), `epub-sanitization-${uuidv4()}`);
  const epubDir = path.join(tempDir, 'epub');

  try {
    // Create temporary directory
    fs.mkdirSync(epubDir, { recursive: true });
    console.log(`[EPUB Sanitization] Created temp directory: ${epubDir}`);

    // Extract EPUB contents
    console.log(`[EPUB Sanitization] Extracting EPUB to: ${epubDir}`);
    try {
      const zip = new AdmZip(epubPath);
      zip.extractAllTo(epubDir, true);
      console.log(`[EPUB Sanitization] Extraction completed successfully`);
    } catch (extractError) {
      console.error(`[EPUB Sanitization] Failed to extract EPUB:`, extractError);
      throw extractError;
    }

    // Find and sanitize XHTML files in /EPUB/text/ directory
    const textDir = path.join(epubDir, 'EPUB', 'text');
    if (fs.existsSync(textDir)) {
      sanitizeXhtmlFiles(textDir);
    }

    // Ensure UTF-8 encoding for all files in the EPUB
    ensureUtf8EncodingForAllFiles(epubDir);

    // Repackage the EPUB with proper mimetype handling
    console.log(`[EPUB Sanitization] Repackaging EPUB: ${epubPath}`);
    try {
      const sanitizedZip = new AdmZip();
      
      // CRITICAL: Add mimetype file FIRST without compression (EPUB requirement)
      const mimetypePath = path.join(epubDir, 'mimetype');
      if (fs.existsSync(mimetypePath)) {
        const mimetypeContent = fs.readFileSync(mimetypePath);
        sanitizedZip.addFile('mimetype', mimetypeContent, '', 0); // 0 = no compression
        console.log(`[EPUB Sanitization] Added mimetype as first entry (uncompressed)`);
      } else {
        console.warn(`[EPUB Sanitization] Warning: mimetype file not found at ${mimetypePath}`);
      }
      
      // Add all other files and directories
      console.log(`[EPUB Sanitization] Adding remaining files to ZIP...`);
      addDirectoryToZip(sanitizedZip, epubDir, '', true); // true = skip mimetype
      
      console.log(`[EPUB Sanitization] Writing sanitized EPUB to ${epubPath}...`);
      sanitizedZip.writeZip(epubPath);
      
      console.log(`[EPUB Sanitization] EPUB sanitization completed successfully`);
    } catch (repackError) {
      console.error(`[EPUB Sanitization] Failed to repackage EPUB:`, repackError);
      throw repackError;
    }

  } catch (error) {
    console.error(`[EPUB Sanitization] Error during sanitization:`, error);
    throw error;
  } finally {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      // Use fs.rm if available (Node 14+), fallback to recursive deletion
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (rmError) {
        // Fallback for older Node.js versions
        deleteFolderRecursive(tempDir);
      }
      console.log(`[EPUB Sanitization] Cleaned up temp directory: ${tempDir}`);
    }
  }
}

/**
 * Ensures UTF-8 encoding for all files in the EPUB directory
 * @param {string} epubDir - Path to the extracted EPUB directory
 */
function ensureUtf8EncodingForAllFiles(epubDir) {
  console.log(`[EPUB Encoding] Ensuring UTF-8 encoding for all files in: ${epubDir}`);

  function processDirectory(dir) {
    const items = fs.readdirSync(dir);

    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        processDirectory(fullPath);
      } else {
        // Skip binary files (images, fonts, etc.)
        const ext = path.extname(item).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.gif', '.svg', '.woff', '.woff2', '.ttf', '.otf'].includes(ext)) {
          ensureUtf8Encoding(fullPath);
        }
      }
    });
  }

  processDirectory(epubDir);
  console.log(`[EPUB Encoding] UTF-8 encoding check completed`);
}

/**
 * Recursively adds a directory to a ZIP archive
 * @param {AdmZip} zip - The ZIP archive to add to
 * @param {string} dirPath - Path to the directory to add
 * @param {string} zipPath - Path within the ZIP archive
 * @param {boolean} skipMimetype - Whether to skip the mimetype file (already added)
 */
function addDirectoryToZip(zip, dirPath, zipPath, skipMimetype = false) {
  const items = fs.readdirSync(dirPath);

  items.forEach(item => {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    // Skip mimetype file if flag is set (it was already added first)
    if (skipMimetype && item === 'mimetype' && zipPath === '') {
      console.log(`[EPUB Sanitization] Skipping mimetype file (already added as first entry)`);
      return;
    }

    if (stat.isDirectory()) {
      const subZipPath = path.join(zipPath, item).replace(/\\/g, '/');
      addDirectoryToZip(zip, fullPath, subZipPath, skipMimetype);
    } else {
      const entryPath = path.join(zipPath, item).replace(/\\/g, '/');
      const zipDir = path.dirname(entryPath);
      zip.addLocalFile(fullPath, zipDir === '.' ? '' : zipDir);
    }
  });
}

/**
 * Recursively deletes a folder and all its contents (fallback for older Node.js)
 * @param {string} dirPath - Path to the directory to delete
 */
function deleteFolderRecursive(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.readdirSync(dirPath).forEach(file => {
      const curPath = path.join(dirPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(dirPath);
  }
}

/**
 * Exports an EPUB using Pandoc.
 * @param {string} assembledPath - Path to the assembled markdown file.
 * @param {string} outputPath - Path to output the .epub file.
 * @param {Object} options - { title, author, tocDepth, language }
 */
async function exportEpub(assembledPath, outputPath, options = {}) {
  // Use the persistent epub-style.css file
  const cssFile = path.join(__dirname, 'epub-style.css');

  // Read the CSS and inject the selected font-family
  // Ensure UTF-8 encoding for EPUB3 compliance
  let css = fs.readFileSync(cssFile, 'utf8');
  console.log(`CSS file read, length: ${css.length} characters`);

  // Clean up any potential BOM or encoding artifacts
  css = css.replace(/^\uFEFF/, ''); // Remove BOM if present
  css = css.replace(/\u0000/g, ''); // Remove any null bytes

  console.log(`CSS processed for EPUB3, final length: ${css.length}`);
  let fontFamily = options.fontFamily;
  if (!fontFamily) {
    const platform = os.platform();
    if (platform === 'win32') fontFamily = 'Times New Roman';
    else fontFamily = 'Liberation Serif';
  }
  // Replace the body font-family in the CSS
  css = css.replace(/font-family:[^;]+;/, `font-family: ${fontFamily}, serif;`);

  // Write the temp CSS file with explicit UTF-8 encoding
  const tempCssFile = path.join(__dirname, `epub-style-${Date.now()}.css`);
  fs.writeFileSync(tempCssFile, css, 'utf8');
  console.log(`CSS file written as UTF-8: ${tempCssFile}`);

  const baseArgs = [
    assembledPath,
    '-f', 'markdown+utf8',
    '-t', 'epub3',
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
    '--variable=document-css:true',
    // Force UTF-8 encoding for EPUB3 compliance
    '--metadata', 'encoding=utf-8',
    // Ensure CSS is treated as UTF-8
    '--css-encoding=utf-8'
  ];

  if (options.title) baseArgs.push('--metadata', `title=${options.title}`);
  if (options.author) baseArgs.push('--metadata', `author=${options.author}`);

  try {
    execFileSync(PANDOC_PATH, baseArgs, { stdio: 'inherit' });
    console.log(`EPUB successfully created at ${outputPath}`);

    // Sanitize the generated EPUB for EPUB 3.3 compliance
    await sanitizeGeneratedEpub(outputPath);

    console.log(`EPUB sanitization completed for ${outputPath}`);
  } catch (error) {
    console.error('EPUB generation error:', error);
    throw error;
  } finally {
    // Clean up the temp CSS file
    if (fs.existsSync(tempCssFile)) fs.unlinkSync(tempCssFile);
  }
}

module.exports = { exportEpub, sanitizeGeneratedEpub }; 