# bot-sprinttrack

Layanan WhatsApp Bot untuk sistem manajemen sprint **SprintTrack Abinara-1** (Tim Robotik Abinara ITS). Repositori ini merupakan starter template berbasis TypeScript dan [whatsapp-web.js](https://wwebjs.dev/) yang menyediakan inisialisasi koneksi WhatsApp Web via Puppeteer, autentikasi QR code melalui terminal, penyimpanan sesi lokal (`LocalAuth`), serta kerangka penanganan perintah chat (`update`, `log`, dan `help`).

## Prasyarat

- Node.js v18 atau lebih baru
- npm v9 atau lebih baru
- Google Chrome atau Chromium terpasang di sistem (dibutuhkan oleh Puppeteer)
- Akun WhatsApp aktif untuk memindai QR code saat autentikasi awal

## Teknologi Utama

- TypeScript
- Node.js
- `whatsapp-web.js`
- `qrcode-terminal`
- `dotenv`

## Instalasi dan Menjalankan Proyek

1. Clone repositori ini:

   ```bash
   git clone https://github.com/MPT-ChatBot-Abinara-1/bot-sprinttrack.git
   cd bot-sprinttrack
   ```

2. Pasang seluruh dependensi:

   ```bash
   npm install
   ```

3. Salin file konfigurasi environment dan sesuaikan nilainya:

   ```bash
   cp .env.example .env
   ```

   Untuk Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

   Pastikan variabel pada `.env` (seperti `SESSION_DIR` dan `API_BASE_URL`) sudah sesuai dengan konfigurasi lokal atau server Anda.

4. Jalankan bot dalam mode pengembangan:

   ```bash
   npm run dev
   ```

5. Pindai QR code yang muncul di terminal menggunakan fitur Perangkat Tertaut (Linked Devices) pada aplikasi WhatsApp. Sesi akan otomatis disimpan pada folder `.wwebjs_auth` sehingga tidak perlu scan ulang setiap kali aplikasi dimulai ulang.

6. Untuk menjalankan versi produksi:

   ```bash
   npm run build
   npm run start
   ```

## Struktur Proyek

```text
bot-sprinttrack/
├── .env.example          # Contoh konfigurasi variabel environment
├── .gitignore            # Daftar file dan direktori yang diabaikan Git
├── package.json          # Metadata proyek, dependensi, dan skrip npm
├── tsconfig.json         # Konfigurasi compiler TypeScript
├── README.md             # Dokumentasi proyek
└── src/
    ├── index.ts          # Entry point untuk menjalankan layanan bot
    ├── bot.ts            # Inisialisasi client whatsapp-web.js, QR code, dan listener pesan
    ├── commands.ts       # Kerangka router dan handler perintah chat (update, log, help)
    ├── config.ts         # Pembaca konfigurasi environment (.env)
    └── types.ts          # Definisi tipe data perintah dan status tugas
```

## Skrip Tersedia

| Perintah | Deskripsi |
| --- | --- |
| `npm run dev` | Menjalankan bot dengan hot-reload menggunakan `tsx` |
| `npm run build` | Mengompilasi TypeScript ke JavaScript di direktori `dist/` |
| `npm run start` | Menjalankan hasil build produksi dari `dist/index.js` |
| `npm run typecheck` | Memeriksa validitas tipe TypeScript tanpa menghasilkan file output |
