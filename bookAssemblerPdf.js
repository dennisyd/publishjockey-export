// PDF-specific book assembler
const { removeEmojis } = require('./utils');
const { assembleBookPlain } = require('./assembleBookPlain');
const { replaceCustomImages } = require('./utils');

/**
 * Processes markdown content to automatically number chapters.
 * - Each level 1 heading gets transformed into a centered div with Chapter and title
 * - All other content is preserved
 * - Clean blank lines are maintained
 */
function rewriteMarkdownWithStyledChapters(markdown) {
  const lines = markdown.split('\n');
  let chapter = 1;
  const output = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match a level 1 heading (starts with exactly one '# ' and not more)
    const h1Match = /^# (?!#)(.*)/.exec(line);
    
    if (h1Match) {
      const headingText = h1Match[1].trim();
      
      // Skip if the heading already contains just "Chapter X" with no other text
      if (headingText.match(/^Chapter\s+\d+$/i)) {
        output.push(line);
        continue;
      }
      
      // Extract title if the heading starts with "Chapter X"
      const chapterTitleMatch = headingText.match(/^Chapter\s+(\d+)\s+(.*)/i);
      if (chapterTitleMatch) {
        const chapterNum = chapterTitleMatch[1];
        const title = chapterTitleMatch[2];
        
        // Format using proper HTML elements - no explicit clearpage
        output.push('');
        output.push(`<div style="text-align:center;">`);
        output.push(`  <h1>Chapter ${chapterNum}</h1>`);
        output.push(`  <div style="font-size:14pt; font-weight:bold;">${title}</div>`);
        output.push(`</div>`);
        output.push('');
      } else {
        // Format using proper HTML elements - no explicit clearpage
        output.push('');
        output.push(`<div style="text-align:center;">`);
        output.push(`  <h1>Chapter ${chapter++}</h1>`);
        output.push(`  <div style="font-size:14pt; font-weight:bold;">${headingText}</div>`);
        output.push(`</div>`);
        output.push('');
      }
    } else {
      output.push(line);
    }
  }
  
  // Remove any extra blank lines at the start/end
  return output.join('\n').replace(/^\s*\n/, '').replace(/\n\s*$/, '') + '\n';
}

function assembleBookPdf(sections, options = {}) {
  const {
    useAutoChapterNumbers = false,
    numberedHeadings = false,
    includeTitlePage = true,
    metadata = {},
  } = options;

  // Create a complete document
  let output = '';
  
  // Add YAML metadata block if present, but DO NOT include title, author, or subtitle
  output += '---\n';
  if (metadata.title) output += `title: "${metadata.title.replace(/"/g, '\"')}"\n`;
  if (metadata.author) output += `author: "${metadata.author.replace(/"/g, '\"')}"\n`;
  if (metadata.subtitle) output += `subtitle: "${metadata.subtitle.replace(/"/g, '\"')}"\n`;
  if (metadata.isbn) output += `isbn: "${metadata.isbn.replace(/"/g, '\"')}"\n`;
  output += 'toc-title: "CONTENTS"\n';
  // INCREASED footskip to move page numbers HIGHER on the page (farther from bottom)
  output += 'geometry: "footskip=1.0in"\n';
  // Add header-includes for consistent page styles
  output += 'header-includes: |\n';
  output += '  % Force larger footskip on ALL pages including frontmatter\n';
  output += '  \\setlength{\\footskip}{1.0in}\n';
  output += '  % Use same page style for ALL pages\n';
  output += '  \\pagestyle{plain}\n';
  output += '  \\usepackage{fancyhdr}\n';
  output += '  \\fancypagestyle{plain}{%\n';
  output += '    \\fancyhf{}\n'; 
  output += '    \\fancyfoot[C]{\\thepage}\n';
  output += '  }\n';
  output += '  \\fancypagestyle{empty}{%\n';
  output += '    \\fancyhf{}\n';
  output += '    \\fancyfoot[C]{\\thepage}\n';
  output += '  }\n';
  output += '  \\usepackage{longtable}\n';
  output += '---\n\n';
  
  // Find and extract copyright and title page sections
  let copyrightSection = null;
  let titlePageSection = null;
  const otherSections = [];
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (!section.content || !section.content.trim()) continue;
    const title = section.title ? section.title.toLowerCase() : '';
    if (!copyrightSection && title.includes('copyright')) {
      copyrightSection = section;
      continue;
    }
    if (!titlePageSection && title.includes('title page')) {
      titlePageSection = section;
      continue;
    }
    otherSections.push({ ...section, content: replaceCustomImages(section.content, 'pdf') });
  }

  // Insert Title Page (if present), then Copyright (if present), then TOC, then rest
  if (titlePageSection) {
    output += '```{=latex}\n';
    output += '\\clearpage\n';
    output += '\\thispagestyle{empty}\n';
    output += '```\n\n';
    // Center each line of the title page content
    const titleLines = replaceCustomImages(titlePageSection.content, 'pdf').split(/\r?\n/);
    let firstNonEmptyFound = false;
    const centeredTitlePage = titleLines
      .map(line => {
        const trimmed = line.trim();
        // If already a LaTeX center block or empty, leave as is
        if (/^\\begin\{center\}/.test(trimmed) || /^\\end\{center\}/.test(trimmed) || trimmed === '') {
          return line;
        }
        // If already markdown/HTML centered, leave as is
        if (trimmed.startsWith('<div style="text-align:center;">') || trimmed.startsWith('</div>')) {
          return line;
        }
        // If it's a Markdown heading, strip the # and center the text
        const headingMatch = /^#+\s*(.*)/.exec(trimmed);
        if (headingMatch) {
          if (!firstNonEmptyFound) {
            firstNonEmptyFound = true;
            return `\\begin{center} {\\fontsize{24pt}{28pt}\\selectfont\\textbf{${headingMatch[1]}}} \\end{center}`;
          } else {
            return `\\begin{center} ${headingMatch[1]} \\end{center}`;
          }
        }
        // First non-empty line: treat as title
        if (!firstNonEmptyFound) {
          firstNonEmptyFound = true;
          return `\\begin{center} {\\fontsize{24pt}{28pt}\\selectfont\\textbf{${trimmed}}} \\end{center}`;
        }
        // Otherwise, wrap in LaTeX center
        return `\\begin{center} ${line} \\end{center}`;
      })
      .join('\n');
    output += centeredTitlePage + '\n\n';
  }
  if (copyrightSection) {
    output += '```{=latex}\n';
    output += '\\clearpage\n';
    output += '```\n\n';
    output += copyrightSection.content.trim() + '\n\n';
  }
  // Insert TOC only if includeToc is true
  if (options.includeToc !== false) {
    output += '```{=latex}\n';
    output += '\\clearpage\n';
    output += '\\tableofcontents\n';
    output += '\\clearpage\n';
    output += '```\n\n';
  }

  // Add the rest of the sections (excluding copyright and title page)
  let insertedMainmatter = false;
  let mainMatterStarted = false;
  let chapterCount = 1;
  for (let i = 0; i < otherSections.length; i++) {
    const section = otherSections[i];
    let content = section.content.trim()
      .replace(/````{=latex}\frontmatter```/g, '')
      .replace(/````{=latex}\mainmatter\\setcounter\{page\}\{1\}```/g, '')
      .replace(/\\frontmatter/g, '')
      .replace(/\\mainmatter/g, '')
      .replace(/\\setcounter\{page\}\{\d+\}/g, '');
    // Keep chapter headings as plain markdown - styling will be handled by exportPdf.js
    // content = content.replace(...) - removed to prevent conflicts
    
    // Check if this section is a Part divider (Part I, Part II, etc.)
    const isPartDivider = section.title && /^Part [IVXLCDM]+:/.test(section.title);
    
    // Insert \mainmatter before the first main matter section (first chapter or part divider)
    if (!insertedMainmatter) {
      // Detect main matter by identifying a chapter section or a part divider section
      // Make this more inclusive - if section has content with h1 headings, treat as main matter
      const hasMainContent = content.includes('# ') || content.includes('<h1>') || section.matter === 'main';
      const isIntroductionOrChapter = section.title && (
        /^Chapter\s+\d+/i.test(section.title) || 
        /^Introduction/i.test(section.title) ||
        /^Part [IVXLCDM]+/i.test(section.title)
      );
      
      if (
        (section.title && /^Chapter\s+\d+/i.test(section.title)) || 
        /<div style="text-align:center;">\s*<h1>Chapter\s+1<\/h1>/.test(content) || 
        /^#\s+Chapter\s+1/i.test(content) || 
        isPartDivider ||  // Add detection for part dividers
        (section.matter && section.matter === 'main') || // Also check if the section explicitly belongs to main matter
        hasMainContent || // If section has h1 headings, likely main matter
        isIntroductionOrChapter // Common main matter section types
      ) {
        output += '```{=latex}\n';
        output += '\\mainmatter\n';
        output += '\\pagenumbering{arabic}\n';
        output += '\\setcounter{page}{1}\n';
        output += '```\n\n';
        insertedMainmatter = true;
        mainMatterStarted = true;
      }
    }

    // Special handling for Part dividers
    if (isPartDivider && mainMatterStarted) {
      // Keep part dividers as chapter headings but make them unnumbered and add to TOC
      content = content.replace(
        /^# (Part [IVXLCDM]+:.*)$/m,
        '\\chapter*{$1}\n\\addcontentsline{toc}{chapter}{$1}'
      );
    }
    // Numbered headings: only number chapters in main matter
    else if (numberedHeadings || options.chapterLabelFormat === 'number' || options.chapterLabelFormat === 'text') {
      if (mainMatterStarted) {
        // Output # Heading as plain, let Pandoc/LaTeX handle numbering and label
        content = content.replace(/^# (?:Chapter \\d+: )?(.*)$/gm, '# $1');
      } else {
        // In front matter, keep h1 headings as markdown so they appear in TOC
        // Only convert h2 and below to LaTeX commands if needed
        content = content
          .replace(/^## (.*)$/gm, (_, t) => `\\section*{${t}}\n\\addcontentsline{toc}{section}{${t}}`);
        // Keep h1 headings as markdown for TOC: content = content.replace(/^# (.*)$/gm, '# $1');
      }
    }
    output += content + '\n\n';
  }
  // Note: Chapter styling is now handled by exportPdf.js rewriteMarkdownWithStyledChapters function
  // Remove the old LaTeX generation to prevent conflicts and malformed LaTeX

  return output.trim();
}

module.exports = { assembleBookPdf, rewriteMarkdownWithStyledChapters }; 