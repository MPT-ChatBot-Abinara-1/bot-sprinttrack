import fs from 'fs';
import path from 'path';
import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { config } from './config.js';
import { handleCommand } from './commands.js';
import { logger } from './logger.js';

const { Client, LocalAuth } = pkg;

export const PUPPETEER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
];

export interface ParsedMessageCommand {
  sender: string;
  command: string;
  args: string[];
  rawText: string;
}

export interface IncomingMessageLike {
  isStatus?: boolean;
  from?: string;
  to?: string;
  fromMe?: boolean;
  body?: string;
  reply: (content: string) => Promise<unknown>;
}

export interface BotClientLike {
  info?: { wid?: { _serialized?: string } };
  on: (event: string, listener: (...args: any[]) => void) => unknown;
  initialize: () => Promise<void>;
  destroy: () => Promise<void>;
}

export interface BotLifecycleDeps {
  sessionDir?: string;
  reconnectDelayMs?: number;
  qrGenerate?: (qr: string, opts: { small: boolean }) => void;
  commandHandler?: typeof handleCommand;
  log?: typeof logger;
  onAuthFailureExit?: () => void;
  onReconnect?: () => Promise<void>;
  cleanupCache?: (sessionDir: string) => void;
}

let botReady = false;
let isShuttingDown = false;
let activeClient: BotClientLike | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function isBotReady(): boolean {
  return botReady;
}

export function setBotReady(ready: boolean): void {
  botReady = ready;
}

export function parseMessageCommand(
  message: Pick<IncomingMessageLike, 'isStatus' | 'from' | 'body'>,
): ParsedMessageCommand | null {
  if (message.isStatus === true) return null;
  if (!message.from || !message.from.endsWith('@c.us')) return null;

  const rawText = message.body?.trim();
  if (!rawText) return null;

  const [rawCommand, ...args] = rawText.split(/\s+/);
  const command = rawCommand.toLowerCase();
  if (!command) return null;

  return {
    sender: message.from,
    command,
    args,
    rawText,
  };
}

export function cleanupTemporarySocketCache(sessionDir: string = config.sessionDir): void {
  const resolvedSessionDir = path.resolve(sessionDir);
  const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'DevToolsActivePort'];

  const candidateSessionFolders = new Set<string>([path.join(resolvedSessionDir, 'session')]);
  try {
    if (fs.existsSync(resolvedSessionDir)) {
      for (const entry of fs.readdirSync(resolvedSessionDir, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name.startsWith('session')) {
          candidateSessionFolders.add(path.join(resolvedSessionDir, entry.name));
        }
      }
    }
  } catch {
    // Abaikan jika direktori sesi belum dibuat atau tidak dapat dibaca
  }

  for (const folder of candidateSessionFolders) {
    for (const file of lockFiles) {
      const filePath = path.join(folder, file);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          logger.info(`🧹 Cache socket sementara dihapus: ${filePath}`);
        }
      } catch {
        // Abaikan jika file sedang terkunci atau sudah terhapus
      }
    }
  }

  const webCacheDir = path.resolve(path.dirname(resolvedSessionDir), '.wwebjs_cache');
  try {
    if (fs.existsSync(webCacheDir)) {
      fs.rmSync(webCacheDir, { recursive: true, force: true });
      logger.info(`🧹 Cache sementara dihapus: ${webCacheDir}`);
    }
  } catch {
    // Abaikan jika gagal menghapus cache sementara
  }
}

export function attachClientLifecycle(
  client: BotClientLike,
  deps: BotLifecycleDeps = {},
): {
  clearReconnectTimer: () => void;
  dispatchMessage: (message: IncomingMessageLike) => Promise<void>;
} {
  const sessionDir = deps.sessionDir ?? config.sessionDir;
  const reconnectDelayMs = deps.reconnectDelayMs ?? config.reconnectDelayMs;
  const qrGenerate = deps.qrGenerate ?? ((qr, opts) => qrcode.generate(qr, opts));
  const commandHandler = deps.commandHandler ?? handleCommand;
  const log = deps.log ?? logger;
  const cleanupCache = deps.cleanupCache ?? cleanupTemporarySocketCache;
  const onAuthFailureExit = deps.onAuthFailureExit ?? (() => process.exit(1));

  isShuttingDown = false;

  // Mencegah loop balasan diri sendiri saat mode tes "Message Yourself"
  const pendingBotReplies = new Map<string, number>();

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const trackOutgoingReply = (replyText: string) => {
    pendingBotReplies.set(replyText, (pendingBotReplies.get(replyText) ?? 0) + 1);
    const expiry = setTimeout(() => {
      const remaining = (pendingBotReplies.get(replyText) ?? 1) - 1;
      if (remaining <= 0) {
        pendingBotReplies.delete(replyText);
      } else {
        pendingBotReplies.set(replyText, remaining);
      }
    }, 30_000);
    expiry.unref?.();
  };

  const consumeOwnReplyIfTracked = (body?: string): boolean => {
    if (!body) return false;
    const count = pendingBotReplies.get(body);
    if (!count || count <= 0) return false;
    if (count === 1) {
      pendingBotReplies.delete(body);
    } else {
      pendingBotReplies.set(body, count - 1);
    }
    return true;
  };

  const dispatchMessage = async (message: IncomingMessageLike): Promise<void> => {
    const parsed = parseMessageCommand(message);
    if (!parsed) return;

    log.info(`[Perintah Diterima] ${parsed.sender}: "${parsed.rawText}"`);

    try {
      await commandHandler({
        sender: parsed.sender,
        command: parsed.command,
        args: parsed.args,
        reply: async (replyText: string) => {
          trackOutgoingReply(replyText);
          log.info(`[Membalas ke ${parsed.sender}]:\n${replyText}`);
          await message.reply(replyText);
        },
      });
    } catch (err) {
      log.error(`Gagal memproses perintah "${parsed.command}" dari ${parsed.sender}`, err);
    }
  };

  client.on('qr', (qr: string) => {
    log.info('\nScan QR code berikut melalui Linked Devices di WhatsApp untuk login:');
    qrGenerate(qr, { small: true });
  });

  client.on('authenticated', () => {
    log.info('🔐 Autentikasi berhasil: pertukaran kunci sesi WhatsApp selesai.');
  });

  client.on('loading_screen', (percent: number, message: string) => {
    log.info(`⏳ Memuat data WhatsApp: ${percent}% (${message})`);
  });

  client.on('ready', () => {
    botReady = true;
    log.info('✅ WhatsApp Bot SprintTrack berhasil terhubung dan siap menerima pesan!');
  });

  client.on('auth_failure', async (msg: string) => {
    botReady = false;
    isShuttingDown = true;
    clearReconnectTimer();
    log.error('❌ Autentikasi WhatsApp gagal, menutup proses bot secara aman', msg);

    try {
      await client.destroy();
    } catch (err) {
      log.error('Gagal menghentikan client saat auth_failure', err);
    }

    onAuthFailureExit();
  });

  const scheduleReconnect = () => {
    if (isShuttingDown || reconnectTimer) {
      return;
    }

    log.info(
      `🔄 Menjadwalkan auto-reconnect dalam ${Math.round(reconnectDelayMs / 1000)} detik...`,
    );

    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null;
      if (isShuttingDown) return;

      try {
        await client.destroy();
      } catch {
        // Abaikan error saat menutup sesi client lama sebelum reconnect
      }

      cleanupCache(sessionDir);

      try {
        if (deps.onReconnect) {
          await deps.onReconnect();
        } else {
          await reconnectBot();
        }
      } catch (err) {
        log.error('Gagal melakukan auto-reconnect WhatsApp Bot', err);
        scheduleReconnect();
      }
    }, reconnectDelayMs);
  };

  client.on('disconnected', (reason: string) => {
    botReady = false;
    log.warn('⚠️ Koneksi WhatsApp Bot terputus', reason);

    if (isShuttingDown) {
      return;
    }

    cleanupCache(sessionDir);
    scheduleReconnect();
  });

  client.on('message', async (message: IncomingMessageLike) => {
    await dispatchMessage(message);
  });

  client.on('message_create', async (message: IncomingMessageLike) => {
    if (!message.fromMe) return;
    if (consumeOwnReplyIfTracked(message.body)) return;

    const myWid = client.info?.wid?._serialized;
    if (myWid && message.to === myWid && message.from === myWid) {
      await dispatchMessage(message);
    }
  });

  return { clearReconnectTimer, dispatchMessage };
}

export function createBot(deps: BotLifecycleDeps = {}): pkg.Client {
  const sessionDir = deps.sessionDir ?? config.sessionDir;

  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: sessionDir,
    }),
    authTimeoutMs: 120_000,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    webVersionCache: {
      type: 'none',
    },
    puppeteer: {
      headless: true,
      protocolTimeout: 120_000,
      ...(config.puppeteerExecutablePath
        ? { executablePath: config.puppeteerExecutablePath }
        : {}),
      args: PUPPETEER_ARGS,
    },
  });

  attachClientLifecycle(client as unknown as BotClientLike, deps);
  return client;
}

async function reconnectBot(): Promise<void> {
  if (isShuttingDown) return;
  logger.info('🔄 Mencoba menyambungkan ulang WhatsApp Bot SprintTrack...');
  const client = createBot();
  activeClient = client as unknown as BotClientLike;
  await client.initialize();
}

export async function startBot(): Promise<pkg.Client> {
  isShuttingDown = false;
  botReady = false;
  cleanupTemporarySocketCache(config.sessionDir);
  const client = createBot();
  activeClient = client as unknown as BotClientLike;
  await client.initialize();
  return client;
}

export async function stopBot(): Promise<void> {
  isShuttingDown = true;
  botReady = false;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (activeClient) {
    const clientToStop = activeClient;
    activeClient = null;
    try {
      await clientToStop.destroy();
    } catch {
      // Abaikan error saat shutdown
    }
  }
}
