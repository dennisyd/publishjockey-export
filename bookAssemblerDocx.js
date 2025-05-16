const { assembleBookPlain } = require('./assembleBookPlain');
const { replaceCustomImages } = require('./utils');
// DOCX-specific book assembler
function assembleBookDocx(sections, options = {}) {
  const {
    numberedHeadings = false,
    includeTitlePage = true,
    includeToc = true,
    metadata = {},
  } = options;

  // Add YAML metadata block if present
  let output = '';
  if (metadata && (metadata.title || metadata.author || metadata.subtitle)) {
    output += '---\n';
    if (metadata.title) output += `title: "${metadata.title.replace(/"/g, '\"')}"\n`;
    if (metadata.author) output += `author: "${metadata.author.replace(/"/g, '\"')}"\n`;
    if (metadata.subtitle) output += `subtitle: "${metadata.subtitle.replace(/"/g, '\"')}"\n`;
    output += 'toc-title: "CONTENTS"\n';
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