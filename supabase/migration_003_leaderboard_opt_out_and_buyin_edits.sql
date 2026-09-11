-- 增量迁移 003
-- 你之前已经跑过 schema.sql（以及 migration_002），这次只需要把下面这几行
-- 贴进 Supabase 的 SQL Editor 点 Run 一次即可，不用重跑整个 schema.sql。

alter table seats add column if not exists count_in_leaderboard boolean not null default true;

create policy "public update buyins" on buy_ins for update using (true);
create policy "public delete buyins" on buy_ins for delete using (true);
