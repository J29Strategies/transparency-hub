-- ============================================================
-- TRANSPARENCY HUB — FC COLLABORATIVE
-- Supabase Schema · Run this in the Supabase SQL Editor
-- ============================================================

-- ── Tables ──────────────────────────────────────────────────

create table organizations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  status text default 'active' check (status in ('active','inactive')),
  created_at timestamptz default now()
);

create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  org_id uuid references organizations(id),
  first_name text not null default '',
  last_name text not null default '',
  role text not null default 'agency_staff'
    check (role in ('super_admin','org_admin','agency_staff','advocate')),
  status text default 'active' check (status in ('active','inactive')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table youth (
  id uuid default gen_random_uuid() primary key,
  first_name text not null,
  last_name text not null,
  preferred_name text,
  dob date,
  phone text,
  email text,
  zip text,
  contact_pref text default 'Text Message',
  fc_status text,
  county text,
  placement_type text,
  placement_zip text,
  stability text default 'Unknown',
  goals text,
  interests text,
  notes text,
  referred_by_org_id uuid references organizations(id),
  last_contact date,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table youth_services (
  id uuid default gen_random_uuid() primary key,
  youth_id uuid references youth(id) on delete cascade not null,
  service_type text not null,
  created_at timestamptz default now()
);

-- Many-to-many: advocates ↔ youth
create table youth_advocates (
  id uuid default gen_random_uuid() primary key,
  youth_id uuid references youth(id) on delete cascade not null,
  advocate_id uuid references profiles(id) on delete cascade not null,
  assigned_by uuid references profiles(id),
  assigned_at timestamptz default now(),
  unique(youth_id, advocate_id)
);

create table referrals (
  id uuid default gen_random_uuid() primary key,
  youth_id uuid references youth(id) on delete cascade not null,
  need_type text not null,
  status text default 'open'
    check (status in ('open','claimed','closed','unable_to_fulfill')),
  notes text,
  logged_by uuid references profiles(id),
  logged_by_org_id uuid references organizations(id),
  claimed_by uuid references profiles(id),
  claimed_by_org_id uuid references organizations(id),
  claimed_at timestamptz,
  closed_at timestamptz,
  close_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  text text not null,
  read boolean default false,
  created_at timestamptz default now()
);

-- ── Indexes ──────────────────────────────────────────────────

create index on youth(fc_status);
create index on youth(county);
create index on youth(stability);
create index on referrals(status);
create index on referrals(youth_id);
create index on referrals(logged_by_org_id);
create index on referrals(claimed_by_org_id);
create index on youth_advocates(advocate_id);
create index on youth_advocates(youth_id);
create index on notifications(user_id, read);

-- ── Helper functions ─────────────────────────────────────────

create or replace function get_my_role()
returns text as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer stable;

create or replace function get_my_org_id()
returns uuid as $$
  select org_id from profiles where id = auth.uid();
$$ language sql security definer stable;

-- ── Auto-create profile on sign-up ───────────────────────────

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, first_name, last_name, role, org_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'agency_staff'),
    nullif(new.raw_user_meta_data->>'org_id', '')::uuid
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Notification triggers ─────────────────────────────────────

-- When a referral is logged: notify all non-advocate staff
create or replace function notify_referral_logged()
returns trigger as $$
declare
  youth_name text;
begin
  select first_name || ' ' || last_name into youth_name
  from youth where id = new.youth_id;

  insert into notifications (user_id, text)
  select id,
    'New open referral: ' || new.need_type || ' for ' || youth_name
  from profiles
  where role in ('super_admin','org_admin','agency_staff')
    and id != new.logged_by
    and status = 'active';

  return new;
end;
$$ language plpgsql security definer;

create trigger on_referral_logged
  after insert on referrals
  for each row execute function notify_referral_logged();

-- When a referral is claimed: notify the org that logged it
create or replace function notify_referral_claimed()
returns trigger as $$
declare
  youth_name text;
  claimer_name text;
  claimer_org text;
begin
  if old.status = 'open' and new.status = 'claimed' then
    select first_name || ' ' || last_name into youth_name
    from youth where id = new.youth_id;

    select p.first_name || ' ' || p.last_name, o.name
    into claimer_name, claimer_org
    from profiles p
    left join organizations o on o.id = p.org_id
    where p.id = new.claimed_by;

    -- Notify the user who logged the referral
    insert into notifications (user_id, text)
    select new.logged_by,
      claimer_org || ' claimed your referral for ' || new.need_type || ' (' || youth_name || ')'
    where new.logged_by is not null;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_referral_claimed
  after update on referrals
  for each row execute function notify_referral_claimed();

-- When a referral is closed: notify the org that logged it
create or replace function notify_referral_closed()
returns trigger as $$
declare
  youth_name text;
begin
  if old.status = 'claimed' and new.status = 'closed' then
    select first_name || ' ' || last_name into youth_name
    from youth where id = new.youth_id;

    insert into notifications (user_id, text)
    select new.logged_by,
      'Referral closed: ' || new.need_type || ' for ' || youth_name || ' has been fulfilled.'
    where new.logged_by is not null and new.logged_by != new.claimed_by;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_referral_closed
  after update on referrals
  for each row execute function notify_referral_closed();

-- ── Row Level Security ────────────────────────────────────────

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table youth enable row level security;
alter table youth_services enable row level security;
alter table youth_advocates enable row level security;
alter table referrals enable row level security;
alter table notifications enable row level security;

-- Organizations: everyone can read; only super_admin can write
create policy "orgs_read" on organizations
  for select using (true);

create policy "orgs_write" on organizations
  for all using (get_my_role() = 'super_admin');

-- Profiles: own profile always; org_admin sees their org; super_admin sees all
create policy "profiles_select" on profiles
  for select using (
    id = auth.uid()
    or get_my_role() = 'super_admin'
    or (get_my_role() = 'org_admin' and org_id = get_my_org_id())
    or get_my_role() in ('agency_staff') -- staff can see org members for display
  );

create policy "profiles_insert" on profiles
  for insert with check (
    get_my_role() in ('super_admin','org_admin')
    or id = auth.uid() -- allow self-registration
  );

create policy "profiles_update" on profiles
  for update using (
    id = auth.uid()
    or get_my_role() = 'super_admin'
    or (get_my_role() = 'org_admin' and org_id = get_my_org_id())
  );

-- Youth: advocates see only assigned; all others see all
create policy "youth_select" on youth
  for select using (
    get_my_role() in ('super_admin','org_admin','agency_staff')
    or (
      get_my_role() = 'advocate'
      and id in (
        select youth_id from youth_advocates where advocate_id = auth.uid()
      )
    )
  );

create policy "youth_insert" on youth
  for insert with check (
    get_my_role() in ('super_admin','org_admin','agency_staff','advocate')
  );

create policy "youth_update" on youth
  for update using (
    get_my_role() in ('super_admin','org_admin','agency_staff')
    or (
      get_my_role() = 'advocate'
      and id in (
        select youth_id from youth_advocates where advocate_id = auth.uid()
      )
    )
  );

-- Youth services: same rules as youth
create policy "youth_services_select" on youth_services
  for select using (
    get_my_role() in ('super_admin','org_admin','agency_staff')
    or (
      get_my_role() = 'advocate'
      and youth_id in (
        select youth_id from youth_advocates where advocate_id = auth.uid()
      )
    )
  );

create policy "youth_services_all" on youth_services
  for all using (
    get_my_role() in ('super_admin','org_admin','agency_staff')
    or (
      get_my_role() = 'advocate'
      and youth_id in (
        select youth_id from youth_advocates where advocate_id = auth.uid()
      )
    )
  );

-- Youth advocates: advocates see own; staff/admin see all; staff/admin assign
create policy "youth_advocates_select" on youth_advocates
  for select using (
    get_my_role() in ('super_admin','org_admin','agency_staff')
    or advocate_id = auth.uid()
  );

create policy "youth_advocates_insert" on youth_advocates
  for insert with check (
    get_my_role() in ('super_admin','org_admin','agency_staff')
  );

create policy "youth_advocates_delete" on youth_advocates
  for delete using (
    get_my_role() in ('super_admin','org_admin','agency_staff')
  );

-- Referrals: advocates see only their youth's referrals; others see all
create policy "referrals_select" on referrals
  for select using (
    get_my_role() in ('super_admin','org_admin','agency_staff')
    or (
      get_my_role() = 'advocate'
      and youth_id in (
        select youth_id from youth_advocates where advocate_id = auth.uid()
      )
    )
  );

create policy "referrals_insert" on referrals
  for insert with check (
    get_my_role() in ('super_admin','org_admin','agency_staff','advocate')
  );

create policy "referrals_update" on referrals
  for update using (
    get_my_role() in ('super_admin','org_admin','agency_staff')
    or (
      get_my_role() = 'advocate'
      and youth_id in (
        select youth_id from youth_advocates where advocate_id = auth.uid()
      )
    )
  );

-- Notifications: users see and update only their own
create policy "notifications_select" on notifications
  for select using (user_id = auth.uid());

create policy "notifications_update" on notifications
  for update using (user_id = auth.uid());

-- ── Seed: Organizations ───────────────────────────────────────

insert into organizations (name) values
  ('Madi''s Movement'),
  ('Friends of Joshua House'),
  ('New Life Village'),
  ('Fostering Hope Florida'),
  ('Voices for Children Tampa Bay'),
  ('Golden Generations'),
  ('Fostering Hearts'),
  ('West Florida Foster Care Services'),
  ('Hero to a Child'),
  ('J29 Strategies');
