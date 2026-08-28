import { loadConfig } from './config.js';
import { ReceiptModel } from './receipt/ReceiptModel.js';
import { createHttpServer } from './server/httpServer.js';
import { ReceiptBroadcaster } from './server/wsServer.js';
import { createTcpServer } from './server/tcpServer.js';

const config = loadConfig();
const receipt = new ReceiptModel(config.columns);

const httpServer = createHttpServer(config, receipt, () => broadcaster.broadcastSnapshot());
const broadcaster = new ReceiptBroadcaster(httpServer, receipt);
const tcpServer = createTcpServer(receipt, broadcaster);

httpServer.listen(config.httpPort, () => {
  console.log(`[posprint-emu] viewer UI:    http://localhost:${config.httpPort}`);
});

tcpServer.listen(config.tcpPort, () => {
  console.log(`[posprint-emu] printer port: tcp://localhost:${config.tcpPort} (${config.columns} columns)`);
});
