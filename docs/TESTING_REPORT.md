# WFH Portal v2 — Testing Report

**Branch:** `feature/wfm-portal-v2-sync-messages`  
**Date:** 2026-05-29  
**Build:** `npm run build` — passed (95 modules, no errors)

## Automated checks

| Check | Result |
|-------|--------|
| Production build (`vite build`) | Pass |
| Package script (`npm run package:zyoris`) | Pass — copied to `website-/zy-wfh-7k2m` |

## Test cases

### 1. Cloud-first sync (critical)

| # | Scenario | Expected | Code path verified |
|---|----------|----------|-------------------|
| 1.1 | Employee punch in on mobile | Row upserted to Supabase, then `replaceFromCloud()` | `updateAttendance` → `syncAttendanceRow` → await cloud |
| 1.2 | Admin opens laptop within 8s | Same punch visible on Overview | `refreshFromCloud` interval + realtime subscription |
| 1.3 | Employee on tablet refreshes | Identical attendance | `initPortalDb` loads cloud first |
| 1.4 | Punch out with tasks | All devices show punch out | Async `mutateAttendance` + admin `notifyPunch` |

**Manual verification required:** Log in as same employee on 3 browsers/devices and confirm punch times match after each action.

### 2. Break tracking

| # | Scenario | Expected |
|---|----------|----------|
| 2.1 | Break Start while punched in | `BREAK_START` event in `attendance.events` |
| 2.2 | Break End | `BREAK_END` event; working hours exclude break time |
| 2.3 | Cross-device | Break state visible via cloud refresh |

### 3. Attendance history

| # | Scenario | Expected |
|---|----------|----------|
| 3.1 | Admin → Attendance | Default 90-day range, employee filter, search |
| 3.2 | Export CSV / Excel | File downloads with correct columns |
| 3.3 | Employee → History | 30-day default, total working hours summary |
| 3.4 | Historical records | Loaded via `fetchAttendanceRange` from Supabase |

**Prerequisite:** Run `supabase/migration-v2-messages-notifications.sql` and prior migrations in Supabase SQL Editor.

### 4. Messaging

| # | Scenario | Expected |
|---|----------|----------|
| 4.1 | Admin sends to all | Message + recipients in DB |
| 4.2 | Important/Critical | Employee popup + bell sound |
| 4.3 | Normal priority | Message center only (no popup) |
| 4.4 | Employee reply | Reply stored in `message_replies` |
| 4.5 | Read status | `message_recipients.read_at` updated |

### 5. Notifications

| # | Trigger | Recipient |
|---|---------|-----------|
| 5.1 | Punch in/out | Admin |
| 5.2 | Leave request | Admin |
| 5.3 | Leave approve/reject | Employee |
| 5.4 | Important/Critical message | Employee |

### 6. Leaves & employees

| # | Scenario | Expected |
|---|----------|----------|
| 6.1 | Employee submit leave | Cloud write + admin notification |
| 6.2 | Admin approve/reject | Employee notification |
| 6.3 | Add employee | Awaited cloud sync |

### 7. Multi-user concurrency

| # | Scenario | Expected |
|---|----------|----------|
| 7.1 | Two employees punch in simultaneously | Separate `(emp_id, date)` rows, no overwrite |
| 7.2 | Realtime postgres_changes | Triggers refresh on other tabs |

## Known limitations

- **No backend server** — security relies on Supabase RLS; anon key is public in built bundle.
- **Employee passwords** stored in plaintext in DB (existing design).
- **Realtime** requires Supabase Realtime enabled on tables.
- **Migration v2** must be applied manually before messages/notifications work.

## Recommended manual test script

1. Run SQL migrations in Supabase dashboard.
2. Set `VITE_SUPABASE_ANON_KEY` in `.env.production.local` and rebuild.
3. Admin: add test employee if needed.
4. Employee A: punch in from Chrome mobile emulation.
5. Admin: refresh Overview — confirm punch in within 8s.
6. Employee A: punch out from Firefox.
7. Admin: open Attendance history — export CSV.
8. Admin: send Critical message to Employee A.
9. Employee A: confirm popup + sound; reply from Messages.
10. Employee A: submit leave; admin approve; confirm employee notification.
