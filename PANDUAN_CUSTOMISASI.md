# Panduan Customisasi StudyFlow AI

Panduan ini membantu kamu mengubah StudyFlow AI agar cocok untuk kebutuhan portfolio pribadi. Semua dokumentasi tetap menggunakan Bahasa Indonesia.

## Warning Keamanan

Jangan upload API key ke GitHub. File `.env.local` harus tetap lokal dan tidak boleh masuk repository.

Jangan pernah menulis `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_ACCESS_TOKEN`, atau `CRON_SECRET` di React component, client-side file, README, screenshot, atau dokumentasi publik. Gunakan `.env.example` hanya untuk placeholder.

## Cara Mengganti Nama Aplikasi

File yang diedit:

- `app/layout.tsx`
- `components/layout/sidebar.tsx`
- `components/layout/header.tsx`
- `README.md`

Before:

```tsx
StudyFlow AI
```

After:

```tsx
CampusFlow AI
```

Jika mengganti metadata:

```tsx
export const metadata = {
  title: "CampusFlow AI",
  description: "Academic task manager untuk mahasiswa.",
};
```

## Cara Mengganti Logo

File yang diedit:

- `components/layout/sidebar.tsx`
- `app/login/page.tsx`
- `app/register/page.tsx`
- `public/logo.png`

Logo utama aplikasi sekarang memakai file gambar:

```txt
public/logo.png
```

Untuk mengganti logo:

1. Siapkan file logo baru dengan format PNG.
2. Ubah nama file menjadi `logo.png`.
3. Ganti file lama di folder `public/logo.png`.
4. Restart development server jika gambar belum berubah di browser.

Contoh penggunaan logo di component:

```tsx
import Image from "next/image";

<Image
  src="/logo.png"
  alt="Logo StudyFlow AI"
  width={40}
  height={40}
/>
```

Before jika ingin memakai logo lama:

```tsx
src="/logo.png"
```

After jika ingin memakai nama file berbeda:

```tsx
src="/logo-campusflow.png"
```

Jika nama file diganti, pastikan file tersebut juga ada di folder `public/` dan update semua pemakaian `src` di `components/layout/sidebar.tsx`, `app/login/page.tsx`, dan `app/register/page.tsx`.

## Cara Mengganti Warna Tema

File yang diedit:

- `app/globals.css`
- `tailwind.config.ts`

Before:

```css
:root {
  --primary: 199 89% 48%;
}
```

After:

```css
:root {
  --primary: 158 64% 42%;
}
```

Jika dark mode memakai variable terpisah, ubah juga bagian `.dark`.

## Cara Mengganti Menu Sidebar

File yang diedit:

- `components/layout/sidebar.tsx`

Before:

```tsx
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/courses", label: "Mata Kuliah", icon: BookOpen },
];
```

After:

```tsx
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/courses", label: "Mata Kuliah", icon: BookOpen },
  { href: "/ai/priority", label: "AI Priority", icon: Sparkles },
];
```

Jika menambahkan menu baru, buat route baru di `app/(main)/...` dan tambahkan route tersebut ke `middleware.ts` jika harus protected.

## Cara Menambahkan Link GitHub

File yang diedit:

- `app/(main)/settings/page.tsx`

Contoh:

```tsx
<a href="https://github.com/username" target="_blank" rel="noreferrer">
  GitHub
</a>
```

## Cara Menambahkan Link Portfolio

File yang diedit:

- `app/(main)/settings/page.tsx`

Contoh:

```tsx
<a href="https://nama-kamu.dev" target="_blank" rel="noreferrer">
  Portfolio
</a>
```

## Cara Menambahkan Link LinkedIn

File yang diedit:

- `app/(main)/settings/page.tsx`

Contoh:

```tsx
<a href="https://www.linkedin.com/in/username" target="_blank" rel="noreferrer">
  LinkedIn
</a>
```

## Cara Mengganti Dashboard Cards

File yang diedit:

- `components/dashboard/dashboard-manager.tsx`
- `components/dashboard/dashboard-card.tsx`

Before:

```tsx
const statCards = [
  { label: "Total tugas", value: String(metrics.total) },
  { label: "Selesai", value: String(metrics.completed) },
];
```

After:

```tsx
const statCards = [
  { label: "Total tugas", value: String(metrics.total) },
  { label: "Overdue", value: String(metrics.overdue) },
  { label: "Deadline minggu ini", value: String(metrics.dueThisWeek) },
];
```

Pastikan metrik dihitung dari data user yang sedang login.

## Cara Custom Warna Mata Kuliah

File yang diedit:

- `database/schema.sql`
- `components/courses/course-manager.tsx`

Kolom database:

```sql
color_label text not null default '#38bdf8'
```

Contoh warna:

```txt
#38bdf8
#10b981
#f59e0b
#f43f5e
#8b5cf6
```

Jika database sudah berjalan di Supabase, perubahan schema perlu dijalankan sebagai query/migration baru.

## Cara Custom Task Priority Badges

File yang diedit:

- `database/schema.sql`
- `components/tasks/priority-badge.tsx`
- `components/tasks/task-manager.tsx`

Priority default:

```txt
low
medium
high
urgent
```

Before:

```sql
constraint tasks_priority_check check (priority in ('low', 'medium', 'high', 'urgent'))
```

After menambahkan `critical`:

```sql
constraint tasks_priority_check check (priority in ('low', 'medium', 'high', 'urgent', 'critical'))
```

Tambahkan style badge:

```tsx
critical: "border-red-300 bg-red-50 text-red-700"
```

Tambahkan juga option di form tugas agar user bisa memilih priority baru.

## Cara Custom AI Prompt Behavior

File yang diedit:

- `app/api/ai/breakdown/route.ts`
- `app/api/ai/study-plan/route.ts`
- `app/api/ai/priority/route.ts`
- `app/api/ai/summarize-notes/route.ts`
- `lib/gemini.ts`

Before:

```ts
"Buat rencana belajar yang realistis sebelum deadline."
```

After:

```ts
"Buat rencana belajar yang cocok untuk mahasiswa yang hanya punya 1 jam per hari."
```

Aturan penting:

- Gemini harus dipanggil dari server-side API route.
- Jangan memanggil Gemini langsung dari browser.
- Jangan import `lib/gemini.ts` ke file yang memakai `"use client"`.
- Validasi response JSON sebelum ditampilkan atau disimpan.
- Jangan mengirim data user yang tidak diperlukan.

## Cara Custom WhatsApp Reminder

File yang diedit:

- `components/settings/whatsapp-reminder-settings.tsx`
- `app/api/cron/reminders/route.ts`
- `lib/whatsapp.ts`
- `database/schema.sql`
- `vercel.json`

Default reminder WhatsApp adalah mati. User harus mengaktifkan toggle di halaman `Settings`.

Before:

```ts
whatsapp_reminder_enabled: false
```

After jika ingin default aktif untuk row baru:

```sql
whatsapp_reminder_enabled boolean not null default true
```

Rekomendasi: biarkan default tetap `false` agar user benar-benar opt-in.

Untuk mengganti jam cron Vercel, edit `vercel.json`:

```json
{
  "path": "/api/cron/reminders",
  "schedule": "0 0 * * *"
}
```

Jadwal Vercel memakai UTC. `0 0 * * *` berarti sekitar pukul `07:00 WIB`.

Untuk mengganti format pesan, edit function pembuat pesan di:

```txt
app/api/cron/reminders/route.ts
```

Bagian yang biasanya diedit:

- `buildTaskMessage`
- `buildScheduleMessage`

Jika memakai WhatsApp template, pastikan jumlah variable template sesuai dengan `templateParameters` yang dikirim dari route cron.

Jangan mengirim token WhatsApp dari frontend. Semua request WhatsApp harus tetap lewat server-side route.

## Cara Custom Upload Materi dan Quiz AI

File yang diedit:

- `components/tasks/task-materials-manager.tsx`
- `components/quiz/quiz-manager.tsx`
- `app/(main)/quiz/page.tsx`
- `app/api/ai/material-breakdown/route.ts`
- `app/api/ai/material-quiz/route.ts`
- `lib/material-ai-server.ts`
- `lib/gemini.ts`
- `database/schema.sql`

Format file default:

```txt
PDF, TXT, Markdown
```

Batas ukuran default:

```txt
10 MB
```

Jika ingin mengganti batas ukuran file, edit:

```ts
const maxFileSize = 10 * 1024 * 1024;
```

Jika ingin mengganti jumlah soal quiz default, edit:

```ts
const [questionCount, setQuestionCount] = useState(5);
```

Jika ingin mengganti prompt AI breakdown materi, edit:

```txt
app/api/ai/material-breakdown/route.ts
```

Jika ingin mengganti prompt AI quiz, edit:

```txt
app/api/ai/material-quiz/route.ts
```

Aturan penting:

- `GEMINI_API_KEY` tetap hanya boleh dipakai di server-side API route.
- File materi disimpan di Supabase Storage bucket `task-materials`.
- User hanya boleh melihat file miliknya sendiri.
- Jangan mengirim file ke AI dari frontend secara langsung.
- Untuk DOCX, konversi dulu ke PDF atau text sebelum upload jika belum menambahkan parser khusus.

## Cara Memasukkan atau Mengganti Supabase URL

File lokal:

- `.env.local`

Tempat production:

- Vercel Environment Variables.

Contoh:

```env
NEXT_PUBLIC_SUPABASE_URL=https://project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon_key_baru
SUPABASE_SERVICE_ROLE_KEY=service_role_key_baru
```

Setelah mengganti `.env.local`, restart development server.

## Cara Memasukkan atau Mengganti Gemini API Key

File lokal:

- `.env.local`

Tempat production:

- Vercel Environment Variables.

Contoh:

```env
GEMINI_API_KEY=api_key_baru
```

Jangan masukkan Gemini API key asli ke `.env.example`.

## Cara Memasukkan atau Mengganti WhatsApp API Key

File lokal:

- `.env.local`

Tempat production:

- Vercel Environment Variables.

Contoh:

```env
WHATSAPP_ACCESS_TOKEN=token_whatsapp_cloud_api_baru
WHATSAPP_PHONE_NUMBER_ID=phone_number_id_baru
WHATSAPP_GRAPH_API_VERSION=v23.0
WHATSAPP_TEMPLATE_NAME=nama_template_baru
WHATSAPP_TEMPLATE_LANGUAGE=id
CRON_SECRET=random_secret_baru
```

Setelah mengganti value WhatsApp di Vercel, redeploy project. Jangan masukkan token asli ke `.env.example`.

## Cara Memasukkan Environment Variables di Vercel

1. Buka dashboard Vercel.
2. Pilih project StudyFlow AI.
3. Buka Settings.
4. Pilih Environment Variables.
5. Tambahkan:

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

6. Pilih environment yang dibutuhkan.
7. Simpan.
8. Redeploy project.

## File Path yang Harus Diedit

| Customisasi | File path |
| --- | --- |
| Nama aplikasi | `app/layout.tsx`, `components/layout/sidebar.tsx`, `components/layout/header.tsx` |
| Logo | `components/layout/sidebar.tsx`, `app/login/page.tsx`, `app/register/page.tsx`, `public/logo.png` |
| Warna tema | `app/globals.css`, `tailwind.config.ts` |
| Menu sidebar | `components/layout/sidebar.tsx`, `middleware.ts` |
| Link GitHub | `app/(main)/settings/page.tsx` |
| Link portfolio | `app/(main)/settings/page.tsx` |
| Link LinkedIn | `app/(main)/settings/page.tsx` |
| Dashboard cards | `components/dashboard/dashboard-manager.tsx`, `components/dashboard/dashboard-card.tsx` |
| Warna mata kuliah | `database/schema.sql`, `components/courses/course-manager.tsx` |
| Priority badges | `database/schema.sql`, `components/tasks/priority-badge.tsx`, `components/tasks/task-manager.tsx` |
| AI prompt behavior | `app/api/ai/*/route.ts`, `lib/gemini.ts` |
| Upload materi dan quiz AI | `components/tasks/task-materials-manager.tsx`, `components/quiz/quiz-manager.tsx`, `app/(main)/quiz/page.tsx`, `app/api/ai/material-breakdown/route.ts`, `app/api/ai/material-quiz/route.ts`, `lib/material-ai-server.ts`, `database/schema.sql` |
| WhatsApp reminder | `components/settings/whatsapp-reminder-settings.tsx`, `app/api/cron/reminders/route.ts`, `lib/whatsapp.ts`, `vercel.json`, `database/schema.sql` |
| Supabase URL | `.env.local`, Vercel Environment Variables |
| Gemini API key | `.env.local`, Vercel Environment Variables |
| WhatsApp API key | `.env.local`, Vercel Environment Variables |

## Checklist Sebelum Upload ke GitHub

- `.env.local` tidak ikut commit.
- `.env.example` hanya berisi placeholder.
- Tidak ada API key di README, screenshot, source code, atau commit history.
- Tidak ada WhatsApp access token atau Supabase service role key di repository.
- Tidak ada database password di repository.
- Folder `docs/screenshots/` tersedia.
- Dokumentasi menggunakan Bahasa Indonesia.
- `npm run typecheck` berhasil.
- `npm run build` berhasil.
