import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import EventEmitter from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  attachClientLifecycle,
  cleanupTemporarySocketCache,
  isBotReady,
  parseMessageCommand,
  PUPPETEER_ARGS,
  setBotReady,
  type BotClientLike,
} from '../src/bot.js';
import {
  handleCommand,
  HELP_MESSAGE,
  PING_RESPONSE,
  UNKNOWN_COMMAND_RESPONSE,
} from '../src/commands.js';
import { appendLogToFile } from '../src/logger.js';
import { api } from '../src/api.js';

class FakeClient extends EventEmitter implements BotClientLike {
  info = { wid: { _serialized: '628111111111@c.us' } };
  destroyCount = 0;
  initializeCount = 0;

  async initialize(): Promise<void> {
    this.initializeCount++;
  }

  async destroy(): Promise<void> {
    this.destroyCount++;
  }
}

describe('PUPPETEER_ARGS', () => {
  it('contains required Linux/Windows server-friendly Chromium flags', () => {
    assert.deepEqual(PUPPETEER_ARGS, [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ]);
  });
});

describe('parseMessageCommand', () => {
  it('ignores WhatsApp status messages', () => {
    const parsed = parseMessageCommand({
      isStatus: true,
      from: '6281234567890@c.us',
      body: 'ping',
    });
    assert.equal(parsed, null);
  });

  it('ignores group, broadcast, and newsletter messages', () => {
    for (const from of [
      '120363012345678901@g.us',
      'status@broadcast',
      '120363012345678901@newsletter',
    ]) {
      const parsed = parseMessageCommand({
        isStatus: false,
        from,
        body: 'help',
      });
      assert.equal(parsed, null, `expected ${from} to be ignored`);
    }
  });

  it('ignores empty or whitespace-only messages', () => {
    assert.equal(
      parseMessageCommand({ isStatus: false, from: '6281234567890@c.us', body: '   \n\t  ' }),
      null,
    );
    assert.equal(
      parseMessageCommand({ isStatus: false, from: '6281234567890@c.us', body: '' }),
      null,
    );
  });

  it('trims, splits, and lowercases private @c.us commands', () => {
    const parsed = parseMessageCommand({
      isStatus: false,
      from: '6281234567890@c.us',
      body: '   UPDATE   T-101   in_progress  ',
    });
    assert.deepEqual(parsed, {
      sender: '6281234567890@c.us',
      command: 'update',
      args: ['T-101', 'in_progress'],
      rawText: 'UPDATE   T-101   in_progress',
    });
  });
});

describe('handleCommand', () => {
  it('responds with the structured help menu for help and bantuan', async () => {
    for (const command of ['help', 'bantuan']) {
      const replies: string[] = [];
      await handleCommand({
        sender: '6281234567890@c.us',
        command,
        args: [],
        reply: async (text) => {
          replies.push(text);
        },
      });
      assert.equal(replies.length, 1);
      assert.equal(replies[0], HELP_MESSAGE);
      assert.match(replies[0], /🤖 \*SprintTrack Abinara Bot\*/);
      assert.match(replies[0], /• \*ping\* : Cek status respons bot/);
    }
  });

  it('responds with Pong message for ping command', async () => {
    const replies: string[] = [];
    await handleCommand({
      sender: '6281234567890@c.us',
      command: 'ping',
      args: [],
      reply: async (text) => {
        replies.push(text);
      },
    });
    assert.deepEqual(replies, [PING_RESPONSE]);
  });

  it('responds with friendly fallback message for unrecognized commands', async () => {
    const replies: string[] = [];
    await handleCommand({
      sender: '6281234567890@c.us',
      command: 'halo',
      args: ['dunia'],
      reply: async (text) => {
        replies.push(text);
      },
    });
    assert.deepEqual(replies, [UNKNOWN_COMMAND_RESPONSE]);
  });
});

describe('attachClientLifecycle', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    setBotReady(false);
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()!;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('handles qr, authenticated, ready, and message events', async () => {
    const client = new FakeClient();
    const qrCalls: Array<{ qr: string; small: boolean }> = [];
    const logs: string[] = [];

    const { clearReconnectTimer } = attachClientLifecycle(client, {
      qrGenerate: (qr, opts) => qrCalls.push({ qr, small: opts.small }),
      log: {
        info: (m) => logs.push(m),
        warn: (m) => logs.push(m),
        error: (m) => logs.push(m),
      },
    });

    try {
      client.emit('qr', 'mock-qr-payload');
      assert.deepEqual(qrCalls, [{ qr: 'mock-qr-payload', small: true }]);

      client.emit('authenticated');
      assert.ok(logs.some((l) => l.includes('kunci sesi')));

      assert.equal(isBotReady(), false);
      client.emit('ready');
      assert.equal(isBotReady(), true);

      const replies: string[] = [];
      client.emit('message', {
        isStatus: false,
        from: '6281234567890@c.us',
        body: '  PING ',
        reply: async (text: string) => {
          replies.push(text);
        },
      });
      await new Promise((r) => setTimeout(r, 20));
      assert.deepEqual(replies, [PING_RESPONSE]);

      // Group message must be ignored
      client.emit('message', {
        isStatus: false,
        from: '120363012345678901@g.us',
        body: 'ping',
        reply: async (text: string) => {
          replies.push(text);
        },
      });
      await new Promise((r) => setTimeout(r, 20));
      assert.equal(replies.length, 1);
    } finally {
      clearReconnectTimer();
    }
  });

  it('logs auth_failure to file and shuts down safely', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-sprinttrack-auth-'));
    tempDirs.push(tmpDir);
    const logFile = path.join(tmpDir, 'bot-error.log');

    const client = new FakeClient();
    let exitCalled = false;

    attachClientLifecycle(client, {
      log: {
        info: () => {},
        warn: () => {},
        error: (msg, detail) => appendLogToFile('ERROR', msg, detail, logFile),
      },
      onAuthFailureExit: () => {
        exitCalled = true;
      },
    });

    client.emit('ready');
    assert.equal(isBotReady(), true);

    client.emit('auth_failure', 'Invalid session credentials');
    await new Promise((r) => setTimeout(r, 20));

    assert.equal(isBotReady(), false);
    assert.equal(client.destroyCount, 1);
    assert.equal(exitCalled, true);

    const logContent = fs.readFileSync(logFile, 'utf8');
    assert.match(logContent, /\[ERROR\]/);
    assert.match(logContent, /Invalid session credentials/);
  });

  it('cleans temporary socket cache and auto-reconnects after disconnected', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-sprinttrack-disc-'));
    tempDirs.push(tmpDir);

    const sessionDir = path.join(tmpDir, '.wwebjs_auth');
    const sessionProfileDir = path.join(sessionDir, 'session');
    const cacheDir = path.join(tmpDir, '.wwebjs_cache');
    fs.mkdirSync(sessionProfileDir, { recursive: true });
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(sessionProfileDir, 'SingletonLock'), 'lock');
    fs.writeFileSync(path.join(sessionProfileDir, 'SingletonSocket'), 'sock');
    fs.writeFileSync(path.join(sessionProfileDir, 'PersistentData'), 'keep-me');
    fs.writeFileSync(path.join(cacheDir, 'temp.html'), 'cache');

    const client = new FakeClient();
    let reconnectCalls = 0;

    const { clearReconnectTimer } = attachClientLifecycle(client, {
      sessionDir,
      reconnectDelayMs: 50,
      log: { info: () => {}, warn: () => {}, error: () => {} },
      cleanupCache: cleanupTemporarySocketCache,
      onReconnect: async () => {
        reconnectCalls++;
      },
    });

    try {
      client.emit('ready');
      assert.equal(isBotReady(), true);

      client.emit('disconnected', 'NAVIGATION');
      assert.equal(isBotReady(), false);

      // Temporary socket lock files and cache should be cleaned, persistent session data kept
      assert.equal(fs.existsSync(path.join(sessionProfileDir, 'SingletonLock')), false);
      assert.equal(fs.existsSync(path.join(sessionProfileDir, 'SingletonSocket')), false);
      assert.equal(fs.existsSync(cacheDir), false);
      assert.equal(fs.existsSync(path.join(sessionProfileDir, 'PersistentData')), true);

      await new Promise((r) => setTimeout(r, 120));
      assert.equal(client.destroyCount, 1);
      assert.equal(reconnectCalls, 1);
    } finally {
      clearReconnectTimer();
    }
  });
});

describe('backend integration header', () => {
  it('sends x-bot-api-key header on backend API requests', async () => {
    const originalFetch = globalThis.fetch;
    let capturedHeaders: Record<string, string> | undefined;

    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      capturedHeaders = init?.headers as Record<string, string>;
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    try {
      await api.myTasks('6281234567890');
      assert.ok(capturedHeaders);
      assert.equal('x-bot-api-key' in capturedHeaders, true);
      assert.equal('x-bot-key' in capturedHeaders, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
