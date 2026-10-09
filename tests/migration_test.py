"""Apply the migration to a disposable Postgres container; no remote database access."""
import os,subprocess,time,uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
name='aahana-sql-test-'+uuid.uuid4().hex[:10]
env={k:v for k,v in os.environ.items() if k not in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']}
docker=['docker','--host=unix:///var/run/docker.sock']
def run(args,sql=None,check=True):
    result=subprocess.run(docker+args,input=sql,text=True,capture_output=True,env=env)
    if check and result.returncode: raise RuntimeError(result.stderr or result.stdout)
    return result
def psql(sql):
    return run(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1'],sql).stdout
bootstrap="""
create role authenticated;
create role anon;
create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user_id',true),'')::uuid$$;
create table organizations(id uuid primary key);
create table organization_members(organization_id uuid,user_id uuid);
create function is_org_member(target_org uuid) returns boolean language sql stable security invoker set search_path=public as $$
 select exists(select 1 from organization_members where organization_id=target_org and user_id=current_setting('test.user_id')::uuid)
$$;
create table clients(id uuid primary key,organization_id uuid);
create table invoices(id uuid primary key,organization_id uuid,invoice_date date not null,total numeric not null,invoice_no text,client_id uuid);
create table payments(id uuid primary key,organization_id uuid,invoice_id uuid,payment_date date not null,amount numeric not null,receipt text);
grant usage on schema public to authenticated;
grant select on organization_members to authenticated;
grant select,insert,update on invoices,payments to authenticated;
alter table invoices enable row level security;
alter table payments enable row level security;
create policy invoices_members on invoices to authenticated using(is_org_member(organization_id)) with check(is_org_member(organization_id));
create policy payments_members on payments to authenticated using(is_org_member(organization_id)) with check(is_org_member(organization_id));
insert into organizations values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
insert into organization_members values('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003');
insert into invoices(id,organization_id,invoice_date,total) values('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001',current_date-10,118);
"""
checks="""
set role authenticated;
set test.user_id='00000000-0000-4000-8000-000000000003';
insert into erp_records(organization_id,kind,record_key,payload) values('00000000-0000-4000-8000-000000000001','company_profile','company','{"name":"Aahana"}');
insert into payments values('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004',current_date,50,'REC-001');
do $$begin
 begin insert into payments values(gen_random_uuid(),'00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004',current_date,100,'REC-002');raise exception 'overpayment accepted';exception when raise_exception then if SQLERRM<>'Payment exceeds invoice outstanding' then raise;end if;end;
 begin insert into payments values(gen_random_uuid(),'00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004',current_date,1,' rec-001 ');raise exception 'duplicate accepted';exception when unique_violation then null;end;
 begin insert into erp_records(organization_id,kind,record_key,payload) values('00000000-0000-4000-8000-000000000002','company_profile','company','{}');raise exception 'cross-org insert accepted';exception when insufficient_privilege then null;end;
 begin insert into payments values(gen_random_uuid(),'00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004',current_date+1,1,'REC-003');raise exception 'future payment accepted';exception when raise_exception then if SQLERRM<>'Payment date must fall between invoice date and today' then raise;end if;end;
end $$;
select 'Migration checks passed: payment limits, receipt uniqueness, payment dates and organization isolation.';
"""
try:
    run(['run','-d','--name',name,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine'])
    for attempt in range(40):
        if run(['exec',name,'sh','-c','test "$(head -n 1 /var/lib/postgresql/data/postmaster.pid 2>/dev/null)" = 1 && pg_isready -U postgres'],check=False).returncode==0:break
        time.sleep(.25)
    else:raise RuntimeError('Disposable Postgres did not start')
    psql(bootstrap)
    for file in sorted((ROOT/'supabase/migrations').glob('*.sql')):psql(file.read_text())
    run(['exec',name,'createdb','-U','postgres','aahana_fresh'])
    def fresh(sql):return run(['exec','-i',name,'psql','-U','postgres','-d','aahana_fresh','-v','ON_ERROR_STOP=1'],sql).stdout
    fresh("create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user_id',true),'')::uuid$$;")
    fresh('grant usage on schema auth to authenticated;')
    fresh("create function public.rls_auto_enable() returns event_trigger language plpgsql security definer as $$begin return;end$$;create event trigger test_platform_rls on ddl_command_end execute function public.rls_auto_enable();grant execute on function public.rls_auto_enable() to anon,authenticated;")
    for file in sorted((ROOT/'supabase/migrations').glob('*.sql')):fresh(file.read_text())
    fresh("do $$begin if has_function_privilege('anon','public.rls_auto_enable()','EXECUTE') or has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE') then raise exception 'Platform event trigger exposed to clients';end if;end$$;create table public.trigger_smoke_test(id int);drop table public.trigger_smoke_test;")
    print('Platform trigger checks passed: client EXECUTE revoked, event trigger still runs for DDL.')
    fresh("insert into auth.users values('00000000-0000-4000-8000-000000000003','admin@aahanapestcontrol.in',now()),('00000000-0000-4000-8000-000000000009','other@example.test',now());set role authenticated;set test.user_id='00000000-0000-4000-8000-000000000003';select public.bootstrap_aahana_workspace();select public.bootstrap_aahana_workspace();do $$begin if (select count(*) from public.organization_members)<>1 or (select count(*) from public.accounts)<>4 then raise exception 'Bootstrap duplicates';end if;end $$;")
    fresh("set role authenticated;set test.user_id='00000000-0000-4000-8000-000000000009';do $$begin begin perform public.bootstrap_aahana_workspace();raise exception 'Unauthorized bootstrap accepted';exception when raise_exception then if SQLERRM<>'Verified Aahana administrator required' then raise;end if;end;end $$;")
    import_file=Path(os.environ['AAHANA_PRIVATE_IMPORT_SQL']) if os.environ.get('AAHANA_PRIVATE_IMPORT_SQL') else None
    if import_file is not None and import_file.exists():
        fresh(import_file.read_text());fresh(import_file.read_text())
        fresh("do $$begin if (select count(*) from public.historical_billing)<>185 or (select count(*) from public.clients)<>33 then raise exception 'Historical import mismatch or replay duplicates';end if;end $$;")
        print('Private workbook import passed locally: 185 original rows, 33 linked clients, replay without duplicates.')
    print('Fresh-project checks passed: complete schema, idempotent admin bootstrap and non-admin denial.')
    print(psql(checks))
    print(psql((ROOT/'tests/invoice_sequence_checks.sql').read_text()))
    concurrent_sql="""set role authenticated;
set test.user_id='00000000-0000-4000-8000-000000000003';
insert into public.invoices(id,organization_id,invoice_date,total,invoice_no,billing_details)
values(gen_random_uuid(),'00000000-0000-4000-8000-000000000001','2026-10-01',100,'DRAFT-concurrent','{"numbering":"automatic"}') returning invoice_no;"""
    with ThreadPoolExecutor(max_workers=8) as pool:
        results=list(pool.map(lambda _:psql(concurrent_sql),range(8)))
    numbers=[line.strip() for output in results for line in output.splitlines() if line.strip().startswith('APC/')]
    assert len(numbers)==8 and len(set(numbers))==8, numbers
    assert sorted(int(n.rsplit('/',1)[1]) for n in numbers)==list(range(90,98)),numbers
    print('Concurrent allocation checks passed: 8 simultaneous saves got distinct consecutive numbers.')
finally:
    run(['rm','-f',name],check=False)
