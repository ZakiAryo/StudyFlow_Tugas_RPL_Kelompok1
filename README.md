# StudyFlow

StudyFlow adalah web app academic task manager untuk mahasiswa. Aplikasi ini membantu mengelola mata kuliah, tugas, deadline, jadwal kuliah, progress, checklist, notes, dan rekomendasi belajar berbasis AI.

Project ini dibuat sebagai Tugas untuk mata Kuliah RPL Semester 7 dengan menggunakan Next.js App Router, Supabase, dan Google Gemini API. Aplikasi dapat dijalankan lokal dan dideploy ke Vercel.

## Catatan MVP

StudyFlow adalah web app only. MVP ini tidak mencakup native mobile app, React Native, Expo, PWA, push notification browser/mobile, OCR, import Google Calendar, atau import jadwal otomatis.

## Fitur Utama

- Authentication: register, login, logout, dan protected route.
- Dashboard dinamis dari data Supabase.
- Statistik tugas: total, selesai, in progress, overdue, deadline hari ini, deadline minggu ini, dan overall progress.
- Upcoming deadlines dan recent tasks.
- Jadwal Hari Ini di dashboard berdasarkan jadwal kuliah milik user yang sedang login.
- CRUD mata kuliah.
- CRUD jadwal kuliah manual.
- WhatsApp reminder opt-in untuk deadline, overdue task, dan jadwal kuliah harian.
- CRUD tugas akademik.
- Filter tugas: all, today, this week, overdue, completed.
- Search tugas berdasarkan judul.
- Detail tugas dengan status, progress, checklist, notes, dan study plan.
- Upload materi tugas dalam format PDF, TXT, atau Markdown di halaman detail tugas.
- Checklist per tugas dengan progress tracking.
- Notes per tugas.
- Deadline badge: Due Today, Due Tomorrow, Due This Week, Overdue.
- Light mode dan dark mode.
- Responsive layout untuk desktop dan mobile browser.

## Fitur AI

Semua fitur AI memanggil Gemini dari server-side API routes. `GEMINI_API_KEY` tidak pernah dipakai langsung di frontend.

- AI Task Breakdown: membuat checklist dari detail tugas.
- AI Study Plan Generator: membuat rencana belajar bertahap sebelum deadline.
- AI Priority Assistant: mengurutkan tugas aktif berdasarkan urgency dan importance.
- AI Notes Summarizer: merangkum notes menjadi summary, important points, dan suggested next actions.
- AI Material Breakdown: menganalisis file materi yang diupload di detail tugas.
- AI Material Quiz: membuat quiz dari materi lewat menu `/quiz`, menghitung skor, dan menampilkan jawaban benar setelah submit.

## Tech Stack

- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- Supabase Database dan Authentication.
- Supabase Row Level Security.
- Google Gemini API dengan official SDK `@google/genai`.
- lucide-react.
- Vercel.

## Struktur Folder

```txt
app/
  (main)/
    ai/priority/
    courses/
    dashboard/
    quiz/
    schedule/
    settings/
    tasks/
      [id]/
  api/ai/
    breakdown/
    material-breakdown/
    material-quiz/
    priority/
    study-plan/
    summarize-notes/
  api/cron/
    reminders/
  login/
  register/

components/
  ai/
  auth/
  courses/
  dashboard/
  layout/
  schedule/
  settings/
  tasks/
  theme/
  ui/

lib/
  deadline.ts
  gemini.ts
  supabase-admin.ts
  supabase.ts
  utils.ts
  whatsapp.ts

database/
  schema.sql

docs/
  screenshots/

README.md
PANDUAN_SETUP.md
PANDUAN_CUSTOMISASI.md
.env.example
```

## Screenshot

Simpan screenshot portfolio di folder `docs/screenshots/`.

Rekomendasi screenshot:

- Dashboard.
- Courses atau Mata Kuliah.
- Tasks.
- Task Detail dengan checklist dan notes.
- Modal AI Task Breakdown.
- AI Priority Assistant.
- Tampilan mobile browser.

Contoh penulisan:

```md
![Dashboard StudyFlow AI](docs/screenshots/dashboard.png)
```

## Cara Install

Install dependency:

```bash
npm install
```

Salin file environment:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Isi `.env.local`:

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

Jangan menaruh API key asli di `.env.example`, README, screenshot, atau file source code.

## Cara Menjalankan Lokal

Jalankan development server:

```bash
npm run dev
```

Buka:

```txt
http://localhost:3000
```

Jika environment variable baru ditambahkan atau diubah, hentikan server lalu jalankan ulang `npm run dev`.

## Database Supabase

Jalankan file berikut di Supabase SQL Editor:

```txt
database/schema.sql
```

Schema akan membuat tabel:

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
- `user_notification_settings`
- `whatsapp_reminder_logs`

Schema juga membuat bucket Supabase Storage `task-materials` untuk file materi dan mengaktifkan Row Level Security agar user hanya bisa mengakses data miliknya sendiri.

## Upload Materi dan Quiz AI

Di halaman detail tugas, user bisa upload materi dalam format:

- PDF.
- TXT.
- Markdown.

File disimpan di Supabase Storage bucket `task-materials`. AI breakdown dan quiz diproses melalui server-side API routes:

```txt
app/api/ai/material-breakdown/route.ts
app/api/ai/material-quiz/route.ts
```

Quiz menampilkan pertanyaan pilihan ganda. Setelah user submit, aplikasi menghitung skor dan menampilkan daftar jawaban benar.

## WhatsApp Reminder

Reminder WhatsApp bersifat opt-in. User bisa membuka halaman `Settings`, mengisi nomor WhatsApp, lalu mengaktifkan atau mematikan reminder. Jika toggle mati, cron tidak akan mengirim reminder ke nomor tersebut.

Pengiriman otomatis memakai route server-side:

```txt
app/api/cron/reminders/route.ts
```

Route ini membaca `user_notification_settings`, membuat log di `whatsapp_reminder_logs`, lalu mengirim pesan lewat WhatsApp Cloud API hanya dari backend. Secret WhatsApp dan Supabase service role tidak boleh dipakai di frontend.

## Cara Deploy ke Vercel

1. Push project ke GitHub.
2. Login ke Vercel.
3. Klik Add New Project.
4. Import repository StudyFlow AI.
5. Pastikan framework terdeteksi sebagai Next.js.
6. Tambahkan environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `WHATSAPP_ACCESS_TOKEN`
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `WHATSAPP_GRAPH_API_VERSION`
   - `WHATSAPP_TEMPLATE_NAME`
   - `WHATSAPP_TEMPLATE_LANGUAGE`
   - `CRON_SECRET`
7. Klik Deploy.
8. Setelah deploy selesai, test register, login, dashboard, CRUD, dan fitur AI.

Jika environment variable di Vercel diubah setelah deploy, lakukan redeploy agar nilai baru dipakai.

Cron WhatsApp reminder didefinisikan di `vercel.json` dan berjalan setiap hari pukul `00:00 UTC`, setara sekitar `07:00 WIB`. Jika ingin jadwal lebih sering, sesuaikan `schedule` dan pastikan plan Vercel mendukung frekuensi tersebut.

## Future Improvements

Fitur berikut hanya rencana lanjutan, bukan bagian MVP:

- PWA support.
- Add to Home Screen.
- Browser notification reminder.
- Reminder browser untuk deadline tugas.
- Reminder browser untuk jadwal kuliah.
- Google Calendar integration.
- Import jadwal dari CSV.
- Import jadwal dari PDF atau screenshot menggunakan OCR/AI.
- Export data tugas ke CSV.
- Analytics produktivitas belajar.

## Keamanan

- `.env.local` wajib masuk `.gitignore`.
- `.env.example` hanya berisi placeholder.
- Jangan hardcode Supabase key, Gemini key, WhatsApp token, atau cron secret.
- `GEMINI_API_KEY` hanya dibaca di server-side API routes.
- `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_ACCESS_TOKEN`, dan `CRON_SECRET` hanya boleh dipakai di server-side route.
- Aktifkan RLS di Supabase.
- Query data user harus dibatasi dengan `user_id` dan `auth.uid()`.

## Referensi Resmi

- Supabase Row Level Security: <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Vercel Environment Variables: <https://vercel.com/docs/projects/environment-variables>
- Vercel Cron Jobs: <https://vercel.com/docs/cron-jobs>
- WhatsApp Cloud API: <https://developers.facebook.com/docs/whatsapp/cloud-api>
- Gemini Document Processing: <https://ai.google.dev/gemini-api/docs/document-processing>
- Gemini API Key: <https://ai.google.dev/gemini-api/docs/api-key>
