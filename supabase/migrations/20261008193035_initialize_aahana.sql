do $initializer$ begin
if to_regclass('public.organizations') is null then
execute $base$

create table public.organizations(id uuid primary key default gen_random_uuid(),name text not null,slug text not null unique);
create table public.organization_members(organization_id uuid not null references public.organizations(id),user_id uuid not null references auth.users(id),role text not null check(role in ('owner','admin')),primary key(organization_id,user_id));
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
create policy members_self on public.organization_members for select to authenticated using(user_id=(select auth.uid()));
create function public.is_org_member(target_org uuid) returns boolean language sql stable security invoker set search_path=public as $$ select exists(select 1 from public.organization_members where organization_id=target_org and user_id=(select auth.uid())); $$;
revoke all on function public.is_org_member(uuid) from public,anon;grant execute on function public.is_org_member(uuid) to authenticated;
create policy organizations_member on public.organizations for select to authenticated using(public.is_org_member(id));
grant select on public.organizations,public.organization_members to authenticated;
create table public.clients(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),name text not null,site text not null default '',contact text not null default '',plan text not null default 'Historical',rule text not null default 'Unspecified',visits integer not null default 0,status text not null default 'Historical',unique(organization_id,id));
alter table public.clients enable row level security;
create policy clients_members on public.clients for all to authenticated using(public.is_org_member(organization_id)) with check(public.is_org_member(organization_id));
grant select,insert,update,delete on public.clients to authenticated;revoke all on public.clients from anon;
create index clients_org on public.clients(organization_id);
create table public.service_plans(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),client_id uuid,name text not null,rule text,completed integer not null default 0,total integer not null default 1,next_date date,unique(organization_id,id));
alter table public.service_plans enable row level security;
create policy service_plans_members on public.service_plans for all to authenticated using(public.is_org_member(organization_id)) with check(public.is_org_member(organization_id));
grant select,insert,update,delete on public.service_plans to authenticated;revoke all on public.service_plans from anon;
create index service_plans_org on public.service_plans(organization_id);
create table public.visits(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),client_id uuid,date date not null,time time,plan text,status text not null default 'due',technician text,unique(organization_id,id));
alter table public.visits enable row level security;
create policy visits_members on public.visits for all to authenticated using(public.is_org_member(organization_id)) with check(public.is_org_member(organization_id));
grant select,insert,update,delete on public.visits to authenticated;revoke all on public.visits from anon;
create index visits_org on public.visits(organization_id);
create table public.visit_reports(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),visit_id uuid,report_date date not null,work text,materials text,client_status text,followup text,unique(organization_id,id));
alter table public.visit_reports enable row level security;
create policy visit_reports_members on public.visit_reports for all to authenticated using(public.is_org_member(organization_id)) with check(public.is_org_member(organization_id));
grant select,insert,update,delete on public.visit_reports to authenticated;revoke all on public.visit_reports from anon;
create index visit_reports_org on public.visit_reports(organization_id);
create table public.jobs(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),client_id uuid,title text not null,due date,assignee text,priority text,status text,notes text,unique(organization_id,id));
alter table public.jobs enable row level security;
create policy jobs_members on public.jobs for all to authenticated using(public.is_org_member(organization_id)) with check(public.is_org_member(organization_id));
grant select,insert,update,delete on public.jobs to authenticated;revoke all on public.jobs from anon;
create index jobs_org on public.jobs(organization_id);
create table public.invoices(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),client_id uuid,invoice_no text not null,invoice_date date not null,taxable numeric not null,gst numeric not null,total numeric not null,unique(organization_id,id));
alter table public.invoices enable row level security;
create policy invoices_members on public.invoices for all to authenticated using(public.is_org_member(organization_id)) with check(public.is_org_member(organization_id));
grant select,insert,update,delete on public.invoices to authenticated;revoke all on public.invoices from anon;
create index invoices_org on public.invoices(organization_id);
create table public.payments(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),invoice_id uuid,receipt text not null,payment_date date not null,amount numeric not null,mode text not null,unique(organization_id,id));
alter table public.payments enable row level security;
create policy payments_members on public.payments for all to authenticated using(public.is_org_member(organization_id)) with check(public.is_org_member(organization_id));
grant select,insert,update,delete on public.payments to authenticated;revoke all on public.payments from anon;
create index payments_org on public.payments(organization_id);
create table public.expenses(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),expense_date date not null,category text,vendor text,description text,account text,amount numeric not null,gst numeric not null default 0,receipt text,unique(organization_id,id));
alter table public.expenses enable row level security;
create policy expenses_members on public.expenses for all to authenticated using(public.is_org_member(organization_id)) with check(public.is_org_member(organization_id));
grant select,insert,update,delete on public.expenses to authenticated;revoke all on public.expenses from anon;
create index expenses_org on public.expenses(organization_id);
create table public.accounts(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),name text not null,type text not null,opening numeric not null default 0,unique(organization_id,name),unique(organization_id,id));
alter table public.accounts enable row level security;
create policy accounts_members on public.accounts for all to authenticated using(public.is_org_member(organization_id)) with check(public.is_org_member(organization_id));
grant select,insert,update,delete on public.accounts to authenticated;revoke all on public.accounts from anon;
create index accounts_org on public.accounts(organization_id);
create table public.owner_capital(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),capital_date date not null,amount numeric not null,mode text not null,unique(organization_id,id));
alter table public.owner_capital enable row level security;
create policy owner_capital_members on public.owner_capital for all to authenticated using(public.is_org_member(organization_id)) with check(public.is_org_member(organization_id));
grant select,insert,update,delete on public.owner_capital to authenticated;revoke all on public.owner_capital from anon;
create index owner_capital_org on public.owner_capital(organization_id);
create table public.vendors(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),name text not null,contact text,gstin text,unique(organization_id,id));
alter table public.vendors enable row level security;
create policy vendors_members on public.vendors for all to authenticated using(public.is_org_member(organization_id)) with check(public.is_org_member(organization_id));
grant select,insert,update,delete on public.vendors to authenticated;revoke all on public.vendors from anon;
create index vendors_org on public.vendors(organization_id);
create table public.vendor_bills(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),vendor_id uuid,bill_no text,bill_date date not null,amount numeric not null,gst numeric not null default 0,description text,unique(organization_id,id));
alter table public.vendor_bills enable row level security;
create policy vendor_bills_members on public.vendor_bills for all to authenticated using(public.is_org_member(organization_id)) with check(public.is_org_member(organization_id));
grant select,insert,update,delete on public.vendor_bills to authenticated;revoke all on public.vendor_bills from anon;
create index vendor_bills_org on public.vendor_bills(organization_id);
create table public.vendor_payments(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),vendor_id uuid,payment_date date not null,amount numeric not null,mode text not null,unique(organization_id,id));
alter table public.vendor_payments enable row level security;
create policy vendor_payments_members on public.vendor_payments for all to authenticated using(public.is_org_member(organization_id)) with check(public.is_org_member(organization_id));
grant select,insert,update,delete on public.vendor_payments to authenticated;revoke all on public.vendor_payments from anon;
create index vendor_payments_org on public.vendor_payments(organization_id);
alter table public.service_plans add foreign key(organization_id,client_id) references public.clients(organization_id,id);
alter table public.visits add foreign key(organization_id,client_id) references public.clients(organization_id,id);
alter table public.visit_reports add foreign key(organization_id,visit_id) references public.visits(organization_id,id);
alter table public.jobs add foreign key(organization_id,client_id) references public.clients(organization_id,id);
alter table public.invoices add foreign key(organization_id,client_id) references public.clients(organization_id,id);
alter table public.payments add foreign key(organization_id,invoice_id) references public.invoices(organization_id,id);
alter table public.vendor_bills add foreign key(organization_id,vendor_id) references public.vendors(organization_id,id);
alter table public.vendor_payments add foreign key(organization_id,vendor_id) references public.vendors(organization_id,id);

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

-- Historical invoice numbers stay exactly as issued; their actual invoice date
-- determines the internal April–March financial year, independently of the prefix.
create function public.aahana_financial_year(d date) returns text
language sql immutable strict security invoker set search_path = '' as $$
 select y::text || '-' || right((y+1)::text,2)
 from (select extract(year from d)::integer - case when extract(month from d)<4 then 1 else 0 end as y) years;
$$;
revoke all on function public.aahana_financial_year(date) from public,anon;
grant execute on function public.aahana_financial_year(date) to authenticated;
drop index if exists public.invoices_org_number_unique;
create unique index invoices_org_year_number_unique on public.invoices
(organization_id,public.aahana_financial_year(invoice_date),lower(btrim(invoice_no)));

create schema if not exists aahana_private;
revoke all on schema aahana_private from public,anon,authenticated;
create table aahana_private.invoice_sequences (
 organization_id uuid not null references public.organizations(id),
 financial_year text not null,
 last_number integer not null check(last_number between 0 and 9999),
 primary key(organization_id,financial_year)
);
alter table aahana_private.invoice_sequences enable row level security;
revoke all on aahana_private.invoice_sequences from public,anon,authenticated;

-- Definer is limited to the private, non-API trigger because callers must not
-- have permission to reset or forge the shared counter. Membership is explicit.
create function aahana_private.assign_invoice_number() returns trigger
language plpgsql security definer set search_path = '' as $$
declare fy text; prefix text; existing_number text; previous numeric; assigned integer;
begin
 if not public.is_org_member(new.organization_id) then
  raise exception 'Organization access required';
 end if;
 if new.invoice_date is null then raise exception 'Invoice date is required'; end if;
 fy := public.aahana_financial_year(new.invoice_date);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.organization_id::text || ':' || fy,0));
 -- A lost response followed by UUID upsert must not allocate another number.
 select invoice_no into existing_number from public.invoices
 where id=new.id and organization_id=new.organization_id;
 if found then new.invoice_no:=existing_number;return new;end if;
 if new.billing_details->>'numbering' is distinct from 'automatic' then
  -- Reviewed historical imports retain the number printed on the source bill.
  return new;
 end if;
 prefix:=coalesce(nullif(btrim(new.billing_details->'company'->>'prefix'),''),nullif(btrim(new.billing_details->>'invoicePrefix'),''),'APC');
 if prefix !~ '^[A-Za-z0-9-]{1,3}$' then raise exception 'Invalid invoice prefix';end if;
 select coalesce(max(substring(invoice_no from '([0-9]+)$')::numeric),0) into previous
 from public.invoices where organization_id=new.organization_id
 and public.aahana_financial_year(invoice_date)=fy;
 insert into aahana_private.invoice_sequences(organization_id,financial_year,last_number)
 values(new.organization_id,fy,0) on conflict do nothing;
 select greatest(last_number,previous) into previous
 from aahana_private.invoice_sequences where organization_id=new.organization_id and financial_year=fy for update;
 if previous>=9999 then raise exception 'Invoice sequence is full for this financial year';end if;
 assigned:=previous::integer+1;
 update aahana_private.invoice_sequences set last_number=assigned
 where organization_id=new.organization_id and financial_year=fy;
 new.invoice_no:=prefix || '/' || fy || '/' || lpad(assigned::text,4,'0');
 return new;
end $$;
revoke all on function aahana_private.assign_invoice_number() from public,anon,authenticated;
create trigger aahana_assign_invoice_number before insert on public.invoices
for each row execute function aahana_private.assign_invoice_number();

create function aahana_private.preserve_invoice_identity() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 if new.invoice_no is distinct from old.invoice_no or new.invoice_date is distinct from old.invoice_date
 or new.organization_id is distinct from old.organization_id then
  raise exception 'Issued invoice number, date and organization cannot be amended';
 end if;
 return new;
end $$;
revoke all on function aahana_private.preserve_invoice_identity() from public,anon,authenticated;
create trigger aahana_preserve_invoice_identity before update on public.invoices
for each row execute function aahana_private.preserve_invoice_identity();

$base$;
end if;end $initializer$;

create unique index if not exists clients_org_id_identity_unique on public.clients(organization_id,id);
create table public.historical_billing (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 client_id uuid not null,source_sha256 text not null,source_key text not null,
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 unique(organization_id,source_sha256,source_key),
 foreign key(organization_id,client_id) references public.clients(organization_id,id)
);
alter table public.historical_billing enable row level security;
create policy historical_billing_read on public.historical_billing for select to authenticated using(public.is_org_member(organization_id));
grant select on public.historical_billing to authenticated;
revoke insert,update,delete on public.historical_billing from authenticated;
revoke all on public.historical_billing from anon;
create index historical_billing_org on public.historical_billing(organization_id);

-- Narrow private bootstrap: only the verified fixed business administrator.
create function aahana_private.bootstrap_workspace() returns uuid
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid();org_id uuid;
begin
 if owner_id is null or not exists(select 1 from auth.users where id=owner_id and lower(email)='admin@aahanapestcontrol.com' and email_confirmed_at is not null) then raise exception 'Verified Aahana administrator required';end if;
 insert into public.organizations(name,slug) values('Aahana Pest Control','aahana-pest-control') on conflict(slug) do nothing;
 select id into org_id from public.organizations where slug='aahana-pest-control';
 insert into public.organization_members(organization_id,user_id,role) values(org_id,owner_id,'owner') on conflict do nothing;
 insert into public.accounts(organization_id,name,type,opening) values(org_id,'Cash','Cash',0),(org_id,'Bank','Bank',0),(org_id,'UPI / Wallet','UPI',0),(org_id,'Petty Cash','Petty Cash',0) on conflict(organization_id,name) do nothing;
 return org_id;
end $$;
revoke all on function aahana_private.bootstrap_workspace() from public,anon;
grant usage on schema aahana_private to authenticated;
grant execute on function aahana_private.bootstrap_workspace() to authenticated;
create function public.bootstrap_aahana_workspace() returns uuid language sql security invoker set search_path='' as $$ select aahana_private.bootstrap_workspace(); $$;
revoke all on function public.bootstrap_aahana_workspace() from public,anon;
grant execute on function public.bootstrap_aahana_workspace() to authenticated;
