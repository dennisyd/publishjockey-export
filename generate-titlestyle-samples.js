/**
 * Generate Title Style Samples PDF
 * 
 * Creates a PDF showing all 12 title styles side-by-side for easy comparison.
 * Output: titlestyles.pdf
 * 
 * Run: node generate-titlestyle-samples.js
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { TitleStyleProcessor } = require('./TitleStyleProcessor');
const { FontManager } = require('./FontManager');

const PANDOC_PATH = process.env.PANDOC_PATH || '/root/.cache/pandoc-3.6.4';
const OUTPUT_FILE = path.join(__dirname, 'public', 'samples', 'titlestyles.pdf');

// Ensure output directory exists
const outputDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const titleStyles = [
  { name: 'Standard', value: 'standard', description: 'Simple, centered, classic' },
  { name: 'Classic Literature', value: 'classic_literature', description: 'Horizontal rules, elegant' },
  { name: 'Modern Minimalist', value: 'modern_minimalist', description: 'Sans-serif, clean' },
  { name: 'Academic Press', value: 'academic_press', description: 'Full-width rules, formal' },
  { name: 'Classical Ornate', value: 'classical_ornate', description: 'Asterisk ornaments, italic' },
  { name: 'Technical Programming', value: 'technical_programming', description: 'Colored box background' },
  { name: 'Magazine Style', value: 'magazine_style', description: 'Left-aligned, uppercase, bold' },
  { name: 'Luxury Fashion', value: 'luxury_fashion', description: 'Diamond ornaments, italic' },
  { name: 'Small Caps Elegance', value: 'small_caps_elegance', description: 'Small caps with rules' },
  { name: 'Decorative Script', value: 'decorative_script', description: 'Club suit ornament, script' },
  { name: 'Thriller/Noir', value: 'thriller_noir', description: 'Black background, white uppercase' },
  { name: 'Romance/Soft Literary', value: 'romance_soft', description: 'Heart ornaments, flowing italic' }
];

async function generateSamples() {
  console.log('🎨 Generating Title Style Samples...\n');

  const fontManager = new FontManager();
  const titleProcessor = new TitleStyleProcessor('en', fontManager);

  let markdown = `---
title: "Title Style Guide"
author: "PublishJockey"
---

# Title Style Samples

This document showcases all available title styles in PublishJockey. Each chapter demonstrates a different style with sample content.

---

`;

  // Sample content for each chapter
  const sampleContent = `The art of typography and book design has evolved over centuries, combining aesthetics with readability. Each style offers a unique visual identity that can enhance your manuscript's professional appearance and reader experience.

This sample paragraph demonstrates how your content will appear below each chapter heading, allowing you to see the overall visual harmony of the chosen style.`;

  for (let i = 0; i < titleStyles.length; i++) {
    const style = titleStyles[i];
    const chapterTitle = `Chapter ${i + 1}: Sample Chapter`;
    
    // Generate styled header
    const styledHeader = await titleProcessor.generateStyledHeader(chapterTitle, i + 1, style.value);
    
    markdown += styledHeader;
    markdown += `\\vspace{1em}\n\n`;
    markdown += `**Style Name:** ${style.name}\n\n`;
    markdown += `**Description:** ${style.description}\n\n`;
    markdown += `---\n\n`;
    markdown += sampleContent + '\n\n';
  }

  // Write markdown to temp file
  const tempInput = path.join(__dirname, 'temp', 'titlestyle_samples_input.md');
  const tempDir = path.dirname(tempInput);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  fs.writeFileSync(tempInput, markdown, 'utf8');
  console.log('✓ Generated markdown with all title styles');

  // Get font configuration
  const fontConfig = await fontManager.getFontConfigForStyle('standard');
  
  // Generate preamble for fancy styles
  const preamble = titleProcessor.generateStylePreamble('standard', fontConfig);
  const preamblePath = path.join(__dirname, 'temp', 'titlestyle_preamble.tex');
  fs.writeFileSync(preamblePath, preamble, 'utf8');

  // Generate PDF with Pandoc
  const args = [
    tempInput,
    '-o', OUTPUT_FILE,
    '--pdf-engine=xelatex',
    '--template=templates/custom.tex',
    '--from=markdown+raw_tex',
    '--to=latex',
    '--include-in-header', preamblePath,
    '--variable', 'mainfont=Linux Libertine O',
    '--variable', 'documentclass=book',
    '--variable', 'fontsize=11pt',
    '--variable', 'geometry:margin=1in',
    '--top-level-division=chapter',
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

    console.log('\n✅ Successfully generated titlestyles.pdf!');
    console.log(`   Location: ${OUTPUT_FILE}`);
    console.log('\n📍 Upload this to your frontend public directory:');
    console.log(`   Frontend path: public/samples/titlestyles.pdf`);
    console.log('   Access URL: /samples/titlestyles.pdf');

    // Clean up temp files
    fs.unlinkSync(tempInput);
    fs.unlinkSync(preamblePath);
  });
}

generateSamples().catch(console.error);

