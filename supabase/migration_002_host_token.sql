-- 增量迁移：给权限体系加上"房主设备令牌"
-- 你之前已经跑过一次 schema.sql 建好了表，这次不需要重跑整个 schema.sql，
-- 只需要把下面这一段贴进 Supabase 的 SQL Editor 点 Run 一次即可。

alter table sessions add column if not exists host_token uuid not null default gen_random_uuid();
