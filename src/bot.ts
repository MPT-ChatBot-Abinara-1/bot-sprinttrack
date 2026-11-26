import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { config } from './config.js';
import { handleCommand } from './commands.js';

export function createBot(): pkg.Client {
  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: config.sessionDir,
    }),
    puppeteer: {
      headless: true,
      protocolTimeout: 120_000,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('qr', (qr: string) => {
    console.log('\nScan QR code berikut di WhatsApp untuk login:');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    console.log('✅ WhatsApp Bot SprintTrack berhasil terhubung!');
  });

  client.on('auth_failure', (msg: string) => {
    console.error('Autentikasi gagal:', msg);
  });

  client.on('disconnected', (reason: string) => {
    console.log('Koneksi bot terputus:', reason);
  });

  client.on('message', async (message) => {
    if (message.isStatus) return;

    const text = message.body?.trim();
    if (!text) return;

    const [command, ...args] = text.split(/\s+/);

    await handleCommand({
      sender: message.from,
      command: command.toLowerCase(),
      args,
      reply: async (replyText: string) => {
        await message.reply(replyText);
      },
    });
  });

  return client;
}

export async function startBot(): Promise<pkg.Client> {
  const client = createBot();
  await client.initialize();
  return client;
}
