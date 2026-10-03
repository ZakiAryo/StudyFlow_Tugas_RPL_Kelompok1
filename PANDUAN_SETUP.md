# Panduan Setup StudyFlow AI

Panduan ini menjelaskan cara menjalankan StudyFlow AI secara lokal, menyiapkan Supabase, menyiapkan Gemini API key, push ke GitHub, dan deploy ke Vercel.

## Tools yang Dibutuhkan

- Node.js versi LTS.
- Git.
- VS Code.
- Akun GitHub.
- Akun Supabase.
- Gemini API key dari Google AI Studio.
- Akun Meta Developer atau WhatsApp Business Cloud API jika ingin mengaktifkan reminder WhatsApp.
- Akun Vercel.

## Cara Install Node.js

1. Buka <https://nodejs.org/>.
2. Download versi LTS.
3. Jalankan installer.
4. Pastikan opsi menambahkan Node.js ke PATH aktif.
5. Tutup dan buka ulang terminal.
6. Cek instalasi:

```bash
node -v
npm -v
```

Jika versi muncul, Node.js dan npm sudah siap.

## Cara Install Git

1. Buka <https://git-scm.com/>.
2. Download Git sesuai sistem operasi.
3. Jalankan installer.
4. Gunakan opsi default jika belum yakin.
5. Cek instalasi:

```bash
git --version
```

## Cara Install VS Code

1. Buka <https://code.visualstudio.com/>.
2. Download installer.
3. Jalankan installer.
4. Buka folder project StudyFlow AI dari VS Code.

Extension yang disarankan:

- ESLint.
- Prettier.
- Tailwind CSS IntelliSense.
- GitLens.

## Cara Install Dependencies

Buka terminal di folder project:

```bash
npm install
```

Folder `node_modules` akan dibuat dan tidak perlu diupload ke GitHub.

## Cara Membuat Project Supabase

1. Login ke <https://supabase.com/>.
2. Klik New Project.
3. Pilih organization.
4. Isi nama project, database password, dan region.
5. Klik Create New Project.
6. Tunggu sampai project selesai dibuat.

Simpan database password di tempat aman. Jangan menaruh password database di repository.

## Cara Menjalankan `database/schema.sql` di Supabase SQL Editor

1. Buka dashboard project Supabase.
2. Buka SQL Editor.
3. Klik New query.
4. Buka file `database/schema.sql` dari project ini.
5. Salin seluruh isi file.
6. Paste ke SQL Editor.
7. Klik Run.
8. Buka Table Editor untuk memastikan tabel berhasil dibuat.

Tabel yang dibuat:

- `profiles`
- `courses`
- `schedule_sessions`
- `tasks`
- `task_checklists`
- `task_notes`
- `study_plans`
- `study_plan_items`
- `ai_suggestions`
- `task_materials`
- `material_quiz_attempts`
- bucket Supabase Storage `task-materials`
- policy Supabase Storage untuk file materi
- `user_notification_settings`
- `whatsapp_reminder_logs`

File schema juga membuat trigger, index, dan Row Level Security policy. RLS penting agar user hanya bisa mengakses data miliknya sendiri.

## Cara Menyiapkan Upload Materi Tugas

Upload materi memakai Supabase Storage bucket `task-materials`. Bucket dan policy dibuat oleh `database/schema.sql`.

Format file yang didukung:

- PDF.
- TXT.
- Markdown.

Batas ukuran file:

```txt
10 MB
```

Jika upload gagal, cek:

- `database/schema.sql` sudah dijalankan ulang.
- Bucket `task-materials` ada di Supabase Storage.
- Policy storage sudah dibuat.
- User sudah login.
- File memakai format yang didukung.

## Cara Mendapatkan Supabase URL dan Anon Key

1. Buka dashboard project Supabase.
2. Masuk ke Project Settings.
3. Pilih API.
4. Salin Project URL.
5. Salin anon public key.
6. Masukkan ke `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon_key_dari_supabase
```

Anon key boleh digunakan oleh Supabase client di frontend, tetapi akses data tetap dikunci oleh RLS.

## Cara Mendapatkan Supabase Service Role Key

Service role key dipakai hanya oleh backend cron untuk membaca user yang mengaktifkan WhatsApp reminder.

1. Buka dashboard project Supabase.
2. Masuk ke Project Settings.
3. Pilih API.
4. Salin `service_role` key.
5. Masukkan ke `.env.local`:

```env
SUPABASE_SERVICE_ROLE_KEY=service_role_key_dari_supabase
```

Jangan pernah memakai `SUPABASE_SERVICE_ROLE_KEY` di frontend. Jangan upload key ini ke GitHub.

## Cara Mendapatkan Gemini API Key dari Google AI Studio

1. Buka <https://aistudio.google.com/>.
2. Login dengan akun Google.
3. Buka halaman API keys.
4. Klik Create API key.
5. Pilih atau buat Google Cloud project.
6. Salin API key.
7. Masukkan ke `.env.local`:

```env
GEMINI_API_KEY=api_key_dari_google_ai_studio
```

Jangan panggil Gemini langsung dari frontend. Di project ini semua request Gemini lewat route:

```txt
app/api/ai/breakdown/route.ts
app/api/ai/study-plan/route.ts
app/api/ai/priority/route.ts
app/api/ai/summarize-notes/route.ts
```

## Cara Membuat File `.env.local`

Salin `.env.example`:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Isi `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon_key_dari_supabase
SUPABASE_SERVICE_ROLE_KEY=service_role_key_dari_supabase
GEMINI_API_KEY=api_key_dari_google_ai_studio
WHATSAPP_ACCESS_TOKEN=token_whatsapp_cloud_api
WHATSAPP_PHONE_NUMBER_ID=phone_number_id_whatsapp
WHATSAPP_GRAPH_API_VERSION=v23.0
WHATSAPP_TEMPLATE_NAME=nama_template_whatsapp_yang_disetujui
WHATSAPP_TEMPLATE_LANGUAGE=id
CRON_SECRET=random_secret_minimal_16_karakter
```

Pastikan `.env.local` tidak diupload ke GitHub.

## Cara Menyiapkan WhatsApp Cloud API

Fitur WhatsApp reminder bersifat opt-in. Jika environment WhatsApp belum diisi, fitur Settings tetap bisa menyimpan preferensi, tetapi cron tidak bisa mengirim pesan asli.

1. Buka <https://developers.facebook.com/>.
2. Buat atau pilih Meta App yang memiliki produk WhatsApp.
3. Buka WhatsApp API Setup.
4. Salin temporary/permanent access token ke `WHATSAPP_ACCESS_TOKEN`.
5. Salin Phone Number ID ke `WHATSAPP_PHONE_NUMBER_ID`.
6. Buat message template reminder di WhatsApp Manager dan tunggu sampai disetujui.
7. Masukkan nama template ke `WHATSAPP_TEMPLATE_NAME`.
8. Masukkan kode bahasa template ke `WHATSAPP_TEMPLATE_LANGUAGE`, contoh `id` atau `en_US`.

Template yang paling aman untuk project ini adalah template body dengan 4 variable:

```txt
{{1}}
{{2}}
{{3}}
{{4}}
```

Untuk reminder tugas, StudyFlow mengirim variable: judul tugas, nama mata kuliah, deadline, dan progress. Untuk reminder jadwal, StudyFlow mengirim variable: judul reminder, jumlah sesi, tanggal, dan saran singkat.

Catatan: untuk pesan otomatis yang dikirim lebih dulu oleh sistem, WhatsApp biasanya membutuhkan template message yang sudah disetujui Meta.

## Cara Menyiapkan Cron Reminder di Vercel

Project ini memakai `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 0 * * *"
    }
  ]
}
```

Jadwal `0 0 * * *` berjalan pada `00:00 UTC`, sekitar `07:00 WIB`. Route cron dilindungi dengan `CRON_SECRET`. Tambahkan `CRON_SECRET` yang sama di `.env.local` dan Vercel Environment Variables.

## Cara Menjalankan Project di Localhost

Jalankan:

```bash
npm run dev
```

Buka:

```txt
http://localhost:3000
```

Jika `.env.local` baru diubah, hentikan server lalu jalankan ulang `npm run dev`.

## Cara Push ke GitHub

Jika belum menjadi Git repository:

```bash
git init
git add .
git commit -m "Initial StudyFlow AI setup"
```

Buat repository baru di GitHub, lalu hubungkan:

```bash
git remote add origin https://github.com/username/studyflow-ai.git
git branch -M main
git push -u origin main
```

Sebelum push, cek:

```bash
git status
```

Pastikan `.env.local` tidak muncul di daftar file.

## Cara Deploy ke Vercel

1. Login ke <https://vercel.com/>.
2. Klik Add New Project.
3. Import repository GitHub StudyFlow AI.
4. Pastikan Framework Preset adalah Next.js.
5. Biarkan Build Command default `next build`.
6. Tambahkan environment variables.
7. Klik Deploy.
8. Setelah deploy selesai, test register, login, dashboard, CRUD, dan fitur AI.

## Cara Menambahkan Environment Variables di Vercel

1. Buka project di Vercel.
2. Masuk ke Settings.
3. Pilih Environment Variables.
4. Tambahkan:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_gemini_api_key
WHATSAPP_ACCESS_TOKEN=your_meta_whatsapp_access_token
WHATSAPP_PHONE_NUMBER_ID=your_meta_whatsapp_phone_number_id
WHATSAPP_GRAPH_API_VERSION=v23.0
WHATSAPP_TEMPLATE_NAME=your_approved_whatsapp_template_name
WHATSAPP_TEMPLATE_LANGUAGE=id
CRON_SECRET=your_random_cron_secret_at_least_16_chars
```

5. Pilih environment Production, Preview, dan Development jika ingin semua deployment memakai value yang sama.
6. Simpan.
7. Redeploy project.

Catatan: perubahan environment variables di Vercel tidak otomatis mengubah deployment lama. Redeploy diperlukan.

## Common Errors and Fixes

### `npm` tidak dikenali

Penyebab:

- Node.js belum terinstall.
- PATH belum diperbarui.

Solusi:

- Install Node.js versi LTS.
- Tutup dan buka ulang terminal.
- Cek dengan `node -v` dan `npm -v`.

### `git` tidak dikenali

Penyebab:

- Git belum terinstall.
- PATH Git belum aktif.

Solusi:

- Install Git.
- Tutup dan buka ulang terminal.
- Cek dengan `git --version`.

### `Supabase environment variables are missing`

Penyebab:

- `.env.local` belum dibuat.
- Nama variable salah.
- Development server belum direstart.

Solusi:

- Salin `.env.example` menjadi `.env.local`.
- Pastikan nama variable sama persis.
- Restart `npm run dev`.

### Login gagal atau session tidak tersimpan

Penyebab:

- Supabase URL atau anon key salah.
- Browser memblokir cookie.
- Project Supabase belum siap.

Solusi:

- Periksa `NEXT_PUBLIC_SUPABASE_URL`.
- Periksa `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Coba browser lain atau clear site data.

### Error RLS saat insert, update, atau delete

Penyebab:

- User belum login.
- `user_id` tidak sama dengan `auth.uid()`.
- Relasi seperti `course_id` atau `task_id` bukan milik user tersebut.

Solusi:

- Login ulang.
- Jalankan ulang `database/schema.sql`.
- Pastikan data relasi berasal dari user yang sama.

### Gemini API error

Penyebab:

- `GEMINI_API_KEY` kosong atau salah.
- Kuota Gemini habis.
- Response Gemini bukan JSON valid.

Solusi:

- Periksa key di Google AI Studio.
- Masukkan key ke `.env.local`.
- Masukkan key ke Vercel Environment Variables.
- Cek server logs untuk melihat error API route.

### Upload materi atau quiz AI gagal

Penyebab:

- Bucket `task-materials` belum dibuat.
- Policy Supabase Storage belum aktif.
- File lebih dari 10 MB.
- Format file bukan PDF, TXT, atau Markdown.
- `GEMINI_API_KEY` belum diisi.
- `SUPABASE_SERVICE_ROLE_KEY` belum diisi sehingga server tidak bisa membaca file private dari storage.

Solusi:

- Jalankan ulang `database/schema.sql` di Supabase SQL Editor.
- Pastikan bucket `task-materials` muncul di Supabase Storage.
- Isi `GEMINI_API_KEY` dan `SUPABASE_SERVICE_ROLE_KEY`.
- Redeploy Vercel setelah mengubah environment variables.

### WhatsApp reminder tidak terkirim

Penyebab:

- User belum mengaktifkan toggle WhatsApp reminder di Settings.
- Nomor WhatsApp belum memakai format internasional, contoh `62812xxxx`.
- `WHATSAPP_ACCESS_TOKEN` atau `WHATSAPP_PHONE_NUMBER_ID` kosong/salah.
- Template WhatsApp belum disetujui Meta.
- `CRON_SECRET` di Vercel tidak sama dengan environment route.
- Cron Vercel belum berjalan karena project belum deploy production.

Solusi:

- Aktifkan toggle di Settings.
- Cek tabel `whatsapp_reminder_logs` untuk status `failed` dan pesan error.
- Pastikan semua environment variables sudah ditambahkan di Vercel.
- Redeploy setelah mengubah environment variables.
- Jalankan endpoint cron dengan `?dryRun=1` saat development untuk melihat kandidat reminder tanpa mengirim pesan.

### Build gagal di Vercel

Penyebab:

- TypeScript error.
- Dependency belum lengkap.
- Environment variables belum ditambahkan.

Solusi:

- Jalankan `npm install`.
- Jalankan `npm run typecheck`.
- Jalankan `npm run build`.
- Tambahkan environment variables di Vercel.
- Redeploy project.

## Referensi Resmi

- Supabase Row Level Security: <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Vercel Environment Variables: <https://vercel.com/docs/projects/environment-variables>
- Vercel Cron Jobs: <https://vercel.com/docs/cron-jobs>
- WhatsApp Cloud API: <https://developers.facebook.com/docs/whatsapp/cloud-api>
- Gemini Document Processing: <https://ai.google.dev/gemini-api/docs/document-processing>
- Google AI Studio dan Gemini API key: <https://ai.google.dev/gemini-api/docs/api-key>
