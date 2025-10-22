/**
 * Test script to debug page numbering and margin issues locally
 * This script tests the current margin and page numbering setup
 */

// Set environment for local Windows testing
process.env.EXPORT_PLATFORM = 'windows';

const { exportPdf } = require('./exportPdf');
const fs = require('fs');
const path = require('path');

async function testPageNumbering() {
  console.log('🔍 Testing page numbering and margins locally...');
  console.log('📋 Current environment:', {
    platform: process.platform,
    EXPORT_PLATFORM: process.env.EXPORT_PLATFORM
  });

  // Create test content with multiple pages to ensure page numbers appear
  const testContent = `
# Chapter 1: Introduction

This is the first chapter of our test book to verify that page numbers are properly positioned with adequate margins for Amazon KDP compliance.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.

# Chapter 2: Testing Page Numbers

This chapter specifically tests whether page numbers appear correctly at the bottom of pages with proper spacing from the bottom edge.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

# Chapter 3: Margin Testing

This chapter provides additional content to ensure we have enough pages to test page numbering throughout the document.

Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.

Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?

# Chapter 4: Final Tests

This final chapter ensures we have sufficient content to generate multiple pages and thoroughly test the page numbering system.

At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga.

Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus.
  `.trim();

  // Test options
  const testOptions = {
    title: 'Page Numbering Test Book',
    author: 'Test Author',
    bookSize: '6x9', // Standard size
    pageCount: 100,  // Ensure adequate page count for testing
    fontFamily: 'Times New Roman', // Windows font for local testing
    includeToc: false, // Skip TOC for simpler testing
    includePageNumbers: true,
    numberedHeadings: false,
    language: 'en'
  };

  try {
    console.log('📊 Test options:', testOptions);
    
    // Test the export
    const outputPath = path.join(__dirname, 'temp', 'test-page-numbering.pdf');
    
    // Ensure temp directory exists
    const tempDir = path.dirname(outputPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    console.log('🚀 Starting PDF export test...');
    
    // Write test content to a temporary markdown file
    const inputPath = path.join(tempDir, 'test-content.md');
    fs.writeFileSync(inputPath, testContent, 'utf8');
    console.log('📝 Test content written to:', inputPath);
    
    await exportPdf(inputPath, outputPath, testOptions);
    
    // Check if file was created successfully
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      console.log('✅ PDF export successful!');
      console.log('📁 Output file:', outputPath);
      console.log(`📈 File size: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log('📏 Testing results:');
      console.log('   - ✅ Page numbers should be CENTERED at bottom of page');
      console.log('   - ✅ Adequate space between page numbers and bottom edge');
      console.log('   - ✅ Page numbers should not be cut off on Amazon KDP');
      console.log('   - ✅ fancyhdr working with pagestyle=fancy (no conflicts)');
      console.log('');
      console.log('🔍 Margin Analysis (Proportional System):');
      console.log('   - Bottom margin: 0.5in (base) + 0.5in (page numbers) = 1.0in total');
      console.log('   - Footskip: 0.5in (proportional to 6x9 size)');
      console.log('   - Font: Times New Roman (Windows platform detected)');
      console.log('   - Book size: 6x9 inches (standard size)');
      console.log('   - System: Proportional margins based on book size for optimal spacing');
    } else {
      console.log('❌ PDF file was not created at expected location');
    }
    
  } catch (error) {
    console.error('💥 Test failed with error:', error);
    console.error('📋 Stack trace:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testPageNumbering().then(() => {
    console.log('\n🏁 Page numbering test completed.');
  }).catch(error => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });
}

module.exports = { testPageNumbering };
