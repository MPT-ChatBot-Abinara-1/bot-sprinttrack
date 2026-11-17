import { BotCommandContext } from './types.js';

export async function handleCommand(ctx: BotCommandContext): Promise<void> {
  const { command, args, reply } = ctx;

  switch (command) {
    case 'help':
    case 'bantuan':
      await reply(
        `🤖 *SprintTrack Bot*\n\n` +
          `Daftar Perintah:\n` +
          `- *update <id_tugas> <status>*: Ubah status tugas (todo, in_progress, review, done)\n` +
          `- *log <id_tugas> <pesan>*: Catat aktivitas pengerjaan tugas\n` +
          `- *help*: Menampilkan pesan bantuan ini`
      );
      break;

    case 'update': {
      const [taskId, status] = args;
      if (!taskId || !status) {
        await reply('❌ Format salah! Contoh: *update T-101 done*');
        return;
      }

      // TODO (Dev): Validasi kepemilikan tugas pengirim ke API SprintTrack (FR-10 & FR-14)
      // TODO (Dev): Panggil API SprintTrack untuk update status tugas (FR-07)
      // TODO (Dev): Kirim notifikasi ke Staff Ahli jika status ke Review/Done (FR-12)

      await reply(`⏳ [Template] Mengubah status tugas *${taskId}* menjadi *${status}*...`);
      break;
    }

    case 'log': {
      const [taskId, ...logParts] = args;
      const message = logParts.join(' ');
      if (!taskId || !message) {
        await reply('❌ Format salah! Contoh: *log T-101 selesai merakit rangka sensor*');
        return;
      }

      // TODO (Dev): Kirim pencatatan log aktivitas ke API SprintTrack (FR-14)

      await reply(`📝 [Template] Mencatat log untuk tugas *${taskId}*: "${message}"`);
      break;
    }

    default:
      await reply('❓ Perintah tidak dikenali. Ketik *help* untuk melihat format yang benar.');
      break;
  }
}
