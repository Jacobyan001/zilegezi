const http = require('http');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'dist');
const mime = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.txt': 'text/plain',
};

http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  let file = path.join(dir, urlPath === '/' ? 'index.html' : urlPath);
  fs.readFile(file, (err, data) => {
    if (err) {
      // SPA fallback
      file = path.join(dir, 'index.html');
      try { data = fs.readFileSync(file); } catch { res.writeHead(404); res.end('not found'); return; }
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(80, '0.0.0.0', () => console.log('serving on :80'));
