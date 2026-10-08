-- Run in the Supabase SQL editor. Read-only: returns configuration metadata,
-- not passwords, tokens, or client/financial records. No changes are applied.
begin transaction read only;

with expected(table_name) as (
  values ('organizations'), ('organization_members'), ('clients'),
    ('service_plans'), ('visits'), ('visit_reports'), ('jobs'), ('invoices'),
    ('payments'), ('expenses'), ('accounts'), ('owner_capital'), ('vendors'),
    ('vendor_bills'), ('vendor_payments')
), tables as (
  select e.table_name,
    c.oid is not null as exists,
    coalesce(c.relrowsecurity, false) as rls_enabled,
    (select count(*) from pg_policy p where p.polrelid = c.oid) as policy_count
  from expected e
  left join pg_namespace n on n.nspname = 'public'
  left join pg_class c on c.relnamespace = n.oid and c.relname = e.table_name
    and c.relkind in ('r', 'p')
), admin as (
  select count(*) as matching_users,
    coalesce(bool_or(email_confirmed_at is not null), false) as email_confirmed
  from auth.users where lower(email) = 'admin@aahanapestcontrol.com'
)
select jsonb_build_object(
  'admin', (select to_jsonb(a) from admin a),
  'tables', (select jsonb_agg(to_jsonb(t) order by table_name) from tables t),
  'policies', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
    from (select tablename, policyname, roles, cmd, qual, with_check
      from pg_policies where schemaname = 'public'
      and tablename in (select table_name from expected)
      order by tablename, policyname) p),
  'membership_functions', (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb)
    from (select p.proname as name, p.prosecdef as security_definer,
      pg_get_function_arguments(p.oid) as arguments
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'is_org_member') f)
) as readiness_audit;

rollback;
