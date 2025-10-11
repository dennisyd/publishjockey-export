const { assembleBookPlain } = require('./assembleBookPlain');
const { replaceCustomImages } = require('./utils');
const { identifySpecialSections } = require('./utils/bookStructureLocalization');
// EPUB-specific book assembler
function assembleBookEpub(sections, options = {}) {
  const {
    numberedHeadings = false,
    includeTitlePage = true,
    includeToc = true,
    metadata = {},
  } = options;

  // Add YAML metadata block if present
  let output = '';
  const hasCustomMetadata = metadata && (metadata.title || metadata.tocTitle || metadata.tocDepth || metadata.numberSections !== undefined);
  if (hasCustomMetadata) {
    output += '---\n';
    // Properly escape YAML string values using single quotes (safer for YAML)
    // In single-quoted strings, only single quotes need escaping (by doubling them)
    const escapeYAMLSingle = (str) => {
      if (!str) return '';
      // Single quotes in YAML: escape single quotes by doubling them
      // Also handle any newlines/carriage returns by converting to spaces
      return str
        .replace(/\r?\n/g, ' ')   // Convert newlines to spaces
        .replace(/'/g, "''");      // Escape single quotes by doubling
    };
    
    if (metadata.title) output += `title: '${escapeYAMLSingle(metadata.title)}'\n`;
    if (metadata.tocTitle) output += `toc-title: '${escapeYAMLSingle(metadata.tocTitle)}'\n`;
    if (metadata.tocDepth) output += `toc-depth: ${metadata.tocDepth}\n`;
    if (metadata.numberSections !== undefined) output += `numbersections: ${metadata.numberSections}\n`;
    output += '---\n\n';  // Add extra newline after YAML block for clarity
  }

  // Find and extract copyright and title page sections
  const { titlePageSection, copyrightSection } = identifySpecialSections(sections);
  const otherSections = [];
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (!section.content || !section.content.trim()) continue;
    
    // Skip title page and copyright sections as they're handled separately
    if (section === titlePageSection || section === copyrightSection) {
      continue;
    }
    
    // Convert markdown tables to centered HTML tables in section content for EPUB only
    let centeredContent = convertMarkdownTablesToCenteredHtml(replaceCustomImages(section.content, 'epub'));
    
    // SANITIZE: Remove scale comments from EPUB content
    centeredContent = centeredContent.replace(/<!--\s*scale:[^>]*-->/gi, '');
    centeredContent = centeredContent.replace(/&lt;!--\s*scale:[^&]*--&gt;/gi, '');
    
    otherSections.push({ ...section, content: centeredContent });
  }

  // Insert Title Page (if present) as the very first content
  if (titlePageSection && (metadata.title || metadata.subtitle || metadata.author)) {
    const title = metadata.title || '';
    const subtitle = metadata.subtitle || '';
    const author = metadata.author || '';
    output += `<div class="title-block" style="page-break-before: always; break-before: page; text-align:center; margin-top: 3em; margin-bottom: 3em;">`;
    output += `<h1 style="font-size:2.5em; font-weight:bold; margin-bottom:0.7em;">${title}</h1>`;
    if (subtitle) output += `<h2 style="font-size:1.5em; font-weight:bold; margin-bottom:1.5em;">${subtitle}</h2>`;
    if (author) output += `<div style="font-size:1.1em; margin-bottom:2em;">${author}</div>`;
    output += `</div>`;
    // Optionally, add a blank page after
    // output += `<div style="page-break-before: always; break-before: page;"></div>`;
  }
  if (copyrightSection) {
    // Wrap copyright content in a div with both page-break-before and break-before for EPUB compatibility
    let copyrightContent = copyrightSection.content.trim();
    // SANITIZE: Remove scale comments from copyright content
    copyrightContent = copyrightContent.replace(/<!--\s*scale:[^>]*-->/gi, '');
    copyrightContent = copyrightContent.replace(/&lt;!--\s*scale:[^&]*--&gt;/gi, '');
    
    output += `<div style="page-break-before: always; break-before: page;">
${copyrightContent}
</div>\n\n`;
  }

  // Determine if chapter labels are enabled
  const chapterLabelsEnabled = (options.useChapterPrefix !== false) || (options.chapterLabelFormat !== 'none');

  // Prepare TOC data for main-matter sections
  const tocData = [];
  let chapterCount = 1;
  const processedSections = otherSections
    .filter(section => {
      // Skip empty sections - no content, no headings
      const hasContent = section.content && section.content.trim();
      if (!hasContent) {
        console.log(`[EPUB] Skipping empty section: ${section.title}`);
        return false;
      }
      return true;
    })
    .map((section, idx) => {
    let content = section.content || '';
    let anchor = '';
    let subtitle = '';
    let originalHeadingText = '';
    // Treat every section with matter === 'main' as a chapter
    if (section.matter === 'main' && chapterLabelsEnabled) {
      // Find the first level 1 heading at the start of the content
      let newContent = content;
      let originalHeadingText = '';
      let subtitle = '';
      // Match a level 1 heading at the start (allow whitespace before)
      const headingMatch = newContent.match(/^\s*#\s+(.+)$/m);
      if (headingMatch) {
        // Remove the heading from the content
        const lines = newContent.split(/\r?\n/);
        const h1Index = lines.findIndex(line => /^\s*#\s+/.test(line));
        if (h1Index !== -1) {
          originalHeadingText = lines[h1Index].replace(/^\s*#\s+/, '').trim();
          // Check if the next line is a non-empty, non-heading line (subtitle)
          let nextLine = '';
          if (lines.length > h1Index + 1) {
            nextLine = lines[h1Index + 1].trim();
            if (nextLine && !/^\s*#/.test(nextLine) && !/^\s*##/.test(nextLine)) {
              subtitle = nextLine;
              // Remove both lines
              lines.splice(h1Index, 2);
            } else {
              // Only remove the H1
              lines.splice(h1Index, 1);
            }
          } else {
            // Only remove the H1
            lines.splice(h1Index, 1);
          }
          newContent = lines.join('\n').trim();
        }
      }
      // Generate anchor from subtitle or heading
      let anchor = subtitle || originalHeadingText;
      anchor = anchor ? anchor.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-') : `chapter-${chapterCount}`;
      // Save TOC entry
      tocData.push({ anchor, subtitle: subtitle || originalHeadingText || `Chapter ${chapterCount}` });
      // Always insert the custom chapter heading block with anchor and print to console
      const chapterDiv = `<div id="${anchor}" style="text-align: center; margin-top: 2em; margin-bottom: 1em;">
  <div style="font-size: 2em; font-weight: bold;">Chapter ${chapterCount}</div>
  <div style=\"font-size: 1.25em; font-weight: bold; margin-top: 0.5em;\">${subtitle || originalHeadingText}</div>
</div>\n\n`;
      console.log('EPUB Chapter Heading Div for Chapter', chapterCount, ':\n', chapterDiv);
      // Return processed section
      const result = {
        ...section,
        content: newContent,
        anchor,
        chapterLabel: `Chapter ${chapterCount}`,
        subtitle: subtitle || originalHeadingText,
        isMainMatter: true
      };
      chapterCount++;
      return result;
    } else {
      // Not main matter or chapter labels off
      return { ...section, content, isMainMatter: false };
    }
  });

  // Insert custom TOC page (before main content)
  if (chapterLabelsEnabled && tocData.length > 0) {
    // output += `<div style="page-break-before: always; break-before: page;">
    //   <h1 style="text-align:center;">CONTENTS</h1>
    //   <ul style="list-style:none; padding-left:0;">
    //     ${tocData.map(e => `<li><a href="#${e.anchor}">${e.subtitle}</a></li>`).join('\n    ')}
    //   </ul>
    // </div>\n\n`;
  }

  // Add the rest of the sections (excluding copyright and title page)
  chapterCount = 1;
  for (let i = 0; i < processedSections.length; i++) {
    let section = processedSections[i];
    let content = section.content || '';
    if (section.isMainMatter && chapterLabelsEnabled) {
      // Output the page break, hidden h1, and custom heading as separate blocks
      output += `<!-- Page break -->\n`;
      output += `<div style="page-break-before: always; break-before: page;"></div>\n`;
      // Visually hidden semantic heading for TOC/navigation
      output += `<!-- Visually hidden semantic heading for TOC/navigation -->\n`;
      output += `<h1 id="${section.anchor}" style="position: absolute; left: -10000px; top: auto; width: 1px; height: 1px; overflow: hidden;">${section.subtitle}</h1>\n`;
      // Visible custom heading
      output += `<!-- Visible custom heading -->\n`;
      const chapterDiv = `<div id="${section.anchor}" style="text-align: center; margin-top: 2em; margin-bottom: 1em;">
  <div style="font-size: 2em; font-weight: bold;">${section.chapterLabel}</div>
  <div style=\"font-size: 1.25em; font-weight: bold; margin-top: 0.5em;\">${section.subtitle}</div>
</div>\n\n`;
      console.log('EPUB Chapter Heading Div for Chapter', section.chapterLabel, ':\n', chapterDiv);
      output += chapterDiv;
      output += content + '\n\n';
    } else {
      // For non-main-matter sections, also wrap in a page-break div
      output += `<div style="page-break-before: always; break-before: page;">\n${content.trim()}\n</div>\n\n`;
    }
  }

  let finalOutput = output.trim();
  
  // FINAL SANITIZE: Remove any remaining scale comments from the entire EPUB output
  finalOutput = finalOutput.replace(/<!--\s*scale:[^>]*-->/gi, '');
  finalOutput = finalOutput.replace(/&lt;!--\s*scale:[^&]*--&gt;/gi, '');
  console.log('[EPUB SANITIZE] Final scale comment cleanup completed');

  // Write the HTML output to a temp file for debugging
  try {
    const fs = require('fs');
    const path = require('path');
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const debugFile = path.join(tempDir, `epub_debug_${Date.now()}.html`);
    fs.writeFileSync(debugFile, finalOutput, 'utf8');
    console.log('EPUB debug HTML written to:', debugFile);
  } catch (err) {
    console.error('Failed to write EPUB debug HTML:', err);
  }

  return finalOutput;
}

// Utility: Convert Markdown tables to scrollable, auto-scaling, fancy HTML tables
function convertMarkdownTablesToCenteredHtml(markdown) {
  // Regex to match markdown tables (header, separator, at least one row)
  const tableRegex = /((?:^\|.*\|\s*\n)+^\|(?:\s*-+\s*\|)+\s*\n(?:^\|.*\|\s*\n*)+)/gm;
  return markdown.replace(tableRegex, (match) => {
    // Split table into lines
    const lines = match.trim().split('\n');
    if (lines.length < 2) return match; // Not a valid table

    // Extract header, separator, and rows
    const header = lines[0].split('|').map(cell => cell.trim()).filter(Boolean);
    const rows = lines.slice(2).map(line =>
      line.split('|').map(cell => cell.trim()).filter(Boolean)
    );

    // Scrollable div and table styles
    const divStyle = 'overflow-x: auto;';
    const tableStyle = [
      'min-width: 600px',
      'border-collapse: collapse',
      'margin: 0 auto',
      "font-family: 'Times New Roman', serif",
      'font-size: 1em',
      'text-align: center',
      'border: 1px solid #999'
    ].join('; ');
    const theadStyle = 'background-color: #f2f2f2;';
    const thtdStyle = 'padding: 8px; border: 1px solid #999;';

    // Build HTML table
    let html = `<div style="${divStyle}">\n<table style="${tableStyle}">\n  <thead style=\"${theadStyle}\">\n    <tr>`;
    header.forEach(cell => { html += `<th style=\"${thtdStyle}\">${cell}</th>`; });
    html += '</tr>\n  </thead>\n  <tbody>\n';
    rows.forEach(row => {
      html += '    <tr>';
      row.forEach(cell => { html += `<td style=\"${thtdStyle}\">${cell}</td>`; });
      html += '</tr>\n';
    });
    html += '  </tbody>\n</table>\n</div>\n';

    return html;
  });
}

module.exports = { assembleBookEpub }; 