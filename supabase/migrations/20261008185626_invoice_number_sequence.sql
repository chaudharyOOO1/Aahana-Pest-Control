do $migration$ begin
if to_regclass('public.organizations') is null then return;end if;
execute $ddl$
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

$ddl$;end $migration$;
