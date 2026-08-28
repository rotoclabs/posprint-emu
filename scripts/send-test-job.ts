import { Socket } from 'node:net';
import { loadConfig } from '../src/config.js';

const ESC = 0x1b;
const GS = 0x1d;

function bytes(...values: (number | string)[]): Buffer {
  const out: number[] = [];
  for (const v of values) {
    if (typeof v === 'string') {
      for (const ch of v) out.push(ch.charCodeAt(0));
    } else {
      out.push(v);
    }
  }
  return Buffer.from(out);
}

function checkerboardImage(widthBytes: number, heightDots: number): Buffer {
  const rows: number[] = [];
  for (let y = 0; y < heightDots; y++) {
    const rowByte = y % 4 < 2 ? 0xaa : 0x55;
    for (let x = 0; x < widthBytes; x++) rows.push(rowByte);
  }
  return Buffer.from(rows);
}

function rasterImage(widthBytes: number, heightDots: number, data: Buffer): Buffer {
  return Buffer.concat([
    bytes(GS, 0x76, 0x30, 0x00, widthBytes & 0xff, (widthBytes >> 8) & 0xff, heightDots & 0xff, (heightDots >> 8) & 0xff),
    data,
  ]);
}

const config = loadConfig();
const img = checkerboardImage(8, 24);

const job = Buffer.concat([
  bytes(ESC, 0x40), // init
  bytes(ESC, 0x61, 1), // align center
  bytes(ESC, 0x45, 1), // bold on
  bytes('POSPRINT-EMU TEST RECEIPT'),
  bytes(0x0a),
  bytes(ESC, 0x45, 0), // bold off
  bytes(ESC, 0x61, 0), // align left
  bytes(0x0a),

  bytes(GS, 0x21, 0x00), // 1x1
  bytes('normal size'),
  bytes(0x0a),
  bytes(GS, 0x21, 0x11), // 2x2
  bytes('2x2 size'),
  bytes(0x0a),
  bytes(GS, 0x21, 0x00),
  bytes(0x0a),

  bytes(ESC, 0x2d, 1), // underline on
  bytes('underlined text'),
  bytes(ESC, 0x2d, 0), // underline off
  bytes(0x0a),

  bytes(`Wrap test: ${'x'.repeat(config.columns + 10)}`),
  bytes(0x0a),

  bytes(ESC, 0x64, 2), // feed 2 lines
  rasterImage(8, 24, img),
  bytes(0x0a),

  bytes(GS, 0x56, 0x00), // full cut

  bytes('Second segment after full cut'),
  bytes(0x0a),

  bytes(GS, 0x56, 0x01), // partial cut
]);

const socket = new Socket();
socket.connect(config.tcpPort, 'localhost', () => {
  socket.write(job, () => socket.end());
});

socket.on('connect', () => {
  console.log(`Sending test job to tcp://localhost:${config.tcpPort} (${job.length} bytes)`);
});

socket.on('error', (err) => {
  console.error(`Failed to send test job: ${err.message}`);
  process.exitCode = 1;
});

socket.on('close', () => {
  console.log(`Done. Check the viewer at http://localhost:${config.httpPort}`);
});
