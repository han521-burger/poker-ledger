# Poker Ledger · Felt & Ledger

Home-game Texas Hold'em bookkeeping + regulars roster + realtime sync + leaderboard.

Stack: Next.js 14 (App Router) + Supabase (database + realtime) + Vercel (hosting).

---

## Deployment (follow it once end to end, roughly 15-20 minutes)

### Step 1: Create the Supabase database

1. Sign in at https://supabase.com/dashboard and click **New Project** to create one (if you've never done this, follow the steps sent to you earlier).
2. Once the project exists, go to **SQL Editor** → **New query** in the left menu.
3. Open `supabase/schema.sql` in this repo, select all, paste it into the SQL Editor, and hit **Run** in the bottom right.
   - `Success. No rows returned` means the tables were created.
   - This creates 5 tables (players / sessions / seats / buy_ins / leaderboard) and enables Realtime broadcasting.
4. Go to **Project Settings → API** and note these two values — you'll paste them into Vercel next:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public key** (a long string)

### Step 2: Push the code to GitHub

In a terminal on your own machine (not this sandbox), unzip the code folder I gave you and run:

```bash
cd poker-ledger
git init
git add .
git commit -m "init poker ledger"
```

Then create a new repo at https://github.com/new (call it `poker-ledger`, for example). Do **not** check "Add a README". Once created, GitHub shows you a few commands like:

```bash
git remote add origin https://github.com/your-username/poker-ledger.git
git branch -M main
git push -u origin main
```

Run them in order, then refresh the GitHub repo page — all your code files should be there.

### Step 3: Import and deploy on Vercel

1. Go to https://vercel.com/new
2. Choose **Import Git Repository**, find the `poker-ledger` repo you just created, and click **Import**
3. Under **Environment Variables**, add these two (the values you noted in Step 1):
   - `NEXT_PUBLIC_SUPABASE_URL` = your Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon public key
4. Click **Deploy** and wait 1-2 minutes for the build to finish.
5. Vercel then gives you a domain like `poker-ledger-xxx.vercel.app` — open it and that's your site.

### Step 4: Test the whole flow

1. Open the site and start a session (fill in blinds, buy-in, location; you can leave the PIN empty for testing)
2. Scan the QR code with your phone (or copy the link to another device / chat app) and claim a seat
3. Rebuy, then cash out and count chips — check that both devices update in realtime
4. Once the books balance, hit "Generate settlement & recap" and check that the transfer list and poster look right
5. Go to the leaderboard page and confirm this session's net result was added

---

## Changing content or styling later

After editing the code, run locally:

```bash
git add .
git commit -m "describe what you changed"
git push
```

Vercel detects the new commit on GitHub and rebuilds and redeploys automatically — no manual step needed.

---

## Project structure

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
  migration_004_*.sql       Incremental migration (optional account profiles + avatar)
  migration_005_*.sql       Incremental migration (created_by, for cross-device host recognition)
  migration_006_*.sql       Incremental migration (voided flag, for the "void this session" button)
```

## How this maps to the original plan

- **Regulars roster + automatic local device memory**: `lib/localPlayer.ts` uses `localStorage` to remember which identity this device last claimed; `JoinPanel.tsx` implements the frictionless "welcome back" seating, tap-to-pick from the regulars roster, and automatic persistence of new players.
- **Table-wide broadcast**: `SessionView.tsx` uses `supabase.channel().on('postgres_changes', ...)` to subscribe to changes on seats / buy_ins / sessions, so a rebuy or cash-out on any device refreshes every other phone at the table in realtime.
- **Traffic-light balance check + minimal transfer paths**: `simplifyDebts()` in `lib/settlement.ts` — a greedy algorithm that matches the largest creditor with the largest debtor.
- **Shareable recap poster**: `components/ResultPoster.tsx` uses `html-to-image` to render the settlement result into a saveable image.
- **Season-long leaderboard**: the `leaderboard` table plus the `bump_leaderboard()` database function, which atomically accumulates net result and win rate at each settlement.

## Permission model (this version)

There are now **two layers of protection**: the rebuy / cash-out / void / view-and-edit-records / settle buttons are **visible to the host only**, and the host has to re-enter the PIN on every click:

- A PIN is required when starting a session (4 digits) — no PIN, no session.
- Who counts as "host": whoever started the session. Two cases —
  - Started **while signed out**: the device stores a host token (`host_token`) locally, so only that device sees the management buttons; switch devices and it won't recognize you.
  - Started **while signed in**: `sessions.created_by` is recorded as well, so that account is recognized as host on any device, not just one phone.
- Anyone other than the host who opens this session's board sees no Records / + Rebuy / Cash out / Settle buttons at all — data only.
- The host sees the buttons and, **after entering the PIN correctly once, isn't asked again for 30 minutes**; past 30 minutes the PIN prompt comes back. The board shows "🔓 Unlocked for N more min" or "🔒" to indicate the current state.
- The host also gets an extra **"+ Add player"** button to seat someone directly, so not everyone has to scan the QR code or open the link themselves.
- **Forgot the PIN?** As long as this device/account is still recognized as host (no need to know the old PIN), click "Forgot PIN? Reset it" and set a new one. This is deliberate — host identity is already verified strictly enough, and the PIN is mainly there to prevent mis-taps, so there's no need to layer an email-recovery flow on top.
- **Host left and nobody can manage the books?** Non-host boards show a "Host gone? Take over" line. Anyone who knows the session PIN can click it, enter the current PIN to prove they know it, and **must** set a new PIN at the same time. After a successful takeover the old host's device/account immediately loses access (both `host_token` and `created_by` are replaced), and only the person who took over knows the new PIN.
- **Started the wrong session, or want to abandon one mid-game?** The host can click "Made a mistake? Void this session instead" to discard it without going through the full settlement flow. A voided session is flagged `voided`, counts toward nobody's leaderboard, and appears in the history list marked "Voided".

**Known security boundary**: PIN validation is purely client-side — the entered value is compared in plaintext against `sessions.host_pin`, and the PIN itself is fetched along with the session data by every visitor's browser (visible in plaintext in devtools' network tab). The host's `host_token` is likewise within publicly readable range. That's fine for a trusted friends' game, but it isn't bank-grade security — don't reuse a password from your other accounts as this PIN.

## Leaderboard privacy toggle

When taking a seat, each person can choose whether this session counts toward the leaderboard (checked by default). If unchecked:
- This session isn't added to the `leaderboard` aggregate table after settlement, so nobody sees this person's result for this session on the leaderboard.
- This session's table board shows a small "not on leaderboard" tag next to that person (visible only to people at the table; the leaderboard and history list are unaffected).
- The personal trend chart (`/player/[id]`) only counts sessions where that person opted into the leaderboard.

## The host can edit or void buy-in records

Each player's seat has a **Records** button (PIN required as well). Opening it shows all of that person's buy-ins for this session, and each one can have its amount changed or be voided outright — for fixing mistakes like a mistyped number.

## Personal trend chart + session history list

- Click a name on the leaderboard to see that person's session history plus a cumulative net-result line chart (`/player/[id]`).
- The home page has a "History" link (`/history`) listing every settled session; click through for the full recap.

## Duplicate-name protection

If a new name entered at seating differs from someone already in the roster only by case or whitespace, the system treats them as the same person instead of creating a duplicate profile. If the name is merely similar but not identical, it suggests "did you mean this person?" for you to tap — reducing the odds of one person being recorded under several different names.

## Database migrations (for existing projects)

If yours is an **existing project that has already run schema.sql once** (like the one you have deployed now), you don't need to rerun the whole schema.sql — just run these incremental scripts in order:

1. `supabase/migration_002_host_token.sql` (skip if you've already run it)
2. `supabase/migration_003_leaderboard_opt_out_and_buyin_edits.sql`
3. `supabase/migration_004_profiles.sql`
4. `supabase/migration_005_host_recognition.sql`
5. `supabase/migration_006_void_session.sql` (new this time — be sure to run it)

## Optional account system (new this time)

- Email magic-link sign-in (Supabase Auth, no password to set).
- **Optional**: not registering changes nothing about how you use the app — you can still tap a name to take a seat, exactly as before.
- People who do register can pick an avatar from a set of preset emoji, and a signed-in account is recognized across devices (no longer dependent on one device's local memory).
- The entry point is "My account" in the top-right of the home page.

**To deploy this feature you need to do two extra things in the Supabase dashboard** (these can't be done from code — you have to click through the web UI):

1. Supabase project → **Authentication → URL Configuration**
   - Set **Site URL** to your production domain, e.g. `https://han-poker.vercel.app`
   - Add a **Redirect URL**: `https://han-poker.vercel.app/account` (substitute your own domain)
2. Confirm **Authentication → Providers → Email** is enabled (it's on by default for new Supabase projects, so usually no change needed)

Sign-in emails are sent by Supabase's built-in email service; the free quota is plenty for a small friends' game, but messages occasionally land in spam — remind your friends to check their junk folder. If the group grows and you want more reliable delivery, you can hook up your own SMTP in Supabase later.

## Known limitations / possible future improvements

- The host PIN is currently stored in plaintext in `sessions.host_pin` — good enough, but not bank-grade security. If that bothers you, it could be switched to hashed storage later.
- Database permissions (RLS) are currently in a lightweight "anyone with the link can read and write" mode with no account-based gating, which suits a friends' game. Turning this into a public-facing club tool would require real user authentication.
- Duplicate-name detection currently only handles case/whitespace tolerance plus similarity suggestions; there's no admin tool to merge two existing duplicate profiles. If duplicates have already accumulated in the roster, you'll need to clean them up manually in the Supabase dashboard.
