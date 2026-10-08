set role authenticated;
set test.user_id='00000000-0000-4000-8000-000000000003';
insert into invoices(id,organization_id,invoice_date,total,invoice_no,billing_details) values
(gen_random_uuid(),'00000000-0000-4000-8000-000000000001','2025-05-01',100,'UT/25-26/87','{}'),
(gen_random_uuid(),'00000000-0000-4000-8000-000000000001','2026-05-01',100,'UT/25-26/87','{}');
-- Same issued text across actual financial years is preserved, never rewritten.
do $$declare saved public.invoices%rowtype;last integer;begin
 if (select count(*) from public.invoices where invoice_no='UT/25-26/87')<>2 then raise exception 'Historical numbers changed';end if;
 insert into public.invoices(id,organization_id,invoice_date,total,invoice_no,billing_details)
 values('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000001','2026-10-01',100,'DRAFT-retry','{"numbering":"automatic","company":{"prefix":"APC"}}') returning * into saved;
 if saved.invoice_no<>'APC/2026-27/0088' then raise exception 'Historical sequence not continued: %',saved.invoice_no;end if;
 insert into public.invoices(id,organization_id,invoice_date,total,invoice_no,billing_details)
 values('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000001','2026-10-01',100,'DRAFT-retry','{"numbering":"automatic","company":{"prefix":"APC"}}') on conflict(id) do nothing;
 insert into public.invoices(id,organization_id,invoice_date,total,invoice_no,billing_details)
 values(gen_random_uuid(),'00000000-0000-4000-8000-000000000001','2026-10-01',100,'DRAFT-next','{"numbering":"automatic","company":{"prefix":"UT"}}') returning * into saved;
 if saved.invoice_no<>'UT/2026-27/0089' then raise exception 'Retry consumed a number or prefix split sequence';end if;
 insert into public.invoices(id,organization_id,invoice_date,total,invoice_no,billing_details)
 values(gen_random_uuid(),'00000000-0000-4000-8000-000000000001','2026-03-31',100,'DRAFT-march','{"numbering":"automatic"}') returning * into saved;
 if saved.invoice_no<>'APC/2025-26/0088' then raise exception 'March year is incorrect';end if;
 insert into public.invoices(id,organization_id,invoice_date,total,invoice_no,billing_details)
 values(gen_random_uuid(),'00000000-0000-4000-8000-000000000001','2027-04-01',100,'DRAFT-april','{"numbering":"automatic"}') returning * into saved;
 if saved.invoice_no<>'APC/2027-28/0001' then raise exception 'April sequence did not reset';end if;
 begin update public.invoices set invoice_no='Changed' where id='00000000-0000-4000-8000-000000000007';raise exception 'Amendment accepted';exception when raise_exception then if SQLERRM<>'Issued invoice number, date and organization cannot be amended' then raise;end if;end;
 begin insert into public.invoices(id,organization_id,invoice_date,total,invoice_no,billing_details) values(gen_random_uuid(),'00000000-0000-4000-8000-000000000001','2026-07-01',100,'UT/25-26/87','{}');raise exception 'Same-year duplicate accepted';exception when unique_violation then null;end;
 begin update aahana_private.invoice_sequences set last_number=0;raise exception 'Counter reset accepted';exception when insufficient_privilege then null;end;
 begin insert into public.invoices(id,organization_id,invoice_date,total,invoice_no,billing_details) values(gen_random_uuid(),'00000000-0000-4000-8000-000000000002','2026-07-01',100,'DRAFT-other-org','{"numbering":"automatic"}');raise exception 'Cross-org allocation accepted';exception when raise_exception then if SQLERRM<>'Organization access required' then raise;end if;end;
end $$;
select 'Sequence checks passed: historical preservation, FY uniqueness, seeded numbering, shared prefixes, idempotent retry, year rollover and authorization.';
