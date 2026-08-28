import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { ReceiptModel } from '../receipt/ReceiptModel.js';
import type { ClientMessage, ServerMessage } from './ws-protocol.js';

export class ReceiptBroadcaster {
  private readonly wss: WebSocketServer;

  constructor(
    httpServer: HttpServer,
    private readonly receipt: ReceiptModel,
  ) {
    this.wss = new WebSocketServer({ server: httpServer });

    this.wss.on('connection', (socket) => {
      this.send(socket, { type: 'snapshot', receipt: this.receipt.getSnapshot() });

      socket.on('message', (raw) => {
        let msg: ClientMessage;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          this.send(socket, { type: 'error', message: 'Malformed message' });
          return;
        }
        this.handleClientMessage(msg);
      });
    });
  }

  private handleClientMessage(msg: ClientMessage): void {
    switch (msg.type) {
      case 'clear':
        this.receipt.clear();
        this.broadcastSnapshot();
        break;
      case 'request-snapshot':
        this.broadcastSnapshot();
        break;
    }
  }

  broadcastConnectionEvent(event: 'connected' | 'disconnected', connectionId: string, remoteAddress: string): void {
    this.broadcast({ type: 'connection-event', event, connectionId, remoteAddress, timestamp: Date.now() });
  }

  broadcastSnapshot(): void {
    this.broadcast({ type: 'snapshot', receipt: this.receipt.getSnapshot() });
  }

  private broadcast(message: ServerMessage): void {
    const payload = JSON.stringify(message);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
  }

  private send(socket: WebSocket, message: ServerMessage): void {
    socket.send(JSON.stringify(message));
  }
}
