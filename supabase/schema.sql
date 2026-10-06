-- 牌局账本 · 数据库结构
-- 在 Supabase 项目的 SQL Editor 里粘贴整段并 Run 一次，
-- 然后再跑一次 migration_008_server_side_pin.sql（房主 PIN 私密表 + 所有写操作函数）。

create extension if not exists "pgcrypto";

-- 1. 常客表
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar text,
  created_at timestamptz not null default now()
);

-- 2. 牌局场次表
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  date timestamptz not null default now(),
  location text not null default '',
  small_blind numeric not null default 1,
  big_blind numeric not null default 2,
  buy_in numeric not null default 200,
  created_by uuid references auth.users(id) on delete set null,
  voided boolean not null default false,
  status text not null default 'active' check (status in ('active', 'finished'))
);

-- 3. 入座表（一个玩家在一场牌局里的座位状态）
create table if not exists seats (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  cash_out numeric,
  has_left boolean not null default false,
  count_in_leaderboard boolean not null default true,
  joined_at timestamptz not null default now(),
  unique (session_id, player_id)
);

-- 4. 买入流水表（核心防错依据，每一笔加买都有精确时间戳）
create table if not exists buy_ins (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  amount numeric not null,
  created_at timestamptz not null default now()
);

-- 5. 排行榜视图（跨场次累计净胜/胜率）：直接从已结算、未作废的牌局实时算出，
-- 不存累加值，所以重复点结算也不会多算一局。
create or replace view leaderboard as
with per_seat as (
  select
    st.player_id,
    coalesce(st.cash_out, 0) - coalesce((
      select sum(b.amount) from buy_ins b
      where b.session_id = st.session_id and b.player_id = st.player_id
    ), 0) as net
  from seats st
  join sessions s on s.id = st.session_id
  where s.status = 'finished'
    and s.voided = false
    and st.count_in_leaderboard = true
)
select
  player_id,
  count(*)::int as games,
  count(*) filter (where net > 0)::int as wins,
  sum(net) as net_sum
from per_seat
group by player_id;

grant select on leaderboard to anon, authenticated;

-- 6. 账号资料表：把 Supabase 登录账号跟某一个玩家身份绑定起来。
-- 这是可选的——没注册账号的人照样能靠点名字入座，跟以前一样。
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  player_id uuid not null unique references players(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_seats_session on seats(session_id);
create index if not exists idx_buyins_session on buy_ins(session_id);

-- 开启 Realtime 广播（加买/离场时全桌手机自动跳动）
alter publication supabase_realtime add table seats;
alter publication supabase_realtime add table buy_ins;
alter publication supabase_realtime add table sessions;

-- 行级安全策略：四张表对所有人只读（玩家可以新建）。
-- 牌局 / 座位 / 买入的所有写操作都走 migration_008 里的函数，由数据库校验房主 PIN。
alter table players enable row level security;
alter table sessions enable row level security;
alter table seats enable row level security;
alter table buy_ins enable row level security;

create policy "public read players" on players for select using (true);
create policy "public insert players" on players for insert with check (true);

create policy "public read sessions" on sessions for select using (true);

create policy "public read seats" on seats for select using (true);

create policy "public read buyins" on buy_ins for select using (true);

-- profiles 表只有本人能读写自己那一行，别人看不到、也改不了谁跟哪个账号绑定。
alter table profiles enable row level security;
create policy "user reads own profile" on profiles for select using (auth.uid() = user_id);
create policy "user inserts own profile" on profiles for insert with check (auth.uid() = user_id);
create policy "user updates own profile" on profiles for update using (auth.uid() = user_id);
create policy "user deletes own profile" on profiles for delete using (auth.uid() = user_id);

-- 头像/名字只有绑定了这个 player_id 的账号本人能改；没登录账号的人（匿名 key）
-- 不受影响地继续能新建玩家、能读所有玩家信息，只是不能改别人的资料。
create policy "profile owner can update own player" on players for update
  using (exists (select 1 from profiles where profiles.player_id = players.id and profiles.user_id = auth.uid()));
