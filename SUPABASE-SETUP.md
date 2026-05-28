# Zyoris WFH Portal — free cloud database (Supabase)

Portal ab **localStorage** ki jagah **Supabase** (PostgreSQL) use karega — sab employees / admin **ek hi data** dekhenge, kisi bhi phone ya PC se.

## 1. Supabase account (free)

1. [supabase.com](https://supabase.com) → Sign up (free tier).
2. **New project** → naam: `zyoris-wfh` → region: apke users ke paas (e.g. Singapore).
3. Database password save kar lena.

## 2. Tables banayein

1. Project → **SQL Editor** → New query.
2. Repo ki file `supabase/schema.sql` ka **poora** content paste karo → **Run**.

## 3. Realtime on

1. **Database** → **Replication** (ya Publications).
2. `employees`, `attendance`, `leaves` tables ke liye **Realtime** enable karo.

## 4. API keys

1. **Project Settings** → **API**.
2. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

## 5. Is project mein keys lagayein

`.env.production` file mein add karo (example `.env.example` dekho):

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```

Phir build + deploy:

```powershell
cd c:\Users\Puneet\Projects\zyoris-wfh-portal
npm run package:zyoris
```

`website-` repo mein push (jaise pehle karte the).

**Important:** Keys build ke andar embed hoti hain — sirf **hidden URL** par deploy karo; anon key browser mein dikhti hai (internal tool).

## 6. Pehla admin / employees

- Admin login ab bhi code wala hai: `src/config/auth.js` (email + password).
- Employees **Admin → Employees** se add karo — ab **cloud** par save honge.

## Purana local data

Agar browser mein pehle se localStorage data tha aur cloud khali hai, **pehli load** par app automatically **migrate** kar degi Supabase par, phir local copy hata degi.

## Bina Supabase (dev only)

Agar `VITE_SUPABASE_URL` / key **khali** hain → app **localStorage mode** mein chalegi (purana behaviour).

---

Questions: Supabase free tier limits — [supabase.com/pricing](https://supabase.com/pricing) (500MB DB, enough for small team).
