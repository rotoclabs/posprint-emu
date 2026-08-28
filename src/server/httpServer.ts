import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppConfig } from '../config.js';
import type { ReceiptModel } from '../receipt/ReceiptModel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload);
}

async function serveStatic(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const urlPath = (req.url ?? '/').split('?')[0];
  const relative = urlPath === '/' ? 'index.html' : urlPath.slice(1);
  const resolved = path.normalize(path.join(PUBLIC_DIR, relative));

  if (!resolved.startsWith(PUBLIC_DIR) || !existsSync(resolved)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }

  const ext = path.extname(resolved);
  const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
  const body = await readFile(resolved);
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(body);
}

export function createHttpServer(config: AppConfig, receipt: ReceiptModel, onCleared: () => void) {
  return createServer((req, res) => {
    const urlPath = (req.url ?? '/').split('?')[0];

    if (urlPath === '/api/health') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }

    if (urlPath === '/api/config') {
      sendJson(res, 200, config);
      return;
    }

    if (urlPath === '/api/clear' && req.method === 'POST') {
      receipt.clear();
      onCleared();
      sendJson(res, 200, { status: 'cleared' });
      return;
    }

    serveStatic(req, res).catch(() => {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal error');
    });
  });
}
