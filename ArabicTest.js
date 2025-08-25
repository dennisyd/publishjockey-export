const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exportPdf } = require('./exportPdf');

/**
 * Arabic Font and RTL Test Case
 * Tests mixed Arabic/English content with proper font switching and RTL page numbering
 */
async function testArabicMixedContent() {
  console.log('\n🇸🇦 ===== ARABIC MIXED CONTENT TEST =====');
  
  try {
    // Generate unique temporary file names
    const timestamp = Date.now();
    const tempDir = '/app/temp';
    const inputFile = path.join(tempDir, `arabic-test-${timestamp}.md`);
    const pdfFile = path.join(tempDir, `arabic-test-${timestamp}.pdf`);
    const uploadsFile = '/app/uploads/arabic-test.pdf';
    
    // Create test content with mixed Arabic/English text
    const testContent = `---
title: "اختبار المحتوى المختلط"
author: "مؤلف مجهول"
lang: ar
dir: rtl
---

# الفصل الأول: مقدمة

هذا نص عربي يحتوي على **كلمات إنجليزية** مثل JavaScript و HTML و CSS. يجب أن تظهر الكلمات الإنجليزية بشكل صحيح دون مربعات.

This is English text mixed with Arabic. The text should flow properly: هذا نص عربي وسط النص الإنجليزي.

## قائمة بالتقنيات

1. React - تقنية لبناء واجهات المستخدم
2. Node.js - بيئة تشغيل JavaScript
3. MongoDB - قاعدة بيانات NoSQL

### أمثلة برمجية

\`\`\`javascript
// هذا مثال على كود JavaScript
function greetInArabic(name) {
  return "مرحبا " + name;
}

console.log(greetInArabic("أحمد"));
\`\`\`

## نص مختلط متقدم

العبارة التالية تحتوي على أرقام (123) وكلمات إنجليزية مثل "programming" و "development" وسط النص العربي. هذا اختبار للتأكد من أن:

- الأرقام تظهر بشكل صحيح
- الكلمات الإنجليزية لا تظهر كمربعات
- اتجاه النص صحيح (من اليمين إلى اليسار)

### Technical Terms in Arabic Context

When we talk about تطوير البرمجيات (software development), we often use terms like:
- Frontend Development
- Backend APIs  
- Database Management
- User Interface (UI)
- User Experience (UX)

These English terms should display correctly within the Arabic text flow.

## الخلاصة

هذا الاختبار يهدف إلى التأكد من:
1. عرض النص العربي بشكل صحيح
2. عرض النص الإنجليزي المختلط دون مربعات
3. ترقيم الصفحات من اليمين إلى اليسار
4. اتجاه النص الصحيح (RTL)
`;

    // Write test content to file
    fs.writeFileSync(inputFile, testContent, 'utf8');
    console.log(`📝 Test content written to: ${inputFile}`);
    console.log(`📄 Content length: ${testContent.length} characters`);
    
    // Arabic export options with enhanced RTL support
    const testOptions = {
      title: 'اختبار المحتوى المختلط',
      author: 'مؤلف مجهول',
      language: 'ar',
      bookSize: '6x9',
      fontFamily: 'Noto Sans Arabic',
      bindingType: 'paperback',
      includeToc: true,
      documentclass: 'book',
      fontsize: '12pt',
      // RTL-specific options
      dir: 'rtl',
      'latex-dir-rtl': true,
      // Enhanced Arabic font handling
      mainfont: 'Noto Sans Arabic',
      // Use enhanced Arabic template
      template: 'templates/arabic-enhanced.tex'
    };
    
    console.log('🔧 Test options:', testOptions);
    
    // Run the export
    console.log(`🚀 Running Arabic export test...`);
    const startTime = Date.now();
    
    await exportPdf(inputFile, pdfFile, testOptions);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Check if PDF was created
    if (fs.existsSync(pdfFile)) {
      const stats = fs.statSync(pdfFile);
      console.log(`✅ PDF generated successfully!`);
      console.log(`📊 File size: ${stats.size} bytes`);
      console.log(`⏱️  Generation time: ${duration}ms`);
      
      // Copy to uploads directory for easy download
      try {
        // Ensure uploads directory exists
        const uploadsDir = path.dirname(uploadsFile);
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        fs.copyFileSync(pdfFile, uploadsFile);
        console.log(`📁 File copied to uploads directory: ${uploadsFile}`);
        
        // Verify the file was copied successfully
        if (fs.existsSync(uploadsFile)) {
          const uploadStats = fs.statSync(uploadsFile);
          console.log(`✅ File verified in uploads: ${uploadStats.size} bytes`);
        } else {
          console.log(`❌ File not found in uploads directory`);
        }
      } catch (copyError) {
        console.error(`⚠️ Error copying to uploads: ${copyError.message}`);
      }
      
      // Register file for download if possible
      try {
        const server = require('./server');
        if (server && server.tempExportFiles) {
          const fileId = `arabic-test-${timestamp}`;
          server.tempExportFiles.set(fileId, {
            filePath: uploadsFile,
            originalName: 'arabic-test.pdf',
            contentType: 'application/pdf',
            timestamp: Date.now()
          });
          console.log(`🔗 File registered for download with ID: ${fileId}`);
          console.log(`📥 Download URL: http://localhost:3001/api/files/${fileId}?filename=arabic-test.pdf`);
        }
      } catch (e) {
        console.log(`⚠️  Could not register file for download: ${e.message}`);
      }
      
      console.log(`🌐 Direct uploads URL: http://localhost:3001/uploads/arabic-test.pdf`);
      console.log(`🔗 Production URL: ${process.env.NODE_ENV === 'production' ? 'https://export-backend.publishjockey.com' : 'http://localhost:3001'}/uploads/arabic-test.pdf`);
      
      console.log(`\n📋 Test Results:`);
      console.log(`1. Check that Arabic text renders properly (RTL)`);
      console.log(`2. Check that English text within Arabic doesn't show as boxes`);
      console.log(`3. Check that page numbers are in Arabic/RTL format`);
      console.log(`4. Check that mixed content flows correctly`);
      console.log(`5. Check that code blocks display properly`);
      console.log(`6. Check that the TOC title is in Arabic: "المحتويات"`);
      
      return {
        success: true,
        message: 'Arabic mixed content test completed successfully',
        filePath: uploadsFile,
        fileSize: stats.size,
        duration: duration
      };
      
    } else {
      throw new Error('PDF file was not created');
    }
    
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    if (error.stack) {
      console.error(`Stack trace: ${error.stack}`);
    }
    return {
      success: false,
      error: error.message,
      details: error.toString()
    };
  }
}

// Export the test function
module.exports = { testArabicMixedContent };

// Run test if called directly
if (require.main === module) {
  testArabicMixedContent().then(result => {
    console.log('\n🏁 Test completed:', result);
    process.exit(result.success ? 0 : 1);
  });
}
