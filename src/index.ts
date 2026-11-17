import { startBot } from './bot.js';

console.log('Memulai SprintTrack WhatsApp Bot...');

startBot().catch((err) => {
  console.error('Gagal menjalankan bot:', err);
});
