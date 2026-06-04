# WFH Portal v2 — Deployment Report

**Branch:** `feature/wfm-portal-v2-sync-messages`  
**Live URL:** https://zyoris.com/zy-wfh-7k2m/#/login  
**Package command:** `npm run package:zyoris`

## Changed files (application)

| File | Change |
|------|--------|
| `src/state/storage.js` | Cloud-first sync; async writes; messages/notifications API |
| `src/state/supabaseSync.js` | Realtime, range queries, message/notification sync |
| `src/state/activityLog.js` | BREAK_START / BREAK_END labels |
| `src/views/EmployeePortal.jsx` | Async punch/break; history/messages routes |
| `src/views/AdminPortal.jsx` | Attendance history + messages routes; async CRUD |
| `src/views/EmployeeHistoryView.jsx` | Employee 30-day history |
| `src/views/EmployeeMessagesView.jsx` | Employee message center + replies |
| `src/views/AdminAttendanceHistory.jsx` | Admin 90-day history, export |
| `src/views/AdminMessagesView.jsx` | Admin send message UI |
| `src/ui/PortalNotifications.jsx` | Important message modal, nav badges |
| `src/ui/PortalBootstrap.jsx` | Cloud sync badge text |
| `src/ui/EmployeeProfileEditor.jsx` | Async profile save |
| `src/utils/attendanceCalc.js` | Working hours, breaks |
| `src/utils/exportTable.js` | CSV / Excel export |
| `supabase/migration-v2-messages-notifications.sql` | New tables |
| `docs/ANALYSIS_REPORT.md` | Architecture analysis |
| `docs/TESTING_REPORT.md` | Test matrix |

## Database changes

Run in Supabase SQL Editor (in order):

1. `supabase/schema.sql` (if fresh project)
2. `supabase/migration-add-email.sql`
3. `supabase/migration-attendance-events.sql`
4. **`supabase/migration-v2-messages-notifications.sql`** (new)

### New tables

| Table | Purpose |
|-------|---------|
| `messages` | Admin broadcast messages |
| `message_recipients` | Per-employee delivery + read status |
| `message_replies` | Employee replies |
| `notifications` | Centralized notification history |

### Indexes added

- `attendance (date)`, `attendance (emp_id, date)`
- `messages (created_at DESC)`
- `notifications (user_kind, user_id, created_at DESC)`

## New features

1. **Single source of truth** — Supabase is primary; localStorage is cache only
2. **Real-time sync** — Supabase Realtime + 8s polling
3. **Break start/end** on employee attendance
4. **Admin attendance history** — 3 months, filters, CSV/Excel export
5. **Employee attendance history** — 1 month+, working hours total
6. **Admin messaging** — single / multiple / all employees; Normal / Important / Critical
7. **Employee message center** — read, reply, unread badges
8. **Important/Critical popup** + notification sound
9. **Centralized notifications** — punch, leave, admin messages

## Environment

| Variable | Location |
|----------|----------|
| `VITE_SUPABASE_URL` | `.env.production` |
| `VITE_SUPABASE_ANON_KEY` | `.env.production.local` (gitignored) |
| `VITE_DEPLOY_BASE` | `/zy-wfh-7k2m/` |

## Deploy steps

```powershell
cd C:\Users\Puneet\Projects\zyoris-wfh-portal
# Ensure .env.production.local has anon key
npm run package:zyoris
cd ..\website-
git add zy-wfh-7k2m
git commit -m "Deploy WFH portal v2 sync + messages"
git push
```

## Testing results

See [TESTING_REPORT.md](./TESTING_REPORT.md). Build and package scripts pass. Full multi-device testing requires live Supabase with migrations applied.
