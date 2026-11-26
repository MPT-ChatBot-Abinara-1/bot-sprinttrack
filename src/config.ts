import dotenv from 'dotenv';

dotenv.config();

const parsedReconnectDelay = Number(process.env.RECONNECT_DELAY_MS);

export const config = {
  sessionDir: process.env.SESSION_DIR || './.wwebjs_auth',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:4000/api/v1',
  botApiKey: process.env.BOT_API_KEY || '',
  logFile: process.env.LOG_FILE || './logs/bot-error.log',
  reconnectDelayMs:
    Number.isFinite(parsedReconnectDelay) && parsedReconnectDelay > 0
      ? parsedReconnectDelay
      : 10_000,
  puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
};
