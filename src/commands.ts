import { BotCommandContext } from './types.js';
import { api, ApiError, phoneFromJid } from './api.js';

async function safe(reply: (t: string) => Promise<void>, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    const msg = err instanceof ApiError ? err.message : 'Terjadi kesalahan tak terduga.';
    if (!(err instanceof ApiError)) console.error(err);
    await reply(`❌ ${msg}`);
  }
}

export async function handleCommand(ctx: BotCommandContext): Promise<void> {
  const { command, args, reply, sender } = ctx;
  const phone = phoneFromJid(sender);

  switch (command) {
    case 'help':
    case 'bantuan':
      await reply(
        `🤖 *SprintTrack Bot*\n\n` +
          `Daftar Perintah:\n` +
          `- *tugas*: Lihat tugas aktif Anda\n` +
          `- *update <id_tugas> <status>*: Ubah status tugas (todo, in_progress, review, done)\n` +
          `- *log <id_tugas> <pesan>*: Catat aktivitas pengerjaan tugas\n` +
          `- *help*: Menampilkan pesan bantuan ini`,
      );
      break;

    case 'tugas':
      await safe(reply, async () => {
        const tasks = await api.myTasks(phone);
        if (tasks.length === 0) {
          await reply('🎉 Tidak ada tugas aktif untuk Anda.');
          return;
        }
        const lines = tasks.map((t) => `- *T-${t.code}* ${t.title} (${t.status})`);
        await reply(`📋 *Tugas Aktif Anda*\n\n${lines.join('\n')}`);
      });
      break;

    case 'update': {
      const [taskId, status] = args;
      if (!taskId || !status) {
        await reply('❌ Format salah! Contoh: *update T-101 done*');
        return;
      }
      await safe(reply, async () => {
        const task = await api.updateStatus(taskId, phone, status);
        await reply(`✅ Tugas *T-${task.code}* (${task.title}) sekarang berstatus *${task.status}*.`);
      });
      break;
    }

    case 'log': {
      const [taskId, ...logParts] = args;
      const message = logParts.join(' ');
      if (!taskId || !message) {
        await reply('❌ Format salah! Contoh: *log T-101 selesai merakit rangka sensor*');
        return;
      }
      await safe(reply, async () => {
        const task = await api.addLog(taskId, phone, message);
        await reply(`📝 Log tercatat untuk *T-${task.code}* (${task.title}).`);
      });
      break;
    }

    default:
      await reply('❓ Perintah tidak dikenali. Ketik *help* untuk melihat format yang benar.');
      break;
  }
}
