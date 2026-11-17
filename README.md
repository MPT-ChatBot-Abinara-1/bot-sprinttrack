# bot-sprinttrack

Starter template WhatsApp Bot untuk **SprintTrack Abinara-1** (TypeScript + Baileys).

Template ini menyediakan koneksi dasar Baileys (login via QR terminal) dan kerangka penanganan pesan perintah (`update`, `log`, `help`) sesuai PRD, siap diisi logika backend oleh developer.

## Struktur File

```text
src/
├── config.ts       # Konfigurasi environment dasar
├── types.ts        # Tipe data dasar perintah bot
├── commands.ts     # Kerangka penanganan pesan & perintah PRD (update, log, help)
├── bot.ts          # Inisialisasi koneksi Baileys & event listener pesan
└── index.ts        # Entry point aplikasi
```

## Cara Menjalankan

1. Salin environment:
   ```bash
   cp .env.example .env
   ```

2. Jalankan bot:
   ```bash
   npm run dev
   ```

3. Scan QR code yang muncul di terminal menggunakan aplikasi WhatsApp.
