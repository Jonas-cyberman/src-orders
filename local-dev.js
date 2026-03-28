const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 1. SILENT ENV LOADER
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envData = fs.readFileSync(envPath, 'utf8');
    envData.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        process.env[key] = value;
      }
    });
    console.log('✅ Local .env configuration loaded successfully.');
  } else {
    console.log('⚠️ No .env file found. Please create one based on .env.example');
  }
} catch (e) {
  console.error('❌ Error loading .env:', e.message);
}

// 2. VERCEL API HANDLER BRIDGE
const verifyHandlerPath = path.join(__dirname, 'api', 'verify.js');
const verifyHandler = require(verifyHandlerPath);

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  // DECORATE RESPONSE (EMULATE VERCEL)
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  };
  req.query = parsedUrl.query;

  // ROUTING
  if (parsedUrl.pathname === '/api/verify') {
    return verifyHandler(req, res);
  }

  // STATIC ASSETS
  let filePath = path.join(__dirname, parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname);
  
  // Apply Vercel-style clean URLs (rewrites)
  const rewrites = {
    '/admin': 'admin.html',
    '/login': 'admin-login.html',
    '/checkout': 'checkout.html',
    '/product': 'product.html'
  };

  if (rewrites[parsedUrl.pathname]) {
    filePath = path.join(__dirname, rewrites[parsedUrl.pathname]);
  }

  const ext = path.extname(filePath);
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp'
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('404 Not Found: ' + parsedUrl.pathname);
    } else {
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(data);
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log('--------------------------------------------------');
  console.log(`🚀 SRC PULSE LOCAL DEV SERVER RUNNING`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log(`⚙️  API: http://localhost:${PORT}/api/verify`);
  console.log('--------------------------------------------------');
});
