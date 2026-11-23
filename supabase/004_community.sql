-- Sprint 4: Studio (designs and votes) and Run safe (crews, safe routes,
-- live location and SOS), plus reports. Run after 003_trust.sql:
-- SQL Editor, paste, Run. Safe to run again.

-- ---------------------------------------------------------------- Studio

create table if not exists public.designs (
  id uuid primary key default gen_random_uuid(),
  designer_id uuid not null references auth.users (id) on delete cascade,
  designer_name text not null check (char_length(designer_name) between 1 and 40),
  title text not null check (char_length(title) between 3 and 60),
  about text not null check (char_length(about) between 10 and 600),
  kind text not null check (kind in ('sneakers', 'tee', 'hoodie', 'cap', 'bag', 'other')),
  image text not null,
  status text not null default 'pending' check (status in ('pending', 'open', 'rejected', 'made')),
  review_note text not null default '',
  reports integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.designs enable row level security;

create table if not exists public.design_votes (
  design_id uuid not null references public.designs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (design_id, user_id)          -- one vote per member
);
alter table public.design_votes enable row level security;

drop policy if exists "Anyone sees open and made designs" on public.designs;
create policy "Anyone sees open and made designs" on public.designs for select to anon, authenticated
  using (status in ('open', 'made') and not hidden);
drop policy if exists "Designers see their own designs" on public.designs;
create policy "Designers see their own designs" on public.designs for select to authenticated
  using ((select auth.uid()) = designer_id);
drop policy if exists "Admins see all designs" on public.designs;
create policy "Admins see all designs" on public.designs for select to authenticated
  using ((select public.is_admin()));
drop policy if exists "Members submit designs" on public.designs;
create policy "Members submit designs" on public.designs for insert to authenticated
  with check ((select auth.uid()) = designer_id and status = 'pending');

revoke all on public.designs from anon, authenticated;
grant select on public.designs to anon, authenticated;
grant insert (designer_id, designer_name, title, about, kind, image) on public.designs to authenticated;

-- Vote counts are public; who voted is not (only your own votes).
drop policy if exists "Anyone sees vote counts" on public.design_votes;
drop policy if exists "Members see their own votes" on public.design_votes;
create policy "Members see their own votes" on public.design_votes for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Members vote, not for their own, only while open" on public.design_votes;
create policy "Members vote, not for their own, only while open" on public.design_votes for insert to authenticated
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.designs d where d.id = design_id and d.status = 'open' and d.designer_id <> (select auth.uid())));
drop policy if exists "Members take back their vote" on public.design_votes;
create policy "Members take back their vote" on public.design_votes for delete to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.design_votes from anon, authenticated;
grant select, insert (design_id, user_id), delete on public.design_votes to authenticated;

create or replace function public.design_vote_counts()
returns table (design_id uuid, votes bigint) language sql stable security definer set search_path = '' as $$
  select v.design_id, count(*) from public.design_votes v group by v.design_id;
$$;
grant execute on function public.design_vote_counts() to anon, authenticated;

create or replace function public.review_design(design_id uuid, new_status text, note text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Only admins can review designs' using errcode = '42501'; end if;
  if new_status not in ('open', 'rejected', 'made') then raise exception 'Unknown status' using errcode = '22023'; end if;
  if new_status = 'rejected' and char_length(coalesce(note, '')) < 5 then raise exception 'Say what to fix' using errcode = '22023'; end if;
  update public.designs set status = new_status, review_note = case when new_status = 'rejected' then note else '' end where id = design_id;
end;
$$;
revoke all on function public.review_design(uuid, text, text) from public, anon;
grant execute on function public.review_design(uuid, text, text) to authenticated;

-- Design pictures: public to view; members upload into their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('design-images', 'design-images', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true;
drop policy if exists "Members upload design pictures" on storage.objects;
create policy "Members upload design pictures" on storage.objects for insert to authenticated
  with check (bucket_id = 'design-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------- Crews

create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 3 and 50),
  area text not null check (char_length(area) between 2 and 40),
  days text[] not null check (cardinality(days) between 1 and 7),
  time text not null check (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  pace text not null default '' check (char_length(pace) <= 40),
  reports integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.crews enable row level security;
create table if not exists public.crew_members (
  crew_id uuid not null references public.crews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);
alter table public.crew_members enable row level security;

drop policy if exists "Anyone sees crews" on public.crews;
create policy "Anyone sees crews" on public.crews for select to anon, authenticated using (not hidden or (select public.is_admin()));
drop policy if exists "Members start crews" on public.crews;
create policy "Members start crews" on public.crews for insert to authenticated with check ((select auth.uid()) = owner_id);
drop policy if exists "Owners edit their crew" on public.crews;
create policy "Owners edit their crew" on public.crews for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
revoke all on public.crews from anon, authenticated;
grant select on public.crews to anon, authenticated;
grant insert (owner_id, name, area, days, time, pace) on public.crews to authenticated;
grant update (name, area, days, time, pace) on public.crews to authenticated;

-- Member counts are public; who is in a crew is not (only your own membership).
drop policy if exists "Members see their own memberships" on public.crew_members;
create policy "Members see their own memberships" on public.crew_members for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Members join" on public.crew_members;
create policy "Members join" on public.crew_members for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Members leave" on public.crew_members;
create policy "Members leave" on public.crew_members for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.crew_members from anon, authenticated;
grant select, insert (crew_id, user_id), delete on public.crew_members to authenticated;

create or replace function public.crew_member_counts()
returns table (crew_id uuid, members bigint) language sql stable security definer set search_path = '' as $$
  select m.crew_id, count(*) from public.crew_members m group by m.crew_id;
$$;
grant execute on function public.crew_member_counts() to anon, authenticated;

-- ---------------------------------------------------------------- Routes

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  added_by uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 3 and 60),
  area text not null check (char_length(area) between 2 and 40),
  distance_km numeric(4,1) not null check (distance_km between 0.5 and 100),
  tip text not null default '' check (char_length(tip) <= 60),
  reports integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.routes enable row level security;
create table if not exists public.route_ratings (
  route_id uuid not null references public.routes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  safe boolean not null,
  rated_at timestamptz not null default now(),
  primary key (route_id, user_id)          -- one answer per member; changing it updates it
);
alter table public.route_ratings enable row level security;

drop policy if exists "Anyone sees routes" on public.routes;
create policy "Anyone sees routes" on public.routes for select to anon, authenticated using (not hidden or (select public.is_admin()));
drop policy if exists "Members add routes" on public.routes;
create policy "Members add routes" on public.routes for insert to authenticated with check ((select auth.uid()) = added_by);
revoke all on public.routes from anon, authenticated;
grant select on public.routes to anon, authenticated;
grant insert (added_by, name, area, distance_km, tip) on public.routes to authenticated;

-- The "felt safe" totals are public; who answered is not (only your own answer).
drop policy if exists "Anyone sees route answers" on public.route_ratings;
drop policy if exists "Members see their own answers" on public.route_ratings;
create policy "Members see their own answers" on public.route_ratings for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Members answer" on public.route_ratings;
create policy "Members answer" on public.route_ratings for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Members change their answer" on public.route_ratings;
create policy "Members change their answer" on public.route_ratings for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.route_ratings from anon, authenticated;
grant select, insert (route_id, user_id, safe), update (safe, rated_at) on public.route_ratings to authenticated;

create or replace function public.route_safety()
returns table (route_id uuid, safe_count bigint, total bigint) language sql stable security definer set search_path = '' as $$
  select r.route_id, count(*) filter (where r.safe), count(*) from public.route_ratings r group by r.route_id;
$$;
grant execute on function public.route_safety() to anon, authenticated;

-- ---------------------------------------------------------------- Live location and SOS

create table if not exists public.live_shares (
  token text primary key check (token ~ '^[A-Za-z0-9_-]{22}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  runner_name text not null check (char_length(runner_name) between 1 and 40),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  accuracy real,
  sos boolean not null default false,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.live_shares enable row level security;

drop policy if exists "Runners manage their own share" on public.live_shares;
create policy "Runners manage their own share" on public.live_shares for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.live_shares from anon, authenticated;
grant select, insert (token, user_id, runner_name), update (lat, lng, accuracy, sos, updated_at), delete on public.live_shares to authenticated;

-- A buddy with the link reads one share, and only the fields they need.
create or replace function public.get_live_share(share_token text)
returns table (runner_name text, lat double precision, lng double precision, accuracy real, sos boolean, started_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.runner_name, s.lat, s.lng, s.accuracy, s.sos, s.started_at, s.updated_at
  from public.live_shares s
  where s.token = share_token and s.started_at > now() - interval '4 hours';
$$;
revoke all on function public.get_live_share(text) from public;
grant execute on function public.get_live_share(text) to anon, authenticated;

-- Forgotten shares are deleted after 4 hours. Schedule this daily in Supabase
-- (Database, Cron) or run it by hand:  select public.delete_old_shares();
create or replace function public.delete_old_shares()
returns void language sql security definer set search_path = '' as $$
  delete from public.live_shares where started_at < now() - interval '4 hours';
$$;
revoke all on function public.delete_old_shares() from public, anon, authenticated;

-- ---------------------------------------------------------------- Reports

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('design', 'crew', 'route')),
  item_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (char_length(reason) between 2 and 40),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists reports_once on public.reports (kind, item_id, user_id) where not resolved;
alter table public.reports enable row level security;
drop policy if exists "Members report" on public.reports;
create policy "Members report" on public.reports for insert to authenticated with check ((select auth.uid()) = user_id);
revoke all on public.reports from anon, authenticated;
grant insert (kind, item_id, user_id, reason) on public.reports to authenticated;

-- 3 open reports hide the item until an admin decides.
create or replace function public.reports_hide_after_three()
returns trigger language plpgsql security definer set search_path = '' as $$
declare open_count integer;
begin
  select count(*) into open_count from public.reports where kind = new.kind and item_id = new.item_id and not resolved;
  if new.kind = 'design' then update public.designs set reports = open_count, hidden = hidden or open_count >= 3 where id = new.item_id;
  elsif new.kind = 'crew' then update public.crews set reports = open_count, hidden = hidden or open_count >= 3 where id = new.item_id;
  else update public.routes set reports = open_count, hidden = hidden or open_count >= 3 where id = new.item_id;
  end if;
  return new;
end;
$$;
drop trigger if exists reports_hide on public.reports;
create trigger reports_hide after insert on public.reports for each row execute function public.reports_hide_after_three();

create or replace function public.open_reports()
returns table (kind text, item_id uuid, title text, hidden boolean, reasons text[], count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  return query
    select r.kind, r.item_id,
      coalesce(d.title, c.name, ro.name, '(gone)'),
      coalesce(d.hidden, c.hidden, ro.hidden, false),
      array_agg(r.reason), count(*)
    from public.reports r
    left join public.designs d on r.kind = 'design' and d.id = r.item_id
    left join public.crews c on r.kind = 'crew' and c.id = r.item_id
    left join public.routes ro on r.kind = 'route' and ro.id = r.item_id
    where not r.resolved
    group by r.kind, r.item_id, d.title, c.name, ro.name, d.hidden, c.hidden, ro.hidden;
end;
$$;
revoke all on function public.open_reports() from public, anon;
grant execute on function public.open_reports() to authenticated;

create or replace function public.resolve_reports(item_kind text, item uuid, hide_it boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  update public.reports set resolved = true where kind = item_kind and item_id = item;
  if item_kind = 'design' then update public.designs set hidden = hide_it, reports = 0 where id = item;
  elsif item_kind = 'crew' then update public.crews set hidden = hide_it, reports = 0 where id = item;
  else update public.routes set hidden = hide_it, reports = 0 where id = item;
  end if;
end;
$$;
revoke all on function public.resolve_reports(text, uuid, boolean) from public, anon;
grant execute on function public.resolve_reports(text, uuid, boolean) to authenticated;
