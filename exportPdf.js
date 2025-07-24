const { execFile, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Page Size Mappings (width and height for common Amazon KDP book sizes)
const pageSizes = {
  "5x8": { width: "5in", height: "8in" },
  "5.06x7.81": { width: "5.06in", height: "7.81in" },
  "5.25x8": { width: "5.25in", height: "8in" },
  "5.5x8.5": { width: "5.5in", height: "8.5in" },
  "6x9": { width: "6in", height: "9in" },
  "6.14x9.21": { width: "6.14in", height: "9.21in" },
  "6.69x9.61": { width: "6.69in", height: "9.61in" },
  "7x10": { width: "7in", height: "10in" },
  "7.44x9.69": { width: "7.44in", height: "9.69in" },
  "7.5x9.25": { width: "7.5in", height: "9.25in" },
  "8x10": { width: "8in", height: "10in" },
  "8.5x11": { width: "8.5in", height: "11in" }
};

// Calculate the margins based on page size and page count
function getDynamicMargins(pageSizeKey, pageCount, includeBleed = false, hasPageNumbers = true) {
  // KDP margin table (strict)
  let inside;
  if (pageCount <= 150) inside = 0.375;
  else if (pageCount <= 300) inside = 0.5;
  else if (pageCount <= 500) inside = 0.625;
  else if (pageCount <= 700) inside = 0.75;
  else inside = 0.875;

  // Outside, top, bottom margins: KDP minimums
  let outside = includeBleed ? 0.375 : 0.25;
  let top = outside;
  let bottom = outside;

  // Optionally, you can still adjust for book size, but never below KDP minimums
  switch (pageSizeKey) {
    case "5x8":
    case "5.06x7.81":
    case "5.25x8":
    case "5.5x8.5":
      outside = Math.max(outside, 0.425);
      top = Math.max(top, 0.375);
      bottom = Math.max(bottom, 0.375);
      break;
    case "6x9":
    case "6.14x9.21":
      outside = Math.max(outside, 0.425);
      top = Math.max(top, 0.5);
      bottom = Math.max(bottom, 0.5);
      break;
    case "6.69x9.61":
    case "7x10":
    case "7.44x9.69":
    case "7.5x9.25":
      outside = Math.max(outside, 0.425);
      top = Math.max(top, 0.5);
      bottom = Math.max(bottom, 0.5);
      break;
    case "8x10":
    case "8.5x11":
      outside = Math.max(outside, 0.525);
      top = Math.max(top, 0.5);
      bottom = Math.max(bottom, 0.5);
      break;
    default:
      // Use minimums if unknown size
      outside = Math.max(outside, 0.425);
  }

  // --- Add extra space for page numbers if present ---
  if (hasPageNumbers) {
    bottom += 0.25; // Add 0.25" to bottom margin for footer/page number
  }

  // --- Add 0.10 to the outside (right) margin for extra whitespace ---
  outside += 0.3;
  // This adjustment provides a slightly larger right margin for improved aesthetics and readability.

  // Log the margin calculation for transparency
  console.log(`[KDP MARGINS] For ${pageSizeKey}, ${pageCount} pages, bleed: ${includeBleed}, page numbers: ${hasPageNumbers}`);
  console.log(`[KDP MARGINS] inside: ${inside}", outside: ${outside}", top: ${top}", bottom: ${bottom}`);

  return { inside, outside, top, bottom };
}

/**
 * Estimate page count based on word count and book size
 * @param {string} markdownText - The markdown text content
 * @param {string} pageSizeKey - The book size (e.g., "6x9")
 * @param {boolean} includeToc - Whether a table of contents is included
 * @returns {number} Estimated page count
 */
function estimatePageCount(markdownText, pageSizeKey, includeToc = true) {
  // Count words in the text (approximate)
  const wordCount = markdownText.split(/\s+/).length;
  
  // Get approximate words per page based on book size
  let wordsPerPage = 300; // Default for 6x9
  
  switch (pageSizeKey) {
    case "5x8":
    case "5.06x7.81":
    case "5.25x8":
      wordsPerPage = 250; // Smaller books fit fewer words per page
      break;
    case "5.5x8.5":
      wordsPerPage = 275;
      break;
    case "6x9":
    case "6.14x9.21":
      wordsPerPage = 300; // Standard trade paperback
      break;
    case "6.69x9.61":
    case "7x10":
    case "7.44x9.69":
      wordsPerPage = 350; // Larger books fit more words per page
      break;
    case "7.5x9.25":
    case "8x10":
    case "8.5x11":
      wordsPerPage = 400; // Largest formats fit the most words
      break;
  }
  
  // Estimate base page count from word count
  let pageCount = Math.ceil(wordCount / wordsPerPage);
  
  // Add pages for front matter (title page, copyright, etc.)
  pageCount += 4;
  
  // Add pages for table of contents if included
  if (includeToc) {
    // Estimate 1 TOC page per 15 content pages
    pageCount += Math.ceil(pageCount / 15);
  }
  
  // Add pages for any images (by counting markdown image tags)
  const imageCount = (markdownText.match(/!\[.*?\]\(.*?\)/g) || []).length;
  pageCount += imageCount;
  
  // Add extra pages for chapter starts (chapters often start on odd pages)
  const chapterCount = (markdownText.match(/^# /gm) || []).length;
  pageCount += Math.floor(chapterCount / 2); // Add ~0.5 pages per chapter for breaks
  
  // Ensure minimum page count
  pageCount = Math.max(pageCount, 24);
  
  console.log(`Estimated page count: ${pageCount} (${wordCount} words, ${pageSizeKey} format)`);
  
  return pageCount;
}

/**
 * Parse a custom size string like "6x9" into width and height
 */
function parseCustomSize(sizeStr) {
  // Remove any spaces, then split by 'x'
  const parts = sizeStr.replace(/\s+/g, '').split('x');
  if (parts.length === 2) {
    // Check if values already have units
    const width = parts[0].endsWith('in') ? parts[0] : `${parts[0]}in`;
    const height = parts[1].endsWith('in') ? parts[1] : `${parts[1]}in`;
    return { width, height };
  }
  console.log('WARNING: Could not parse custom size, falling back to 6x9');
  return pageSizes["6x9"];
}

/**
 * Generate the LaTeX code for setting page geometry based on standard book sizes
 * @param {string} pageSizeKey - Key for the page size in the pageSizes object
 * @param {number} pageCount - Estimated page count for margin calculation
 * @param {boolean} hasPageNumbers - Whether page numbers are present
 * @returns {string} LaTeX code for page geometry
 */
function generatePageGeometryCode(pageSizeKey, pageCount, hasPageNumbers = true) {
  // Clean the size key by removing spaces
  const sizeKey = pageSizeKey.replace(/\s+/g, '');
  
  // Get page dimensions
  const size = pageSizes[sizeKey] || 
              (sizeKey.includes('x') ? parseCustomSize(sizeKey) : pageSizes["6x9"]);
  
  // Get industry-standard margins for this book size and page count
  const margins = getDynamicMargins(sizeKey, pageCount, false, hasPageNumbers);
  
  // Extract numeric values (remove 'in')
  const width = size.width.replace('in', '');
  const height = size.height.replace('in', '');
  
  // Calculate text width and height
  const textWidth = parseFloat(width) - margins.inside - margins.outside;
  const textHeight = parseFloat(height) - margins.top - margins.bottom;
  
  // --- Set footskip to 0.5in if page numbers are present ---
  const footskip = hasPageNumbers ? '0.25in' : '0.40in';

  // Generate LaTeX code to enforce page size
  return {
    size,
    margins,
    width,
    height,
    textWidth,
    textHeight,
    latexCode: `
% --- AMAZON KDP COMPLIANT PAGE SIZE AND MARGINS ---
% Uniform margins: left and right margins are the same on all pages
% Note: 'oneside' is not a valid geometry option and has been removed
\\usepackage[
  paperwidth=${width}in,
  paperheight=${height}in,
  left=${margins.outside}in,
  right=${margins.outside}in,
  top=${margins.top}in,
  bottom=${margins.bottom}in,
  footskip=${footskip},
  bindingoffset=0pt
]{geometry}

% --- Enable Pandoc .center divs to render as centered text in PDF ---
% This macro maps ::: {.center} ... ::: to \begin{center} ... \end{center}
\\usepackage{etoolbox}
\\makeatletter
\\def\\markdownRendererDivClasscenter#1{%
  \\begin{center}#1\\end{center}%
}
\\makeatother

% --- Add microtype for better text fitting and margin control ---
\\usepackage{microtype}
\\UseMicrotypeSet[protrusion]{basicmath}
\\SetProtrusion
   [ name     = default ]
   { encoding = * }
   {
     A = {50,50},
     W = {30,30}
   }

% --- Better handling for long URLs and hyphenation ---
\\usepackage{url}
\\usepackage{xurl}  % Allows line breaks at any character in URLs
\\usepackage{hyphenat}  % Improves hyphenation
\\usepackage{seqsplit}  % Allows splitting of very long words at any character
\\urlstyle{same}

% --- Ensure full justification for all body text ---
\\usepackage{ragged2e}
% Force justification globally, even if other environments or packages override it
\\AtBeginDocument{\\justifying}

% --- Standard LaTeX footer with centered page number ---
\\usepackage{fancyhdr}
\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot[C]{\\thepage}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

% Force PDF dimensions directly
\\pdfpagewidth=${width}in
\\pdfpageheight=${height}in
\\special{papersize=${width}in,${height}in}

% --- Improved text wrapping and overflow protection ---
\\tolerance=3000
\\emergencystretch=3em
\\hbadness=10000
\\vfuzz=30pt
\\hfuzz=30pt
\\setlength{\\rightskip}{0pt plus 5pt}  % Allow some stretch on right margin
\\parfillskip=0pt plus 0.75\\textwidth  % Better paragraph ending
\\sloppy
\\setlength{\\parindent}{1em}

% NOTE: If page numbers appear too low, try reducing footskip or bottom margin above.
% footskip=${footskip}, bottom=${margins.bottom}in
`
  };
}

// Helper to build Pandoc --variable arguments from options
function getPandocVariables(options) {
  const vars = [];
  // Document class
  vars.push(`documentclass=${options.documentclass || (options.bindingType === 'hardcover' ? 'report' : 'book')}`);
  // Font size
  vars.push(`fontsize=${options.fontsize || '12pt'}`);
  // Bleed
  if (options.includeBleed === true) {
    vars.push('bleed=true');
    vars.push('bleedmargin=0.125in');
  }
  
  // Main font
  vars.push('mainfont=Times New Roman');
  // Section style
  vars.push('secstyle=\\Large\\bfseries\\filcenter');
  
  // Completely remove default page numbers
  vars.push('pagestyle=empty');
  vars.push('disable-headers=true');
  // Remove page numbers from special pages
  vars.push('plainfoot=');
  vars.push('emptyfoot=');
  
  // TOC
  if (options.includeToc !== false) {
    vars.push('toc-title=CONTENTS');
  }
  // Section numbering
  if (options.numberedHeadings === true) {
    // handled by --number-sections
  } else {
    vars.push('numbersections=false');
    vars.push('secnumdepth=-10');
    vars.push('disable-all-numbering=true');
  }
  // Chapter labels
  if (options.chapterLabelFormat === 'none' || options.useChapterPrefix === false) {
    vars.push('no-chapter-labels=true');
  } else if (options.chapterLabelFormat === 'text') {
    vars.push('chapter-name=Chapter');
    vars.push('chapter-name-format=text');
  }
  // Blank pages
  vars.push('no-blank-pages=true');
  vars.push('no-separator-pages=true');
  vars.push('frontmatter-continuous=true');
  vars.push('continuous-front-matter=true');
  // KDP margin requirements
  vars.push('classoption=oneside');
  vars.push('classoption=openany');
  // Line height
  if (options.lineheight) {
    vars.push(`linestretch=${options.lineheight}`);
  }
  return vars;
}

// Helper to build Pandoc --metadata arguments from options
function getPandocMetadata(options) {
  const meta = [];
  if (options.title) meta.push(`title=${options.title}`);
  if (options.author) meta.push(`author=${options.author}`);
  if (options.subtitle) meta.push(`subtitle=${options.subtitle}`);
  if (options.isbn) meta.push(`isbn=${options.isbn}`);
  return meta;
}

// Helper: Convert only center and right alignment divs to LaTeX environments for PDF
function convertAlignmentDivsToLatex(markdown) {
  // Center
  markdown = markdown.replace(
    /::: *\{\.center\}[\r\n]+([\s\S]*?)[\r\n]+:::/g,
    (match, content) => `\\begin{center}\n${content.trim()}\n\\end{center}`
  );
  // Right
  markdown = markdown.replace(
    /::: *\{\.right\}[\r\n]+([\s\S]*?)[\r\n]+:::/g,
    (match, content) => `\\begin{flushright}\n${content.trim()}\n\\end{flushright}`
  );
  return markdown;
}

/**
 * Exports a PDF using Pandoc.
 * @param {string} assembledPath - Path to the assembled markdown file.
 * @param {string} outputPath - Path to output the .pdf file.
 * @param {Object} options - Format settings from frontend
 * @returns {Promise<void>} Resolves when PDF is created, rejects on error.
 */
function exportPdf(assembledPath, outputPath, options = {}) {
  return new Promise((resolve, reject) => {
    let args = [
      assembledPath,
      '-o', outputPath,
      '--from=markdown+fenced_divs+header_attributes+raw_tex+latex_macros+raw_html',
      '--to=latex',
      '--pdf-engine=xelatex',
      '--template=templates/custom.tex',
      '--standalone',
      '--variable=links-as-notes',
    ];

    // Book Format Settings
    const pageSizeKey = options.papersize || "6x9";
    let markdown = fs.readFileSync(assembledPath, 'utf8');
    const estimatedPages = estimatePageCount(
      markdown, 
      pageSizeKey, 
      options.includeToc !== false
    );
    // --- Print the page number estimate to the console ---
    console.log(`[PAGE ESTIMATE] Estimated page count for margin calculation: ${estimatedPages}`);
    const pageCount = options.estimatedPageCount || estimatedPages || 100;
    // --- Set hasPageNumbers to true (default) ---
    const hasPageNumbers = true; // You can make this dynamic if needed
    const geometry = generatePageGeometryCode(pageSizeKey, pageCount, hasPageNumbers);
    args = args.filter(arg => !arg.includes('geometry') && !arg.includes('paperwidth') && !arg.includes('paperheight') && !arg.includes('papersize'));
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    const tmpHeaderPath = path.join(path.dirname(assembledPath), `page_geometry_${uniqueId}.tex`);
    fs.writeFileSync(tmpHeaderPath, geometry.latexCode);
    args.push('--include-in-header', tmpHeaderPath);

    // Add variables
    getPandocVariables(options).forEach(v => args.push('--variable', v));
    // Add metadata
    getPandocMetadata(options).forEach(m => args.push('--metadata', m));
    // Section numbering
    if (options.numberedHeadings === true) {
      args.push('--number-sections');
    } else {
      args.push('--number-offset=0');
    }
    // Chapter labels
    if (options.chapterLabelFormat === 'text' || options.chapterLabelFormat !== 'none') {
      args.push('--top-level-division=chapter');
    }
    // Minimal logging for key parameters
    console.log(`Using page size: ${pageSizeKey} (${geometry.width}in x ${geometry.height}in)`);

    // --- Convert alignment divs to LaTeX environments ---
    let processedMarkdown = convertAlignmentDivsToLatex(markdown);
    fs.writeFileSync(assembledPath, processedMarkdown, 'utf8');

    // Create a temporary file with float settings
    const floatSettingsPath = path.join(path.dirname(assembledPath), `float_settings_${uniqueId}.tex`);
    const floatSettings = `
% --- Settings to force images and tables to respect margins ---
\\usepackage{float}
\\floatplacement{figure}{!htbp}
\\floatplacement{table}{!htbp}

% --- Better figure handling ---
\\renewcommand{\\floatpagefraction}{0.7}
\\renewcommand{\\textfraction}{0.1}
\\renewcommand{\\topfraction}{0.9}
\\renewcommand{\\bottomfraction}{0.9}
\\setcounter{topnumber}{4}
\\setcounter{bottomnumber}{4}
\\setcounter{totalnumber}{10}

% --- Automatically scale oversized figures ---
\\usepackage{graphicx}
\\makeatletter
\\setlength{\\@fptop}{0pt}
\\makeatother

% --- Force table width to respect text width ---
\\usepackage{tabularx}
\\usepackage{booktabs}
\\usepackage{longtable}
\\setlength\\LTleft{0pt}
\\setlength\\LTright{0pt}
\\setlength\\LTpre{8pt}
\\setlength\\LTpost{8pt}
`;
    fs.writeFileSync(floatSettingsPath, floatSettings);
    args.push('--include-in-header', floatSettingsPath);

    // --- Run the PDF export (Pandoc only, no direct xelatex) ---
    execFile('pandoc', args, (error, stdout, stderr) => {
      // Clean up the unique geometry file and float settings file after export
      try { 
        fs.unlinkSync(tmpHeaderPath);
        fs.unlinkSync(floatSettingsPath);
      } catch (e) { /* ignore */ }
      if (error) {
        console.error('Pandoc PDF error:', error);
        console.error('Pandoc stderr:', stderr);
        return reject(new Error(`PDF generation failed: ${error.message}\n${stderr}`));
      }
      if (!fs.existsSync(outputPath)) {
        return reject(new Error('PDF output file was not created'));
      }
      console.log(`PDF successfully created at ${outputPath}`);
      resolve();
    });
  });
}

/**
 * Rewrites Markdown for styled chapters:
 * - Each level 1 heading is replaced with a large, bold "Chapter X" (centered, 24pt)
 * - The original heading text is placed below as plain, centered, italicized text (16–18pt)
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
      // Add a blank line before the chapter block if not at the top
      if (output.length > 0 && output[output.length - 1].trim() !== '') {
        output.push('');
      }
      // Use raw LaTeX for best PDF styling with Pandoc
      output.push('```{=latex}');
      output.push('\\begin{center}');
      output.push(`{\\fontsize{24pt}{28pt}\\selectfont\\textbf{Chapter ${chapter++}}}\\\\[0.5em]`);
      output.push(`{\\fontsize{16pt}{20pt}\\selectfont\\textit{${headingText}}}`);
      output.push('\\end{center}');
      output.push('```');
      output.push(''); // Blank line for separation
    } else {
      output.push(line);
    }
  }
  // Remove any extra blank lines at the start/end
  return output.join('\n').replace(/^\s*\n/, '').replace(/\n\s*$/, '') + '\n';
}

module.exports = { exportPdf, pageSizes, getDynamicMargins, estimatePageCount };
