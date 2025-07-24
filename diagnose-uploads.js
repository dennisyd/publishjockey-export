#!/usr/bin/env node

/**
 * Upload Diagnostic Tool
 * Tests file upload functionality and filesystem persistence on Render
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Upload Diagnostics Starting...');
console.log('=====================================');

// Environment info
console.log('\n📊 ENVIRONMENT INFO:');
console.log(`Platform: ${process.platform}`);
console.log(`Node.js: ${process.version}`);
console.log(`Working Directory: ${process.cwd()}`);
console.log(`Script Directory: ${__dirname}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);

// Check if we're on Render
const isRender = process.env.RENDER || process.env.RENDER_SERVICE_ID;
console.log(`Render Environment: ${isRender ? 'YES' : 'NO'}`);
if (isRender) {
  console.log(`Render Service ID: ${process.env.RENDER_SERVICE_ID || 'not set'}`);
}

// Test filesystem permissions
console.log('\n🗂️  FILESYSTEM TESTS:');

const testDirs = [
  path.join(__dirname, 'uploads'),
  path.join(__dirname, 'temp'),
  path.join(__dirname, 'debug'),
  '/tmp',
  '/app/uploads',
  process.cwd()
];

testDirs.forEach(dir => {
  console.log(`\nTesting directory: ${dir}`);
  
  try {
    // Check if directory exists
    if (fs.existsSync(dir)) {
      console.log(`  ✅ Exists: ${dir}`);
      
      // Test write permissions
      const testFile = path.join(dir, `test-${Date.now()}.txt`);
      fs.writeFileSync(testFile, 'test content');
      console.log(`  ✅ Write: Can write to ${dir}`);
      
      // Test read permissions
      const content = fs.readFileSync(testFile, 'utf8');
      console.log(`  ✅ Read: Can read from ${dir}`);
      
      // Cleanup
      fs.unlinkSync(testFile);
      console.log(`  ✅ Delete: Can delete from ${dir}`);
      
      // List contents
      const items = fs.readdirSync(dir);
      console.log(`  📋 Contents (${items.length} items): ${items.slice(0, 5).join(', ')}${items.length > 5 ? '...' : ''}`);
      
    } else {
      console.log(`  ❌ Does not exist: ${dir}`);
      
      // Try to create it
      try {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`  ✅ Created: ${dir}`);
      } catch (createErr) {
        console.log(`  ❌ Cannot create: ${dir} - ${createErr.message}`);
      }
    }
  } catch (err) {
    console.log(`  ❌ Error accessing ${dir}: ${err.message}`);
  }
});

// Test image upload simulation
console.log('\n📸 UPLOAD SIMULATION TEST:');

const uploadsDir = path.join(__dirname, 'uploads');
const testImageName = `test-image-${Date.now()}.png`;
const testImagePath = path.join(uploadsDir, testImageName);

try {
  // Ensure uploads directory exists
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  // Create a test image (1x1 pixel PNG)
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  fs.writeFileSync(testImagePath, testImageBase64, 'base64');
  console.log(`✅ Created test image: ${testImagePath}`);
  
  // Verify the image exists
  if (fs.existsSync(testImagePath)) {
    const stats = fs.statSync(testImagePath);
    console.log(`✅ Image verified: ${stats.size} bytes`);
  }
  
  // Simulate what happens after a container restart
  console.log('\n⚠️  PERSISTENCE TEST:');
  console.log('On Render, this file would disappear after container restart!');
  console.log('To test persistence, run this script again in 5-10 minutes.');
  
  // Create a timestamp file to track when files were created
  const timestampFile = path.join(uploadsDir, 'last-created.txt');
  fs.writeFileSync(timestampFile, new Date().toISOString());
  console.log(`📅 Created timestamp: ${timestampFile}`);
  
} catch (err) {
  console.log(`❌ Upload simulation failed: ${err.message}`);
}

// Disk usage info
console.log('\n💾 DISK USAGE:');
try {
  const stats = fs.statSync(__dirname);
  console.log(`Directory stats available`);
  
  // Check available space (rough estimation)
  if (fs.existsSync('/proc/meminfo')) {
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
    console.log('Memory info available (Linux environment)');
  }
} catch (err) {
  console.log(`Cannot get disk stats: ${err.message}`);
}

// Solution recommendations
console.log('\n💡 SOLUTIONS FOR RENDER:');
console.log('1. Use cloud storage (AWS S3, Cloudinary, etc.)');
console.log('2. Use Render Persistent Disks (if available)');
console.log('3. Store images in MongoDB with GridFS');
console.log('4. Use external image hosting service');

console.log('\n🏁 Diagnostic Complete!');

// Export results for programmatic access
module.exports = {
  isRender: !!isRender,
  platform: process.platform,
  nodeVersion: process.version,
  workingDir: process.cwd(),
  scriptDir: __dirname
}; 