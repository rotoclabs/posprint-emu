# posprint-emu

An ESC/POS thermal receipt printer emulator. It listens on a raw TCP socket like a real
network receipt printer (the "JetDirect"/direct-IP convention, port 9100 by default), parses
the ESC/POS byte stream, and renders a live, WYSIWYG-style view of the resulting receipt in
your browser — so you can visually confirm exactly what a printer client under test is
actually sending, without needing physical hardware.

## Usage

```sh
npm install
npm run dev
```

This starts:

- a TCP listener on `9100` — point any ESC/POS client at `tcp://localhost:9100`
- a web viewer at `http://localhost:8080` — open it in a browser to watch receipts render live

To try it without a real client, run the bundled test job against a running server:

```sh
npm run test:send
```

It sends one crafted print job exercising every supported command (bold, underline, sizes,
alignment, hard-wrap, a raster image, and both cut types) so you can confirm the viewer end to
end.

Run `npm run build && npm start` to run from compiled output instead of `tsx`.

## Configuration

Resolved in order: CLI flags > environment variables > config file > defaults.

| Setting | CLI flag | Env var | Default |
|---|---|---|---|
| Listen host | `--host` | `HOST` | `localhost` |
| Printer TCP port | `--tcp-port` | `TCP_PORT` | `9100` |
| Viewer HTTP port | `--http-port` | `HTTP_PORT` | `8080` |
| Receipt width (characters) | `--columns` | `RECEIPT_COLUMNS` | `48` (42 is common for 58mm paper) |

Use `--host 0.0.0.0` (or any specific interface IP) to listen on more than just
`localhost`.

A JSON config file can also be passed with `--config path/to/file.json` — see
`posprint.config.example.json`.

## Architecture

- `src/escpos/` — the ESC/POS protocol layer: a table-driven, streaming tokenizer
  (`tokenizer.ts` + `commandTable.ts`) that turns a raw byte stream into discrete commands,
  correctly handling commands split across TCP packets.
- `src/receipt/` — a pure, framework-free model (`ReceiptModel.ts`) that turns parsed commands
  into a "virtual paper roll": wrapped text lines with formatting spans, images, and cut
  markers. Fully unit-testable without any networking.
- `src/session/PrintJob.ts` — one per TCP connection; owns its own tokenizer and printer
  formatting state so concurrent connections can never corrupt each other's parsing, while all
  connections write into one shared `ReceiptModel` (one printer, one paper roll).
- `src/server/` — the TCP listener, the HTTP static file + REST server, and a WebSocket
  broadcaster that pushes a full receipt snapshot to every connected browser tab whenever the
  model changes.
- `public/` — a small vanilla JS/CSS viewer: no build step, re-renders the whole receipt from
  each snapshot.

Adding a new ESC/POS command means adding one `CommandSpec` entry to `commandTable.ts` (prefix
bytes, header length, and a decoder) — the tokenizer itself needs no changes.

## Supported commands (MVP scope)

| Command | Bytes |
|---|---|
| Initialize | `ESC @` |
| Bold on/off | `ESC E n` |
| Underline on/off | `ESC - n` |
| Align left/center/right | `ESC a n` |
| Character size (width/height 1x-8x) | `GS ! n` |
| Line feed | `LF` |
| Feed n lines | `ESC d n` |
| Feed n dots (approximate) | `ESC J n` |
| Cut (full/partial) | `GS V m` |
| Raster bit image (normal mode) | `GS v 0 m xL xH yL yH [data]` |
| Plain text (CP437) | anything else |

Known simplifications: a single fixed CP437 codepage (no `ESC t` codepage switching yet),
carriage return is a no-op, underline weight is collapsed to on/off, `ESC J` is rendered as a
proportional spacer rather than converted to text lines, and only raster image mode 0 is
rendered. Unrecognized or unsupported control sequences are logged to the console and skipped
as no-ops — malformed input never crashes the emulator.

**Deferred / not yet implemented** (the architecture is designed to make these low-friction to
add later): 1D barcodes (`GS k`), QR codes (`GS ( k`), multiple/switchable codepages (`ESC t`),
cash drawer kick (`ESC p`), printer status queries (`DLE EOT`), NV image storage, and emulating
multiple independent printers at once.

## Testing

```sh
npm test
```

Unit tests cover the tokenizer (including a property test that feeds the same byte stream
split at every possible offset and asserts identical output — the thing that actually proves
TCP packet fragmentation is handled correctly), per-command decoding, and the receipt model's
line-wrapping/cut/formatting behavior.
