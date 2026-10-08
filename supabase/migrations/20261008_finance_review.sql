-- Apply in Supabase SQL editor before deploying the finance-review features.
-- Adds metadata only; no existing business records are imported or reclassified.
begin;
-- Use the existing referenced key types rather than assuming UUID keys.
do $migration$
declare
  client_type text;
  organization_type text;
  client_type_id oid;
  organization_type_id oid;
  existing_type_id oid;
begin
  select format_type(atttypid, atttypmod), atttypid
    into client_type, client_type_id
    from pg_attribute
    where attrelid = 'public.clients'::regclass
      and attname = 'id' and not attisdropped;
  select format_type(atttypid, atttypmod), atttypid
    into organization_type, organization_type_id
    from pg_attribute
    where attrelid = 'public.organizations'::regclass
      and attname = 'id' and not attisdropped;
  if client_type is null or organization_type is null then
    raise exception 'Referenced id columns were not found';
  end if;

  select atttypid into existing_type_id from pg_attribute
    where attrelid = 'public.expenses'::regclass
      and attname = 'client_id' and not attisdropped;
  if existing_type_id is not null and existing_type_id <> client_type_id then
    raise exception 'Existing expenses.client_id has a different type; review it before changing any data';
  end if;
  execute format(
    'alter table public.expenses add column if not exists client_id %s references public.clients(id)',
    client_type
  );
  alter table public.expenses add column if not exists allocations jsonb not null default '[]'::jsonb;

  execute format($ddl$
    create table if not exists public.bank_transactions (
      id uuid primary key default gen_random_uuid(),
      organization_id %s not null references public.organizations(id),
      account_name text not null,
      fingerprint text not null,
      transaction_date date not null,
      description text not null default '',
      reference text not null default '',
      amount numeric(18,2) not null check(amount <> 0),
      note text not null default '',
      review jsonb not null default '{}'::jsonb,
      unique(organization_id, account_name, fingerprint)
    )
  $ddl$, organization_type);

  select atttypid into existing_type_id from pg_attribute
    where attrelid = 'public.bank_transactions'::regclass
      and attname = 'organization_id' and not attisdropped;
  if existing_type_id is distinct from organization_type_id then
    raise exception 'Existing bank_transactions.organization_id has a different type; review it before changing any data';
  end if;
end
$migration$;
alter table public.bank_transactions enable row level security;
revoke all on public.bank_transactions from anon;
grant select, insert, update, delete on public.bank_transactions to authenticated;
-- Inline membership check uses the existing organization_members security model.
-- It also enforces the owner-selected admin email, with no public signup reliance.
drop policy if exists aahana_bank_owner on public.bank_transactions;
create policy aahana_bank_owner on public.bank_transactions for all to authenticated
 using (
  lower(auth.jwt()->>'email') = 'admin@aahanapestcontrol.com'
  and exists(select 1 from public.organization_members m
   where m.organization_id=bank_transactions.organization_id
   and m.user_id=auth.uid() and m.role='owner')
 )
 with check (
  lower(auth.jwt()->>'email') = 'admin@aahanapestcontrol.com'
  and exists(select 1 from public.organization_members m
   where m.organization_id=bank_transactions.organization_id
   and m.user_id=auth.uid() and m.role='owner')
 );
commit;
