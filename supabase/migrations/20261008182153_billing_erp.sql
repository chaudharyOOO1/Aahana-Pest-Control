do $migration$ begin
if to_regclass('public.organizations') is null then return;end if;
execute $ddl$
-- Apply only to the existing Aahana schema after backup and duplicate-receipt review.
alter table public.clients add column if not exists billing_details jsonb not null default '{}'::jsonb;
alter table public.invoices add column if not exists billing_details jsonb not null default '{}'::jsonb;

create table public.erp_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  kind text not null check (kind in ('company_profile','gst_filing','tax_payment','bank_transaction','account_transfer','invoice_delivery')),
  record_key text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  unique (organization_id,kind,record_key)
);
alter table public.erp_records enable row level security;
create policy erp_records_members on public.erp_records for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));
grant select,insert,update,delete on public.erp_records to authenticated;
revoke all on public.erp_records from anon;

-- This fails safely if old duplicate receipt numbers exist. Review them first.
create unique index payments_org_receipt_unique on public.payments (organization_id,lower(btrim(receipt)));

create function public.validate_aahana_payment() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare invoice_row public.invoices%rowtype; received numeric;
begin
  select * into invoice_row from public.invoices
  where id = new.invoice_id and organization_id = new.organization_id for update;
  if not found then raise exception 'Invoice is not accessible in this organization'; end if;
  if new.amount is null or new.amount <= 0 or new.amount <> round(new.amount,2) then
    raise exception 'Payment must be positive and have at most two decimal places';
  end if;
  if new.payment_date < invoice_row.invoice_date or new.payment_date > current_date then
    raise exception 'Payment date must fall between invoice date and today';
  end if;
  if new.receipt is null or btrim(new.receipt) = '' then raise exception 'Receipt number is required'; end if;
  select coalesce(sum(amount),0) into received from public.payments
  where invoice_id = new.invoice_id and organization_id = new.organization_id
    and id is distinct from new.id;
  if received + new.amount > invoice_row.total then raise exception 'Payment exceeds invoice outstanding'; end if;
  return new;
end $$;
revoke all on function public.validate_aahana_payment() from public,anon;
create trigger aahana_payment_checks before insert or update on public.payments
for each row execute function public.validate_aahana_payment();

-- Reserve invoice identities across simultaneous sessions.
-- Invoice identity uniqueness is installed by the subsequent FY sequence migration.
create unique index invoices_monthly_client_unique on public.invoices (organization_id,client_id,(billing_details->>'serviceMonth'))
where billing_details->>'source' = 'monthly';

$ddl$;end $migration$;
