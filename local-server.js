/*
  Serveur de dev local qui reproduit le moteur de redirections de Netlify
  (_redirects) — a utiliser a la place de VS Code Live Server pour tester
  les URLs jolies (/bbw4life/...) sans avoir "Cannot GET" au refresh.

  Usage: node local-server.js [port]   (port par defaut: 5501)
*/

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = __dirname;
const PORT = parseInt(process.argv[2], 10) || 5501;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function parseRedirects(file) {
  const rules = []; // { from, to, status, wildcard }
  const text = fs.readFileSync(file, 'utf8');
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/).filter(Boolean);
    if (parts.length < 2) continue;
    const [from, to, status] = parts;
    rules.push({
      from,
      to,
      status: status ? parseInt(status, 10) : 301,
      wildcard: from.endsWith('/*'),
    });
  }
  return rules;
}

let rules = parseRedirects(path.join(ROOT, '_redirects'));
console.log(`[local-server] ${rules.length} regles chargees depuis _redirects`);

function matchRule(pathname) {
  // exact match first
  for (const r of rules) {
    if (!r.wildcard && r.from === pathname) return r;
  }
  // then wildcard (prefix) rules, most specific (longest prefix) first
  const wildcards = rules
    .filter(r => r.wildcard)
    .sort((a, b) => b.from.length - a.from.length);
  for (const r of wildcards) {
    const prefix = r.from.slice(0, -1); // strip trailing '*'
    if (pathname.startsWith(prefix)) return r;
  }
  return null;
}

function safeJoin(base, target) {
  const resolved = path.normalize(path.join(base, target));
  if (!resolved.startsWith(base)) return null; // path traversal guard
  return resolved;
}

function serveFile(res, filePath, statusCode) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found: ' + filePath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(statusCode, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = decodeURIComponent(url.pathname);

  // reload _redirects on the fly so edits don't require a server restart
  try { rules = parseRedirects(path.join(ROOT, '_redirects')); } catch (_) {}

  // 1) try to serve a real static file first (covers /products/product1.html,
  //    /style.css, /script.js, images, etc. -- normal site browsing)
  let realPath = pathname === '/' ? '/index.html' : pathname;
  let filePath = safeJoin(ROOT, realPath);
  if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    serveFile(res, filePath, 200);
    return;
  }

  // 2) try a directory index (path with trailing slash or matching folder)
  if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    const indexPath = path.join(filePath, 'index.html');
    if (fs.existsSync(indexPath)) {
      serveFile(res, indexPath, 200);
      return;
    }
  }

  // 3) not a real file -- check _redirects (this is the part Live Server
  //    can't do, and exactly what fixes the "Cannot GET" on refresh)
  const rule = matchRule(pathname);
  if (rule) {
    let target = rule.to;
    if (rule.wildcard && !target.includes('*')) {
      // catch-all like /* -> /404.html
    }
    const targetPath = safeJoin(ROOT, target);
    if (targetPath && fs.existsSync(targetPath)) {
      serveFile(res, targetPath, rule.status === 200 ? 200 : rule.status);
      return;
    }
  }

  // 4) genuinely nothing matched
  const notFoundPath = path.join(ROOT, '404.html');
  if (fs.existsSync(notFoundPath)) {
    serveFile(res, notFoundPath, 404);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Cannot GET ' + pathname);
  }
});

server.listen(PORT, () => {
  console.log(`[local-server] http://127.0.0.1:${PORT}`);
  console.log(`[local-server] essaie par exemple: http://127.0.0.1:${PORT}/bbw4life/glam-heels-cross-strap-stiletto-sandals (puis F5)`);
});
