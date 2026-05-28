-- Run in SQL Editor if you already created tables (before email column existed)
alter table employees add column if not exists email text not null default '';
