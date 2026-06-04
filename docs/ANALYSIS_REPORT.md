# WFH Portal — Pre-Implementation Analysis

## Git & Project

| Item | Value |
|------|--------|
| Repository | `https://github.com/puneetmunjal7725/zyoris-wfh-portal.git` |
| Branch (start) | `master` |
| Feature branch | `feature/wfm-portal-v2-sync-messages` |
| Deploy target | `website-` repo → `zyoris.com/zy-wfh-7k2m/` |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 8, React Router 7 (HashRouter on GitHub Pages) |
| Backend | **None** — static SPA |
| Database | **Supabase PostgreSQL** (free tier) via `@supabase/supabase-js` |
| Auth | Client-side: admin email/password in `config/auth.js`; employees by ID + password in DB |
| Realtime | Supabase `postgres_changes` subscriptions |

## Existing Architecture

```
Browser (React SPA)
  ├── localStorage cache (`zyoris_portal_v1`, `zyoris_session_v1`)
  ├── in-memory dbCache
  └── Supabase client (anon key) — direct table read/write
```

**No REST API layer.** All data operations go through `storage.js` → `supabaseSync.js`.

## Database Schema (v1)

- `employees` — profile, password (plaintext), role, email, etc.
- `attendance` — PK `(emp_id, date)`, punch in/out, checks, events JSONB
- `leaves` — leave requests with status

## Root Cause of Multi-Device Sync Issues

1. **Hybrid local-first model** — localStorage cache could diverge from Supabase.
2. **Fire-and-forget cloud writes** — punch saved locally before Supabase confirmed.
3. **Merge logic** skipped cloud pull when local had data.
4. **No await on attendance sync** — mobile showed punch before server had it.
5. **Admin/employee used different merge strategies.**

## Fix Strategy (v2)

1. **Supabase = single source of truth** — load cloud on init; cache is read-only mirror.
2. **Await all writes** to Supabase before updating UI.
3. **Realtime + 8s polling** refresh cache on all devices.
4. **New tables**: `messages`, `message_recipients`, `message_replies`, `notifications`.
5. **Attendance history** via date-range Supabase queries (90+ days).
6. **Break events** stored in `attendance.events` as `BREAK_START` / `BREAK_END`.

## New Features in This Branch

- Cloud-first sync (critical fix)
- Admin attendance history (3 months, filters, CSV/Excel export)
- Employee attendance history (1 month, working hours summary)
- Admin → employee messaging (Normal / Important / Critical)
- Important/Critical popup + sound on employee side
- Centralized notifications (punch, leave, messages)
- Break start / end on attendance
