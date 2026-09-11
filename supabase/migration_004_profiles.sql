-- 增量迁移 004：可选账号系统 + 预设头像
-- 贴进 Supabase SQL Editor 的 New query，点 Run 一次即可。

alter table players add column if not exists avatar text;

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  player_id uuid not null unique references players(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "user reads own profile" on profiles;
create policy "user reads own profile" on profiles for select using (auth.uid() = user_id);

drop policy if exists "user inserts own profile" on profiles;
create policy "user inserts own profile" on profiles for insert with check (auth.uid() = user_id);

drop policy if exists "user updates own profile" on profiles;
create policy "user updates own profile" on profiles for update using (auth.uid() = user_id);

drop policy if exists "user deletes own profile" on profiles;
create policy "user deletes own profile" on profiles for delete using (auth.uid() = user_id);

drop policy if exists "profile owner can update own player" on players;
create policy "profile owner can update own player" on players for update
  using (exists (select 1 from profiles where profiles.player_id = players.id and profiles.user_id = auth.uid()));
