-- Run in Supabase SQL Editor after schema.sql

create table if not exists messages (
  id text primary key,
  title text not null,
  body text not null,
  priority text not null default 'Normal',
  scope text not null default 'all',
  sender text not null default 'Admin',
  created_at timestamptz not null default now()
);

create table if not exists message_recipients (
  message_id text not null references messages (id) on delete cascade,
  emp_id text not null,
  read_at timestamptz,
  primary key (message_id, emp_id)
);

create table if not exists message_replies (
  id text primary key,
  message_id text not null references messages (id) on delete cascade,
  emp_id text not null,
  emp_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id text primary key,
  user_kind text not null,
  user_id text not null,
  type text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);

create index if not exists message_recipients_emp_idx on message_recipients (emp_id);
create index if not exists message_replies_message_idx on message_replies (message_id);
create index if not exists notifications_user_idx on notifications (user_kind, user_id, created_at desc);
create index if not exists attendance_emp_date_idx on attendance (emp_id, date desc);

alter table messages enable row level security;
alter table message_recipients enable row level security;
alter table message_replies enable row level security;
alter table notifications enable row level security;

create policy "portal_messages_all" on messages for all using (true) with check (true);
create policy "portal_message_recipients_all" on message_recipients for all using (true) with check (true);
create policy "portal_message_replies_all" on message_replies for all using (true) with check (true);
create policy "portal_notifications_all" on notifications for all using (true) with check (true);

-- Realtime: enable for messages, message_recipients, message_replies, notifications
