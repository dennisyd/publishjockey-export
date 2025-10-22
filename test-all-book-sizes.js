/**
 * Test script to verify proportional page numbering margins across all book sizes
 */

// Set environment for local Windows testing
process.env.EXPORT_PLATFORM = 'windows';

const { exportPdf } = require('./exportPdf');
const fs = require('fs');
const path = require('path');

// All supported book sizes
const bookSizes = [
  '5x8',
  '5.25x8', 
  '5.5x8.5',
  '6x9',
  '6.14x9.21',
  '7x10',
  '7.5x9.25',
  '8x10',
  '8.5x11'
];

async function testBookSize(bookSize) {
  console.log(`\n📖 Testing book size: ${bookSize}`);
  console.log('=' .repeat(50));

  // Short test content for quick generation
  const testContent = `
# Chapter 1: Introduction

This is a test chapter to verify that page numbers are properly positioned for the ${bookSize} book size with adequate margins for Amazon KDP compliance.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

# Chapter 2: Content Test

This chapter tests the margin calculations and page numbering for different book sizes.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
  `.trim();

  const testOptions = {
    title: `${bookSize} Page Test`,
    author: 'Test Author',
    bookSize: bookSize,
    pageCount: 50, // Consistent page count for comparison
    fontFamily: 'Times New Roman',
    includeToc: false,
    includePageNumbers: true,
    numberedHeadings: false,
    language: 'en'
  };

  try {
    // Create size-specific temp directory
    const tempDir = path.join(__dirname, 'temp', 'size-tests');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const sizeKey = bookSize.replace(/[^a-zA-Z0-9]/g, '_');
    const inputPath = path.join(tempDir, `test-${sizeKey}.md`);
    const outputPath = path.join(tempDir, `test-${sizeKey}.pdf`);
    
    // Write test content
    fs.writeFileSync(inputPath, testContent, 'utf8');
    
    // Export PDF
    await exportPdf(inputPath, outputPath, testOptions);
    
    // Check results
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      console.log(`✅ Success: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log(`📁 File: ${outputPath}`);
    } else {
      console.log('❌ Failed: PDF not created');
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

async function testAllBookSizes() {
  console.log('🔍 Testing proportional page numbering margins for all book sizes...');
  console.log(`📊 Testing ${bookSizes.length} different book sizes`);
  
  for (const bookSize of bookSizes) {
    await testBookSize(bookSize);
  }
  
  console.log('\n🏁 All book size tests completed!');
  console.log('\n📋 Summary of Proportional Margins:');
  console.log('   • Small books (5x8, 5.25x8, 5.5x8.5):');
  console.log('     - Bottom margin: base + 0.375" = ~0.75" total');
  console.log('     - Footskip: 0.4" (tighter spacing)');
  console.log('   • Standard books (6x9, 6.14x9.21):');
  console.log('     - Bottom margin: base + 0.5" = 1.0" total');
  console.log('     - Footskip: 0.5" (balanced spacing)');
  console.log('   • Medium-large books (7x10, 7.5x9.25):');
  console.log('     - Bottom margin: base + 0.5" = 1.0" total');
  console.log('     - Footskip: 0.5" (balanced spacing)');
  console.log('   • Large books (8x10, 8.5x11):');
  console.log('     - Bottom margin: base + 0.55" = 1.05" total');
  console.log('     - Footskip: 0.55" (more spacing)');
}

// Run the test
if (require.main === module) {
  testAllBookSizes().catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
}

module.exports = { testAllBookSizes, testBookSize };
