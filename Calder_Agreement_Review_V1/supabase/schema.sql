-- Run this entire file in Supabase: SQL Editor > New query > Run.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'submitter' check (role in ('submitter','reviewer','approver','administrator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''), '@', 1)),
    'submitter'
  ) on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.profiles (id, full_name, role)
select id, coalesce(raw_user_meta_data->>'full_name', split_part(coalesce(email,''), '@', 1)), 'submitter'
from auth.users on conflict (id) do nothing;

create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'submitter');
$$;

create or replace function public.assign_user_role(target_user uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_user_role() <> 'administrator' then
    raise exception 'Administrator access required';
  end if;
  if new_role not in ('submitter','reviewer','approver','administrator') then
    raise exception 'Invalid role';
  end if;
  update public.profiles set role=new_role, updated_at=now()
  where id=target_user;
end; $$;

revoke update on public.profiles from authenticated;
grant update (full_name, updated_at) on public.profiles to authenticated;
grant execute on function public.assign_user_role(uuid,text) to authenticated;

create table if not exists public.agreements (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  vendor text not null,
  agreement_type text not null check (agreement_type in ('Software Subscription','Professional Services','Licensing','Logistics and Freight','Data Processing Addendum','Mutual NDA','Other')),
  business_unit text not null,
  needed_by date not null,
  filename text not null,
  storage_key text,
  status text not null default 'ready_for_review',
  playbook_version text not null default 'Global v1',
  review_cycle integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Change Notice 1 uses Calder's procurement-intake agreement types. Preserve
-- existing records by migrating the two former shorthand values.
alter table public.agreements drop constraint if exists agreements_agreement_type_check;
update public.agreements set agreement_type='Software Subscription' where agreement_type='SaaS';
update public.agreements set agreement_type='Data Processing Addendum' where agreement_type='DPA';
alter table public.agreements add constraint agreements_agreement_type_check
  check (agreement_type in ('Software Subscription','Professional Services','Licensing','Logistics and Freight','Data Processing Addendum','Mutual NDA','Other'));

create table if not exists public.findings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agreement_id text not null references public.agreements(id) on delete cascade,
  provision text not null,
  finding_type text not null default 'present' check (finding_type in ('present','gap','deviation','acceptable')),
  severity text not null check (severity in ('low','medium','high','critical')),
  confidence integer not null check (confidence between 0 and 100),
  source_text text not null,
  reason text not null,
  status text not null default 'open',
  decision_reason text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.findings add column if not exists analysis_method text not null default 'manual' check (analysis_method in ('ai','deterministic','manual'));

-- Existing deployments may still have the v1.5 constraint. Historical gap,
-- deviation, and acceptable records are retained, but every new baseline
-- analysis path writes only `present`.
alter table public.findings drop constraint if exists findings_finding_type_check;
alter table public.findings add constraint findings_finding_type_check
  check (finding_type in ('present','gap','deviation','acceptable'));

create table if not exists public.playbook_rules (
  id text primary key,
  agreement_type text not null,
  provision text not null,
  applicability text not null check (applicability in ('R','M','C','N')),
  standard text not null,
  method text not null,
  severity text not null,
  version text not null default 'v1',
  active boolean not null default true
);

comment on column public.playbook_rules.standard is
  'Disabled stretch-backlog metadata. The required presence-only workflow does not compare standards.';
comment on column public.playbook_rules.applicability is
  'Disabled stretch-backlog metadata. The required presence-only workflow does not infer gaps from missing categories.';
comment on column public.playbook_rules.severity is
  'Disabled stretch-backlog metadata. The required presence-only workflow does not assign risk severity.';

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agreement_id text references public.agreements(id) on delete cascade,
  actor_name text not null,
  event_type text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

-- Decisions and audit history are durable records. Account or agreement
-- deletion must be blocked rather than cascading into review history.
alter table public.agreements drop constraint if exists agreements_user_id_fkey;
alter table public.agreements add constraint agreements_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete restrict;
alter table public.findings drop constraint if exists findings_user_id_fkey;
alter table public.findings add constraint findings_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete restrict;
alter table public.findings drop constraint if exists findings_agreement_id_fkey;
alter table public.findings add constraint findings_agreement_id_fkey
  foreign key (agreement_id) references public.agreements(id) on delete restrict;
alter table public.audit_events drop constraint if exists audit_events_user_id_fkey;
alter table public.audit_events add constraint audit_events_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete restrict;
alter table public.audit_events drop constraint if exists audit_events_agreement_id_fkey;
alter table public.audit_events add constraint audit_events_agreement_id_fkey
  foreign key (agreement_id) references public.agreements(id) on delete restrict;

alter table public.agreements enable row level security;
alter table public.profiles enable row level security;
alter table public.findings enable row level security;
alter table public.playbook_rules enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists "Users read profiles" on public.profiles;
create policy "Users read profiles" on public.profiles for select to authenticated
using (id=auth.uid() or public.current_user_role()='administrator');
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update to authenticated
using (id=auth.uid() or public.current_user_role()='administrator')
with check (id=auth.uid() or public.current_user_role()='administrator');

drop policy if exists "Users manage own agreements" on public.agreements;
drop policy if exists "Role based agreement read" on public.agreements;
create policy "Role based agreement read" on public.agreements for select to authenticated
using (user_id=auth.uid() or public.current_user_role() in ('reviewer','approver','administrator'));
drop policy if exists "Submitters create agreements" on public.agreements;
create policy "Submitters create agreements" on public.agreements for insert to authenticated
with check (user_id=auth.uid() and public.current_user_role() in ('submitter','reviewer','approver','administrator'));
drop policy if exists "Review team updates agreements" on public.agreements;
create policy "Review team updates agreements" on public.agreements for update to authenticated
using (public.current_user_role() in ('reviewer','approver','administrator'));
drop policy if exists "Users manage own findings" on public.findings;
drop policy if exists "Role based finding read" on public.findings;
create policy "Role based finding read" on public.findings for select to authenticated
using (exists (select 1 from public.agreements a where a.id=agreement_id and (a.user_id=auth.uid() or public.current_user_role() in ('reviewer','approver','administrator'))));
drop policy if exists "Review team creates findings" on public.findings;
create policy "Review team creates findings" on public.findings for insert to authenticated
with check (
  public.current_user_role() in ('reviewer','approver','administrator')
  or (
    user_id=auth.uid()
    and exists (
      select 1 from public.agreements a
      where a.id=agreement_id and a.user_id=auth.uid()
    )
  )
);
drop policy if exists "Review team updates findings" on public.findings;
create policy "Review team updates findings" on public.findings for update to authenticated
using (public.current_user_role() in ('reviewer','approver','administrator'));
drop policy if exists "Users read audit" on public.audit_events;
create policy "Users read audit" on public.audit_events for select to authenticated
using (auth.uid()=user_id or public.current_user_role() in ('reviewer','approver','administrator'));
drop policy if exists "Users append audit" on public.audit_events;
create policy "Users append audit" on public.audit_events for insert to authenticated
with check (
  auth.uid()=user_id
  and (
    agreement_id is null
    or exists (
      select 1 from public.agreements a
      where a.id=agreement_id
      and (
        a.user_id=auth.uid()
        or public.current_user_role() in ('reviewer','approver','administrator')
      )
    )
  )
);
drop policy if exists "Authenticated users read playbooks" on public.playbook_rules;
create policy "Authenticated users read playbooks" on public.playbook_rules for select to authenticated using (true);
drop policy if exists "Authenticated users update playbooks" on public.playbook_rules;
create policy "Authenticated users update playbooks" on public.playbook_rules for update to authenticated
using (public.current_user_role()='administrator') with check (public.current_user_role()='administrator');

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('agreements','agreements',false,10485760,array['application/pdf','text/plain'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf','text/plain'];

drop policy if exists "Users upload own agreement PDFs" on storage.objects;
create policy "Users upload own agreement PDFs" on storage.objects for insert to authenticated with check (bucket_id='agreements' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Users read own agreement PDFs" on storage.objects;
create policy "Users read own agreement PDFs" on storage.objects for select to authenticated using (bucket_id='agreements' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Review team reads agreement files" on storage.objects;
create policy "Review team reads agreement files" on storage.objects for select to authenticated
using (bucket_id='agreements' and public.current_user_role() in ('reviewer','approver','administrator'));

insert into public.playbook_rules (id,agreement_type,provision,applicability,standard,method,severity) values
('rule-1','Software Subscription','Cap on Liability','R','Cap required; compare basis, amount, and carve-outs','Hybrid','High'),
('rule-2','Software Subscription','Auto Renewal','M','Monitor renewal term; absence is acceptable','Hybrid','Medium'),
('rule-3','Software Subscription','Renewal Notice','C','If auto-renewal exists, notice should be 60 days or less','Regex + AI','High'),
('rule-4','Software Subscription','Governing Law','R','Approved US jurisdiction required','Regex','Medium'),
('rule-5','Software Subscription','Exclusivity','M','Any exclusivity requires review','AI','High'),
('rule-6','Professional Services','Cap on Liability','R','Cap required and must match approved PSA allocation','Hybrid','High'),
('rule-7','Professional Services','Termination for Convenience','R','Customer convenience termination expected','AI','High'),
('rule-8','Professional Services','Insurance','R','CGL and professional coverage required','Hybrid','High'),
('rule-9','Professional Services','Warranty Duration','R','Services warranty and remedy required','Hybrid','Medium'),
('rule-10','Data Processing Addendum','Cap on Liability','R','Data exposure must match approved DPA standard','Hybrid','High'),
('rule-11','Data Processing Addendum','Audit Rights','R','Acceptable audit or assurance mechanism required','AI','High'),
('rule-12','Data Processing Addendum','Insurance','C','Cyber coverage required for elevated risk tier','Hybrid','High'),
('rule-13','Data Processing Addendum','Assignment / Control','C','Processing obligations must survive transfer or control change','AI','High'),
('rule-14','Data Processing Addendum','Governing Law','R','DPA or incorporated agreement must provide governing law','Regex','Medium'),
('rule-15','Professional Services','Governing Law','M','Disabled stretch metadata - not used by the baseline','Regex','Medium'),
('rule-16','Licensing','Cap on Liability','M','Disabled stretch metadata - not used by the baseline','Hybrid','Medium'),
('rule-17','Licensing','Auto Renewal','M','Disabled stretch metadata - not used by the baseline','Hybrid','Medium'),
('rule-18','Licensing','Renewal Notice','M','Disabled stretch metadata - not used by the baseline','Hybrid','Medium'),
('rule-19','Licensing','Governing Law','M','Disabled stretch metadata - not used by the baseline','Regex','Medium'),
('rule-20','Licensing','Exclusivity','M','Disabled stretch metadata - not used by the baseline','Hybrid','Medium'),
('rule-21','Licensing','Assignment / Control','M','Disabled stretch metadata - not used by the baseline','Hybrid','Medium'),
('rule-22','Logistics and Freight','Cap on Liability','M','Disabled stretch metadata - not used by the baseline','Hybrid','Medium'),
('rule-23','Logistics and Freight','Termination for Convenience','M','Disabled stretch metadata - not used by the baseline','Hybrid','Medium'),
('rule-24','Logistics and Freight','Insurance','M','Disabled stretch metadata - not used by the baseline','Hybrid','Medium'),
('rule-25','Logistics and Freight','Governing Law','M','Disabled stretch metadata - not used by the baseline','Regex','Medium'),
('rule-26','Mutual NDA','Governing Law','M','Disabled stretch metadata - not used by the baseline','Regex','Medium'),
('rule-27','Mutual NDA','Assignment / Control','M','Disabled stretch metadata - not used by the baseline','Hybrid','Medium'),
('rule-28','Other','Cap on Liability','M','Disabled stretch metadata - not used by the baseline','Hybrid','Medium'),
('rule-29','Other','Termination for Convenience','M','Disabled stretch metadata - not used by the baseline','Hybrid','Medium'),
('rule-30','Other','Insurance','M','Disabled stretch metadata - not used by the baseline','Hybrid','Medium'),
('rule-31','Other','Assignment / Control','M','Disabled stretch metadata - not used by the baseline','Hybrid','Medium'),
('rule-32','Other','Governing Law','M','Disabled stretch metadata - not used by the baseline','Regex','Medium')
on conflict (id) do update set agreement_type=excluded.agreement_type,provision=excluded.provision,applicability=excluded.applicability,standard=excluded.standard,method=excluded.method,severity=excluded.severity;
