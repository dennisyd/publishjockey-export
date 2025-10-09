const { TitleStyleProcessor } = require('./TitleStyleProcessor');
const { FontManager } = require('./FontManager');

/**
 * Test script to verify drop cap functionality
 * Run with: node test-drop-caps.js
 */

async function testDropCaps() {
  console.log('🧪 Testing Drop Caps Functionality...\n');

  const fontManager = new FontManager();
  const titleProcessor = new TitleStyleProcessor('en', fontManager);

  const testParagraphs = [
    'This is the first paragraph with traditional drop cap styling.',
    'Another paragraph to test raised drop cap formatting.',
    'Final test for decorated drop cap appearance.'
  ];

  const styles = ['traditional', 'raised', 'decorated'];

  for (const style of styles) {
    console.log(`\n📖 Testing ${style} drop caps:\n`);

    for (let i = 0; i < testParagraphs.length; i++) {
      const paragraph = testParagraphs[i];
      const processed = titleProcessor.generateDropCap(paragraph, style);

      console.log(`  Original: ${paragraph.substring(0, 50)}...`);
      console.log(`  Processed: ${processed.replace(/\n/g, ' ').substring(0, 100)}...`);
      console.log('');
    }
  }

  console.log('\n✅ Drop cap test completed!');
  console.log('📋 If you see LaTeX code with \\lettrine commands, the drop caps should work in your PDF export.');
}

// Run the test
testDropCaps().catch(console.error);
