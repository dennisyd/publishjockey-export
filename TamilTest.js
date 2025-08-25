const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');

const execAsync = promisify(exec);

async function testTamilFontFallback() {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('[TAMIL FONT TEST] Testing Tamil font fallback solution...');
      console.log('🔤 Testing Tamil font fallback solution...');

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

      // Tamil test content with mixed Tamil-English text
      const testContent = `---
title: "Mixed Tamil-English Test"
author: "Test Author"
toc-title: "Contents"
---

# அறிமுகம் (Introduction)

இது தமிழ் உரை ஆகும். This is English text that should not show rectangles.

## முக்கிய பகுதி (Main Section)

தொழில்நுட்ப கருவிகள் இப்போது இந்த முழு செயல்முறையையும் எளிதாக்குகின்றன। Technical tools now simplify this entire process.

Numbers: ௧௨௩ and 123 should both work.

Punctuation: "English quotes" மற்றும் 'தமிழ் மேற்கோள்கள்' both should work.

## Chapter 1: Getting Started

This chapter will cover the basics of the system.

### Section 1.1: Installation

Follow these steps to install the software செயல்முறையை பின்பற்றவும்.

Mixed content test: Here we have English text followed by தமிழ் உரை in the same paragraph. Both should render correctly with their respective fonts.
`;

      // File paths
      const inputFile = path.join(tempDir, 'tamil-test.md');
      const pdfFile = path.join(tempDir, 'tamil-test.pdf');

      // Write test content
      fs.writeFileSync(inputFile, testContent);
      console.log('📝 Test content written to:', inputFile);

      // Use the minimal Tamil template
      const templateFile = path.join(__dirname, 'templates', 'tamil-minimal.tex');
      console.log('📄 Using minimal Tamil template:', templateFile);

      // Simplified Pandoc command - let the template handle font logic
      const pandocCommand = `pandoc "${inputFile}" -o "${pdfFile}" \\
        --from=markdown \\
        --to=latex \\
        --pdf-engine=xelatex \\
        --template="${templateFile}" \\
        --standalone \\
        --toc`;

      console.log('🔄 Running Pandoc command...');
      console.log('Command:', pandocCommand);

      const { stdout, stderr } = await execAsync(pandocCommand);
      
      if (stderr) {
        console.log('⚠️ Pandoc warnings:', stderr);
      }
      
      // Check if PDF was created successfully
      if (fs.existsSync(pdfFile)) {
        const stats = fs.statSync(pdfFile);
        console.log('✅ PDF generated successfully!');
        console.log('📊 File size:', stats.size, 'bytes');
        
        // Copy to uploads directory for easy access
        const uploadsFile = path.join(uploadsDir, 'tamil-test.pdf');
        fs.copyFileSync(pdfFile, uploadsFile);
        console.log('📁 File copied to uploads directory:', uploadsFile);
        
        console.log('\\n📋 Test Results:');
        console.log('1. Check that Tamil text renders properly');
        console.log('2. Check that the TOC title is in English');
        console.log('3. Check that English text renders properly (no rectangles)');
        console.log('4. Check that mixed Tamil-English content works seamlessly');
        
        // Register file with the tracking system for download (if available)
        const fileId = 'tamil-test-' + Date.now();
        try {
          const server = require('./server');
          if (server && server.tempExportFiles) {
            server.tempExportFiles.set(fileId, pdfFile);
            console.log('🔗 File registered for download with ID:', fileId);
            console.log('📥 Download URL:', `${process.env.EXPORT_BACKEND_URL || 'http://localhost:3001'}/api/files/${fileId}?filename=tamil-test.pdf`);
          }
        } catch (error) {
          console.log('⚠️ Could not register file with tracking system:', error.message);
        }
        console.log('🌐 Direct uploads URL:', `${process.env.EXPORT_BACKEND_URL || 'http://localhost:3001'}/uploads/tamil-test.pdf`);
        
        resolve({ 
          success: true, 
          fileId, 
          downloadUrl: `/api/files/${fileId}?filename=tamil-test.pdf`,
          uploadsUrl: '/uploads/tamil-test.pdf',
          message: 'Tamil font fallback test completed successfully' 
        });
      } else {
        throw new Error('PDF file was not created');
      }
    } catch (error) {
      console.error('❌ Test failed:', error);
      console.error('[TAMIL FONT TEST] Test failed:', error);
      reject(error);
    }
  });
}

module.exports = { testTamilFontFallback };
