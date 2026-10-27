#!/usr/bin/env node
/**
 * Harbinger Print Agent v1.0
 *
 * Bridges HTTPS browser → LAN thermal printer by forwarding ESC/POS byte
 * jobs over raw TCP.  Because browsers block HTTP from an HTTPS page (Mixed
 * Content), but they allow requests to 127.0.0.1/localhost, this tiny
 * server runs locally and opens the TCP socket on the browser's behalf.
 *
 * Usage
 *   node harbinger-print-agent.js
 *
 * Protocol
 *   POST http://localhost:9101/print
 *   Body: { "ip": "192.168.1.100", "port": 9100, "data": [27, 64, ...] }
 *          data = Array.from(Uint8Array) of raw ESC/POS bytes
 *
 * No dependencies — pure Node.js built-ins.
 */

'use strict';

const http = require('http');
const net  = require('net');

const AGENT_PORT = parseInt(process.env.PRINT_AGENT_PORT || '9101', 10);

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

const server = http.createServer((req, res) => {
  // CORS pre-flight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  // Health-check
  if (req.method === 'GET' || req.url === '/') {
    res.writeHead(200, CORS);
    res.end(JSON.stringify({ ok: true, service: 'Harbinger Print Agent', port: AGENT_PORT }));
    return;
  }

  // Main print endpoint
  if (req.method === 'POST' && req.url === '/print') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      // Parse body
      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        res.writeHead(400, CORS);
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON body' }));
        return;
      }

      const { ip, port = 9100, data } = payload;

      if (typeof ip !== 'string' || !ip) {
        res.writeHead(400, CORS);
        res.end(JSON.stringify({ ok: false, error: 'Missing or invalid "ip"' }));
        return;
      }
      if (!Array.isArray(data) || data.length === 0) {
        res.writeHead(400, CORS);
        res.end(JSON.stringify({ ok: false, error: 'Missing or invalid "data" (expected byte array)' }));
        return;
      }

      const buf = Buffer.from(data);
      console.log(`[Harbinger] Print job received → ${ip}:${port}  (${buf.length} bytes)`);

      const socket = new net.Socket();
      let settled = false;

      const settle = (ok, error) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        if (ok) {
          console.log(`[Harbinger] ✓ Sent to ${ip}:${port}`);
          res.writeHead(200, CORS);
          res.end(JSON.stringify({ ok: true }));
        } else {
          console.error(`[Harbinger] ✗ ${ip}:${port} — ${error}`);
          res.writeHead(502, CORS);
          res.end(JSON.stringify({ ok: false, error }));
        }
      };

      socket.setTimeout(5000);
      socket.on('timeout', () => settle(false, 'Printer connection timed out (5s)'));
      socket.on('error',   e  => settle(false, e.message));

      socket.connect(port, ip, () => {
        socket.write(buf, () => settle(true, null));
      });
    });
    return;
  }

  res.writeHead(404, CORS);
  res.end(JSON.stringify({ ok: false, error: 'Not found' }));
});

server.listen(AGENT_PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║   Harbinger Print Agent  v1.0            ║');
  console.log('  ╠══════════════════════════════════════════╣');
  console.log(`  ║   Listening on http://localhost:${AGENT_PORT}    ║`);
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
  console.log('  Keep this window open while using the POS.');
  console.log('  Press Ctrl+C to stop.\n');
});
