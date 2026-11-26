import fs from 'fs';
import path from 'path';
import { config } from './config.js';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export function appendLogToFile(
  level: LogLevel,
  message: string,
  detail?: unknown,
  logFilePath: string = config.logFile,
): void {
  const resolvedPath = path.resolve(logFilePath);
  const timestamp = new Date().toISOString();
  const detailText =
    detail === undefined
      ? ''
      : detail instanceof Error
        ? ` | ${detail.stack ?? detail.message}`
        : ` | ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`;
  const line = `[${timestamp}] [${level}] ${message}${detailText}\n`;

  try {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    fs.appendFileSync(resolvedPath, line, 'utf8');
  } catch (err) {
    console.error('Gagal menulis ke file log:', err);
  }
}

export const logger = {
  info(message: string): void {
    console.log(message);
  },
  warn(message: string, detail?: unknown): void {
    console.warn(message, ...(detail !== undefined ? [detail] : []));
    appendLogToFile('WARN', message, detail);
  },
  error(message: string, detail?: unknown): void {
    console.error(message, ...(detail !== undefined ? [detail] : []));
    appendLogToFile('ERROR', message, detail);
  },
};
