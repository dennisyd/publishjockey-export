// PDF-specific book assembler
const { removeEmojis } = require('./utils');
const { assembleBookPlain } = require('./assembleBookPlain');
const { getTocTitle } = require('./translations');
const { identifySpecialSections } = require('./utils/bookStructureLocalization');
// Image processing now handled by exportPdf.js

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
    tocDepth = 1, // Default to 1 if not provided
    language = 'en', // Default to English
  } = options;

  // Convert tocDepth to number and ensure it's valid - declare at function level
  const numericTocDepth = parseInt(tocDepth, 10) || 1;
  
  // Log the tocDepth value for debugging
  console.log(`[assembleBookPdf] Level ${tocDepth} received from frontend (tocDepth)`);
  console.log(`[assembleBookPdf] Converted to numeric: ${numericTocDepth}`);
  console.log(`[assembleBookPdf] Type of original: ${typeof tocDepth}, Type after conversion: ${typeof numericTocDepth}`);

  let output = '';

  // Add YAML metadata block if present
  output += '---\n';
  if (metadata.title) output += `title: "${metadata.title.replace(/"/g, '\"')}"\n`;
  if (metadata.author) output += `author: "${metadata.author.replace(/"/g, '\"')}"\n`;
  if (metadata.subtitle) output += `subtitle: "${metadata.subtitle.replace(/"/g, '\"')}"\n`;
  if (metadata.isbn) output += `isbn: "${metadata.isbn.replace(/"/g, '\"')}"\n`;
  output += `toc-title: "${getTocTitle(language)}"\n`;
  output += `toc-depth: ${numericTocDepth}\n`;  // Use converted numeric value
  
  // Add language metadata for proper font and language support
  if (language && language !== 'en') {
    output += `lang: ${language}\n`;
  }
  
  output += 'geometry: "footskip=1.0in"\n';
  output += 'header-includes: |\n';
  output += '  \\setlength{\\footskip}{1.0in}\n';
  output += '  \\usepackage{longtable}\n';
  output += `  \\setcounter{tocdepth}{${numericTocDepth}}\n`;  // Use converted numeric value
  output += '  % Override Pandoc\'s automatic chapter handling for front matter\n';
  output += '  \\let\\oldchapter\\chapter\n';
  output += '  \\newcommand{\\frontmatterchapter}[1]{\\oldchapter*{#1}\\markboth{#1}{}}\n';
  output += '---\n\n';

  // Find special sections and split by matter
  const { titlePageSection, copyrightSection } = identifySpecialSections(sections);
  const frontMatterSections = [];
  const mainMatterSections = [];
  const backMatterSections = [];

  for (const section of sections) {
    if (!section.content || !section.content.trim()) continue;
    
    // Skip title page and copyright sections as they're handled separately
    if (section === titlePageSection || section === copyrightSection) {
      continue;
    }
    
    // Sort remaining sections by matter (image processing now handled by exportPdf.js)
    if (section.matter === 'front') {
      frontMatterSections.push({ ...section, content: section.content });
    } else if (section.matter === 'main') {
      mainMatterSections.push({ ...section, content: section.content });
    } else if (section.matter === 'back') {
      backMatterSections.push({ ...section, content: section.content });
    }
  }

  // --- FRONT MATTER ---
  output += '```{=latex}\n';
  output += '\\frontmatter\n';
  output += '```\n\n';

  // Insert Title Page (if present)
  if (titlePageSection) {
    output += '```{=latex}\n';
    output += '\\clearpage\n';
    output += '\\thispagestyle{empty}\n';
    output += '```\n\n';
    // Center each line of the title page content
    const titleLines = titlePageSection.content.split(/\r?\n/);
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
  
  // Insert TOC
  if (options.includeToc !== false) {
    output += '```{=latex}\n';
    output += '\\clearpage\n';
    // Set the translated TOC title
    const tocTitle = getTocTitle(language);
    output += `\\renewcommand{\\contentsname}{${tocTitle}}\n`;
    output += '\\tableofcontents\n';
    output += '\\clearpage\n';
    output += '```\n\n';
  }

  // Process remaining front matter sections
  for (const section of frontMatterSections) {
    let content = section.content.trim();
    
    // Skip empty sections - no content, no headings
    if (!content) {
      console.log(`[Front Matter] Skipping empty section: ${section.title}`);
      continue;
    }
    
    // Debug: Log what we're processing
    console.log(`[Front Matter] Processing section: ${section.title}, tocDepth: ${numericTocDepth}`);
    
    // Convert # Heading to unnumbered chapter
    content = content.replace(/^# (.*)$/gm, (match, title) => {
      return `\\chapter*{${title}}\n\\addcontentsline{toc}{chapter}{${title}}`;
    });
    
    // Handle ## headings based on tocDepth
    if (numericTocDepth >= 2) {
      console.log(`[Front Matter] Adding level 2 headings to TOC for ${section.title}`);
      content = content.replace(/^## (.*)$/gm, (_, t) => {
        return `\\section*{${t}}\n\\addcontentsline{toc}{section}{${t}}`;
      });
    } else {
      console.log(`[Front Matter] Converting level 2 headings to sections without TOC entries (tocDepth=${numericTocDepth})`);
      // Create section heading without TOC entry
      content = content.replace(/^## (.*)$/gm, '\\section*{$1}');
    }
    
    // Handle ### headings based on tocDepth
    if (numericTocDepth >= 3) {
      console.log(`[Front Matter] Adding level 3 headings to TOC for ${section.title}`);
      content = content.replace(/^### (.*)$/gm, (_, t) => {
        return `\\subsection*{${t}}\n\\addcontentsline{toc}{subsection}{${t}}`;
      });
    } else {
      console.log(`[Front Matter] Converting level 3 headings to subsections without TOC entries (tocDepth=${numericTocDepth})`);
      // Create subsection heading without TOC entry
      content = content.replace(/^### (.*)$/gm, '\\subsection*{$1}');
    }
    
    output += content + '\n\n';
  }

  // --- MAIN MATTER ---
  if (mainMatterSections.length > 0) {
    output += '```{=latex}\n';
    output += '\\mainmatter\n';
    output += '```\n\n';
    
    for (const section of mainMatterSections) {
      let content = section.content.trim();
      
      // Skip empty sections - no content, no headings
      if (!content) {
        console.log(`[Main Matter] Skipping empty section: ${section.title}`);
        continue;
      }
      
      // Check if this section is a Part divider
      const isPartDivider = section.title && /^Part [IVXLCDM]+:/.test(section.title);
      
      // Special handling for Part dividers
      if (isPartDivider) {
        content = content.replace(
          /^# (Part [IVXLCDM]+:.*)$/m,
          '\\chapter*{$1}\n\\addcontentsline{toc}{chapter}{$1}'
        );
        
        // Handle ## headings based on tocDepth
        if (numericTocDepth >= 2) {
          content = content.replace(/^## (.*)$/gm, (_, t) => {
            return `\\section*{${t}}\n\\addcontentsline{toc}{section}{${t}}`;
          });
        } else {
          // Create section heading without TOC entry
          content = content.replace(/^## (.*)$/gm, '\\section*{$1}');
        }
        
        // Handle ### headings based on tocDepth
        if (numericTocDepth >= 3) {
          content = content.replace(/^### (.*)$/gm, (_, t) => {
            return `\\subsection*{${t}}\n\\addcontentsline{toc}{subsection}{${t}}`;
          });
        } else {
          // Create subsection heading without TOC entry
          content = content.replace(/^### (.*)$/gm, '\\subsection*{$1}');
        }
      }
      else {
        // For regular chapters, let Pandoc handle the # heading
        content = content.replace(/^# (?:Chapter \d+: )?(.*)$/gm, '# $1');
        
        // Handle ## and ### headings based on tocDepth for main matter too
        if (numericTocDepth < 2) {
          // Create section heading without TOC entry
          content = content.replace(/^## (.*)$/gm, '\\section*{$1}');
        }
        
        if (numericTocDepth < 3) {
          // Create subsection heading without TOC entry
          content = content.replace(/^### (.*)$/gm, '\\subsection*{$1}');
        }
      }
      
      output += content + '\n\n';
    }
  }

  // --- BACK MATTER ---
  if (backMatterSections.length > 0) {
    // Continue arabic numbering, but use unnumbered chapters
    for (const section of backMatterSections) {
      let content = section.content.trim();
      
      // Skip empty sections - no content, no headings
      if (!content) {
        console.log(`[Back Matter] Skipping empty section: ${section.title}`);
        continue;
      }
      
      // Convert # Heading to unnumbered chapter
      content = content.replace(/^# (.*)$/gm, (match, title) => {
        return `\\chapter*{${title}}\n\\addcontentsline{toc}{chapter}{${title}}`;
      });
      
      // Handle ## headings based on tocDepth
      if (numericTocDepth >= 2) {
        content = content.replace(/^## (.*)$/gm, (_, t) => {
          return `\\section*{${t}}\n\\addcontentsline{toc}{section}{${t}}`;
        });
      } else {
        // Create section heading without TOC entry
        content = content.replace(/^## (.*)$/gm, '\\section*{$1}');
      }
      
      // Handle ### headings based on tocDepth
      if (numericTocDepth >= 3) {
        content = content.replace(/^### (.*)$/gm, (_, t) => {
          return `\\subsection*{${t}}\n\\addcontentsline{toc}{subsection}{${t}}`;
        });
      } else {
        // Create subsection heading without TOC entry
        content = content.replace(/^### (.*)$/gm, '\\subsection*{$1}');
      }
      
      output += content + '\n\n';
    }
  }

  // --- BACK MATTER ---
  if (backMatterSections.length > 0) {
    output += '```{=latex}\n';
    output += '\\backmatter\n';
    output += '```\n\n';
    
    for (const section of backMatterSections) {
      let content = section.content.trim();
      
      // Skip empty sections - no content, no headings
      if (!content) {
        console.log(`[Back Matter] Skipping empty section: ${section.title}`);
        continue;
      }
      
      // Debug: Log what we're processing
      console.log(`[Back Matter] Processing section: ${section.title}, tocDepth: ${numericTocDepth}`);
      
      // Convert # Heading to unnumbered chapter
      content = content.replace(/^# (.*)$/gm, (match, title) => {
        return `\\chapter*{${title}}\n\\addcontentsline{toc}{chapter}{${title}}`;
      });
      
      // Handle ## headings based on tocDepth
      if (numericTocDepth >= 2) {
        console.log(`[Back Matter] Adding level 2 headings to TOC for ${section.title}`);
        content = content.replace(/^## (.*)$/gm, (_, t) => {
          return `\\section*{${t}}\n\\addcontentsline{toc}{section}{${t}}`;
        });
      } else {
        console.log(`[Back Matter] Converting level 2 headings to sections without TOC entries (tocDepth=${numericTocDepth})`);
        // Create section heading without TOC entry
        content = content.replace(/^## (.*)$/gm, '\\section*{$1}');
      }
      
      // Handle ### headings based on tocDepth
      if (numericTocDepth >= 3) {
        console.log(`[Back Matter] Adding level 3 headings to TOC for ${section.title}`);
        content = content.replace(/^### (.*)$/gm, (_, t) => {
          return `\\subsection*{${t}}\n\\addcontentsline{toc}{subsection}{${t}}`;
        });
      } else {
        console.log(`[Back Matter] Converting level 3 headings to subsections without TOC entries (tocDepth=${numericTocDepth})`);
        // Create subsection heading without TOC entry
        content = content.replace(/^### (.*)$/gm, '\\subsection*{$1}');
      }
      
      output += content + '\n\n';
    }
  }

  return output.trim();
}

module.exports = { assembleBookPdf, rewriteMarkdownWithStyledChapters };