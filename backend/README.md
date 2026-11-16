# PELITA Express API

Backend REST API mandiri untuk aplikasi PELITA. Server berjalan terpisah dari folder `frontend` di port `4000` secara default.

## Persiapan

1. Pastikan Node.js 20+ dan layanan MySQL/MariaDB aktif. Gambar phpMyAdmin menunjukkan server lokal di port standar MySQL `3306`.
2. Di phpMyAdmin, pilih **New**, buat database bernama `pelita_db`, dan pilih collation `utf8mb4_unicode_ci`.
3. Buat akun aplikasi khusus melalui tab **SQL** (ganti password contoh secara lokal):

   ```sql
   CREATE USER 'pelita_backend_app'@'127.0.0.1' IDENTIFIED BY 'GANTI_DENGAN_PASSWORD_KUAT';
   GRANT ALL PRIVILEGES ON pelita_db.* TO 'pelita_backend_app'@'127.0.0.1';
   ```

4. Dari folder `backend`, salin `.env.example` menjadi `.env` dan isi password akun aplikasi tersebut di `DATABASE_URL`. Gunakan password URL-safe (huruf, angka, `_`, `-`) atau URL-encode karakter khusus. Jangan kirim password ke chat atau commit file `.env`.
5. Pastikan `JWT_SECRET` berisi rahasia acak minimal 32 karakter dan atur kredensial admin seed.
6. Pasang dependensi dengan `npm install`.
7. Buat Prisma Client, terapkan skema MySQL, dan seed akun admin:

   ```sh
   npm run db:generate
   npm run db:deploy
   npm run db:seed
   ```

8. Jalankan API dengan `npm run dev`. Cek `GET http://localhost:4000/api/health`; status `200` menandakan koneksi database berhasil (`database: "connected"`). `/api/health/live` hanya memeriksa proses API.
   Gunakan `SEED_ADMIN_EMAIL` dan `SEED_ADMIN_PASSWORD` dari `.env` untuk login ke frontend. Jangan bagikan nilai rahasia tersebut.

Database aplikasi tidak diisi dengan peserta, jadwal, antrean, atau pemeriksaan dummy. Halaman akan menampilkan keadaan kosong sampai data nyata dimasukkan melalui aplikasi.

Login menyediakan peran **Kader** dan **Super Admin** (grant `KADER` dan `ADMIN`). Satu akun dapat memiliki salah satu atau kedua akses; pilihan login hanya berhasil jika role tersebut memang diberikan ke akun. Akun dari `SEED_ADMIN_*` secara default memperoleh akses Super Admin. Untuk memberi akun yang sama akses Kader, atur `SEED_KADER_NAME`, `SEED_KADER_EMAIL`, dan `SEED_KADER_PASSWORD` dengan email dan password yang sama seperti `SEED_ADMIN_*`, lalu jalankan `npm run db:seed`. Jangan bagikan atau commit file `.env`.

### Pengujian API

Tes login dan CRUD peserta memakai akun serta data sementara. Jalankan hanya terhadap database **terpisah** bernama dengan akhiran `_test` (contoh `pelita_db_test`), bukan database aplikasi. Buat database tersebut, beri akun database izin ke database tes, lalu tambahkan `PELITA_TEST_DATABASE_URL` ke `.env` backend dengan URL menuju database tes. Dari PowerShell di folder `backend`, terapkan migrasi dan jalankan tes dengan:

```powershell
$entry = Get-Content .env | Where-Object { $_ -match '^\s*PELITA_TEST_DATABASE_URL\s*=' } | Select-Object -First 1
if (-not $entry) { throw 'Tambahkan PELITA_TEST_DATABASE_URL ke .env terlebih dahulu.' }
$testUrl = ($entry -replace '^\s*PELITA_TEST_DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'")
$env:DATABASE_URL = $testUrl
try {
  npm run db:deploy
  if ($LASTEXITCODE -ne 0) { throw 'Migrasi database tes gagal.' }
} finally {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
}
npm test
```

Tes menolak URL database yang tidak berakhiran `_test` dan membersihkan data yang dibuatnya. Jangan arahkan `PELITA_TEST_DATABASE_URL` ke database aplikasi.

Jika perlu mengganti password admin di Windows, jalankan perintah berikut dari folder `backend`. Terminal akan meminta password secara tersembunyi, kemudian memperbarui akun admin yang sama:

```powershell
npm run db:reset-admin
```

Untuk perubahan schema lokal selanjutnya, gunakan `npm run db:migrate -- --name nama_perubahan`. ### Deployment checklist

- Atur `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET` (unik dan acak, minimal 32 karakter), `FRONTEND_ORIGIN` (HTTPS origin frontend), `TRUST_PROXY` (jumlah proxy tepercaya; `0` jika tidak ada), dan `PORT`.
- Atur `NEXT_PUBLIC_API_URL` di frontend ke URL HTTPS API lengkap yang berakhiran `/api` sebelum build frontend. Jangan gunakan localhost untuk deployment.
- Buat akun database khusus aplikasi dengan izin minimum yang diperlukan; jangan gunakan akun root. Batasi koneksi database dari jaringan/host yang diperlukan saja.
- Deploy skema dengan `npm run db:deploy`, lalu build dan jalankan API memakai `npm run build` dan `npm start`. Build dan deploy frontend terpisah.
- Gunakan HTTPS untuk kedua layanan, simpan secret pada secret manager platform (jangan commit `.env`), aktifkan backup database terenkripsi, dan uji proses pemulihan backup.
- Akun awal dibuat dari `SEED_ADMIN_*`. Jalankan seeding secara terkontrol, lalu ganti password awal melalui alur reset admin. Hindari kredensial bersama dan jangan menjalankan seeder pada setiap startup.
- Login dibatasi 10 percobaan per IP dalam 15 menit. Limit in-memory cocok untuk satu instance; deployment multi-instance memerlukan rate-limit store bersama.
- Jalankan `npm test` hanya menggunakan `PELITA_TEST_DATABASE_URL` terpisah dengan nama database berakhiran `_test`.

Untuk deployment, jalankan migrasi (`npm run db:deploy`), build (`npm run build`), lalu start (`npm start`).

## Endpoint

Endpoint selain login, logout, dan health memerlukan cookie `pelita_session` atau header `Authorization: Bearer <token>`.

- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
- `POST /api/auth/login` menerima `email`, `password`, dan `role` (`KADER` atau `ADMIN`/Super Admin); role harus cocok dengan akun
- `GET /api/dashboard` — total peserta, ringkasan antrean/pemeriksaan hari ini, jadwal hari ini, dan empat jadwal mendatang (zona waktu Asia/Jakarta)
- `/api/peserta` — CRUD peserta, filter kategori, pencarian, dan pagination
- `/api/jadwal` — jadwal posyandu
- `/api/antrean` — antrean dan perubahan status
- `/api/pemeriksaan` — pencatatan dan riwayat pemeriksaan
- `/api/rekapitulasi/stats`, `/summary`, `/trends`, `/riwayat`
- `/api/admin/overview`, `/api/admin/accounts`, dan `/api/admin/kader` — ringkasan sistem serta pengelolaan akun dengan peran Kader dan/atau Super Admin; khusus Super Admin (`ADMIN`)

Super Admin masuk menggunakan akun dengan grant `ADMIN`. Di web, menu **Kelola Akun** menyediakan ringkasan sistem, pencarian/filter/paginasi, serta daftar seluruh akun dan perannya. Super Admin dapat membuat akun Kader, Super Admin, atau akun dengan kedua akses; mengubah profil/peran/ kata sandi; dan menghapus akun. Akun Super Admin terakhir tidak dapat dicabut atau dihapus. Endpoint pengelolaan akun hanya dapat diakses role `ADMIN`.

Respons mengikuti format `{ success, message, data, meta? }`. CORS mengizinkan origin frontend yang ditentukan oleh `FRONTEND_ORIGIN` (pisahkan beberapa origin dengan koma).
