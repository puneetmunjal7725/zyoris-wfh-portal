-- Run once in Supabase SQL Editor (fixes "Could not find table public.messages")
-- https://supabase.com/dashboard/project/qbtzjpcdutjnjhpqqfwr/sql/new

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

alter table messages enable row level security;
alter table message_recipients enable row level security;
alter table message_replies enable row level security;
alter table notifications enable row level security;

drop policy if exists "portal_messages_all" on messages;
drop policy if exists "portal_message_recipients_all" on message_recipients;
drop policy if exists "portal_message_replies_all" on message_replies;
drop policy if exists "portal_notifications_all" on notifications;

create policy "portal_messages_all" on messages for all using (true) with check (true);
create policy "portal_message_recipients_all" on message_recipients for all using (true) with check (true);
create policy "portal_message_replies_all" on message_replies for all using (true) with check (true);
create policy "portal_notifications_all" on notifications for all using (true) with check (true);

grant all on table messages to anon, authenticated, service_role;
grant all on table message_recipients to anon, authenticated, service_role;
grant all on table message_replies to anon, authenticated, service_role;
grant all on table notifications to anon, authenticated, service_role;

notify pgrst, 'reload schema';
