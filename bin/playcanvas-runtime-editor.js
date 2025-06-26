#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get the directory of this package
const packageDir = path.dirname(__dirname);
const buildDir = path.join(packageDir, 'build');

// Check if build directory exists
if (!fs.existsSync(buildDir)) {
  console.error('❌ Build directory not found. Please run "npm run build" first.');
  process.exit(1);
}

// Serve the built app using npx serve
console.log('🚀 Starting PlayCanvas Runtime Editor...');
console.log('📁 Serving from:', buildDir);

const serve = spawn('npx', ['serve', '-s', buildDir, '-p', '3000'], {
  stdio: 'inherit',
  shell: true,
  cwd: packageDir
});

serve.on('error', (error) => {
  console.error('❌ Error starting server:', error.message);
  console.log('💡 Make sure you have npx installed: npm install -g npx');
  process.exit(1);
});

serve.on('close', (code) => {
  if (code !== 0) {
    console.error(`❌ Server exited with code ${code}`);
  }
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down PlayCanvas Runtime Editor...');
  serve.kill('SIGINT');
});

process.on('SIGTERM', () => {
  serve.kill('SIGTERM');
}); 