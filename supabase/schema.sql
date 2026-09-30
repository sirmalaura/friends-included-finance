-- Run once in the Supabase SQL editor. All application access uses the server-side service role.
create table if not exists employees (
  name text primary key,
  role text not null check (role in ('sales','expense','manager'))
);
insert into employees(name, role) values
  ('Richard','sales'),('Anastasia','sales'),('Jean-Claude','sales'),
  ('Kevin','expense'),('Svetlana','manager')
on conflict (name) do update set role=excluded.role;

create table if not exists telegram_links (
  telegram_user_id bigint primary key,
  employee_name text not null references employees(name),
  chat_id bigint not null,
  updated_at timestamptz not null default now()
);

create table if not exists sales (
  reference text primary key,
  submitted_at timestamptz not null default now(),
  salesperson text not null references employees(name),
  customer text not null,
  project text not null check (project in ('A','B')),
  description text not null,
  amount_cents bigint not null check (amount_cents > 0),
  proposed_split integer[] not null check (array_length(proposed_split,1)=3),
  final_split integer[],
  status text not null default 'Pending approval' check (status in ('Pending approval','Approved')),
  source text not null check (source in ('Website','Telegram')),
  original_chat_id bigint,
  decided_at timestamptz,
  sync_status text not null default 'Sync pending' check (sync_status in ('Sync pending','Synced','Sync failed')),
  sync_error text,
  notification_status text not null default 'Not required',
  notification_error text,
  check (final_split is null or array_length(final_split,1)=3)
);

create table if not exists expenses (
  reference text primary key,
  submitted_at timestamptz not null default now(),
  reporter text not null references employees(name),
  description text not null,
  category text not null check (category in ('Materials','Travel','Other')),
  amount_cents bigint not null check (amount_cents > 0),
  proposed_allocation text not null check (proposed_allocation in ('A','B','Company overhead')),
  final_allocation text check (final_allocation in ('A','B','Company overhead')),
  status text not null check (status in ('Awaiting allocation','Allocated')),
  source text not null check (source in ('Website','Telegram')),
  original_chat_id bigint,
  decided_at timestamptz,
  sync_status text not null default 'Sync pending' check (sync_status in ('Sync pending','Synced','Sync failed')),
  sync_error text,
  notification_status text not null default 'Not required',
  notification_error text
);

create index if not exists sales_status_idx on sales(status);
create index if not exists expenses_status_idx on expenses(status);
alter table employees enable row level security;
alter table telegram_links enable row level security;
alter table sales enable row level security;
alter table expenses enable row level security;
-- No anonymous policies: clients cannot bypass the server processing layer.
