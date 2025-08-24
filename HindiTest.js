/**
 * Hindi Font Fallback Test - Deployed Environment Version
 * 
 * This test is designed to run on the deployed export backend where
 * Noto Sans Devanagari is available. It tests the Liberation Serif
 * fallback solution for mixed Hindi-English content.
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { getTocTitle } = require('./translations');

// Test configuration
const TEST_CONFIG = {
  language: 'hi',
  title: 'Hindi Font Test',
  author: 'Test Author',
  outputDir: './temp/hindi-test',
  testContent: `
# ${getTocTitle('hi')}

## परिचय (Introduction)

स्व-प्रकाशन के इस दौर में लेखन केवल अच्छे विचारों तक सीमित नहीं रहा, बल्कि प्रस्तुति और मानकीकरण भी उतने ही महत्वपूर्ण हो गए हैं। In this era of self-publishing, writing is not limited to good ideas alone, but presentation and standardization have become equally important.

## मुख्य विषय (Main Topic)

तकनीकी औज़ार अब इस पूरी प्रक्रिया को सरल बनाते हैं। Technical tools now simplify this entire process. They provide features like localization of numbers/dates, spell-checking, and PDF/EPUB export.

### उप-विषय (Sub-topic)

परिणामस्वरूप, लेखक अपने विचारों पर अधिक ध्यान दे पाते हैं। As a result, authors can focus more on their ideas while formatting and compliance complexities are handled automatically in the background.

## निष्कर्ष (Conclusion)

यह एक महत्वपूर्ण विकास है। This is an important development in the publishing industry.
`
};

/**
 * Generate test markdown with YAML metadata
 */
function generateTestMarkdown() {
  const yamlMetadata = `---
title: "${TEST_CONFIG.title}"
author: "${TEST_CONFIG.author}"
lang: "${TEST_CONFIG.language}"
toc-title: "${getTocTitle(TEST_CONFIG.language)}"
mainfont: "Noto Sans Devanagari"
mainfontoptions: "Script=Devanagari, Ligatures=TeX, Scale=MatchLowercase, Language=Hindi"
sansfont: "Liberation Serif"
sansfontoptions: "Script=Latin, Ligatures=TeX, Scale=MatchLowercase"
seriffont: "Liberation Serif"
seriffontoptions: "Script=Latin, Ligatures=TeX, Scale=MatchLowercase"
lang: "hi"
polyglossia: true
hyperref-unicode: true
documentclass: book
fontsize: 12pt
toc: true
---
`;

  return yamlMetadata + '\n' + TEST_CONFIG.testContent;
}

/**
 * Test the Hindi font fallback solution
 */
async function testHindiFontFallback() {
  console.log('🧪 Starting Hindi Font Fallback Test...\n');
  
  // Create test directory
  const testDir = TEST_CONFIG.outputDir;
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  // Generate test files
  const markdownFile = path.join(testDir, 'hindi-test.md');
  const pdfFile = path.join(testDir, 'hindi-test.pdf');
  
  // Generate markdown content
  const markdownContent = generateTestMarkdown();
  fs.writeFileSync(markdownFile, markdownContent);
  
  console.log('📝 Generated test markdown file:', markdownFile);
  console.log('📄 Content preview:');
  console.log(markdownContent.substring(0, 500) + '...\n');
  
  // Build Pandoc command with font fallback
  const pandocArgs = [
    markdownFile,
    '-o', pdfFile,
    '--from=markdown',
    '--to=latex',
    '--pdf-engine=xelatex',
    '--template=templates/custom.tex',
    '--standalone',
    '--variable=documentclass=book',
    '--variable=fontsize=12pt',
    '--variable=mainfont=Noto Sans Devanagari',
    '--variable=mainfontoptions=Script=Devanagari',
    '--variable=mainfontoptions=Ligatures=TeX',
    '--variable=mainfontoptions=Scale=MatchLowercase',
    '--variable=mainfontoptions=Language=Hindi',
    '--variable=lang=hi',
    '--variable=polyglossia=true',
    '--variable=hyperref-unicode=true',
    '--variable=sansfont=Liberation Serif',
    '--variable=sansfontoptions=Script=Latin',
    '--variable=sansfontoptions=Ligatures=TeX',
    '--variable=sansfontoptions=Scale=MatchLowercase',
    '--variable=seriffont=Liberation Serif',
    '--variable=seriffontoptions=Script=Latin',
    '--variable=seriffontoptions=Ligatures=TeX',
    '--variable=seriffontoptions=Scale=MatchLowercase',
    '--variable=toc-title=' + getTocTitle(TEST_CONFIG.language),
    '--toc'
  ];
  
  console.log('🔧 Pandoc command:');
  console.log('pandoc', pandocArgs.join(' '), '\n');
  
  // Execute Pandoc
  const PANDOC_PATH = process.env.PANDOC_PATH || 
    (process.platform === 'win32' ? 'pandoc' : '/root/.cache/pandoc-3.6.4');
  
  return new Promise((resolve, reject) => {
    execFile(PANDOC_PATH, pandocArgs, { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Pandoc execution failed:');
        console.error('Error:', error.message);
        console.error('Stderr:', stderr);
        reject(error);
        return;
      }
      
      if (stderr) {
        console.log('⚠️ Pandoc warnings:', stderr);
      }
      
      console.log('✅ PDF generated successfully!');
      console.log('📁 Output file:', pdfFile);
      
      // Check if file exists and has content
      if (fs.existsSync(pdfFile)) {
        const stats = fs.statSync(pdfFile);
        console.log('📊 File size:', (stats.size / 1024).toFixed(2), 'KB');
        
        if (stats.size > 0) {
          console.log('🎉 Test completed successfully!');
          console.log('\n📋 Next steps:');
          console.log('1. Open the PDF file:', pdfFile);
          console.log('2. Check that Hindi text renders properly');
          console.log('3. Check that English text renders properly (no rectangles)');
          console.log('4. Check that the TOC title is in Hindi');
          resolve(true);
        } else {
          console.error('❌ Generated PDF is empty');
          reject(new Error('Generated PDF is empty'));
        }
      } else {
        console.error('❌ PDF file was not created');
        reject(new Error('PDF file was not created'));
      }
    });
  });
}

/**
 * Clean up test files
 */
function cleanupTest() {
  const testDir = TEST_CONFIG.outputDir;
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
    console.log('🧹 Cleaned up test files');
  }
}

/**
 * Main test execution
 */
async function runTest() {
  try {
    await testHindiFontFallback();
    console.log('\n✅ Hindi font fallback test PASSED!');
    console.log('💡 The solution is ready to be implemented in the main codebase.');
  } catch (error) {
    console.error('\n❌ Hindi font fallback test FAILED!');
    console.error('Error:', error.message);
    console.log('\n🔧 Debugging steps:');
    console.log('1. Check if Pandoc is installed and accessible');
    console.log('2. Check if the required fonts are available');
    console.log('3. Check the LaTeX template configuration');
  } finally {
    // Uncomment the next line to automatically clean up test files
    // cleanupTest();
  }
}

// Export for use in other files
module.exports = {
  testHindiFontFallback,
  cleanupTest,
  runTest
};

// Run test if this file is executed directly
if (require.main === module) {
  runTest();
}
