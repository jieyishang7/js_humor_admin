# js_humor_admin

Admin area (Assignment 6) for **Spot Finder NYC** (`js_humorproject`). Same Supabase project.

- `/` – live statistics: members, AI output per day, most-loved and most-saved picks, where members are based
- `/users` – READ users/profiles
- `/media` – CREATE / READ / UPDATE / DELETE AI generated media
- `/votes` – READ upvotes/downvotes

Every route sits behind Google sign-in **and** `profiles.is_superadmin = true`, checked in `proxy.ts` before any route renders and again in each page (`requireAdmin()`). Database RLS only lets superadmins read all rows or change AI media, so the anon key alone exposes nothing.

**Not locking yourself out:** the project owner sets their own flag in the Supabase SQL Editor, which runs as the database owner and bypasses RLS:

```sql
update public.profiles set is_superadmin = true where email = 'you@example.com';
```

Members cannot change `is_superadmin` themselves: their UPDATE grant is limited to their own profile detail columns. Setup SQL: `supabase/admin_setup.sql`.

Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
