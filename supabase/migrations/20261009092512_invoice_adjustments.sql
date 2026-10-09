alter table public.erp_records drop constraint erp_records_kind_check;
alter table public.erp_records add constraint erp_records_kind_check check (kind in ('company_profile','gst_filing','tax_payment','bank_transaction','account_transfer','invoice_delivery','invoice_adjustment'));

create function aahana_private.check_invoice_edit() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.total < (select coalesce(sum(p.amount),0) from public.payments p where p.invoice_id=new.id and p.organization_id=new.organization_id) then
  raise exception 'Invoice total cannot be below recorded receipts';
 end if;
 return new;
end;
$$;
revoke all on function aahana_private.check_invoice_edit() from public,anon,authenticated;
create trigger aahana_invoice_edit_checks before update of total on public.invoices for each row execute function aahana_private.check_invoice_edit();
