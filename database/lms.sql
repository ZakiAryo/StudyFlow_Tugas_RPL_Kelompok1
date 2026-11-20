-- =========================================================
-- STUDYFLOW LMS INTEGRATION
-- =========================================================

create extension if not exists pgcrypto;


-- =========================================================
-- 1. LMS CONNECTIONS
-- =========================================================

create table if not exists public.lms_connections (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    provider text not null default 'unindra',

    status text not null default 'disconnected'
        check (
            status in (
                'disconnected',
                'connecting',
                'connected',
                'expired',
                'error'
            )
        ),

    lms_username text,

    -- Reference/token/session identifier.
    -- Jangan menyimpan password LMS di sini.
    session_reference text,

    session_expires_at timestamptz,

    last_synced_at timestamptz,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    constraint lms_connections_user_provider_unique
        unique (user_id, provider)
);


-- =========================================================
-- 2. LMS COURSES
-- =========================================================

create table if not exists public.lms_courses (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    lms_connection_id uuid not null
        references public.lms_connections(id)
        on delete cascade,

    external_id text,

    course_name text not null,

    lecturer_name text,

    class_info text,

    course_url text,

    photo_url text,

    last_synced_at timestamptz,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    constraint lms_courses_connection_external_unique
        unique (lms_connection_id, external_id)
);


-- =========================================================
-- 3. LMS SYNC LOGS
-- =========================================================

create table if not exists public.lms_sync_logs (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    lms_connection_id uuid
        references public.lms_connections(id)
        on delete cascade,

    sync_type text not null
        check (
            sync_type in (
                'dashboard',
                'courses',
                'meetings',
                'contents',
                'full'
            )
        ),

    status text not null
        check (
            status in (
                'started',
                'success',
                'failed'
            )
        ),

    items_synced integer not null default 0,

    error_message text,

    started_at timestamptz not null default now(),

    finished_at timestamptz,

    created_at timestamptz not null default now()
);


-- =========================================================
-- INDEXES
-- =========================================================

create index if not exists idx_lms_connections_user_id
    on public.lms_connections(user_id);

create index if not exists idx_lms_courses_user_id
    on public.lms_courses(user_id);

create index if not exists idx_lms_courses_connection_id
    on public.lms_courses(lms_connection_id);

create index if not exists idx_lms_sync_logs_user_id
    on public.lms_sync_logs(user_id);

create index if not exists idx_lms_sync_logs_connection_id
    on public.lms_sync_logs(lms_connection_id);


-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.lms_connections
    enable row level security;

alter table public.lms_courses
    enable row level security;

alter table public.lms_sync_logs
    enable row level security;


-- =========================================================
-- LMS CONNECTION POLICIES
-- =========================================================

drop policy if exists "Users can view own LMS connections"
    on public.lms_connections;

create policy "Users can view own LMS connections"
    on public.lms_connections
    for select
    to authenticated
    using ((select auth.uid()) = user_id);


drop policy if exists "Users can create own LMS connections"
    on public.lms_connections;

create policy "Users can create own LMS connections"
    on public.lms_connections
    for insert
    to authenticated
    with check ((select auth.uid()) = user_id);


drop policy if exists "Users can update own LMS connections"
    on public.lms_connections;

create policy "Users can update own LMS connections"
    on public.lms_connections
    for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);


drop policy if exists "Users can delete own LMS connections"
    on public.lms_connections;

create policy "Users can delete own LMS connections"
    on public.lms_connections
    for delete
    to authenticated
    using ((select auth.uid()) = user_id);


-- =========================================================
-- LMS COURSES POLICIES
-- =========================================================

drop policy if exists "Users can view own LMS courses"
    on public.lms_courses;

create policy "Users can view own LMS courses"
    on public.lms_courses
    for select
    to authenticated
    using ((select auth.uid()) = user_id);


drop policy if exists "Users can create own LMS courses"
    on public.lms_courses;

create policy "Users can create own LMS courses"
    on public.lms_courses
    for insert
    to authenticated
    with check ((select auth.uid()) = user_id);


drop policy if exists "Users can update own LMS courses"
    on public.lms_courses;

create policy "Users can update own LMS courses"
    on public.lms_courses
    for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);


drop policy if exists "Users can delete own LMS courses"
    on public.lms_courses;

create policy "Users can delete own LMS courses"
    on public.lms_courses
    for delete
    to authenticated
    using ((select auth.uid()) = user_id);


-- =========================================================
-- LMS SYNC LOG POLICIES
-- =========================================================

drop policy if exists "Users can view own LMS sync logs"
    on public.lms_sync_logs;

create policy "Users can view own LMS sync logs"
    on public.lms_sync_logs
    for select
    to authenticated
    using ((select auth.uid()) = user_id);


drop policy if exists "Users can create own LMS sync logs"
    on public.lms_sync_logs;

create policy "Users can create own LMS sync logs"
    on public.lms_sync_logs
    for insert
    to authenticated
    with check ((select auth.uid()) = user_id);


drop policy if exists "Users can update own LMS sync logs"
    on public.lms_sync_logs;

create policy "Users can update own LMS sync logs"
    on public.lms_sync_logs
    for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);


-- =========================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =========================================================

create or replace function public.update_lms_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;


drop trigger if exists trg_lms_connections_updated_at
    on public.lms_connections;

create trigger trg_lms_connections_updated_at
before update on public.lms_connections
for each row
execute function public.update_lms_updated_at();


drop trigger if exists trg_lms_courses_updated_at
    on public.lms_courses;

create trigger trg_lms_courses_updated_at
before update on public.lms_courses
for each row
execute function public.update_lms_updated_at();