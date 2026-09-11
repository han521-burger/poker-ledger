-- 牌局账本 · 数据库结构
-- 在 Supabase 项目的 SQL Editor 里粘贴整段并 Run 一次即可。

create extension if not exists "pgcrypto";

-- 1. 常客表
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
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
  host_pin text,
  status text not null default 'active' check (status in ('active', 'finished'))
);

-- 3. 入座表（一个玩家在一场牌局里的座位状态）
create table if not exists seats (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  cash_out numeric,
  has_left boolean not null default false,
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

-- 5. 排行榜聚合表（跨场次累计净胜/胜率）
create table if not exists leaderboard (
  player_id uuid primary key references players(id) on delete cascade,
  games int not null default 0,
  wins int not null default 0,
  net_sum numeric not null default 0
);

create index if not exists idx_seats_session on seats(session_id);
create index if not exists idx_buyins_session on buy_ins(session_id);

-- 结算一局时，原子性地把这一局每个玩家的净盈亏累加进排行榜
create or replace function bump_leaderboard(p_player_id uuid, p_net numeric, p_won boolean)
returns void as $$
begin
  insert into leaderboard (player_id, games, wins, net_sum)
  values (p_player_id, 1, case when p_won then 1 else 0 end, p_net)
  on conflict (player_id) do update
    set games = leaderboard.games + 1,
        wins = leaderboard.wins + case when p_won then 1 else 0 end,
        net_sum = leaderboard.net_sum + p_net;
end;
$$ language plpgsql security definer;

grant execute on function bump_leaderboard(uuid, numeric, boolean) to anon, authenticated;

-- 开启 Realtime 广播（加买/离场时全桌手机自动跳动）
alter publication supabase_realtime add table seats;
alter publication supabase_realtime add table buy_ins;
alter publication supabase_realtime add table sessions;

-- 行级安全策略：这是家庭局/朋友局工具，不做账号登录系统，
-- 房间本身靠链接/二维码 + 房主 PIN 做轻量保护，
-- 所以这里对四张表放开匿名读写（用的是 anon public key，不是服务密钥）。
alter table players enable row level security;
alter table sessions enable row level security;
alter table seats enable row level security;
alter table buy_ins enable row level security;

create policy "public read players" on players for select using (true);
create policy "public insert players" on players for insert with check (true);

create policy "public read sessions" on sessions for select using (true);
create policy "public insert sessions" on sessions for insert with check (true);
create policy "public update sessions" on sessions for update using (true);

create policy "public read seats" on seats for select using (true);
create policy "public insert seats" on seats for insert with check (true);
create policy "public update seats" on seats for update using (true);

create policy "public read buyins" on buy_ins for select using (true);
create policy "public insert buyins" on buy_ins for insert with check (true);

alter table leaderboard enable row level security;
create policy "public read leaderboard" on leaderboard for select using (true);
-- 注意：leaderboard 的写入只通过上面的 bump_leaderboard() 函数（security definer），
-- 不开放直接 insert/update 策略，避免有人绕过结算流程直接改榜。
