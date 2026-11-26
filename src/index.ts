import { startBot } from './bot.js';

console.log('Memulai SprintTrack WhatsApp Bot...');

let botClient: Awaited<ReturnType<typeof startBot>> | null = null;

async function main() {
  botClient = await startBot();
}

async function shutdown(signal: string) {
  console.log(`\nMenerima sinyal ${signal}, mematikan bot...`);
  if (botClient) {
    try {
      await botClient.destroy();
      console.log('Bot berhasil dihentikan.');
    } catch {
      // abaikan error saat shutdown
    }
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch((err) => {
  console.error('Gagal menjalankan bot:', err);
  process.exit(1);
});
