/**
 * Hindi Font Fallback Test - Deployed Environment Version
 * 
 * This test is designed to run on the deployed export backend where
 * Noto Sans Devanagari is available. It tests the Liberation Serif
 * fallback solution for mixed Hindi-English content.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function testHindiFontFallback() {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('🔤 Testing Hindi font fallback solution...');
      
      // Create temp directory if it doesn't exist
      const tempDir = path.join(__dirname, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(__dirname, 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Test content with mixed Hindi and English
      const testContent = `---
title: "विषय सूची"
author: "Anonymous"
lang: hi
toc-title: "विषय सूची"
---

# परिचय (Introduction)

स्व-प्रकाशन के इस दौर में लेखन केवल अच्छे विचारों तक सीमित नहीं रहा, बल्कि प्रस्तुति और मानकीकरण भी उतने ही महत्वपूर्ण हो गए हैं। This is English text that should render properly with the fallback font.

## मुख्य विषय (Main Topic)

तकनीकी औज़ार अब इस पूरी प्रक्रिया को सरल बनाते हैं। Technical tools now simplify this entire process.

### उप-विषय (Sub-topic)

परिणामस्वरूप, लेखक अपने विचारों पर अधिक ध्यान दे पाते हैं। As a result, authors can focus more on their ideas.

## Chapter 1: Getting Started

This chapter will cover the basics of the system.

### Section 1.1: Installation

Follow these steps to install the software.

## Chapter 2: Advanced Features

Learn about advanced functionality.

### Section 2.1: Configuration

Configure the system according to your needs.
`;

      const inputFile = path.join(tempDir, 'hindi-test.md');
      const pdfFile = path.join(tempDir, 'hindi-test.pdf');
      const uploadsFile = path.join(uploadsDir, 'hindi-test.pdf');

      // Write test content
      fs.writeFileSync(inputFile, testContent);
      console.log('📝 Test content written to:', inputFile);

      // Create custom LaTeX template with improved font fallback
      const customTex = `\\documentclass[12pt,oneside,openany]{book}

\\usepackage{fontspec}
\\usepackage{polyglossia}
\\setdefaultlanguage{hindi}

% Set up fonts with better fallback
\\setmainfont{Noto Sans Devanagari}[
  Script=Devanagari,
  Ligatures=TeX,
  Scale=MatchLowercase,
  Language=Hindi
]

% Set up fallback fonts for Latin script
\\newfontfamily\\latinfont{Liberation Serif}[
  Script=Latin,
  Ligatures=TeX,
  Scale=MatchLowercase
]

% Define commands for mixed content
\\newcommand{\\mixedtext}[1]{{\\latinfont #1}}
\\newcommand{\\hinditext}[1]{{\\mainfont #1}}

% Page geometry
\\usepackage[top=1in,bottom=1in,left=1in,right=1in]{geometry}

% Hyperref for bookmarks
\\usepackage[unicode=true]{hyperref}

% Customize TOC title
$if(toc-title)$
\\renewcommand{\\contentsname}{$toc-title$}
$endif$

% Remove page numbers from TOC
\\usepackage{tocloft}
\\renewcommand{\\cftdot}{}

% Custom styling
\\usepackage{titlesec}
\\titleformat{\\chapter}[display]
  {\\normalfont\\huge\\bfseries\\filcenter}
  {\\chaptertitlename\\ \\thechapter}{20pt}{\\Huge}

\\titleformat{\\section}
  {\\normalfont\\Large\\bfseries}
  {\\thesection}{1em}{}

\\titleformat{\\subsection}
  {\\normalfont\\large\\bfseries}
  {\\thesubsection}{1em}{}

\\begin{document}

$if(toc)$
\\tableofcontents
\\newpage
$endif$

$body$

\\end{document}`;

      const templateFile = path.join(tempDir, 'custom-test.tex');
      fs.writeFileSync(templateFile, customTex);
      console.log('📄 Custom LaTeX template created');

      // Pandoc command with improved font handling
      const pandocCommand = `pandoc "${inputFile}" -o "${pdfFile}" \\
        --from=markdown+fenced_divs+header_attributes+raw_tex+latex_macros+raw_html \\
        --to=latex \\
        --pdf-engine=xelatex \\
        --template="${templateFile}" \\
        --standalone \\
        --variable=documentclass=book \\
        --variable=fontsize=12pt \\
        --variable=lang=hi \\
        --variable=polyglossia=true \\
        --variable=hyperref-unicode=true \\
        --variable=mainfont="Noto Sans Devanagari" \\
        --variable=mainfontoptions="Script=Devanagari,Ligatures=TeX,Scale=MatchLowercase,Language=Hindi" \\
        --variable=sansfont="Liberation Serif" \\
        --variable=sansfontoptions="Script=Latin,Ligatures=TeX,Scale=MatchLowercase" \\
        --variable=seriffont="Liberation Serif" \\
        --variable=seriffontoptions="Script=Latin,Ligatures=TeX,Scale=MatchLowercase" \\
        --variable=secstyle="\\\\Large\\\\bfseries\\\\filcenter" \\
        --variable=pagestyle=empty \\
        --variable=disable-headers=true \\
        --variable=numbersections=false \\
        --variable=secnumdepth=-10 \\
        --variable=disable-all-numbering=true \\
        --variable=no-chapter-labels=true \\
        --variable=no-blank-pages=true \\
        --variable=no-separator-pages=true \\
        --variable=frontmatter-continuous=true \\
        --variable=continuous-front-matter=true \\
        --variable=classoption=oneside \\
        --variable=classoption=openany \\
        --metadata title="Hindi Test" \\
        --metadata author="Anonymous"`;

      console.log('🔄 Running Pandoc command...');
      console.log('Command:', pandocCommand);

      const { stdout, stderr } = await execAsync(pandocCommand);
      
      if (stderr) {
        console.log('⚠️ Pandoc stderr:', stderr);
      }
      
      if (stdout) {
        console.log('📤 Pandoc stdout:', stdout);
      }

      // Check if PDF was generated
      if (fs.existsSync(pdfFile)) {
        const stats = fs.statSync(pdfFile);
        console.log('✅ PDF generated successfully!');
        console.log('📊 File size:', stats.size, 'bytes');
        
        // Copy to uploads directory
        fs.copyFileSync(pdfFile, uploadsFile);
        console.log('📁 File copied to uploads directory:', uploadsFile);
        
        console.log('\\n📋 Test Results:');
        console.log('1. Check that Hindi text renders properly');
        console.log('2. Check that the TOC title is in Hindi');
        console.log('3. Check that English text renders properly (no rectangles)');
        console.log('4. Check that the TOC title is in Hindi');
        
        // Register file with the tracking system for download
        const fileId = 'hindi-test-' + Date.now();
        const { tempExportFiles } = require('./server'); // Dynamically import tempExportFiles
        tempExportFiles.set(fileId, pdfFile);
        console.log('🔗 File registered for download with ID:', fileId);
        console.log('📥 Download URL:', `${process.env.EXPORT_BACKEND_URL || 'http://localhost:3001'}/api/files/${fileId}?filename=hindi-test.pdf`);
        console.log('🌐 Direct uploads URL:', `${process.env.EXPORT_BACKEND_URL || 'http://localhost:3001'}/uploads/hindi-test.pdf`);
        
        resolve({ 
          success: true, 
          fileId, 
          downloadUrl: `/api/files/${fileId}?filename=hindi-test.pdf`,
          uploadsUrl: `/uploads/hindi-test.pdf`
        });
      } else {
        console.error('❌ Generated PDF is empty');
        reject(new Error('PDF generation failed'));
      }

    } catch (error) {
      console.error('❌ Test failed:', error);
      reject(error);
    }
  });
}

module.exports = { testHindiFontFallback };
