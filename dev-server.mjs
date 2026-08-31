import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
};

function mockRes() {
  let statusCode = 200;
  const headers = {};
  let body = '';
  return {
    setHeader(k, v) { headers[k] = v; },
    status(code) { statusCode = code; return this; },
    json(data) { body = JSON.stringify(data); return this; },
    end(data) { if (data) body = data; },
    get result() { return { statusCode, headers, body }; },
  };
}

async function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/room/create' && req.method === 'POST') {
    const handler = (await import('./api/room/create.js')).default;
    const mock = mockRes();
    req.body = await readBody(req);
    await handler(req, mock);
    const { statusCode, headers, body } = mock.result;
    res.writeHead(statusCode, { 'Content-Type': 'application/json', ...headers });
    res.end(body);
    return;
  }

  const roomMatch = url.pathname.match(/^\/api\/room\/([A-Za-z0-9]+)$/);
  if (roomMatch) {
    const handler = (await import('./api/room/[id].js')).default;
    const mock = mockRes();
    req.query = { id: roomMatch[1], playerId: url.searchParams.get('playerId') };
    if (req.method === 'POST') req.body = await readBody(req);
    await handler(req, mock);
    const { statusCode, headers, body } = mock.result;
    res.writeHead(statusCode, { 'Content-Type': 'application/json', ...headers });
    res.end(body);
    return;
  }

  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  filePath = path.join(__dirname, filePath);

  if (!filePath.startsWith(__dirname) || !fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Dev server: http://localhost:${PORT}`);
});
