/**
 * Generate Drop Cap Style Samples PDF
 * 
 * Creates a PDF showing all 6 drop cap styles side-by-side for easy comparison.
 * Output: dropcaps.pdf
 * 
 * Run: node generate-dropcap-samples.js
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { TitleStyleProcessor } = require('./TitleStyleProcessor');
const { FontManager } = require('./FontManager');

const PANDOC_PATH = process.env.PANDOC_PATH || '/root/.cache/pandoc-3.6.4';
const OUTPUT_FILE = path.join(__dirname, 'public', 'samples', 'dropcaps.pdf');

// Ensure output directory exists
const outputDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const dropCapStyles = [
  { name: 'None', value: 'none' },
  { name: 'Traditional', value: 'traditional', description: '3 lines, classic serif' },
  { name: 'Raised', value: 'raised', description: '2 lines, smaller and subtle' },
  { name: 'Large', value: 'large', description: '4 lines, bold and dramatic' },
  { name: 'Elegant', value: 'elegant', description: '3 lines with small caps' },
  { name: 'Bold', value: 'bold', description: '3 lines, sans-serif heavy weight' },
  { name: 'Decorated', value: 'decorated', description: '3 lines, bold with indentation' },
  { name: 'Ornament', value: 'ornament', description: 'Illuminated manuscript with background' },
  { name: 'Colorized', value: 'colorized', description: 'Two-tone blue color' },
  { name: 'Boxed', value: 'boxed', description: 'Magazine style with black box' },
  { name: 'Old-Style', value: 'oldstyle', description: 'Vintage baseline-aligned' }
];

async function generateSamples() {
  console.log('📖 Generating Drop Cap Style Samples...\n');

  const fontManager = new FontManager();
  const titleProcessor = new TitleStyleProcessor('en', fontManager);

  let markdown = `---
title: "Drop Cap Style Guide"
author: "PublishJockey"
---

# Drop Cap Style Samples

This document showcases all available drop cap styles in PublishJockey. Each style is demonstrated with the same sample paragraph for easy comparison.

---

`;

  // Sample paragraph for each style
  const sampleParagraph = 'From the moment the first enslaved Africans set foot on American soil, they were in chains — but they were not broken. In 1619, when an English privateer ship named the White Lion brought "20 and odd" captive Africans to Point Comfort in the Virginia colony, it inaugurated a centuries-long tragedy of bondage that would profoundly shape the American experience.';

  for (const style of dropCapStyles) {
    markdown += `\n\\clearpage\n\n`;
    markdown += `## ${style.name}\n\n`;
    
    if (style.description) {
      markdown += `**Style:** ${style.description}\n\n`;
    } else {
      markdown += `**Style:** No drop cap applied\n\n`;
    }
    
    markdown += `---\n\n`;

    if (style.value === 'none') {
      // No drop cap
      markdown += sampleParagraph + '\n\n';
    } else {
      // Apply drop cap
      const dropCapPara = titleProcessor.generateDropCap(sampleParagraph, style.value);
      markdown += dropCapPara + '\n\n';
    }

    // Add some additional text to show context
    markdown += `This is additional text to show how the paragraph flows after the drop cap. The drop cap should integrate naturally with the rest of the text, maintaining proper spacing and alignment throughout the paragraph.\n\n`;
  }

  // Write markdown to temp file
  const tempInput = path.join(__dirname, 'temp', 'dropcap_samples_input.md');
  const tempDir = path.dirname(tempInput);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  fs.writeFileSync(tempInput, markdown, 'utf8');
  console.log('✓ Generated markdown with all drop cap styles');

  // Generate PDF with Pandoc
  const args = [
    tempInput,
    '-o', OUTPUT_FILE,
    '--pdf-engine=xelatex',
    '--template=templates/custom.tex',
    '--from=markdown+raw_tex',
    '--to=latex',
    '--variable', 'mainfont=Linux Libertine O',
    '--variable', 'documentclass=book',
    '--variable', 'fontsize=11pt',
    '--variable', 'geometry:margin=1in',
    '--standalone'
  ];

  console.log('📄 Generating PDF with Pandoc...');
  console.log(`   Output: ${OUTPUT_FILE}`);

  execFile(PANDOC_PATH, args, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Error generating PDF:', error.message);
      console.error('Stderr:', stderr);
      process.exit(1);
    }

    console.log('\n✅ Successfully generated dropcaps.pdf!');
    console.log(`   Location: ${OUTPUT_FILE}`);
    console.log('\n📍 Upload this to your frontend public directory:');
    console.log(`   Frontend path: public/samples/dropcaps.pdf`);
    console.log('   Access URL: /samples/dropcaps.pdf');

    // Clean up temp file
    fs.unlinkSync(tempInput);
  });
}

generateSamples().catch(console.error);

