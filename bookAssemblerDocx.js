const { assembleBookPlain } = require('./assembleBookPlain');
const { replaceCustomImages } = require('./utils');
const { getTocTitle } = require('./translations');
// DOCX-specific book assembler
function assembleBookDocx(sections, options = {}) {
  const {
    numberedHeadings = false,
    includeTitlePage = true,
    includeToc = true,
    metadata = {},
    language = 'en', // Default to English
  } = options;

  // Add YAML metadata block if present
  // Properly escape YAML string values
  const escapeYAML = (str) => {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')  // Escape backslashes first
      .replace(/"/g, '\\"')     // Escape double quotes
      .replace(/\n/g, '\\n')    // Escape newlines
      .replace(/\r/g, '\\r');   // Escape carriage returns
  };
  
  let output = '';
  if (metadata && (metadata.title || metadata.author || metadata.subtitle)) {
    output += '---\n';
    if (metadata.title) output += `title: "${escapeYAML(metadata.title)}"\n`;
    if (metadata.author) output += `author: "${escapeYAML(metadata.author)}"\n`;
    if (metadata.subtitle) output += `subtitle: "${escapeYAML(metadata.subtitle)}"\n`;
    output += `toc-title: "${escapeYAML(getTocTitle(language))}"\n`;
    output += '---\n\n';
  }

  // Optionally add title page
  if (includeTitlePage && sections.length > 0 && sections[0].title) {
    output += `# ${sections[0].title}\n\n`;
  }

  // Optionally add TOC
  if (includeToc) {
    output += '[TOC]\n\n';
  }

  // Main content with DOCX-specific page breaks
  let chapterCount = 1;
  for (let i = 0; i < sections.length; i++) {
    let section = sections[i];
    let content = replaceCustomImages(section.content || '', 'docx');
    
    // Skip empty sections - no content, no headings
    if (!content.trim()) {
      console.log(`[DOCX] Skipping empty section: ${section.title}`);
      continue;
    }
    
    if (numberedHeadings) {
      content = content.replace(/^# (.*)$/gm, (_, t) => `# Chapter ${chapterCount++}: ${t}`);
    }
    output += content.trim();
    // Insert DOCX page break between sections (except last)
    if (i < sections.length - 1) {
      output += '\n\n<div style="page-break-before: always;"></div>\n\n';
    } else {
      output += '\n\n';
    }
  }

  return output.trim();
}

module.exports = { assembleBookDocx }; 