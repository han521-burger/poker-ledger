# 牌局账本 · Felt & Ledger

德州扑克家局记账 + 常客名录 + 实时同步 + 排行榜。

技术栈：Next.js 14 (App Router) + Supabase（数据库 + 实时推送）+ Vercel（托管部署）。

---

## 部署步骤（跟着做一遍，大约 15-20 分钟）

### 第一步：建 Supabase 数据库

1. 去 https://supabase.com/dashboard 登录，点 **New Project** 建一个项目（如果还没建过，参考之前发你的步骤）。
2. 项目建好后，左侧菜单 **SQL Editor** → **New query**。
3. 打开这个仓库里的 `supabase/schema.sql` 文件，全选复制，粘贴进 SQL Editor，点右下角 **Run**。
   - 看到 `Success. No rows returned` 就是建表成功了。
   - 这一步会建 5 张表（players / sessions / seats / buy_ins / leaderboard）并开启 Realtime 广播。
4. 左侧菜单 **Project Settings → API**，把这两个值记下来，等下要填进 Vercel：
   - **Project URL**（形如 `https://xxxxx.supabase.co`）
   - **anon public key**（一长串字符）

### 第二步：把代码推到 GitHub

在你自己电脑的终端里（不是这个沙盒环境），把我给你的代码文件夹解压后执行：

```bash
cd poker-ledger
git init
git add .
git commit -m "init poker ledger"
```

然后去 https://github.com/new 建一个新仓库（比如叫 `poker-ledger`），**不要**勾选 "Add a README"，建好后 GitHub 会给你几行命令，形如：

```bash
git remote add origin https://github.com/你的用户名/poker-ledger.git
git branch -M main
git push -u origin main
```

依次执行完，刷新 GitHub 仓库页面，应该能看到所有代码文件了。

### 第三步：在 Vercel 导入项目并部署

1. 去 https://vercel.com/new
2. 选择 **Import Git Repository**，找到你刚建的 `poker-ledger` 仓库，点 **Import**
3. 在 **Environment Variables** 这一栏，添加两项（就是第一步记下来的那两个值）：
   - `NEXT_PUBLIC_SUPABASE_URL` = 你的 Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = 你的 anon public key
4. 点 **Deploy**，等 1-2 分钟构建完成。
5. 完成后 Vercel 会给你一个域名，形如 `poker-ledger-xxx.vercel.app`，点开就是你的网站了。

### 第四步：测试一遍完整流程

1. 打开网站，开一局（填盲注、买入、地点，PIN 可以先留空方便测试）
2. 用手机扫二维码（或者复制链接发给自己的另一台设备/微信），选一个身份入座
3. 加买、离场清点筹码，看两台设备是否实时同步跳动
4. 平账后点"生成清算与战报"，看转账清单和海报是否正确
5. 去排行榜页面，看这一局的净胜负是否已经累计进去

---

## 之后要改内容/样式，怎么办

代码改完后，本地执行：

```bash
git add .
git commit -m "描述你改了什么"
git push
```

Vercel 会自动检测到 GitHub 有新提交，自动重新构建部署，不用再手动操作。

---

## 项目结构

```
app/
  page.tsx                Home: start-session form
  session/[id]/page.tsx   Session route
  leaderboard/page.tsx    Leaderboard
  history/page.tsx        All settled sessions
  player/[id]/page.tsx    Per-player net trend chart + session list
components/
  SessionView.tsx         Main session board (realtime sync core logic)
  JoinPanel.tsx            Self-serve join (regulars roster + local device memory)
  BuyInsModal.tsx           Host: view/edit/void a player's buy-in records
  RebuyModal / CashoutModal / PinModal / QRModal / ResultPoster
lib/
  supabase.ts             Supabase client
  settlement.ts            Debt-simplification algorithm
  localPlayer.ts            Local device memory (localStorage)
  types.ts                  Shared types
supabase/
  schema.sql               Fresh-install table + policy script
  migration_002_*.sql       Incremental migration (host_token)
  migration_003_*.sql       Incremental migration (leaderboard opt-out + buy-in edit policies)
```

## 和最初方案的对应关系

- **常客名录 + 本地设备自动记忆**：`lib/localPlayer.ts` 用 `localStorage` 记住这台设备上次认领的身份，`JoinPanel.tsx` 实现"欢迎回来"无痛入座 / 常客名录点选 / 新玩家自动沉淀入库。
- **全桌广播**：`SessionView.tsx` 里用 `supabase.channel().on('postgres_changes', ...)` 订阅 seats / buy_ins / sessions 三张表的变化，任何设备加买/离场都会让全桌其他手机实时刷新。
- **红绿灯平账校验 + 最简转账路径**：`lib/settlement.ts` 的 `simplifyDebts()`，贪心算法匹配最大债权人与最大债务人。
- **社交战报海报**：`components/ResultPoster.tsx`，用 `html-to-image` 把结算结果渲染成可保存的图片。
- **全赛季排行榜**：`leaderboard` 表 + `bump_leaderboard()` 数据库函数，在每局结算时原子性累加净胜负与胜率。

## 权限模型（这一版）

现在是**房主每一次操作都要重新输入 PIN**，不会被记住：

- 开局时 PIN 是必填的（4 位数字），不设 PIN 不能开局。
- 加买、离场、撤销、查看/修改加买记录、结算 —— 每一次点击都会弹出 PIN 输入框，只有这一次输对了才会执行这一次操作。
- 这样即使多个人手机上都能看到这些按钮，没有 PIN 也点不动任何一步。

**已知的安全边界**：这套校验是纯前端拿输入值跟 `sessions.host_pin` 明文比对，PIN 本身会随着牌局数据一起被所有访问者的浏览器读到（在开发者工具的网络请求里能看到明文）。对朋友局这种信任场景够用，但不是银行级安全——不要用你其他账户也在用的密码当这个 PIN。

## 排行榜隐私开关

入座时每个人可以自己选"这一局要不要算进排行榜"（默认勾选算进去）。不勾选的话：
- 这一局结算后不会累加进 `leaderboard` 聚合表，別人在排行榜上完全看不到这个人这一局的数据。
- 这一局的桌面看板上会给这个人标一个"not on leaderboard"的小标签（只有当场的人能看到，排行榜和历史列表不受影响）。
- 个人战绩走势图（`/player/[id]`）只统计这个人勾选了"算入排行榜"的场次。

## 房主可以修改/撤销加买记录

每个玩家的座位旁边有个 **Records** 按钮（同样需要 PIN），点开能看到这个人这一局所有的加买记录，每一笔都能改金额或直接撤销——用来修正按错数字之类的失误。

## 个人历史走势图 + 牌局历史列表

- 排行榜上点名字，能看到这个人的历史场次列表 + 累计净胜负折线图（`/player/[id]`）。
- 首页有一个"History"入口（`/history`），列出所有已结算的牌局，点进去能看到完整战报。

## 防重名入座

入座时如果输入的新名字跟名录里已有的人只是大小写/空格不一样，系统会自动识别成同一个人，不会建重复档案；如果只是相似但不完全一样，会弹出"你是不是想选这个人"的建议供点选，减少同一个人被记成好几个不同名字的情况。

## 数据库迁移（老项目适用）

如果你是**已经跑过一次 schema.sql 的老项目**（比如你现在部署的这套），不需要重跑整个 schema.sql，依次跑这两段增量脚本就够了：

1. `supabase/migration_002_host_token.sql`（如果之前已经跑过可以跳过）
2. `supabase/migration_003_leaderboard_opt_out_and_buyin_edits.sql`（这次新加的，一定要跑）

## 已知限制 / 后续可以加强的地方

- 房主 PIN 目前是明文存在 `sessions.host_pin` 字段里，够用但不是银行级安全；如果介意，可以后续改成哈希存储。
- 数据库权限（RLS）目前是"知道链接就能读写"的轻量模式，没有账号登录系统，适合朋友局场景；如果以后要做成对外开放的俱乐部工具，需要加真正的用户认证。
- 重名检测目前只做大小写/空格容错 + 相似建议，没有"合并两个已存在的重复档案"的管理工具，如果名录里已经攒了重复的人，需要手动去 Supabase 后台清理。
