import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { config } from './config.js';
import { handleCommand } from './commands.js';
import fs from 'fs';
import path from 'path';

export function createBot(): pkg.Client {
  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: config.sessionDir,
    }),
    authTimeoutMs: 120_000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    webVersionCache: {
      type: 'none',
    },
    puppeteer: {
      headless: true,
      protocolTimeout: 120_000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--disable-gpu',
        '--disable-accelerated-2d-canvas',
        '--disable-features=IsolateOrigins,site-per-process,AsyncDns',
        '--disable-site-isolation-trials',
      ],
    },
  });

  client.on('qr', (qr: string) => {
    console.log('\nScan QR code berikut di WhatsApp untuk login:');
    qrcode.generate(qr, { small: true });
  });

  client.on('authenticated', () => {
    console.log('🔐 Sesi WhatsApp berhasil terotentikasi!');
  });

  client.on('loading_screen', (percent: number, message: string) => {
    console.log(`⏳ Memuat data WhatsApp: ${percent}% (${message})`);
  });

  client.on('ready', () => {
    console.log('✅ WhatsApp Bot SprintTrack berhasil terhubung dan siap menerima perintah!');
  });

  client.on('auth_failure', (msg: string) => {
    console.error('❌ Autentikasi gagal:', msg);
  });

  client.on('disconnected', (reason: string) => {
    console.log('⚠️ Koneksi bot terputus:', reason);
  });

  const processIncomingMessage = async (message: pkg.Message, isSelf = false) => {
    if (message.isStatus) return;
    if (message.from.endsWith('@broadcast') || message.from.endsWith('@newsletter')) return;

    const text = message.body?.trim();
    if (!text) return;

    const [rawCommand, ...args] = text.split(/\s+/);
    let command = rawCommand.toLowerCase();
    if (command.startsWith('/') || command.startsWith('!') || command.startsWith('.')) {
      command = command.slice(1);
    }

    const validCommands = ['help', 'bantuan', 'tugas', 'update', 'log', '1', '2', '3', '4'];

    // PENTING: Hanya tanggapi jika pesan berupa perintah bot yang valid.
    // Chat biasa dari orang lain/bank/grup (seperti BCA, teman, keluarga) akan diabaikan secara senyap.
    if (!validCommands.includes(command)) {
      return;
    }

    console.log(`[Perintah Diterima] ${message.from}: "${text}"`);

    try {
      await handleCommand({
        sender: message.from,
        command,
        args,
        reply: async (replyText: string) => {
          console.log(`[Membalas ke ${message.from}]:\n${replyText}`);
          await message.reply(replyText);
        },
      });
    } catch (err) {
      console.error('Error handling command:', err);
    }
  };

  client.on('message', async (message) => {
    await processIncomingMessage(message, false);
  });

  client.on('message_create', async (message) => {
    // Dukung pengetesan langsung lewat chat ke diri sendiri (Message Yourself)
    if (message.fromMe) {
      const myWid = client.info?.wid?._serialized;
      if (myWid && (message.to === myWid || message.from === myWid)) {
        await processIncomingMessage(message, true);
      }
    }
  });

  return client;
}

function cleanupSessionLocks() {
  const sessionPath = path.resolve(config.sessionDir, 'session');
  const lockFiles = ['SingletonLock', 'SingletonCookie', 'DevToolsActivePort'];
  for (const file of lockFiles) {
    const filePath = path.join(sessionPath, file);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🧹 Lock file dihapus: ${file}`);
      }
    } catch {
      // abaikan jika gagal hapus
    }
  }
}

export async function startBot(maxRetries = 5, retryDelayMs = 5000): Promise<pkg.Client> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    cleanupSessionLocks();
    const client = createBot();

    try {
      await client.initialize();
      return client;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[Peringatan] Percobaan inisialisasi bot ke-${attempt} gagal: ${errMsg}`);

      try {
        await client.destroy();
      } catch {
        // abaikan error saat destroy
      }

      cleanupSessionLocks();

      const isNetworkError =
        errMsg.includes('ERR_NAME_NOT_RESOLVED') ||
        errMsg.includes('ERR_INTERNET_DISCONNECTED') ||
        errMsg.includes('ERR_CONNECTION_TIMED_OUT') ||
        errMsg.includes('ERR_NETWORK_CHANGED') ||
        errMsg.includes('Navigation timeout');

      if (attempt < maxRetries) {
        const waitTime = retryDelayMs * attempt;
        console.log(`Mengulang koneksi ke WhatsApp Web dalam ${waitTime / 1000} detik... (Pastikan koneksi internet aktif)`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else {
        if (isNetworkError) {
          throw new Error(
            `Koneksi internet terputus atau domain web.whatsapp.com tidak dapat dijangkau (${errMsg}). Periksa koneksi internet/Wi-Fi Anda, lalu jalankan ulang bot.`
          );
        }
        throw err;
      }
    }
  }

  throw new Error('Gagal memulai WhatsApp Bot setelah beberapa percobaan.');
}
