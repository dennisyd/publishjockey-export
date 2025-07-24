#!/usr/bin/env node

/**
 * Deployment Initialization Script
 * Ensures proper directory structure and image accessibility for PDF generation
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Initializing deployment environment...');

// Ensure required directories exist
const requiredDirs = [
  'uploads',
  'temp', 
  'debug',
  'templates'
];

requiredDirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dirPath}`);
  } else {
    console.log(`✓ Directory exists: ${dirPath}`);
  }
});

// Log current working directory and structure
console.log(`📂 Current working directory: ${process.cwd()}`);
console.log(`📂 Script directory: ${__dirname}`);

// Check if we're in a different deployment structure
const possibleUploadsDirs = [
  path.join(__dirname, 'uploads'),
  path.join(process.cwd(), 'uploads'),
  path.join(process.cwd(), '..', 'uploads'),
  path.join(process.cwd(), 'app', 'uploads')
];

console.log('\n📋 Checking upload directory locations:');
possibleUploadsDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`✅ Found uploads at: ${dir}`);
    const files = fs.readdirSync(dir);
    console.log(`   Contains ${files.length} items: ${files.slice(0, 5).join(', ')}${files.length > 5 ? '...' : ''}`);
  } else {
    console.log(`❌ Not found: ${dir}`);
  }
});

// Check environment variables
console.log('\n🔧 Environment info:');
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`PORT: ${process.env.PORT || 'not set'}`);

// Create a test image to verify the system works
const testImageContent = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const testImagePath = path.join(__dirname, 'uploads', 'test-image.png');

try {
  const base64Data = testImageContent.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(testImagePath, base64Data, 'base64');
  console.log(`✅ Created test image: ${testImagePath}`);
} catch (err) {
  console.error(`❌ Failed to create test image: ${err.message}`);
}

console.log('\n🎉 Deployment initialization complete!'); 