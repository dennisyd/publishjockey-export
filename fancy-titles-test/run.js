#!/usr/bin/env node
/**
 * PublishJockey Fancy Titles Test System Runner
 * 
 * Executes comprehensive tests to validate fancy title styles and drop caps
 * before implementation in the main publishjockey system.
 * 
 * Usage:
 *   node run.js                    # Run all tests
 *   node run.js --skip-xelatex     # Skip XeLaTeX compilation tests
 *   node run.js --no-pdfs          # Don't attempt PDF generation
 *   node run.js --fonts-only       # Test fonts only
 * 
 * @author PublishJockey Fancy Titles System
 */

const path = require('path');
const { TestRunner } = require('./src/TestRunner');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  enableXeLatexTests: !args.includes('--skip-xelatex'),
  generatePdfs: !args.includes('--no-pdfs'),
  fontsOnly: args.includes('--fonts-only'),
  enableDebugLogging: args.includes('--debug') || args.includes('--verbose'),
  outputDir: path.join(__dirname, 'output')
};

async function main() {
  console.log('🎨 PublishJockey Fancy Titles Test System');
  console.log('==========================================\n');
  
  console.log('📋 Configuration:');
  console.log(`   XeLaTeX Tests: ${options.enableXeLatexTests ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   PDF Generation: ${options.generatePdfs ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   Output Directory: ${options.outputDir}`);
  console.log(`   Debug Logging: ${options.enableDebugLogging ? '✅ Enabled' : '❌ Disabled'}\n`);
  
  try {
    const testRunner = new TestRunner(options);
    
    if (options.fontsOnly) {
      console.log('🔍 Running font compatibility tests only...\n');
      const fontResults = await testRunner.testFontCompatibility();
      console.log('📊 Font Test Results:');
      console.log(JSON.stringify(fontResults, null, 2));
      return;
    }
    
    console.log('🚀 Starting comprehensive test suite...\n');
    const results = await testRunner.runCompleteTestSuite();
    
    console.log('\n📈 TEST RESULTS SUMMARY');
    console.log('=======================');
    console.log(`✅ Tests Run: ${results.summary.testsRun}`);
    console.log(`❌ Errors: ${results.summary.errorsCount}`);
    console.log(`📁 Files Generated: ${results.summary.filesGenerated}`);
    console.log(`⏱️ Duration: ${results.duration}ms`);
    console.log(`🎯 Ready for Implementation: ${results.summary.recommendedForImplementation ? '✅ YES' : '❌ NO'}`);
    
    if (results.errors.length > 0) {
      console.log('\n⚠️ ERRORS ENCOUNTERED:');
      results.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. [${error.stage}] ${error.error}`);
      });
    }
    
    console.log(`\n📁 Results saved to: ${options.outputDir}`);
    console.log('   • test-results.json - Complete test data');
    console.log('   • test-report.md - Human-readable report');
    console.log('   • installation-guide.md - Setup instructions');
    console.log('   • generated-pdfs/ - Sample documents');
    
    if (results.tests.fontCompatibility?.recommendations?.length > 0) {
      console.log('\n💡 FONT RECOMMENDATIONS:');
      results.tests.fontCompatibility.recommendations.forEach(cmd => {
        console.log(`   ${cmd}`);
      });
    }
    
    console.log('\n🎉 Fancy Titles Test Suite Complete!');
    
    if (results.summary.recommendedForImplementation) {
      console.log('✅ System is ready for integration into PublishJockey!');
    } else {
      console.log('⚠️ Please address the errors above before implementation.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Fatal Error:', error.message);
    if (options.enableDebugLogging) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the test system
if (require.main === module) {
  main();
}

module.exports = { main, TestRunner };
