import { parseArgs } from 'node:util';
import { readFileSync, existsSync } from 'node:fs';

export interface AppConfig {
  tcpPort: number;
  httpPort: number;
  columns: number;
}

const DEFAULTS: AppConfig = {
  tcpPort: 9100,
  httpPort: 8080,
  columns: 48,
};

interface ConfigFile {
  tcpPort?: number;
  httpPort?: number;
  columns?: number;
}

function readConfigFile(path: string): ConfigFile {
  if (!existsSync(path)) {
    throw new Error(`Config file not found: ${path}`);
  }
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as ConfigFile;
}

export function loadConfig(argv: string[] = process.argv.slice(2)): AppConfig {
  const { values } = parseArgs({
    args: argv,
    options: {
      'tcp-port': { type: 'string' },
      'http-port': { type: 'string' },
      columns: { type: 'string' },
      config: { type: 'string' },
    },
    strict: false,
  });

  const fileConfig: ConfigFile = values.config ? readConfigFile(String(values.config)) : {};

  const tcpPort = values['tcp-port']
    ? Number(values['tcp-port'])
    : process.env.TCP_PORT
      ? Number(process.env.TCP_PORT)
      : (fileConfig.tcpPort ?? DEFAULTS.tcpPort);

  const httpPort = values['http-port']
    ? Number(values['http-port'])
    : process.env.HTTP_PORT
      ? Number(process.env.HTTP_PORT)
      : (fileConfig.httpPort ?? DEFAULTS.httpPort);

  const columns = values.columns
    ? Number(values.columns)
    : process.env.RECEIPT_COLUMNS
      ? Number(process.env.RECEIPT_COLUMNS)
      : (fileConfig.columns ?? DEFAULTS.columns);

  return { tcpPort, httpPort, columns };
}
