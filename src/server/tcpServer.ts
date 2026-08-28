import { createServer, type Server } from 'node:net';
import { PrintJob } from '../session/PrintJob.js';
import type { ReceiptModel } from '../receipt/ReceiptModel.js';
import type { ReceiptBroadcaster } from './wsServer.js';

export function createTcpServer(receipt: ReceiptModel, broadcaster: ReceiptBroadcaster): Server {
  return createServer((socket) => {
    const remoteAddress = `${socket.remoteAddress ?? 'unknown'}:${socket.remotePort ?? '?'}`;
    const job = new PrintJob(receipt, remoteAddress, (name) => {
      console.warn(`[posprint-emu] skipped unsupported command "${name}" from ${remoteAddress}`);
    });

    broadcaster.broadcastConnectionEvent('connected', job.connectionId, remoteAddress);
    broadcaster.broadcastSnapshot();

    socket.on('data', (chunk) => {
      job.feed(chunk);
      broadcaster.broadcastSnapshot();
    });

    socket.on('error', (err) => {
      console.warn(`[posprint-emu] socket error from ${remoteAddress}: ${err.message}`);
    });

    socket.on('close', () => {
      job.end();
      broadcaster.broadcastSnapshot();
      broadcaster.broadcastConnectionEvent('disconnected', job.connectionId, remoteAddress);
    });
  });
}
