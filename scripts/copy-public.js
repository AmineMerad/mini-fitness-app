const fs = require('fs');
const path = require('path');

// Simple script to copy public folder to dist
// Works cross-platform (Windows, Linux, macOS)

const sourceDir = path.join(__dirname, '../src/public');
const targetDir = path.join(__dirname, '../dist/public');

// Copy directory recursively
function copyRecursiveSync(src, dest) {
  // Check if source exists
  if (!fs.existsSync(src)) {
    console.error(`Source directory does not exist: ${src}`);
    process.exit(1);
  }

  const stats = fs.statSync(src);

  if (stats.isDirectory()) {
    // Create destination directory if it doesn't exist
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    // Copy all files and subdirectories
    fs.readdirSync(src).forEach((item) => {
      copyRecursiveSync(
        path.join(src, item),
        path.join(dest, item)
      );
    });
  } else {
    // It's a file, copy it
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
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
