-- 增量迁移 006：支持“作废这局”功能
-- 加一个 voided 标记字段——作废时只是打个标记，不会真的删数据，
-- 牌局详情页会检测这个标记并显示“已作废”，首页/历史列表会把它过滤掉。
-- 贴进 Supabase SQL Editor 的 New query，点 Run 一次即可。

alter table sessions add column if not exists voided boolean not null default false;
