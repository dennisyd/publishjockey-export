const { getTocTitle } = require('./translations');

// Shared book assembler logic for all formats

/**
 * Remove all emoji from a string (Unicode 13+)
 * @param {string} str
 * @returns {string}
 */
function removeEmojis(str) {
  return str.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
}

/**
 * Shared book assembler for all formats (plain logic)
 * @param {Array} sections - Array of {title, content}
 * @param {Object} options - { numberedHeadings, includeTitlePage, includeToc, metadata, removeEmojis: bool, language: string }
 * @returns {string} - Assembled markdown
 */
function assembleBookPlain(sections, options = {}) {
  const {
    numberedHeadings = false,
    includeTitlePage = true,
    includeToc = true, // (ignored for PDF, handled by Pandoc)
    metadata = {},
    removeEmojis: removeEmojiFlag = false,
    language = 'en', // Default to English
  } = options;

  let output = '';

  // Add YAML metadata block if present
  if (metadata && (metadata.title || metadata.author || metadata.subtitle)) {
    output += '---\n';
    if (metadata.title) output += `title: "${metadata.title.replace(/"/g, '\"')}"\n`;
    if (metadata.author) output += `author: "${metadata.author.replace(/"/g, '\"')}"\n`;
    if (metadata.subtitle) output += `subtitle: "${metadata.subtitle.replace(/"/g, '\"')}"\n`;
    output += `toc-title: "${getTocTitle(language)}"\n`;
    output += '---\n\n';
  }

  // Optionally add title page
  if (includeTitlePage && sections.length > 0 && sections[0].title) {
    output += `# ${sections[0].title}\n\n`;
  }

  // DO NOT add [TOC] marker here. Pandoc will generate TOC with --toc flag.

  // Main content
  let chapterCount = 1;
  for (let i = 0; i < sections.length; i++) {
    let section = sections[i];
    let content = section.content || '';
    
    // Skip empty sections - no content, no headings
    if (!content.trim()) {
      continue;
    }
    
    if (numberedHeadings) {
      content = content.replace(/^# (.*)$/gm, (_, t) => `# Chapter ${chapterCount++}: ${t}`);
    }
    if (removeEmojiFlag) {
      content = removeEmojis(content);
    }
    output += content.trim() + '\n\n';
  }

  return output.trim();
}

module.exports = { assembleBookPlain, removeEmojis };
