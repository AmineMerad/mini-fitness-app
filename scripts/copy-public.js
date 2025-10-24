const fs = require('fs');
const path = require('path');

// Simple script to copy public folder to dist
// Works cross-platform (Windows, Linux, macOS)

const sourceDir = path.join(__dirname, '../src/public');
const targetDir = path.join(__dirname, '../dist/public');

// Create dist directory if it doesn't exist
const distDir = path.join(__dirname, '../dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy directory recursively
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

try {
  console.log('Copying public folder to dist...');
  copyRecursiveSync(sourceDir, targetDir);
  console.log('✓ Public folder copied successfully');
} catch (error) {
  console.error('Error copying public folder:', error);
  process.exit(1);
}
