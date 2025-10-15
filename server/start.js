console.log('[start.js] start wrapper launching');
const path = require('path');
const fs = require('fs');

// Resolve index.js relative to this file's directory, not the process cwd
const indexPath = path.join(__dirname, 'index.js');

if (!fs.existsSync(indexPath)) {
  console.error('Cannot find index.js at', indexPath);
  process.exit(1);
}

try {
  // Require the server file; it will start when run directly
  require(indexPath);
} catch (err) {
  // Make sure startup errors are visible in platform logs
  console.error('Failed to start server (caught in start.js):');
  console.error(err && err.stack ? err.stack : err);
  // flush stdout/stderr then exit with non-zero to indicate failure
  try { process.stdout.write('', () => process.exit(1)); } catch (e) { process.exit(1); }
}
