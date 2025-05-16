#!/usr/bin/env node

/**
 * Export Backend Startup Script
 * Creates necessary directories and starts the server
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  console.log('Creating temp directory:', tempDir);
  fs.mkdirSync(tempDir);
} else {
  console.log('Temp directory exists:', tempDir);
  
  // Clean up any old temporary files
  const files = fs.readdirSync(tempDir);
  let filesRemoved = 0;
  
  for (const file of files) {
    try {
      fs.unlinkSync(path.join(tempDir, file));
      filesRemoved++;
    } catch (err) {
      console.error(`Could not remove file ${file}:`, err.message);
    }
  }
  
  if (filesRemoved > 0) {
    console.log(`Cleaned up ${filesRemoved} old temporary files`);
  }
}

// Create necessary files if they don't exist
const createIfMissing = (filename, content) => {
  const filePath = path.join(__dirname, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`Creating missing file: ${filename}`);
    fs.writeFileSync(filePath, content);
  }
};

// Start the server
console.log('Starting Export Backend Server...');
const server = spawn('node', ['server.js'], {
  stdio: 'inherit',
  cwd: __dirname
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

console.log('Server process started with PID:', server.pid); 