# Cloud sync with Supabase

The app runs in **local-only mode** by default (projects saved in your browser).
Add a Supabase project to enable **accounts** and **cloud-synced projects &
cabinet models** across devices. When the two env vars below are absent, none of
this is active and the app behaves exactly as before.

## 1. Create a Supabase project

Sign up at <https://supabase.com>, create a project, and wait for it to finish
provisioning.

## 2. Create the tables + security policies

Open **SQL Editor** in your Supabase project and run this:

```sql
-- Projects -----------------------------------------------------------------
create table if not exists public.projects (
  id         text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text,
  data       jsonb not null,
  updated_at bigint not null default 0
);

alter table public.projects enable row level security;

create policy "projects_select_own" on public.projects
  for select using (auth.uid() = user_id);
create policy "projects_insert_own" on public.projects
  for insert with check (auth.uid() = user_id);
create policy "projects_update_own" on public.projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "projects_delete_own" on public.projects
  for delete using (auth.uid() = user_id);

-- Cabinet models -----------------------------------------------------------
create table if not exists public.cabinet_models (
  id         text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at bigint not null default 0
);

alter table public.cabinet_models enable row level security;

create policy "models_select_own" on public.cabinet_models
  for select using (auth.uid() = user_id);
create policy "models_insert_own" on public.cabinet_models
  for insert with check (auth.uid() = user_id);
create policy "models_update_own" on public.cabinet_models
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "models_delete_own" on public.cabinet_models
  for delete using (auth.uid() = user_id);
```

Row-level security ensures each user can only ever read/write their own rows.

## 3. Configure email auth

**Authentication → Providers → Email** is enabled by default. For quick testing
you may want **Authentication → Providers → Email → "Confirm email" = off** so a
new sign-up is logged in immediately (otherwise users must click a confirmation
link before they can sign in).

## 4. Get your API keys

**Project Settings → API**: copy the **Project URL** and the **anon / public**
key.

## 5. Set the environment variables

**Local development** — create `.env.local` (copy from `.env.example`):

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

**Vercel** — Project → **Settings → Environment Variables** → add the same two
keys, then redeploy. (`VITE_`-prefixed vars are safe to expose to the browser;
the anon key is designed for client use and is protected by row-level security.)

## How sync works

- Local storage is always the working cache, so the editor stays instant and
  works offline.
- On sign-in, local and cloud projects are merged (newest wins per project).
- After every change, the affected project is pushed to Supabase (debounced).
- Deletes and saved cabinet models propagate too.
