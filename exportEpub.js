const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

/**
 * Exports an EPUB using Pandoc.
 * @param {string} assembledPath - Path to the assembled markdown file.
 * @param {string} outputPath - Path to output the .epub file.
 * @param {Object} options - { title, author, tocDepth }
 */
function exportEpub(assembledPath, outputPath, options = {}) {
  // Use the persistent epub-style.css file
  const cssFile = path.join(__dirname, 'epub-style.css');
  
  const baseArgs = [
    assembledPath,
    '-f', 'markdown',
    '-o', outputPath,
    '--toc',
    '--toc-depth=2',
    '--css', cssFile,
    '--variable=toc-title:CONTENTS',
    '--variable=toc-unnumbered:true',
    '--standalone',
    '--split-level=1',
    '--top-level-division=chapter'
  ];
  
  if (options.title) baseArgs.push('--metadata', `title=${options.title}`);
  if (options.author) baseArgs.push('--metadata', `author=${options.author}`);
  
  try {
    execFileSync('pandoc', baseArgs, { stdio: 'inherit' });
    console.log(`EPUB successfully created at ${outputPath}`);
  } catch (error) {
    console.error('EPUB generation error:', error);
    throw error;
  }
}

module.exports = { exportEpub }; 