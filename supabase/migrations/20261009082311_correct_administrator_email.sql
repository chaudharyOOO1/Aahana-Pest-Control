-- Use the owner-confirmed verified administrator; preserve private authorization checks.
create or replace function aahana_private.bootstrap_workspace() returns uuid
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid();org_id uuid;
begin
 if owner_id is null or not exists(select 1 from auth.users where id=owner_id and lower(email)='admin@aahanapestcontrol.in' and email_confirmed_at is not null) then raise exception 'Verified Aahana administrator required';end if;
 insert into public.organizations(name,slug) values('Aahana Pest Control','aahana-pest-control') on conflict(slug) do nothing;
 select id into org_id from public.organizations where slug='aahana-pest-control';
 insert into public.organization_members(organization_id,user_id,role) values(org_id,owner_id,'owner') on conflict do nothing;
 insert into public.accounts(organization_id,name,type,opening) values(org_id,'Cash','Cash',0),(org_id,'Bank','Bank',0),(org_id,'UPI / Wallet','UPI',0),(org_id,'Petty Cash','Petty Cash',0) on conflict(organization_id,name) do nothing;
 return org_id;
end $$;
revoke all on function aahana_private.bootstrap_workspace() from public,anon;
