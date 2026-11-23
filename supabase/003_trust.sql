-- Sprint 2: trust before going live.
--   * Shein-style departments and types, with "Something else"
--   * every new product (and every change to its name, description, category
--     or photos) waits for an admin before shoppers see it
--   * seller checks: ID, selfie with ID, stock photo (private), checklist,
--     call notes; ID photos are deleted once the shop is decided
--   * new sellers can list up to 20 products
-- Run after 002_shops_products.sql: SQL Editor, paste, Run. Safe to run again.

-- ---------------------------------------------------------------- Categories

alter table public.products drop constraint if exists products_category_check;
update public.products set category = case category
  when 'sneakers' then 'shoes' when 'fashion' then 'clothing' else category end
where category in ('sneakers', 'fashion');
alter table public.products add constraint products_category_check check (category in (
  'clothing', 'shoes', 'bags', 'jewellery', 'beauty', 'sport', 'home', 'kids', 'crafts', 'tech', 'stationery', 'pets', 'other'));

alter table public.products add column if not exists subcategory text not null default '';
alter table public.products drop constraint if exists products_subcategory_check;
alter table public.products add constraint products_subcategory_check check (char_length(subcategory) <= 40);
alter table public.products add column if not exists audience text check (audience in ('women', 'men', 'unisex', 'kids'));

-- ---------------------------------------------------------------- Product review

-- Products listed before this sprint were already on show, so the first run
-- marks them approved; after that, new products start as pending.
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'products' and column_name = 'status') then
    alter table public.products add column status text not null default 'approved';
    alter table public.products alter column status set default 'pending';
  end if;
end;
$$;
alter table public.products drop constraint if exists products_status_check;
alter table public.products add constraint products_status_check check (status in ('pending', 'approved', 'rejected'));
alter table public.products add column if not exists review_note text not null default '';

drop policy if exists "Anyone can see products of approved shops" on public.products;
create policy "Anyone can see products of approved shops"
  on public.products for select to anon, authenticated
  using (not hidden and status = 'approved'
         and exists (select 1 from public.shops s where s.id = shop_id and s.status = 'approved'));

drop policy if exists "Admins can see every product" on public.products;
create policy "Admins can see every product"
  on public.products for select to authenticated
  using ((select public.is_admin()));

grant insert (subcategory, audience) on public.products to authenticated;
grant update (subcategory, audience) on public.products to authenticated;
-- status and review_note are never written by sellers directly.

-- New products always start waiting; changing what shoppers read or see sends
-- a product back for review. Price, stock and hiding do not.
create or replace function public.products_review_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_admin() and current_setting('hamba.reviewing', true) = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.review_note := '';
  elsif new.title is distinct from old.title or new.description is distinct from old.description
     or new.category is distinct from old.category or new.subcategory is distinct from old.subcategory
     or new.photos is distinct from old.photos then
    new.status := 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists products_review on public.products;
create trigger products_review before insert or update on public.products
  for each row execute function public.products_review_rules();

-- New sellers may have at most 20 products that are not rejected.
create or replace function public.products_new_seller_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.products p where p.shop_id = new.shop_id and p.status <> 'rejected') >= 20 then
    raise exception 'New sellers can list up to 20 products' using errcode = 'P0001', hint = 'new_seller_limit';
  end if;
  return new;
end;
$$;

drop trigger if exists products_limit on public.products;
create trigger products_limit before insert on public.products
  for each row execute function public.products_new_seller_limit();

create or replace function public.review_product(product_id uuid, new_status text, note text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can review products' using errcode = '42501';
  end if;
  if new_status not in ('approved', 'rejected') then
    raise exception 'Unknown status' using errcode = '22023';
  end if;
  if new_status = 'rejected' and char_length(coalesce(note, '')) < 5 then
    raise exception 'Say what the seller must fix' using errcode = '22023';
  end if;
  perform set_config('hamba.reviewing', 'on', true);
  update public.products set status = new_status, review_note = coalesce(note, '') where id = product_id;
end;
$$;
revoke all on function public.review_product(uuid, text, text) from public, anon;
grant execute on function public.review_product(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------- Seller checks

create table if not exists public.shop_checks (
  shop_id uuid primary key references public.shops (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  id_photo text,          -- private paths in the seller-checks bucket; cleared
  selfie text,            -- once the shop is approved or declined (POPIA)
  stock_photo text,
  checklist jsonb not null default '{}',
  call_notes text not null default '' check (char_length(call_notes) <= 2000),
  decided_by uuid references auth.users (id),
  decided_at timestamptz,
  documents_deleted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.shop_checks enable row level security;

drop policy if exists "Sellers send their own checks" on public.shop_checks;
create policy "Sellers send their own checks"
  on public.shop_checks for insert to authenticated
  with check ((select auth.uid()) = owner_id and (select public.owns_shop(shop_id)));

drop policy if exists "Sellers see that their checks arrived" on public.shop_checks;
create policy "Sellers see that their checks arrived"
  on public.shop_checks for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Admins see all checks" on public.shop_checks;
create policy "Admins see all checks"
  on public.shop_checks for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins update checks" on public.shop_checks;
create policy "Admins update checks"
  on public.shop_checks for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on public.shop_checks from anon, authenticated;
grant select on public.shop_checks to authenticated;
grant insert (shop_id, owner_id, id_photo, selfie, stock_photo) on public.shop_checks to authenticated;
grant update (checklist, call_notes, id_photo, selfie, stock_photo, decided_by, decided_at, documents_deleted_at) on public.shop_checks to authenticated;

-- Private bucket: sellers upload into a folder named with their own user id;
-- only admins can open the files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('seller-checks', 'seller-checks', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Sellers upload their own check photos" on storage.objects;
create policy "Sellers upload their own check photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'seller-checks' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Admins view check photos" on storage.objects;
create policy "Admins view check photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'seller-checks' and (select public.is_admin()));

drop policy if exists "Admins delete check photos" on storage.objects;
create policy "Admins delete check photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'seller-checks' and (select public.is_admin()));
