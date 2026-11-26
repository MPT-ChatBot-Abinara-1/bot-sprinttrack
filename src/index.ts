import { startBot, stopBot } from './bot.js';
import { logger } from './logger.js';

logger.info('Memulai SprintTrack WhatsApp Bot...');

async function main() {
  await startBot();
}

async function shutdown(signal: string) {
  logger.info(`\nMenerima sinyal ${signal}, mematikan bot...`);
  await stopBot();
  logger.info('Bot berhasil dihentikan.');
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

main().catch((err) => {
  logger.error('Gagal menjalankan bot', err);
  process.exit(1);
});
