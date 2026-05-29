alter table attendance add column if not exists events jsonb not null default '[]'::jsonb;
