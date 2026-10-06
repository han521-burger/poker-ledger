-- 增量迁移 007：排行榜改成“从历史记录实时算出来”
-- 以前 leaderboard 是一张累加表，每次点“结算”就给每个人 games +1。
-- 结算按钮被连点两下 / 两台手机同时点，就会把同一局算两次（历史 6 局，榜上显示 7 局）。
-- 现在把它换成视图：直接从已结算、未作废的牌局里统计，永远跟历史对得上，
-- 现有的错误数字跑完这个迁移后也会自动变正确。
-- 贴进 Supabase SQL Editor 的 New query，点 Run 一次即可。

drop function if exists bump_leaderboard(uuid, numeric, boolean);
drop table if exists leaderboard cascade;

create view leaderboard as
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
