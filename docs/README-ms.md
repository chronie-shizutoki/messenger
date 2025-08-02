# Messenger

Aplikasi chat masa nyata dengan sokongan WebSocket, yang menampilkan UI moden dan keupayaan antarabangsaan.

## Ciri-ciri

- Perkhidmatan mesej masa nyata menggunakan Socket.io
- Fungsi muat naik fail dan imej
- Sokongan notifikasi push
- Antaramuka berbilang bahasa
- Integrasi pangkalan data SQLite

## Pemasangan

### Prasyarat
- Node.js (v14 atau lebih tinggi)
- npm (v6 atau lebih tinggi)

### Langkah-langkah
1. Klon repositori
   ```bash
   git clone https://github.com/quiettimejsg/messenger.git
   cd messenger
   ```

2. Pasang pergantungan
   ```bash
   npm install
   ```

3. Buat fail `.env` (pilihan) untuk konfigurasi:
   ```
   PORT=3000
   ```

## Penggunaan

### Memulakan Pelayan

```bash
# Menggunakan npm
npm start

# Menggunakan fail batch Windows
start.bat
```

### Akses Aplikasi
Buka pelayar anda dan navigasikan ke `http://localhost:3000`

## Konfigurasi
- **Notifikasi Push**: Tambahkan URL notifikasi push dalam tetapan aplikasi
- **Bahasa**: Aplikasi secara automatik mengesan pilihan bahasa anda, dengan pilihan manual tersedia dalam tetapan

## Lesen
Lesen AGPL-3.0

## Teknologi yang Digunakan
- [Express](https://expressjs.com/) - Rangka kerja web
- [Socket.io](https://socket.io/) - Komunikasi masa nyata
- [SQLite3](https://www.sqlite.org/) - Pangkalan data
- [Sharp](https://sharp.pixelplumbing.com/) - Pemprosesan imej