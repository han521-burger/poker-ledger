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
  page.tsx                首页：开新局表单
  session/[id]/page.tsx   牌局详情页路由
  leaderboard/page.tsx    排行榜
components/
  SessionView.tsx         牌局主看板（实时同步核心逻辑）
  JoinPanel.tsx            自助入座（常客名录 + 本地设备记忆）
  RebuyModal / CashoutModal / PinModal / QRModal / ResultPoster
lib/
  supabase.ts             Supabase 客户端
  settlement.ts            最简转账路径算法（债务简化）
  localPlayer.ts            本地设备记忆（localStorage）
  types.ts                  类型定义
supabase/
  schema.sql               数据库建表 + 权限策略脚本
```

## 和最初方案的对应关系

- **常客名录 + 本地设备自动记忆**：`lib/localPlayer.ts` 用 `localStorage` 记住这台设备上次认领的身份，`JoinPanel.tsx` 实现"欢迎回来"无痛入座 / 常客名录点选 / 新玩家自动沉淀入库。
- **全桌广播**：`SessionView.tsx` 里用 `supabase.channel().on('postgres_changes', ...)` 订阅 seats / buy_ins / sessions 三张表的变化，任何设备加买/离场都会让全桌其他手机实时刷新。
- **红绿灯平账校验 + 最简转账路径**：`lib/settlement.ts` 的 `simplifyDebts()`，贪心算法匹配最大债权人与最大债务人。
- **社交战报海报**：`components/ResultPoster.tsx`，用 `html-to-image` 把结算结果渲染成可保存的图片。
- **全赛季排行榜**：`leaderboard` 表 + `bump_leaderboard()` 数据库函数，在每局结算时原子性累加净胜负与胜率。

## 已知限制 / 后续可以加强的地方

- 房主 PIN 目前是明文存在 `sessions.host_pin` 字段里，够用但不是银行级安全；如果介意，可以后续改成哈希存储。
- 数据库权限（RLS）目前是"知道链接就能读写"的轻量模式，没有账号登录系统，适合朋友局场景；如果以后要做成对外开放的俱乐部工具，需要加真正的用户认证。
- 个人历史盈亏折线图（原方案提到的"点开个人名字看专属走势图"）这一版还没做，可以作为下一步迭代。
