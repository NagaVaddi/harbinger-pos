-- Run this once in your Supabase SQL editor:
-- https://supabase.com/dashboard/project/vsaunnfackmuutclacfu/sql

create table if not exists harbinger_db (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz default now()
);

-- Allow browser (anon key) to read and write
alter table harbinger_db enable row level security;

create policy "public read"  on harbinger_db for select using (true);
create policy "public write" on harbinger_db for insert with check (true);
create policy "public update" on harbinger_db for update using (true);
