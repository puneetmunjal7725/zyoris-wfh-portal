-- Zyoris WFH Portal — run once in Supabase SQL Editor (free tier)
-- Dashboard: https://supabase.com/dashboard → your project → SQL → New query

create table if not exists employees (
  id text primary key,
  name text not null,
  role text not null default 'Engineer',
  password text not null,
  address text not null default '',
  compensation text not null default '',
  compensation_type text not null default 'Salary',
  photo text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists attendance (
  emp_id text not null references employees (id) on delete cascade,
  emp_name text not null,
  date date not null,
  punch_in timestamptz,
  punch_out timestamptz,
  tasks text not null default '',
  plan text not null default '',
  blocker text not null default '',
  checks jsonb not null default '[]'::jsonb,
  events jsonb not null default '[]'::jsonb,
  primary key (emp_id, date)
);

create table if not exists leaves (
  id text primary key,
  emp_id text not null,
  emp_name text not null,
  type text not null,
  from_date date not null,
  to_date date not null,
  reason text not null default '',
  status text not null default 'PENDING',
  applied_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text
);

create index if not exists leaves_emp_id_idx on leaves (emp_id);
create index if not exists leaves_status_idx on leaves (status);
create index if not exists attendance_date_idx on attendance (date desc);

alter table employees enable row level security;
alter table attendance enable row level security;
alter table leaves enable row level security;

-- Internal tool: anon key can read/write (URL is hidden; tighten later with Auth)
create policy "portal_employees_all" on employees for all using (true) with check (true);
create policy "portal_attendance_all" on attendance for all using (true) with check (true);
create policy "portal_leaves_all" on leaves for all using (true) with check (true);

-- Realtime: Supabase → Database → Replication → enable for these 3 tables
