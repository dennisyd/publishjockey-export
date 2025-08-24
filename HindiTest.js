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

      // Simplified test content
      const testContent = `---
title: "विषय सूची"
author: "Test Author"
lang: hi
toc-title: "विषय सूची"
polyglossia: true
---

# परिचय

यह हिंदी टेक्स्ट है। This is English text that should not show rectangles.

## मुख्य विषय

तकनीकी औज़ार अब इस पूरी प्रक्रिया को सरल बनाते हैं। Technical tools now simplify this entire process.

Numbers: १२३ and 123 should both work.

Punctuation: "English quotes" और 'हिंदी उद्धरण' both should work.

## Chapter 1: Getting Started

This chapter will cover the basics of the system.

### Section 1.1: Installation

Follow these steps to install the software.
`;

      const inputFile = path.join(tempDir, 'hindi-test.md');
      const pdfFile = path.join(tempDir, 'hindi-test.pdf');
      const uploadsFile = path.join(uploadsDir, 'hindi-test.pdf');

      // Write test content
      fs.writeFileSync(inputFile, testContent);
      console.log('📝 Test content written to:', inputFile);

      // Use the main template instead of custom one
      const templateFile = path.join(__dirname, 'templates', 'custom.tex');
      console.log('📄 Using main LaTeX template:', templateFile);

      // Simplified Pandoc command - let the template handle font logic
      const pandocCommand = `pandoc "${inputFile}" -o "${pdfFile}" \\
        --from=markdown \\
        --to=latex \\
        --pdf-engine=xelatex \\
        --template="${templateFile}" \\
        --standalone \\
        --variable=polyglossia=true \\
        --variable=mainfont="Noto Sans Devanagari" \\
        --variable=sansfont="Liberation Serif" \\
        --variable=seriffont="Liberation Serif" \\
        --toc`;

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
        
        // Register file with the tracking system for download (if available)
        const fileId = 'hindi-test-' + Date.now();
        try {
          const server = require('./server');
          if (server && server.tempExportFiles) {
            server.tempExportFiles.set(fileId, pdfFile);
            console.log('🔗 File registered for download with ID:', fileId);
            console.log('📥 Download URL:', `${process.env.EXPORT_BACKEND_URL || 'http://localhost:3001'}/api/files/${fileId}?filename=hindi-test.pdf`);
          }
        } catch (error) {
          console.log('⚠️ Could not register file with tracking system:', error.message);
        }
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
