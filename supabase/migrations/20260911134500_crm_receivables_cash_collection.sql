alter table public.website_crm_billing_invoices
  add column if not exists amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0),
  add column if not exists last_payment_at timestamptz;

update public.website_crm_billing_invoices
set amount_paid = case when status = 'paid' then total_amount else least(amount_paid, total_amount) end
where status = 'paid' or amount_paid > total_amount;

create table if not exists public.website_crm_payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.website_crm_client_accounts(id) on delete cascade,
  reference text not null unique,
  external_reference text,
  status text not null default 'received' check (status in ('pending','received','reversed')),
  method text not null default 'bank_transfer' check (method in ('bank_transfer','card','mobile_money','paypal','cash','cheque','other')),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'XOF' check (char_length(currency) = 3),
  received_at timestamptz,
  payer_name text,
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_crm_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.website_crm_payments(id) on delete cascade,
  invoice_id uuid not null references public.website_crm_billing_invoices(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  created_by text,
  created_at timestamptz not null default now(),
  unique(payment_id, invoice_id)
);

create table if not exists public.website_crm_collection_promises (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.website_crm_client_accounts(id) on delete cascade,
  invoice_id uuid references public.website_crm_billing_invoices(id) on delete set null,
  status text not null default 'open' check (status in ('open','kept','missed','cancelled')),
  promised_date date not null,
  promised_amount numeric(14,2) not null check (promised_amount > 0),
  currency text not null default 'XOF' check (char_length(currency) = 3),
  owner text,
  notes text,
  kept_at timestamptz,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_crm_collection_settings (
  id text primary key default 'default',
  enabled boolean not null default false,
  unallocated_after_days integer not null default 2 check (unallocated_after_days between 0 and 90),
  promise_grace_days integer not null default 1 check (promise_grace_days between 0 and 30),
  aging_alert_days integer not null default 30 check (aging_alert_days between 1 and 365),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.website_crm_collection_settings (id)
values ('default')
on conflict (id) do nothing;

create table if not exists public.website_crm_collection_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_key text not null unique,
  trigger_type text not null check (trigger_type in ('unallocated_payment','promise_missed','aging_balance')),
  source_id uuid,
  status text not null default 'success' check (status in ('success','skipped','failed')),
  summary text,
  created_at timestamptz not null default now()
);

create index if not exists website_crm_payments_client_idx on public.website_crm_payments(client_id, status, received_at desc);
create index if not exists website_crm_payments_reference_idx on public.website_crm_payments(reference);
create index if not exists website_crm_payment_allocations_payment_idx on public.website_crm_payment_allocations(payment_id, created_at);
create index if not exists website_crm_payment_allocations_invoice_idx on public.website_crm_payment_allocations(invoice_id, created_at);
create index if not exists website_crm_collection_promises_due_idx on public.website_crm_collection_promises(status, promised_date);
create index if not exists website_crm_collection_promises_client_idx on public.website_crm_collection_promises(client_id, status, promised_date);
create index if not exists website_crm_collection_runs_created_idx on public.website_crm_collection_runs(created_at desc);

alter table public.website_crm_payments enable row level security;
alter table public.website_crm_payment_allocations enable row level security;
alter table public.website_crm_collection_promises enable row level security;
alter table public.website_crm_collection_settings enable row level security;
alter table public.website_crm_collection_runs enable row level security;

revoke all on public.website_crm_payments from anon, authenticated;
revoke all on public.website_crm_payment_allocations from anon, authenticated;
revoke all on public.website_crm_collection_promises from anon, authenticated;
revoke all on public.website_crm_collection_settings from anon, authenticated;
revoke all on public.website_crm_collection_runs from anon, authenticated;
grant all on public.website_crm_payments to service_role;
grant all on public.website_crm_payment_allocations to service_role;
grant all on public.website_crm_collection_promises to service_role;
grant all on public.website_crm_collection_settings to service_role;
grant all on public.website_crm_collection_runs to service_role;

comment on table public.website_crm_payments is
  'Internal cash-receipt register for explicit payments received by MOONY. No payment is inferred from usage, health, demographic or browsing data.';
comment on table public.website_crm_payment_allocations is
  'Human-validated allocation of a received payment to an invoice. Allocations drive invoice amount_paid and settlement state.';
comment on table public.website_crm_collection_promises is
  'Internal payment commitments recorded after an explicit client or finance interaction. A promise never triggers automatic client communication.';
comment on table public.website_crm_collection_settings is
  'Human-controlled internal receivables alerts. Disabled by default; alerts are for the MOONY team only.';
comment on table public.website_crm_collection_runs is
  'Idempotency history for internal receivables and cash-collection alerts.';
