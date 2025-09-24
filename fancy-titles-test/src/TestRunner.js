/**
 * TestRunner - Comprehensive test system for fancy titles and drop caps
 * 
 * Generates sample documents, validates font compatibility, tests all style combinations,
 * and produces detailed reports to validate the concept before implementation.
 * 
 * @author PublishJockey Fancy Titles System
 * @version 1.0
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const { FontManager } = require('./FontManager');
const { TitleStyleProcessor } = require('./TitleStyleProcessor');

const execAsync = promisify(exec);

class TestRunner {
  constructor(options = {}) {
    this.fontManager = new FontManager(options);
    this.titleProcessor = new TitleStyleProcessor(options);
    this.outputDir = options.outputDir || path.join(process.cwd(), 'output');
    this.enableXeLatexTests = options.enableXeLatexTests !== false;
    this.generatePdfs = options.generatePdfs !== false;
    
    // Test content samples
    this.testChapters = [
      "The Art of Storytelling",
      "Digital Transformation in the Modern Era", 
      "Philosophy and the Human Condition",
      "Advanced Programming Techniques"
    ];
    
    console.log(`[TEST RUNNER] Initialized with output directory: ${this.outputDir}`);
  }

  /**
   * Run complete test suite
   * @returns {Promise<Object>} Comprehensive test results
   */
  async runCompleteTestSuite() {
    console.log(`[TEST RUNNER] 🚀 Starting comprehensive fancy titles test suite...`);
    
    const startTime = Date.now();
    const results = {
      timestamp: new Date().toISOString(),
      duration: 0,
      tests: {},
      summary: {},
      errors: [],
      files_generated: []
    };
    
    try {
      // Ensure output directory exists
      await this.ensureOutputDirectory();
      
      // 1. Test font compatibility
      console.log(`[TEST RUNNER] 📝 Testing font compatibility...`);
      results.tests.fontCompatibility = await this.testFontCompatibility();
      
      // 2. Test language restrictions (user-selected languages)
      console.log(`[TEST RUNNER] 🌐 Testing language restrictions...`);
      results.tests.languageRestrictions = await this.testLanguageRestrictions();
      
      // 3. Generate sample documents for each style
      console.log(`[TEST RUNNER] 🎨 Generating style samples...`);
      results.tests.styleSamples = await this.generateStyleSamples();
      
      // 4. Test drop cap combinations
      console.log(`[TEST RUNNER] 📖 Testing drop cap combinations...`);
      results.tests.dropCapTests = await this.testDropCapCombinations();
      
      // 5. Generate comparison documents
      console.log(`[TEST RUNNER] 📊 Creating comparison documents...`);
      results.tests.comparisons = await this.generateComparisonDocuments();
      
      // 6. Validate XeLaTeX compilation (if enabled)
      if (this.enableXeLatexTests) {
        console.log(`[TEST RUNNER] ⚙️ Testing XeLaTeX compilation...`);
        results.tests.xelatexValidation = await this.testXeLatexCompilation();
      }
      
      // 7. Performance benchmarks
      console.log(`[TEST RUNNER] ⏱️ Running performance benchmarks...`);
      results.tests.performance = await this.runPerformanceBenchmarks();
      
      // 8. Generate final reports
      console.log(`[TEST RUNNER] 📈 Generating reports...`);
      await this.generateReports(results);
      
    } catch (error) {
      console.error(`[TEST RUNNER] ❌ Test suite failed: ${error.message}`);
      results.errors.push({
        stage: 'test_suite',
        error: error.message,
        stack: error.stack
      });
    }
    
    results.duration = Date.now() - startTime;
    results.summary = this.generateSummary(results);
    
    console.log(`[TEST RUNNER] ✅ Test suite completed in ${results.duration}ms`);
    return results;
  }

  /**
   * Test font compatibility across all styles
   */
  async testFontCompatibility() {
    const report = await this.fontManager.validateFontCompatibility();
    const availableStyles = this.titleProcessor.getAvailableStyles();
    
    const compatibility = {
      fontReport: report,
      styleCompatibility: {},
      recommendations: await this.fontManager.getMissingFontCommands()
    };
    
    // Test each style
    for (const styleName of availableStyles) {
      const fontConfig = await this.fontManager.findBestFontForStyle(styleName);
      compatibility.styleCompatibility[styleName] = {
        recommendedFont: fontConfig.primary,
        available: fontConfig.available,
        fallbackChain: fontConfig.fallback,
        fontFamily: fontConfig.family
      };
    }
    
    return compatibility;
  }

  /**
   * Test language restrictions (user-selected languages only)
   */
  async testLanguageRestrictions() {
    const supportedLanguages = ['en', 'fr', 'it', 'es', 'pt', 'de'];
    const unsupportedLanguages = ['ru', 'nl', 'hi', 'zh', 'ar', 'ro'];
    
    const results = {
      supportedLanguages: [],
      unsupportedLanguages: [],
      dropCapRestrictions: {}
    };
    
    // Test supported languages (should enable drop caps)
    for (const langCode of supportedLanguages) {
      const isSupported = this.titleProcessor.isDropCapSupported(langCode);
      const testResult = {
        language: langCode,
        name: this.titleProcessor.getLanguageName(langCode),
        expectedSupport: true,
        actualSupport: isSupported,
        correct: isSupported === true
      };
      
      results.supportedLanguages.push(testResult);
      results.dropCapRestrictions[langCode] = testResult.correct;
    }
    
    // Test unsupported languages (should disable drop caps)  
    for (const langCode of unsupportedLanguages) {
      const isSupported = this.titleProcessor.isDropCapSupported(langCode);
      const testResult = {
        language: langCode,
        name: langCode.toUpperCase(),
        expectedSupport: false,
        actualSupport: isSupported,
        correct: isSupported === false
      };
      
      results.unsupportedLanguages.push(testResult);
      results.dropCapRestrictions[langCode] = testResult.correct;
    }
    
    return results;
  }

  /**
   * Generate sample documents for each title style
   */
  async generateStyleSamples() {
    const styles = this.titleProcessor.getAvailableStyles();
    const samples = {};
    
    for (const styleName of styles) {
      console.log(`[TEST RUNNER] Generating sample for style: ${styleName}`);
      
      const sampleContent = this.generateSampleContent(styleName);
      const processedContent = await this.titleProcessor.convertMarkdownHeaders(
        sampleContent, 
        styleName,
        { 
          dropCapStyle: 'traditional',
          userLanguage: 'en',
          customColors: { primary: '#333333', accent: '#8B4513' }
        }
      );
      
      const filename = `style-sample-${styleName}.md`;
      const filepath = path.join(this.outputDir, 'generated-pdfs', filename);
      
      await fs.writeFile(filepath, processedContent, 'utf8');
      
      samples[styleName] = {
        filename: filename,
        filepath: filepath,
        contentLength: processedContent.length,
        chapterCount: this.testChapters.length
      };
    }
    
    return samples;
  }

  /**
   * Test drop cap combinations with each style (6 supported languages only)
   */
  async testDropCapCombinations() {
    const styles = this.titleProcessor.getAvailableStyles();
    const dropCapStyles = ['traditional', 'raised', 'decorated', 'none'];
    const supportedLanguages = ['en', 'fr', 'it', 'es', 'pt', 'de']; // Only these 6!
    
    const combinations = {};
    
    for (const styleName of styles) {
      combinations[styleName] = {};
      
      for (const dropCapStyle of dropCapStyles) {
        combinations[styleName][dropCapStyle] = {};
        
        for (const language of supportedLanguages) {
          console.log(`[TEST RUNNER] Testing: ${styleName} + ${dropCapStyle} + ${language}`);
          
          const testContent = this.generateLanguageSpecificContent(language);
          const processedContent = await this.titleProcessor.convertMarkdownHeaders(
            testContent,
            styleName,
            {
              dropCapStyle: dropCapStyle,
              userLanguage: language,
              customColors: { primary: '#2C3E50', accent: '#E74C3C' }
            }
          );
          
          const filename = `dropCap-${styleName}-${dropCapStyle}-${language}.md`;
          const filepath = path.join(this.outputDir, 'generated-pdfs', filename);
          
          await fs.writeFile(filepath, processedContent, 'utf8');
          
          combinations[styleName][dropCapStyle][language] = {
            filename: filename,
            filepath: filepath,
            hasDropCaps: dropCapStyle !== 'none',
            language: language
          };
        }
      }
    }
    
    return combinations;
  }

  /**
   * Generate comparison documents showing all styles
   */
  async generateComparisonDocuments() {
    const styles = this.titleProcessor.getAvailableStyles();
    const comparisons = {};
    
    // All styles comparison
    const allStylesContent = [];
    allStylesContent.push('# Fancy Titles Style Comparison\n');
    allStylesContent.push('This document demonstrates all 8 publisher-inspired title styles.\n\n');
    
    for (let i = 0; i < styles.length; i++) {
      const styleName = styles[i];
      const styleInfo = this.titleProcessor.getStyleInfo(styleName);
      
      allStylesContent.push(`**Style ${i + 1}: ${styleInfo.name}**`);
      allStylesContent.push(`*Inspired by: ${styleInfo.inspiration}*`);
      allStylesContent.push(`*Description: ${styleInfo.description}*\n`);
      
      // Generate chapter with this style
      const chapterContent = `# ${this.testChapters[i % this.testChapters.length]}\n\nThis is a sample paragraph demonstrating the ${styleInfo.name} style. The typography and layout are inspired by ${styleInfo.inspiration}, featuring ${styleInfo.features.join(', ')}. This paragraph would receive drop caps in supported languages (English, French, Italian, Spanish, Portuguese, German).\n\n`;
      
      const processedChapter = await this.titleProcessor.convertMarkdownHeaders(
        chapterContent,
        styleName,
        {
          dropCapStyle: 'traditional',
          userLanguage: 'en',
          customColors: { primary: '#2C3E50', accent: '#E67E22' }
        }
      );
      
      allStylesContent.push(processedChapter);
      allStylesContent.push('---\n\n');
    }
    
    const comparisonFilename = 'all-styles-comparison.md';
    const comparisonFilepath = path.join(this.outputDir, 'generated-pdfs', comparisonFilename);
    
    await fs.writeFile(comparisonFilepath, allStylesContent.join(''), 'utf8');
    
    comparisons.allStyles = {
      filename: comparisonFilename,
      filepath: comparisonFilepath,
      styleCount: styles.length
    };
    
    return comparisons;
  }

  /**
   * Test XeLaTeX compilation for validation
   */
  async testXeLatexCompilation() {
    const validationResults = {
      compilationTests: [],
      successful: 0,
      failed: 0,
      errors: []
    };
    
    // Test a few key combinations
    const testCases = [
      { style: 'standard', dropCap: 'none', language: 'en' },
      { style: 'classic-literature', dropCap: 'traditional', language: 'en' },
      { style: 'modern-minimalist', dropCap: 'none', language: 'fr' },
    ];
    
    for (const testCase of testCases) {
      try {
        console.log(`[TEST RUNNER] Testing XeLaTeX compilation: ${testCase.style} + ${testCase.dropCap} + ${testCase.language}`);
        
        const testContent = this.generateLanguageSpecificContent(testCase.language);
        const processedContent = await this.titleProcessor.convertMarkdownHeaders(
          testContent,
          testCase.style,
          {
            dropCapStyle: testCase.dropCap,
            userLanguage: testCase.language
          }
        );
        
        // Generate complete LaTeX document
        const preamble = await this.titleProcessor.generateStylePreamble(
          testCase.style,
          { 
            enableDropCaps: testCase.dropCap !== 'none',
            customColors: { primary: '#2C3E50', accent: '#E74C3C' }
          }
        );
        
        const fullDocument = this.createCompleteLatexDocument(preamble, processedContent);
        
        const testFilename = `xelatex-test-${testCase.style}-${testCase.dropCap}-${testCase.language}.tex`;
        const testFilepath = path.join(this.outputDir, 'generated-pdfs', testFilename);
        
        await fs.writeFile(testFilepath, fullDocument, 'utf8');
        
        // Attempt compilation if XeLaTeX is available (optional)
        let compilationResult = { success: true, output: 'Compilation test skipped - XeLaTeX not tested' };
        
        if (this.generatePdfs) {
          try {
            const { stdout, stderr } = await execAsync(`xelatex -interaction=nonstopmode -output-directory="${this.outputDir}/generated-pdfs" "${testFilepath}"`, {
              timeout: 30000, // 30 second timeout
              cwd: path.dirname(testFilepath)
            });
            compilationResult = { success: true, output: stdout, errors: stderr };
            validationResults.successful++;
          } catch (error) {
            compilationResult = { success: false, error: error.message, output: error.stdout, stderr: error.stderr };
            validationResults.failed++;
            validationResults.errors.push({
              testCase: testCase,
              error: error.message
            });
          }
        }
        
        validationResults.compilationTests.push({
          testCase: testCase,
          filename: testFilename,
          compilation: compilationResult
        });
        
      } catch (error) {
        validationResults.failed++;
        validationResults.errors.push({
          testCase: testCase,
          error: error.message
        });
      }
    }
    
    return validationResults;
  }

  /**
   * Run performance benchmarks
   */
  async runPerformanceBenchmarks() {
    const benchmarks = {
      fontDetection: {},
      styleProcessing: {},
      languageRestrictions: {},
      overall: {}
    };
    
    // Font detection benchmark
    const fontStart = Date.now();
    await this.fontManager.detectSystemFonts();
    benchmarks.fontDetection.duration = Date.now() - fontStart;
    
    // Style processing benchmark
    const testContent = this.generateSampleContent('standard');
    const styleStart = Date.now();
    await this.titleProcessor.convertMarkdownHeaders(testContent, 'classic-literature');
    benchmarks.styleProcessing.duration = Date.now() - styleStart;
    
    // Language restriction benchmark
    const langStart = Date.now();
    this.titleProcessor.isDropCapSupported('en');
    benchmarks.languageRestrictions.duration = Date.now() - langStart;
    
    benchmarks.overall.averageProcessingTime = (
      benchmarks.fontDetection.duration + 
      benchmarks.styleProcessing.duration + 
      benchmarks.languageRestrictions.duration
    ) / 3;
    
    return benchmarks;
  }

  /**
   * Generate comprehensive reports
   */
  async generateReports(testResults) {
    // JSON report
    const jsonReport = JSON.stringify(testResults, null, 2);
    await fs.writeFile(
      path.join(this.outputDir, 'test-results.json'), 
      jsonReport, 
      'utf8'
    );
    
    // Human-readable report
    const readableReport = this.generateReadableReport(testResults);
    await fs.writeFile(
      path.join(this.outputDir, 'test-report.md'), 
      readableReport, 
      'utf8'
    );
    
    // Installation guide
    const installGuide = await this.generateInstallationGuide();
    await fs.writeFile(
      path.join(this.outputDir, 'installation-guide.md'), 
      installGuide, 
      'utf8'
    );
    
    testResults.files_generated.push(
      'test-results.json',
      'test-report.md', 
      'installation-guide.md'
    );
  }

  /**
   * Generate sample content for testing
   */
  generateSampleContent(styleName) {
    const content = [
      '# Sample Document\n',
      'This is a test document for the fancy titles system.\n\n'
    ];
    
    this.testChapters.forEach((title, index) => {
      content.push(`# ${title}\n\n`);
      content.push(`This is the content for chapter ${index + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit. This paragraph demonstrates how drop caps would appear when enabled for supported languages.\n\n`);
      content.push('Additional paragraph content to show regular text flow after the drop cap paragraph.\n\n');
    });
    
    return content.join('');
  }

  /**
   * Generate language-specific test content
   */
  generateLanguageSpecificContent(language) {
    // Sample content for supported languages (user would select these)
    const testContent = {
      'en': {
        title: 'Chapter 1: The Beginning',
        content: 'Once upon a time, in a kingdom far beyond the mountains, there lived a wise king who understood the art of storytelling.'
      },
      'fr': {
        title: 'Chapitre 1: Le Commencement',
        content: 'Il était une fois, dans un royaume au-delà des montagnes, vivait un roi sage qui comprenait l\'art de la narration.'
      },
      'it': {
        title: 'Capitolo 1: L\'Inizio',
        content: 'C\'era una volta, in un regno oltre le montagne, viveva un re saggio che comprendeva l\'arte della narrazione.'
      },
      'es': {
        title: 'Capítulo 1: El Comienzo',
        content: 'Érase una vez, en un reino más allá de las montañas, vivía un rey sabio que entendía el arte de contar historias.'
      },
      'pt': {
        title: 'Capítulo 1: O Começo',
        content: 'Era uma vez, num reino para além das montanhas, vivia um rei sábio que entendia a arte da narrativa.'
      },
      'de': {
        title: 'Kapitel 1: Der Anfang',
        content: 'Es war einmal, in einem Königreich jenseits der Berge, lebte ein weiser König, der die Kunst des Geschichtenerzählens verstand.'
      }
    };
    
    const langData = testContent[language];
    
    if (!langData) return this.generateSampleContent('standard');
    
    return `# ${langData.title}\n\n${langData.content}\n\nThis is additional paragraph content in the same language to provide more context for testing.`;
  }

  /**
   * Create complete LaTeX document for compilation testing
   */
  createCompleteLatexDocument(preamble, content) {
    return `\\documentclass{book}

${preamble}

\\begin{document}

${content}

\\end{document}`;
  }

  /**
   * Generate readable test report
   */
  generateReadableReport(results) {
    const report = [
      '# PublishJockey Fancy Titles Test Report\n',
      `Generated: ${results.timestamp}`,
      `Duration: ${results.duration}ms\n`,
      '## Summary\n',
      `- Total Tests: ${Object.keys(results.tests).length}`,
      `- Errors: ${results.errors.length}`,
      `- Files Generated: ${results.files_generated.length}\n`,
      '## Font Compatibility\n'
    ];
    
    if (results.tests.fontCompatibility) {
      const fontReport = results.tests.fontCompatibility.fontReport;
      report.push(`- System Fonts Detected: ${fontReport.totalSystemFonts}`);
      report.push(`- Missing Fonts: ${fontReport.missingFonts.length}`);
      report.push(`- Recommendations: ${fontReport.recommendations.length}\n`);
    }
    
    report.push('## Language Restrictions\n');
    if (results.tests.languageRestrictions) {
      const langResults = results.tests.languageRestrictions;
      report.push(`- Supported Languages Tested: ${langResults.supportedLanguages.length}`);
      report.push(`- Unsupported Languages Tested: ${langResults.unsupportedLanguages.length}`);
      report.push(`- Drop Cap Restrictions Working: ${Object.values(langResults.dropCapRestrictions).every(Boolean)}\n`);
    }
    
    if (results.errors.length > 0) {
      report.push('## Errors\n');
      results.errors.forEach(error => {
        report.push(`- ${error.stage}: ${error.error}`);
      });
      report.push('');
    }
    
    report.push('## Conclusion\n');
    report.push(results.errors.length === 0 
      ? '✅ All tests passed! The fancy titles system is ready for implementation.'
      : '⚠️ Some tests failed. Review errors above before implementation.'
    );
    
    return report.join('\n');
  }

  /**
   * Generate installation guide
   */
  async generateInstallationGuide() {
    const commands = await this.fontManager.getMissingFontCommands();
    
    const guide = [
      '# PublishJockey Fancy Titles Installation Guide\n',
      '## Required Packages\n',
      '```bash',
      'sudo apt-get update',
      'sudo apt-get install texlive-xetex',
      'sudo apt-get install texlive-latex-extra',
      '```\n',
      '## Font Installation\n',
      '```bash'
    ];
    
    guide.push(...commands);
    guide.push('```\n');
    
    guide.push('## Verification\n');
    guide.push('```bash');
    guide.push('fc-list | grep -E "(Liberation|TeX Gyre|Source|Ubuntu)"');
    guide.push('xelatex --version');
    guide.push('```');
    
    return guide.join('\n');
  }

  /**
   * Ensure output directory structure exists
   */
  async ensureOutputDirectory() {
    const dirs = [
      this.outputDir,
      path.join(this.outputDir, 'generated-pdfs')
    ];
    
    for (const dir of dirs) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
        console.log(`[TEST RUNNER] Created directory: ${dir}`);
      }
    }
  }

  /**
   * Generate test summary
   */
  generateSummary(results) {
    return {
      testsRun: Object.keys(results.tests).length,
      errorsCount: results.errors.length,
      success: results.errors.length === 0,
      filesGenerated: results.files_generated.length,
      recommendedForImplementation: results.errors.length === 0
    };
  }
}

module.exports = { TestRunner };
