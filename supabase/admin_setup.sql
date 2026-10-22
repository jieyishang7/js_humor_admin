-- Assignment 6: admin area access. Run once in Supabase Dashboard -> SQL Editor.
-- Safe to run again.

-- 1. The flag that unlocks the admin area.
alter table public.profiles add column if not exists is_superadmin boolean not null default false;

-- 2. Members may edit their own profile details, but NOT the is_superadmin flag.
revoke update on public.profiles from authenticated;
grant update (first_name, last_name, tagline, avatar_url, current_area, cities_visited, favorite_spot, updated_at)
  on public.profiles to authenticated;

-- 3. Helper used by the policies below (security definer so it can read the flag).
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_superadmin from public.profiles p where p.id = auth.uid()), false);
$$;
revoke all on function public.is_superadmin() from public, anon;
grant execute on function public.is_superadmin() to authenticated;

-- 4. Admin-only access (regular members keep their existing, narrower rules).
drop policy if exists "Admins read all profiles" on public.profiles;
create policy "Admins read all profiles" on public.profiles
  for select to authenticated using (public.is_superadmin());

grant select, insert, update, delete on public.captions to authenticated;
drop policy if exists "Admins manage AI media" on public.captions;
create policy "Admins manage AI media" on public.captions
  for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists "Admins read all votes" on public.caption_votes;
create policy "Admins read all votes" on public.caption_votes
  for select to authenticated using (public.is_superadmin());

drop policy if exists "Admins read all plans" on public.saved_spots;
create policy "Admins read all plans" on public.saved_spots
  for select to authenticated using (public.is_superadmin());

-- 5. Avoid locking yourself out: the project owner promotes their own account here,
--    in the SQL Editor, which runs as the database owner and bypasses RLS.
update public.profiles set is_superadmin = true where email = 'jieyi.sjy@gmail.com';

-- Check: who is an admin?
select email, first_name, last_name, is_superadmin from public.profiles order by is_superadmin desc, email;
