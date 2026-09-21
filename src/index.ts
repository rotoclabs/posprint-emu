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

httpServer.listen(config.httpPort, config.host, () => {
  console.log(`[posprint-emu] viewer UI:    http://${config.host}:${config.httpPort}`);
});

tcpServer.listen(config.tcpPort, config.host, () => {
  console.log(`[posprint-emu] printer port: tcp://${config.host}:${config.tcpPort} (${config.columns} columns)`);
});
