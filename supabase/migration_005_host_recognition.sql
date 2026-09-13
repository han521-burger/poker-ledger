-- 增量迁移 005：房主识别用的 created_by 字段
-- （host_token 字段如果你之前跑过 migration_002，这里就已经有了，不用重建）
-- 贴进 Supabase SQL Editor 的 New query，点 Run 一次即可。

alter table sessions add column if not exists created_by uuid references auth.users(id) on delete set null;
