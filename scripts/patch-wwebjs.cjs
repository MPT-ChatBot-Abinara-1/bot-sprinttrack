/**
 * Applies upstream whatsapp-web.js fix (PR #201990) for WhatsApp Web's /login/ route
 * where WAWebSocketModel is unavailable and socket state lives on WAWebBackendEventBus.
 * Safe and idempotent; becomes a no-op once whatsapp-web.js includes the fix upstream.
 */
const fs = require('fs');
const path = require('path');

const clientPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'whatsapp-web.js',
  'src',
  'Client.js'
);

if (!fs.existsSync(clientPath)) {
  process.exit(0);
}

const raw = fs.readFileSync(clientPath, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
let content = raw.replace(/\r\n/g, '\n');

if (content.includes("window.location.pathname.startsWith('/login')")) {
  console.log('whatsapp-web.js Client.js already patched.');
  process.exit(0);
}

const replacements = [
  [
    `                    const state =\n                        window.require?.('WAWebSocketModel')?.Socket?.state;`,
    `                    const state = window.require('WAWebBackendEventBus')\n                        .BackendEventBus.socketState;`,
  ],
  [
    `                        // Remove QR listener once authentication succeeds\n                        window\n                            .require('WAWebSocketModel')\n                            .Socket.on('change:hasSynced', () => {`,
    `                        // Remove QR listener once authentication succeeds\n                        window\n                            .require('WAWebBackendEventBus')\n                            .BackendEventBus.on('open_socket_stream', () => {`,
  ],
  [
    `            await this.pupPage.evaluate(() => {\n                const Socket = window.require('WAWebSocketModel').Socket;\n                const Cmd = window.require('WAWebCmd').Cmd;\n\n                const listeners = [\n                    [\n                        Socket,\n                        'change:state',\n                        (_AppState, state) => {\n                            window.onAuthAppStateChangedEvent(state);\n                        },\n                    ],\n                    [\n                        Socket,\n                        'change:hasSynced',\n                        () => {\n                            window.onAppStateHasSyncedEvent();\n                        },\n                    ],`,
    `            await this.pupPage.evaluate(() => {\n                const Cmd = window.require('WAWebCmd').Cmd;\n\n                let listeners = [`,
  ],
  [
    `                    [\n                        Cmd,\n                        'logout_from_bridge',\n                        async () => {\n                            await window.onLogoutEvent();\n                        },\n                    ],\n                ];`,
    `                    [\n                        Cmd,\n                        'logout_from_bridge',\n                        async () => {\n                            await window.onLogoutEvent();\n                        },\n                    ],\n                ];\n                const loginRoute =\n                    window.location.pathname.startsWith('/login');\n                let Socket = null;\n                if (loginRoute) {\n                    Socket = window.require(\n                        'WAWebBackendEventBus',\n                    ).BackendEventBus;\n                    Socket.hasSynced = Socket.isMainStreamReadyMd;\n                    listeners.push([\n                        Socket,\n                        'set_socket_state',\n                        (state) => {\n                            window.onAuthAppStateChangedEvent(state);\n                        },\n                    ]);\n                    listeners.push([\n                        Socket,\n                        'open_socket_stream',\n                        () => {\n                            window.onAppStateHasSyncedEvent();\n                        },\n                    ]);\n                } else {\n                    Socket = window.require('WAWebSocketModel').Socket;\n                    listeners.push([\n                        Socket,\n                        'change:state',\n                        (_AppState, state) => {\n                            window.onAuthAppStateChangedEvent(state);\n                        },\n                    ]);\n                    listeners.push([\n                        Socket,\n                        'change:hasSynced',\n                        () => {\n                            window.onAppStateHasSyncedEvent();\n                        },\n                    ]);\n                }`,
  ],
  [
    `                window.codeInterval = setInterval(async () => {\n                    const state =\n                        window.require('WAWebSocketModel').Socket.state;`,
    `                window.codeInterval = setInterval(async () => {\n                    const state = window.require('WAWebBackendEventBus')\n                        .BackendEventBus.socketState;`,
  ],
  [
    `    async logout() {\n        await this.pupPage.evaluate(() => {\n            return window.require('WAWebSocketModel').Socket.logout();\n        });`,
    `    async logout() {\n        await this.pupPage.evaluate(() => {\n            return window\n                .require('WAWebBackendEventBus')\n                .BackendEventBus.triggerLogout();\n        });`,
  ],
  [
    `    async getState() {\n        return await this.pupPage.evaluate(() => {\n            return window.require('WAWebSocketModel').Socket.state ?? null;\n        });`,
    `    async getState() {\n        return await this.pupPage.evaluate(() => {\n            return (\n                window.require('WAWebBackendEventBus').BackendEventBus\n                    .socketState ?? null\n            );\n        });`,
  ],
  [
    `    async resetState() {\n        await this.pupPage.evaluate(() => {\n            window.require('WAWebSocketModel').Socket.reconnect();\n        });`,
    `    async resetState() {\n        await this.pupPage.evaluate(() => {\n            window\n                .require('WAWebBackendEventBus')\n                .BackendEventBus.triggerReconnectSocket();\n        });`,
  ],
];

let applied = 0;
for (const [target, replacement] of replacements) {
  if (content.includes(target)) {
    content = content.replace(target, replacement);
    applied++;
  }
}

if (applied === replacements.length) {
  fs.writeFileSync(clientPath, content.replace(/\n/g, eol), 'utf8');
  console.log(`Patched whatsapp-web.js Client.js (${applied}/${replacements.length} hunks).`);
} else {
  console.warn(
    `Skipped patching whatsapp-web.js Client.js (matched ${applied}/${replacements.length} hunks; version may differ).`
  );
}
