const path = require('path');
const fs = require('fs');

// Resolve index.js relative to this file's directory, not the process cwd
const indexPath = path.join(__dirname, 'index.js');

if (!fs.existsSync(indexPath)) {
  console.error('Cannot find index.js at', indexPath);
  process.exit(1);
}

// Require the server file; it will start when run directly
require(indexPath);
