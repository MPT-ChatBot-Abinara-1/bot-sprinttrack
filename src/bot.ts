import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import { config } from './config.js';
import { handleCommand } from './commands.js';

export async function startBot(): Promise<WASocket> {
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\nScan QR code berikut di WhatsApp untuk login:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Koneksi terputus. Mencoba reconnect:', shouldReconnect);
      if (shouldReconnect) {
        startBot();
      }
    } else if (connection === 'open') {
      console.log('✅ WhatsApp Bot SprintTrack berhasil terhubung!');
    }
  });

  sock.ev.on('messages.upsert', async (event) => {
    for (const msg of event.messages) {
      if (msg.key.fromMe || !msg.message) continue;

      const sender = msg.key.remoteJid;
      if (!sender) continue;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        '';

      const trimmed = text.trim();
      if (!trimmed) continue;

      const [command, ...args] = trimmed.split(/\s+/);

      await handleCommand({
        sender,
        command: command.toLowerCase(),
        args,
        reply: async (replyText: string) => {
          await sock.sendMessage(sender, { text: replyText });
        },
      });
    }
  });

  return sock;
}
