-- 增量迁移 008：房主 PIN 改由数据库校验 + 已结算牌局锁定
-- 以前 PIN 是在浏览器里比对的：每台打开链接的手机都能读到 PIN，数据库也允许任何人
-- 直接改任意牌局的买入/兑现（包括已结算的局，现在排行榜实时计算，就会被改掉）。
-- 现在：
--   * PIN 和房主令牌搬进 session_secrets 私密表，网页读不到
--   * 所有房主操作都走下面的函数，函数里先校验 PIN，再检查牌局状态
--   * 连续输错 10 次 PIN，这局锁 15 分钟（防止暴力试 0000~9999）
--   * 已结算 / 已作废的牌局不能再改；房主可以用 PIN “重新打开”已结算的局
-- 先跑 migration_007，再把这整段贴进 Supabase SQL Editor 的 New query，点 Run 一次即可。
-- 跑完之后旧版网页的房主操作会失效，记得同时把新代码推上去部署。

-- 1. 私密表：没有任何 RLS 策略，网页（anon / authenticated）完全读写不了，只有下面的函数能碰
create table if not exists session_secrets (
  session_id uuid primary key references sessions(id) on delete cascade,
  host_pin text,
  host_token uuid not null default gen_random_uuid(),
  failed_attempts int not null default 0,
  locked_until timestamptz
);
alter table session_secrets enable row level security;
revoke all on session_secrets from anon, authenticated;

-- 2. 把旧牌局的 PIN / 令牌搬过去，再从公开的 sessions 表里删掉
--    （全新安装时 sessions 上本来就没有这两列，这一步会自动跳过）
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sessions' and column_name = 'host_pin'
  ) then
    insert into session_secrets (session_id, host_pin, host_token)
    select id, nullif(host_pin, ''), host_token from sessions
    on conflict (session_id) do nothing;
    alter table sessions drop column host_pin;
    alter table sessions drop column if exists host_token;
  end if;
end $$;

-- 3. 收回直接写表的权限：以后只能通过下面的函数改牌局 / 座位 / 买入
drop policy if exists "public insert sessions" on sessions;
drop policy if exists "public update sessions" on sessions;
drop policy if exists "public insert seats" on seats;
drop policy if exists "public update seats" on seats;
drop policy if exists "public insert buyins" on buy_ins;
drop policy if exists "public update buyins" on buy_ins;
drop policy if exists "public delete buyins" on buy_ins;

-- ===== 函数 =====
-- 房主操作的函数返回 text：null 表示成功，否则是给用户看的错误提示。
-- PIN 错误用“返回”而不是“报错”，这样错误次数才会被记下来（报错会整个回滚）。

-- 内部：校验 PIN 并记录错误次数
create or replace function _pin_error(p_session uuid, p_pin text)
returns text language plpgsql security definer set search_path = public as $$
declare
  sec session_secrets%rowtype;
begin
  select * into sec from session_secrets where session_id = p_session for update;
  if not found or sec.host_pin is null then
    return 'This session has no host PIN';
  end if;
  if sec.locked_until is not null and sec.locked_until > now() then
    return 'Too many wrong PINs — try again in '
      || ceil(extract(epoch from sec.locked_until - now()) / 60)::int || ' min';
  end if;
  if p_pin is distinct from sec.host_pin then
    update session_secrets
      set failed_attempts = case when failed_attempts + 1 >= 10 then 0 else failed_attempts + 1 end,
          locked_until = case when failed_attempts + 1 >= 10 then now() + interval '15 minutes' else null end
      where session_id = p_session;
    return 'Incorrect PIN';
  end if;
  if sec.failed_attempts > 0 then
    update session_secrets set failed_attempts = 0, locked_until = null where session_id = p_session;
  end if;
  return null;
end $$;

-- 内部：牌局必须还在进行中
create or replace function _assert_active(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform 1 from sessions where id = p_session and status = 'active' for update;
  if not found then
    raise exception 'This session is closed — reopen it first';
  end if;
end $$;

revoke all on function _pin_error(uuid, text) from public, anon, authenticated;
revoke all on function _assert_active(uuid) from public, anon, authenticated;

-- 开局：返回新牌局 id 和这台设备的房主令牌
create or replace function create_session(
  p_small_blind numeric, p_big_blind numeric, p_buy_in numeric, p_location text, p_pin text
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_token uuid;
begin
  if p_pin is null or p_pin !~ '^\d{4}$' then
    raise exception 'PIN must be 4 digits';
  end if;
  insert into sessions (small_blind, big_blind, buy_in, location, created_by, status)
  values (p_small_blind, p_big_blind, p_buy_in, coalesce(nullif(trim(p_location), ''), 'Unnamed location'), auth.uid(), 'active')
  returning id into v_id;
  insert into session_secrets (session_id, host_pin) values (v_id, p_pin)
  returning host_token into v_token;
  return json_build_object('id', v_id, 'host_token', v_token);
end $$;

-- 这台设备（令牌）或当前登录账号是不是这局的房主——只决定显示哪些按钮
create or replace function is_host(p_session uuid, p_token uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from session_secrets ss join sessions s on s.id = ss.session_id
    where ss.session_id = p_session
      and ((p_token is not null and ss.host_token = p_token)
        or (auth.uid() is not null and s.created_by = auth.uid()))
  );
$$;

-- 输入 PIN 解锁 30 分钟前先在这里验证一次
create or replace function verify_pin(p_session uuid, p_pin text)
returns text language plpgsql security definer set search_path = public as $$
begin
  return _pin_error(p_session, p_pin);
end $$;

-- 入座（玩家自己扫码入座，不需要 PIN）：座位 + 首次买入一起写，重复点也只入座一次
create or replace function join_session(p_session uuid, p_player uuid, p_count boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_buy_in numeric;
begin
  perform _assert_active(p_session);
  select buy_in into v_buy_in from sessions where id = p_session;
  insert into seats (session_id, player_id, count_in_leaderboard)
  values (p_session, p_player, coalesce(p_count, true))
  on conflict (session_id, player_id) do nothing;
  if found then
    insert into buy_ins (session_id, player_id, amount) values (p_session, p_player, v_buy_in);
  end if;
end $$;

-- 加买：p_id 由网页生成，同一次加买重复提交只会记一笔
create or replace function add_buy_in(p_session uuid, p_pin text, p_player uuid, p_amount numeric, p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  err text := _pin_error(p_session, p_pin);
begin
  if err is not null then return err; end if;
  perform _assert_active(p_session);
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be more than 0';
  end if;
  if not exists (select 1 from seats where session_id = p_session and player_id = p_player and cash_out is null) then
    raise exception 'That player is not at the table';
  end if;
  insert into buy_ins (id, session_id, player_id, amount)
  values (coalesce(p_id, gen_random_uuid()), p_session, p_player, p_amount)
  on conflict (id) do nothing;
  return null;
end $$;

create or replace function edit_buy_in(p_session uuid, p_pin text, p_buy_in uuid, p_amount numeric)
returns text language plpgsql security definer set search_path = public as $$
declare
  err text := _pin_error(p_session, p_pin);
begin
  if err is not null then return err; end if;
  perform _assert_active(p_session);
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be more than 0';
  end if;
  update buy_ins set amount = p_amount where id = p_buy_in and session_id = p_session;
  if not found then raise exception 'Buy-in not found'; end if;
  return null;
end $$;

create or replace function delete_buy_in(p_session uuid, p_pin text, p_buy_in uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  err text := _pin_error(p_session, p_pin);
begin
  if err is not null then return err; end if;
  perform _assert_active(p_session);
  delete from buy_ins where id = p_buy_in and session_id = p_session;
  return null;
end $$;

create or replace function cash_out(p_session uuid, p_pin text, p_player uuid, p_amount numeric)
returns text language plpgsql security definer set search_path = public as $$
declare
  err text := _pin_error(p_session, p_pin);
begin
  if err is not null then return err; end if;
  perform _assert_active(p_session);
  if p_amount is null or p_amount < 0 then
    raise exception 'Cash-out can''t be negative';
  end if;
  update seats set cash_out = p_amount, has_left = true where session_id = p_session and player_id = p_player;
  if not found then raise exception 'That player is not at the table'; end if;
  return null;
end $$;

create or replace function undo_cash_out(p_session uuid, p_pin text, p_player uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  err text := _pin_error(p_session, p_pin);
begin
  if err is not null then return err; end if;
  perform _assert_active(p_session);
  update seats set cash_out = null, has_left = false where session_id = p_session and player_id = p_player;
  return null;
end $$;

-- 结算：数据库自己再核一遍账（所有人都已兑现、总买入 = 总兑现），然后锁定
create or replace function finish_session(p_session uuid, p_pin text)
returns text language plpgsql security definer set search_path = public as $$
declare
  err text := _pin_error(p_session, p_pin);
  v_seats int;
  v_open int;
  v_out numeric;
  v_in numeric;
begin
  if err is not null then return err; end if;
  perform _assert_active(p_session);
  select count(*), count(*) filter (where cash_out is null), coalesce(sum(cash_out), 0)
    into v_seats, v_open, v_out
    from seats where session_id = p_session;
  select coalesce(sum(amount), 0) into v_in from buy_ins where session_id = p_session;
  if v_seats = 0 then raise exception 'No players in this session'; end if;
  if v_open > 0 then raise exception 'Everyone has to cash out before settling'; end if;
  if round(v_in, 2) <> round(v_out, 2) then
    raise exception 'Books are off by % — double check the log', round(v_in - v_out, 2);
  end if;
  update sessions set status = 'finished' where id = p_session;
  return null;
end $$;

create or replace function void_session(p_session uuid, p_pin text)
returns text language plpgsql security definer set search_path = public as $$
declare
  err text := _pin_error(p_session, p_pin);
begin
  if err is not null then return err; end if;
  perform _assert_active(p_session);
  update sessions set status = 'finished', voided = true where id = p_session;
  return null;
end $$;

-- 重新打开一局已结算的牌局（比如结算后才发现记错了），作废的局不能重开
create or replace function reopen_session(p_session uuid, p_pin text)
returns text language plpgsql security definer set search_path = public as $$
declare
  err text := _pin_error(p_session, p_pin);
begin
  if err is not null then return err; end if;
  update sessions set status = 'active' where id = p_session and status = 'finished' and voided = false;
  if not found then raise exception 'Only a settled (not voided) session can be reopened'; end if;
  return null;
end $$;

-- 忘记 PIN：只有房主设备（令牌）或房主账号能重设，不需要旧 PIN
create or replace function reset_pin(p_session uuid, p_token uuid, p_new_pin text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_host(p_session, p_token) then
    raise exception 'Only the host''s device or account can reset the PIN';
  end if;
  if p_new_pin is null or p_new_pin !~ '^\d{4}$' then
    raise exception 'PIN must be 4 digits';
  end if;
  update session_secrets
    set host_pin = p_new_pin, failed_attempts = 0, locked_until = null
    where session_id = p_session;
end $$;

-- 接管房主：输对当前 PIN + 设新 PIN，换一个新令牌，旧房主设备立即失效
-- 返回 {"error": "..."} 或 {"host_token": "..."}
create or replace function takeover(p_session uuid, p_current_pin text, p_new_pin text)
returns json language plpgsql security definer set search_path = public as $$
declare
  err text := _pin_error(p_session, p_current_pin);
  v_token uuid := gen_random_uuid();
begin
  if err is not null then return json_build_object('error', err); end if;
  if p_new_pin is null or p_new_pin !~ '^\d{4}$' then
    raise exception 'New PIN must be 4 digits';
  end if;
  update session_secrets set host_pin = p_new_pin, host_token = v_token where session_id = p_session;
  update sessions set created_by = auth.uid() where id = p_session;
  return json_build_object('host_token', v_token);
end $$;

grant execute on function
  create_session(numeric, numeric, numeric, text, text),
  is_host(uuid, uuid),
  verify_pin(uuid, text),
  join_session(uuid, uuid, boolean),
  add_buy_in(uuid, text, uuid, numeric, uuid),
  edit_buy_in(uuid, text, uuid, numeric),
  delete_buy_in(uuid, text, uuid),
  cash_out(uuid, text, uuid, numeric),
  undo_cash_out(uuid, text, uuid),
  finish_session(uuid, text),
  void_session(uuid, text),
  reopen_session(uuid, text),
  reset_pin(uuid, uuid, text),
  takeover(uuid, text, text)
to anon, authenticated;
