#!/usr/bin/env node
/**
 * Harbinger Print Agent
 * Routes ESC/POS print jobs from the browser to network printers via raw TCP.
 *
 * Usage:
 *   node print-agent.js [--port 3001] [--host 0.0.0.0]
 *
 * Then in Harbinger Settings → Kitchen → Printers, set:
 *   Print agent URL: http://localhost:3001
 */

const http = require('http');
const net  = require('net');

const PORT = parseInt(process.env.PRINT_AGENT_PORT ?? '3001', 10);
const HOST = process.env.PRINT_AGENT_HOST ?? '127.0.0.1';

const server = http.createServer((req, res) => {
  // CORS — only localhost origins
  const origin = req.headers.origin ?? '';
  if (origin && !origin.match(/^https?:\/\/localhost(:\d+)?$/)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'POST')   { res.writeHead(405); res.end('Method Not Allowed'); return; }
  if (req.url !== '/print')    { res.writeHead(404); res.end('Not Found'); return; }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    let payload;
    try { payload = JSON.parse(body); } catch {
      res.writeHead(400); res.end('Bad JSON'); return;
    }

    const { ip, port = 9100, data } = payload;
    if (!ip || !data) {
      res.writeHead(400); res.end('Missing ip or data'); return;
    }

    // data is a base64-encoded ESC/POS byte string
    const buf = Buffer.from(data, 'base64');
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      if (!res.headersSent) { res.writeHead(504); res.end('Printer timeout'); }
    }, 5000);

    socket.connect(port, ip, () => {
      socket.write(buf, () => {
        socket.end();
        clearTimeout(timeout);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });

    socket.on('error', err => {
      clearTimeout(timeout);
      if (!res.headersSent) {
        res.writeHead(502);
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Harbinger Print Agent listening on http://${HOST}:${PORT}`);
  console.log('Press Ctrl+C to stop.');
});
