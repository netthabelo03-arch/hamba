-- Sprint 1: shops (approved by an admin), products with photos, and saved
-- delivery details. Run after 001_profiles.sql: SQL Editor, paste, Run.
-- Safe to run again; it does not delete data.

-- Delivery details are remembered for the next order.
alter table public.profiles add column if not exists delivery jsonb;
grant update (delivery) on public.profiles to authenticated;

-- One shop per person. New shops wait for an admin before anyone can see them.
create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 40),
  about text not null check (char_length(about) between 20 and 500),
  city text not null check (char_length(city) between 2 and 40),
  phone text not null check (phone ~ '^\+27[6-8][0-9]{8}$'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.shops enable row level security;

drop policy if exists "Anyone can see approved shops" on public.shops;
create policy "Anyone can see approved shops"
  on public.shops for select to anon, authenticated
  using (status = 'approved');

drop policy if exists "Owners can see their shop" on public.shops;
create policy "Owners can see their shop"
  on public.shops for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Admins can see every shop" on public.shops;
create policy "Admins can see every shop"
  on public.shops for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "People can open one shop" on public.shops;
create policy "People can open one shop"
  on public.shops for insert to authenticated
  with check ((select auth.uid()) = owner_id and status = 'pending');

drop policy if exists "Owners can edit their shop" on public.shops;
create policy "Owners can edit their shop"
  on public.shops for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

revoke all on public.shops from anon, authenticated;
grant select on public.shops to anon, authenticated;
grant insert (owner_id, name, about, city, phone) on public.shops to authenticated;
-- Owners may change their details, never their status.
grant update (name, about, city, phone) on public.shops to authenticated;

drop trigger if exists shops_touch on public.shops;
create trigger shops_touch before update on public.shops
  for each row execute function public.touch_updated_at();

-- Admins approve or suspend shops through this function only.
create or replace function public.set_shop_status(shop_id uuid, new_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change a shop''s status' using errcode = '42501';
  end if;
  if new_status not in ('pending', 'approved', 'suspended') then
    raise exception 'Unknown status' using errcode = '22023';
  end if;
  update public.shops set status = new_status where id = shop_id;
end;
$$;
revoke all on function public.set_shop_status(uuid, text) from public, anon;
grant execute on function public.set_shop_status(uuid, text) to authenticated;

-- Products. Sellers hide products rather than delete them, so past orders
-- (Sprint 2) keep pointing at something.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  description text not null check (char_length(description) between 10 and 1000),
  category text not null check (category in ('sneakers', 'fashion', 'sport', 'beauty', 'home', 'crafts')),
  price_cents integer not null check (price_cents between 500 and 10000000),
  stock integer not null check (stock between 0 and 9999),
  photos text[] not null default '{}' check (cardinality(photos) <= 4),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_listing on public.products (created_at desc) where not hidden;
create index if not exists products_shop on public.products (shop_id);
alter table public.products enable row level security;

create or replace function public.owns_shop(shop uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.shops s where s.id = shop and s.owner_id = auth.uid());
$$;
revoke all on function public.owns_shop(uuid) from public, anon;
grant execute on function public.owns_shop(uuid) to authenticated;

drop policy if exists "Anyone can see products of approved shops" on public.products;
create policy "Anyone can see products of approved shops"
  on public.products for select to anon, authenticated
  using (not hidden and exists (select 1 from public.shops s where s.id = shop_id and s.status = 'approved'));

drop policy if exists "Owners can see all their products" on public.products;
create policy "Owners can see all their products"
  on public.products for select to authenticated
  using ((select public.owns_shop(shop_id)));

drop policy if exists "Owners can add products" on public.products;
create policy "Owners can add products"
  on public.products for insert to authenticated
  with check ((select public.owns_shop(shop_id)));

drop policy if exists "Owners can edit their products" on public.products;
create policy "Owners can edit their products"
  on public.products for update to authenticated
  using ((select public.owns_shop(shop_id)))
  with check ((select public.owns_shop(shop_id)));

revoke all on public.products from anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert (shop_id, title, description, category, price_cents, stock, photos, hidden) on public.products to authenticated;
grant update (title, description, category, price_cents, stock, photos, hidden) on public.products to authenticated;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- Product photos: anyone can view; sellers upload into their own shop's folder
-- (<shop id>/<file>.jpg), only images, at most 8 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-photos', 'product-photos', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Sellers upload photos to their shop folder" on storage.objects;
create policy "Sellers upload photos to their shop folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-photos' and public.owns_shop(((storage.foldername(name))[1])::uuid));

drop policy if exists "Sellers delete photos in their shop folder" on storage.objects;
create policy "Sellers delete photos in their shop folder"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-photos' and public.owns_shop(((storage.foldername(name))[1])::uuid));
