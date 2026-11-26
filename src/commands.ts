import { BotCommandContext } from './types.js';
import { api, ApiError, phoneFromJid, TaskSummary } from './api.js';

function formatDivision(division?: string): string {
  switch (division?.toUpperCase()) {
    case 'MEKANIK':
      return 'Mekanik';
    case 'ELEKTRIK':
      return 'Elektrik';
    case 'PEMROGRAMAN':
      return 'Pemrograman';
    default:
      return division || '-';
  }
}

function formatPriority(priority?: string): string {
  switch (priority?.toUpperCase()) {
    case 'CRITICAL':
      return 'Critical';
    case 'HIGH':
      return 'High';
    case 'MEDIUM':
      return 'Medium';
    case 'LOW':
      return 'Low';
    default:
      return priority || '-';
  }
}

function formatDueDate(deadline?: string | null): string {
  if (!deadline) return '';
  try {
    const date = new Date(deadline);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return deadline;
  }
}

function formatNow(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${dateStr}, ${timeStr} WIB`;
}

function makeProgressBar(completed: number, total: number, length = 10): string {
  if (total === 0) return '░'.repeat(length);
  const ratio = Math.min(Math.max(completed / total, 0), 1);
  const filled = Math.round(ratio * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

function renderKanbanItem(t: TaskSummary, checkbox: string, strike = false): string {
  const title = strike ? `~${t.title}~` : t.title;
  const pic = t.assignee?.name ? `@${t.assignee.name.replace(/\s+/g, '')}` : '@Unassigned';
  const division = formatDivision(t.division);
  const priority = formatPriority(t.priority);
  const due = formatDueDate(t.deadline);
  const meta = [pic, division, priority, due ? `Due: ${due}` : null]
    .filter(Boolean)
    .join(' · ');

  // Sediakan tombol tap-to-copy langsung untuk kemudahan aksi pengguna
  const quickAction =
    t.status.toUpperCase() === 'TODO'
      ? `\n  Tap copy: \`update T-${t.code} in_progress\``
      : t.status.toUpperCase() === 'IN_PROGRESS'
        ? `\n  Tap copy: \`update T-${t.code} review\``
        : t.status.toUpperCase() === 'REVIEW'
          ? `\n  Tap copy: \`update T-${t.code} done\``
          : '';

  return `${checkbox} *#T-${t.code}* ${title}\n  ${meta}${quickAction}`;
}

async function safe(reply: (t: string) => Promise<void>, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    const msg = err instanceof ApiError ? err.message : 'Internal system error.';
    if (!(err instanceof ApiError)) console.error(err);
    await reply(
      `*PEMBERITAHUAN SISTEM*\n` +
        `──────────────────────────────\n` +
        `${msg}\n` +
        `──────────────────────────────\n` +
        `Ketik *help* untuk kembali ke menu utama.`,
    );
  }
}

export const HELP_MESSAGE = [
  '🤖 *SprintTrack Abinara Bot*',
  'Aplikasi Manajemen Sprint Tim Robotik Abinara-1',
  '',
  'Daftar Perintah:',
  '• *update <id_tugas> <status>*',
  '  Contoh: update T-101 in_progress',
  '  Pilihan status: todo, in_progress, review, done',
  '• *log <id_tugas> <pesan_aktivitas>*',
  '  Contoh: log T-101 selesai merakit sensor api',
  '• *help* : Menampilkan menu panduan ini',
  '• *ping* : Cek status respons bot',
].join('\n');

export const PING_RESPONSE = '🏓 Pong! Bot aktif dan terhubung ke server SprintTrack.';

export const UNKNOWN_COMMAND_RESPONSE =
  '❓ Perintah tidak dikenali. Ketik *help* untuk melihat daftar format perintah yang didukung.';

export async function handleCommand(ctx: BotCommandContext): Promise<void> {
  const { command, args, reply, sender } = ctx;
  const phone = phoneFromJid(sender);

  // Dukung pemilihan nomor menu cepat (Quick Number Reply ala WhatsApp Business)
  if (command === '1') {
    return handleCommand({ ...ctx, command: 'tugas' });
  }
  if (command === '2') {
    if (args.length >= 2) {
      return handleCommand({ ...ctx, command: 'update' });
    }
    await reply(
      `*MENU PEMBARUAN STATUS*\n` +
        `──────────────────────────────\n` +
        `Untuk memperbarui status tugas, gunakan format:\n` +
        `\`update <ID> <STATUS>\`\n\n` +
        `*Daftar Kolom Status:*\n` +
        `• \`todo\`        : Belum dikerjakan\n` +
        `• \`in_progress\` : Sedang dikerjakan\n` +
        `• \`review\`      : Butuh peninjauan\n` +
        `• \`done\`        : Selesai dikerjakan\n\n` +
        `*Contoh Aksi (Tap untuk Salin):*\n` +
        `\`update T-1 in_progress\`\n` +
        `\`update T-1 done\`\n` +
        `──────────────────────────────\n` +
        `Ketik *1* untuk melihat daftar ID tugas yang tersedia.`,
    );
    return;
  }
  if (command === '3') {
    if (args.length >= 2) {
      return handleCommand({ ...ctx, command: 'log' });
    }
    await reply(
      `*MENU CATATAN AKTIVITAS*\n` +
        `──────────────────────────────\n` +
        `Untuk mencatat progres pengerjaan, gunakan format:\n` +
        `\`log <ID> <CATATAN>\`\n\n` +
        `*Contoh Aksi (Tap untuk Salin):*\n` +
        `\`log T-1 Selesai perakitan sasis utama\`\n` +
        `\`log T-2 Pengujian modul motor driver\`\n` +
        `──────────────────────────────\n` +
        `Ketik *1* untuk melihat daftar ID tugas yang tersedia.`,
    );
    return;
  }
  if (command === '4') {
    return handleCommand({ ...ctx, command: 'help' });
  }

  switch (command) {
    case 'help':
    case 'bantuan':
      await reply(HELP_MESSAGE);
      break;

    case 'ping':
      await reply(PING_RESPONSE);
      break;

    case 'tugas':
      await safe(reply, async () => {
        const tasks = await api.myTasks(phone);
        if (tasks.length === 0) {
          await reply(
            `*SPRINTTRACK ABINARA-1*\n` +
              `──────────────────────────────\n` +
              `Papan sprint kosong. Belum ada tugas aktif saat ini.\n` +
              `──────────────────────────────\n` +
              `Ketik *help* untuk melihat opsi perintah lainnya.`,
          );
          return;
        }

        const sprintName =
          tasks[0]?.userStory?.sprint?.name?.toUpperCase() || 'SPRINT 1 ABINARA';

        const todoTasks = tasks.filter((t) => t.status.toUpperCase() === 'TODO');
        const inProgressTasks = tasks.filter((t) => t.status.toUpperCase() === 'IN_PROGRESS');
        const reviewTasks = tasks.filter((t) => t.status.toUpperCase() === 'REVIEW');
        const doneTasks = tasks.filter((t) => t.status.toUpperCase() === 'DONE');

        const total = tasks.length;
        const doneCount = doneTasks.length;
        const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;
        const progressBar = makeProgressBar(doneCount, total, 10);

        const formatSection = (
          title: string,
          items: TaskSummary[],
          checkbox: string,
          strike = false,
        ) => {
          if (items.length === 0) {
            return `*${title} [0]*\n_Tidak ada item_`;
          }
          const rendered = items
            .map((item) => renderKanbanItem(item, checkbox, strike))
            .join('\n\n');
          return `*${title} [${items.length}]*\n${rendered}`;
        };

        const todoBlock = formatSection('TODO', todoTasks, '- [ ]', false);
        const inProgressBlock = formatSection('IN PROGRESS', inProgressTasks, '- [►]', false);
        const reviewBlock = formatSection('IN REVIEW', reviewTasks, '- [?]', false);
        const doneBlock = formatSection('DONE', doneTasks, '- [x]', true);

        await reply(
          `*${sprintName}*\n` +
            `*Papan Sprint Kanban GitHub*\n` +
            `──────────────────────────────\n` +
            `*Progres:* ${doneCount}/${total} selesai (${percent}%)\n` +
            `[${progressBar}]\n` +
            `──────────────────────────────\n\n` +
            `${todoBlock}\n\n` +
            `${inProgressBlock}\n\n` +
            `${reviewBlock}\n\n` +
            `${doneBlock}\n\n` +
            `──────────────────────────────\n` +
            `*TOMBOL AKSI CEPAT:*\n` +
            `┌─────────────────────────────┐\n` +
            `│  [1] Refresh Board Tugas    │\n` +
            `│  [2] Panduan Update Status  │\n` +
            `│  [3] Panduan Catat Log      │\n` +
            `│  [4] Pusat Bantuan          │\n` +
            `└─────────────────────────────┘\n` +
            `_Balas angka *1*, *2*, *3*, atau *4* untuk aksi instan._`,
        );
      });
      break;

    case 'update': {
      const [taskId, status] = args;
      if (!taskId || !status) {
        await reply(
          `*FORMAT PERINTAH TIDAK SESUAI*\n` +
            `──────────────────────────────\n` +
            `Format yang benar:\n` +
            `\`update <ID_TUGAS> <STATUS>\`\n\n` +
            `Pilihan status valid: \`todo\`, \`in_progress\`, \`review\`, \`done\`\n\n` +
            `Contoh aksi:\n` +
            `\`update T-1 in_progress\`\n` +
            `\`update T-1 done\`\n` +
            `──────────────────────────────\n` +
            `Ketik *1* untuk melihat daftar tugas.`,
        );
        return;
      }
      await safe(reply, async () => {
        const task = await api.updateStatus(taskId, phone, status);
        const targetColumn = task.status.toUpperCase();
        await reply(
          `*PEMBARUAN STATUS BERHASIL*\n` +
            `──────────────────────────────\n` +
            `• ID Tugas     : *#T-${task.code}*\n` +
            `• Judul        : ${task.title}\n` +
            `• Kolom Baru   : *[${targetColumn}]*\n` +
            `• Waktu        : ${formatNow()}\n` +
            `──────────────────────────────\n` +
            `Kartu tugas berhasil dipindahkan ke kolom *${targetColumn}*.\n\n` +
            `Ketik *1* untuk melihat board terbaru.`,
        );
      });
      break;
    }

    case 'log': {
      const [taskId, ...logParts] = args;
      const message = logParts.join(' ');
      if (!taskId || !message) {
        await reply(
          `*FORMAT PERINTAH TIDAK SESUAI*\n` +
            `──────────────────────────────\n` +
            `Format yang benar:\n` +
            `\`log <ID_TUGAS> <CATATAN>\`\n\n` +
            `Contoh:\n` +
            `\`log T-1 Selesai perakitan sensor jarak\`\n` +
            `──────────────────────────────\n` +
            `Ketik *1* untuk melihat daftar tugas.`,
        );
        return;
      }
      await safe(reply, async () => {
        const task = await api.addLog(taskId, phone, message);
        await reply(
          `*CATATAN AKTIVITAS TERSIMPAN*\n` +
            `──────────────────────────────\n` +
            `• ID Tugas     : *#T-${task.code}*\n` +
            `• Judul        : ${task.title}\n` +
            `• Catatan      : "${message}"\n` +
            `• Waktu        : ${formatNow()}\n` +
            `──────────────────────────────\n` +
            `Riwayat aktivitas telah disimpan ke database SprintTrack.\n\n` +
            `Ketik *1* untuk melihat board tugas.`,
        );
      });
      break;
    }

    default:
      await reply(UNKNOWN_COMMAND_RESPONSE);
      break;
  }
}
