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
  
  // Add YAML metadata block if present
  output += '---\n';
  // Note: documentclass is set via Pandoc variables, not YAML metadata
  if (metadata.title) output += `title: "${metadata.title.replace(/"/g, '\"')}"\n`;
  if (metadata.author) output += `author: "${metadata.author.replace(/"/g, '\"')}"\n`;
  if (metadata.subtitle) output += `subtitle: "${metadata.subtitle.replace(/"/g, '\"')}"\n`;
  if (metadata.isbn) output += `isbn: "${metadata.isbn.replace(/"/g, '\"')}"\n`;
  output += 'toc-title: "CONTENTS"\n';
  output += 'geometry: "footskip=1.0in"\n';
  // Add header-includes for consistent page styles
  output += 'header-includes: |\n';
  output += '  \\setlength{\\footskip}{1.0in}\n';
  output += '  \\usepackage{longtable}\n';
  output += '  % Override Pandoc\'s automatic chapter handling for front matter\n';
  output += '  \\let\\oldchapter\\chapter\n';
  output += '  \\newcommand{\\frontmatterchapter}[1]{\\oldchapter*{#1}\\markboth{#1}{}}\n';
  output += '---\n\n';
  
  // Find and categorize sections
  let copyrightSection = null;
  let titlePageSection = null;
  const frontMatterSections = [];
  const mainMatterSections = [];
  
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
    
    // Check if this is a front matter section
    const isFrontMatter = title.includes('disclaimer') ||
                         title.includes('acknowledgements') ||
                         title.includes('acknowledgments') ||
                         title.includes('foreword') ||
                         title.includes('introduction') ||
                         title.includes('preface');
    
    if (isFrontMatter) {
      frontMatterSections.push({ ...section, content: replaceCustomImages(section.content, 'pdf') });
    } else {
      mainMatterSections.push({ ...section, content: replaceCustomImages(section.content, 'pdf') });
    }
  }

  // Front matter is now handled by the LaTeX template

  // Insert Title Page (if present)
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
        if (/^\\begin\{center\}/.test(trimmed) || /^\\end\{center\}/.test(trimmed) || trimmed === '') {
          return line;
        }
        if (trimmed.startsWith('<div style="text-align:center;">') || trimmed.startsWith('</div>')) {
          return line;
        }
        const headingMatch = /^#+\s*(.*)/.exec(trimmed);
        if (headingMatch) {
          if (!firstNonEmptyFound) {
            firstNonEmptyFound = true;
            return `\\begin{center} {\\fontsize{24pt}{28pt}\\selectfont\\textbf{${headingMatch[1]}}} \\end{center}`;
          } else {
            return `\\begin{center} ${headingMatch[1]} \\end{center}`;
          }
        }
        if (!firstNonEmptyFound) {
          firstNonEmptyFound = true;
          return `\\begin{center} {\\fontsize{24pt}{28pt}\\selectfont\\textbf{${trimmed}}} \\end{center}`;
        }
        return `\\begin{center} ${line} \\end{center}`;
      })
      .join('\n');
    output += centeredTitlePage + '\n\n';
  }

  // Insert Copyright (if present)
  if (copyrightSection) {
    output += '```{=latex}\n';
    output += '\\clearpage\n';
    output += '```\n\n';
    output += copyrightSection.content.trim() + '\n\n';
  }
  
  // Insert TOC (page numbering handled by template)
  if (options.includeToc !== false) {
    output += '```{=latex}\n';
    output += '\\clearpage\n';
    output += '\\tableofcontents\n';
    output += '\\clearpage\n';
    output += '```\n\n';
  }
  
  // Add all front matter sections with explicit handling
  for (let i = 0; i < frontMatterSections.length; i++) {
    const section = frontMatterSections[i];
    let content = section.content.trim();
    
    // Convert front matter headings to unnumbered chapters that still appear in TOC
    content = content.replace(/^# (.*)$/gm, (match, title) => {
      return `\\frontmatterchapter{${title}}`;
    });
    
    // Convert ## headings to sections
    content = content.replace(/^## (.*)$/gm, (_, t) => `\\section*{${t}}`);
    
    output += content + '\n\n';
  }
  
  // Main matter is handled by the LaTeX template
  
  // Add all main matter sections
  let insertedMainmatter = false;
  for (let i = 0; i < mainMatterSections.length; i++) {
    const section = mainMatterSections[i];
    let content = section.content.trim();
    
    // Insert \mainmatter before the first main matter section
    if (!insertedMainmatter) {
      output += '```{=latex}\n';
      output += '\\mainmatter\n';
      output += '\\pagenumbering{arabic}\n';  // Explicitly set arabic numerals
      output += '```\n\n';
      insertedMainmatter = true;
    }
    
    // Check if this section is a Part divider
    const isPartDivider = section.title && /^Part [IVXLCDM]+:/.test(section.title);
    
    // Special handling for Part dividers
    if (isPartDivider) {
      content = content.replace(
        /^# (Part [IVXLCDM]+:.*)$/m,
        '\\chapter*{$1}\n\\addcontentsline{toc}{chapter}{$1}'
      );
    }
    // Let Pandoc handle chapter numbering for main matter
    else if (numberedHeadings || options.chapterLabelFormat === 'number' || options.chapterLabelFormat === 'text') {
      content = content.replace(/^# (?:Chapter \d+: )?(.*)$/gm, '# $1');
    }
    
    output += content + '\n\n';
  }

  return output.trim();
}

module.exports = { assembleBookPdf, rewriteMarkdownWithStyledChapters };