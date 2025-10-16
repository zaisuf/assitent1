// Proxy entry at repo root so platforms that run `node index.js` will start the server
const path = require('path');
const startPath = path.join(__dirname, 'server', 'start.js');
try {
  require(startPath);
} catch (err) {
  console.error('Failed to require server/start.js from root index.js:', err && err.stack ? err.stack : err);
  process.exit(1);
}
