-- StudyFlow - Supabase schema
-- Jalankan file ini di Supabase SQL Editor pada project baru.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  lecturer_name text,
  color_label text not null default '#38bdf8',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.schedule_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  day_of_week text not null,
  start_time time not null,
  end_time time not null,
  room text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint schedule_time_order check (end_time > start_time),
  constraint schedule_day_check check (
    day_of_week in (
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
      'senin',
      'selasa',
      'rabu',
      'kamis',
      'jumat',
      'sabtu',
      'minggu'
    )
  )
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  deadline date not null,
  priority text not null default 'medium',
  status text not null default 'not_started',
  progress integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint tasks_priority_check check (priority in ('low', 'medium', 'high', 'urgent')),
  constraint tasks_status_check check (status in ('not_started', 'in_progress', 'revision', 'completed')),
  constraint tasks_progress_check check (progress >= 0 and progress <= 100)
);

create table if not exists public.task_checklists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  item_text text not null,
  is_done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.task_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  content text not null default '',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  summary text,
  risk_level text not null default 'medium',
  suggestion text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint study_plans_risk_level_check check (risk_level in ('low', 'medium', 'high'))
);

create table if not exists public.study_plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  study_plan_id uuid not null references public.study_plans(id) on delete cascade,
  date date not null,
  time_block text not null,
  action text not null,
  estimated_minutes integer not null default 30,
  is_done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint study_plan_items_estimated_minutes_check check (estimated_minutes > 0)
);

create table if not exists public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  type text not null,
  prompt text not null,
  response jsonb not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint ai_suggestions_type_check check (
    type in (
      'task_breakdown',
      'study_plan',
      'priority',
      'notes_summary',
      'material_breakdown',
      'material_quiz'
    )
  )
);

create table if not exists public.task_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  file_size integer not null,
  ai_breakdown jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint task_materials_mime_type_check check (
    mime_type in ('application/pdf', 'text/plain', 'text/markdown')
  ),
  constraint task_materials_file_size_check check (
    file_size > 0 and file_size <= 10485760
  )
);

create table if not exists public.material_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  material_id uuid not null references public.task_materials(id) on delete cascade,
  score integer not null default 0,
  total_questions integer not null default 0,
  user_answers jsonb not null,
  correct_answers jsonb not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint material_quiz_attempts_score_check check (
    score >= 0 and score <= total_questions
  ),
  constraint material_quiz_attempts_total_questions_check check (
    total_questions > 0
  )
);

alter table public.ai_suggestions
drop constraint if exists ai_suggestions_type_check;

alter table public.ai_suggestions
add constraint ai_suggestions_type_check check (
  type in (
    'task_breakdown',
    'study_plan',
    'priority',
    'notes_summary',
    'material_breakdown',
    'material_quiz'
  )
);

create table if not exists public.user_notification_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  telegram_chat_id text,
  telegram_enabled boolean not null default false,
  remind_deadline_tomorrow boolean not null default true,
  remind_deadline_today boolean not null default true,
  remind_overdue_tasks boolean not null default true,
  remind_today_schedule boolean not null default false,
  reminder_time time not null default '07:00',
  timezone text not null default 'Asia/Jakarta',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint user_notification_settings_telegram_chat_id_check check (
    telegram_chat_id is null
    or telegram_chat_id <> ''
  )
);

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  schedule_session_id uuid references public.schedule_sessions(id) on delete cascade,
  reminder_type text not null,
  reminder_date date not null,
  recipient text not null,
  channel text not null default 'telegram',
  message text not null,
  status text not null default 'pending',
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint notification_logs_type_check check (
    reminder_type in (
      'deadline_tomorrow',
      'deadline_today',
      'overdue_task',
      'today_schedule',
      'test_message'
    )
  ),
  constraint notification_logs_status_check check (
    status in ('pending', 'sent', 'failed', 'skipped')
  ),
  constraint notification_logs_channel_check check (channel = 'telegram')
);

create index if not exists courses_user_id_idx on public.courses(user_id);
create index if not exists schedule_sessions_user_id_idx on public.schedule_sessions(user_id);
create index if not exists schedule_sessions_course_id_idx on public.schedule_sessions(course_id);
create index if not exists tasks_user_id_idx on public.tasks(user_id);
create index if not exists tasks_course_id_idx on public.tasks(course_id);
create index if not exists tasks_deadline_idx on public.tasks(deadline);
create index if not exists task_checklists_task_id_idx on public.task_checklists(task_id);
create index if not exists task_notes_task_id_idx on public.task_notes(task_id);
create index if not exists study_plans_task_id_idx on public.study_plans(task_id);
create index if not exists study_plan_items_plan_id_idx on public.study_plan_items(study_plan_id);
create index if not exists ai_suggestions_user_id_idx on public.ai_suggestions(user_id);
create index if not exists task_materials_user_id_idx on public.task_materials(user_id);
create index if not exists task_materials_task_id_idx on public.task_materials(task_id);
create index if not exists material_quiz_attempts_user_id_idx on public.material_quiz_attempts(user_id);
create index if not exists material_quiz_attempts_material_id_idx on public.material_quiz_attempts(material_id);
create index if not exists user_notification_settings_user_id_idx on public.user_notification_settings(user_id);
create index if not exists notification_logs_user_id_idx on public.notification_logs(user_id);
create index if not exists notification_logs_reminder_date_idx on public.notification_logs(reminder_date);
create unique index if not exists notification_logs_task_once_idx
on public.notification_logs(user_id, task_id, reminder_type, reminder_date)
where task_id is not null;
create unique index if not exists notification_logs_schedule_once_idx
on public.notification_logs(user_id, schedule_session_id, reminder_type, reminder_date)
where schedule_session_id is not null;
create unique index if not exists notification_logs_general_once_idx
on public.notification_logs(user_id, reminder_type, reminder_date)
where task_id is null and schedule_session_id is null;

drop trigger if exists set_courses_updated_at on public.courses;
create trigger set_courses_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

drop trigger if exists set_schedule_sessions_updated_at on public.schedule_sessions;
create trigger set_schedule_sessions_updated_at
before update on public.schedule_sessions
for each row execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists set_task_checklists_updated_at on public.task_checklists;
create trigger set_task_checklists_updated_at
before update on public.task_checklists
for each row execute function public.set_updated_at();

drop trigger if exists set_task_notes_updated_at on public.task_notes;
create trigger set_task_notes_updated_at
before update on public.task_notes
for each row execute function public.set_updated_at();

drop trigger if exists set_task_materials_updated_at on public.task_materials;
create trigger set_task_materials_updated_at
before update on public.task_materials
for each row execute function public.set_updated_at();

drop trigger if exists set_user_notification_settings_updated_at on public.user_notification_settings;
create trigger set_user_notification_settings_updated_at
before update on public.user_notification_settings
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-materials',
  'task-materials',
  false,
  10485760,
  array['application/pdf', 'text/plain', 'text/markdown']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;

  insert into public.user_notification_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.courses to authenticated;
grant select, insert, update, delete on table public.schedule_sessions to authenticated;
grant select, insert, update, delete on table public.tasks to authenticated;
grant select, insert, update, delete on table public.task_checklists to authenticated;
grant select, insert, update, delete on table public.task_notes to authenticated;
grant select, insert, update, delete on table public.study_plans to authenticated;
grant select, insert, update, delete on table public.study_plan_items to authenticated;
grant select, insert, update, delete on table public.ai_suggestions to authenticated;
grant select, insert, update, delete on table public.task_materials to authenticated;
grant select, insert, update, delete on table public.material_quiz_attempts to authenticated;
grant select, insert, update, delete on table public.user_notification_settings to authenticated;
grant select on table public.notification_logs to authenticated;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.schedule_sessions enable row level security;
alter table public.tasks enable row level security;
alter table public.task_checklists enable row level security;
alter table public.task_notes enable row level security;
alter table public.study_plans enable row level security;
alter table public.study_plan_items enable row level security;
alter table public.ai_suggestions enable row level security;
alter table public.task_materials enable row level security;
alter table public.material_quiz_attempts enable row level security;
alter table public.user_notification_settings enable row level security;
alter table public.notification_logs enable row level security;

drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "Profiles are insertable by owner" on public.profiles;
create policy "Profiles are insertable by owner"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "Profiles are editable by owner" on public.profiles;
create policy "Profiles are editable by owner"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Users can manage own courses" on public.courses;
create policy "Users can manage own courses"
on public.courses for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can manage own schedule sessions" on public.schedule_sessions;
create policy "Users can manage own schedule sessions"
on public.schedule_sessions for all
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.courses
    where courses.id = schedule_sessions.course_id
    and courses.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage own tasks" on public.tasks;
create policy "Users can manage own tasks"
on public.tasks for all
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.courses
    where courses.id = tasks.course_id
    and courses.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage own checklists" on public.task_checklists;
create policy "Users can manage own checklists"
on public.task_checklists for all
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.tasks
    where tasks.id = task_checklists.task_id
    and tasks.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage own notes" on public.task_notes;
create policy "Users can manage own notes"
on public.task_notes for all
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.tasks
    where tasks.id = task_notes.task_id
    and tasks.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage own study plans" on public.study_plans;
create policy "Users can manage own study plans"
on public.study_plans for all
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.tasks
    where tasks.id = study_plans.task_id
    and tasks.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage own study plan items" on public.study_plan_items;
create policy "Users can manage own study plan items"
on public.study_plan_items for all
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.study_plans
    where study_plans.id = study_plan_items.study_plan_id
    and study_plans.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage own AI suggestions" on public.ai_suggestions;
create policy "Users can manage own AI suggestions"
on public.ai_suggestions for all
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (
    task_id is null
    or exists (
      select 1 from public.tasks
      where tasks.id = ai_suggestions.task_id
      and tasks.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can manage own task materials" on public.task_materials;
create policy "Users can manage own task materials"
on public.task_materials for all
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.tasks
    where tasks.id = task_materials.task_id
    and tasks.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage own material quiz attempts" on public.material_quiz_attempts;
create policy "Users can manage own material quiz attempts"
on public.material_quiz_attempts for all
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.task_materials
    where task_materials.id = material_quiz_attempts.material_id
    and task_materials.user_id = auth.uid()
  )
);

drop policy if exists "Users can upload own task material files" on storage.objects;
create policy "Users can upload own task material files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'task-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can view own task material files" on storage.objects;
create policy "Users can view own task material files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'task-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own task material files" on storage.objects;
create policy "Users can update own task material files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'task-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'task-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own task material files" on storage.objects;
create policy "Users can delete own task material files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'task-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can manage own notification settings" on public.user_notification_settings;
create policy "Users can manage own notification settings"
on public.user_notification_settings for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can view own Telegram notification logs" on public.notification_logs;
create policy "Users can view own Telegram notification logs"
on public.notification_logs for select
to authenticated
using (user_id = auth.uid());
