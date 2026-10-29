-- Week 7: admin panel with more observability.
-- Run once in Supabase Dashboard -> SQL Editor. Safe to run again.
-- Mirrors the course's Crack'd admin data model: LLM providers/models, prompt chains
-- (with steps and a mix), prompt chain runs, LLM responses, terms, generation examples,
-- allowed signup domains and a whitelist of e-mail addresses.

-- 0. Admins -------------------------------------------------------------------------
update public.profiles set is_superadmin = true where email in ('js7141@columbia.edu');

-- 1. LLM providers & models --------------------------------------------------------
create table if not exists public.llm_providers (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_datetime_utc timestamptz not null default now(),
  created_by_user_id uuid default auth.uid(),
  modified_by_user_id uuid,
  modified_datetime_utc timestamptz
);

create table if not exists public.llm_models (
  id bigint generated always as identity primary key,
  name text not null,
  llm_provider_id bigint not null references public.llm_providers (id) on delete restrict,
  provider_model_id text not null unique,
  is_temperature_supported boolean not null default true,
  created_datetime_utc timestamptz not null default now(),
  created_by_user_id uuid default auth.uid(),
  modified_by_user_id uuid,
  modified_datetime_utc timestamptz
);

-- 2. Prompt chains (definitions), their steps, and the mix -------------------------
create table if not exists public.prompt_chains (
  id bigint generated always as identity primary key,
  slug text not null unique,
  description text,
  created_datetime_utc timestamptz not null default now()
);

create table if not exists public.prompt_chain_steps (
  id bigint generated always as identity primary key,
  prompt_chain_id bigint not null references public.prompt_chains (id) on delete cascade,
  step_order int not null,
  llm_model_id bigint references public.llm_models (id) on delete set null,
  step_type text not null default 'general',
  input_type text not null default 'text-only',
  output_type text not null default 'string',
  system_prompt text not null,
  user_prompt text not null,
  temperature numeric,
  created_datetime_utc timestamptz not null default now(),
  unique (prompt_chain_id, step_order)
);

create table if not exists public.prompt_chain_mix (
  id bigint generated always as identity primary key,
  prompt_chain_id bigint not null unique references public.prompt_chains (id) on delete cascade,
  weight int not null default 1 check (weight >= 0 and weight <= 100),
  modified_datetime_utc timestamptz not null default now()
);

-- 3. Runs and responses (written by the user app on every AI call) -------------------
create table if not exists public.llm_prompt_chains (
  id bigint generated always as identity primary key,
  prompt_chain_id bigint references public.prompt_chains (id) on delete set null,
  spot_request_id bigint references public.spot_requests (id) on delete cascade,
  profile_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_datetime_utc timestamptz not null default now()
);

create table if not exists public.llm_responses (
  id uuid primary key default gen_random_uuid(),
  created_datetime_utc timestamptz not null default now(),
  llm_model_id bigint references public.llm_models (id) on delete set null,
  provider_model_id text,
  spot_request_id bigint references public.spot_requests (id) on delete cascade,
  profile_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prompt_chain_id bigint references public.prompt_chains (id) on delete set null,
  llm_prompt_chain_id bigint references public.llm_prompt_chains (id) on delete cascade,
  prompt_chain_step_id bigint references public.prompt_chain_steps (id) on delete set null,
  system_prompt text,
  user_prompt text,
  response text,
  temperature numeric,
  processing_time_seconds numeric,
  succeeded boolean not null default true
);

-- 4. Terms and generation examples (both fed into the prompts) ----------------------
create table if not exists public.terms (
  id bigint generated always as identity primary key,
  term text not null,
  term_type text not null default 'Noun',
  definition text not null,
  example text,
  priority int not null default 0,
  created_datetime_utc timestamptz not null default now(),
  modified_datetime_utc timestamptz not null default now()
);

create table if not exists public.generation_examples (
  id bigint generated always as identity primary key,
  mood text not null,
  example_output text not null,
  explanation text,
  priority int not null default 0,
  created_datetime_utc timestamptz not null default now(),
  modified_datetime_utc timestamptz not null default now()
);

-- 5. Who may sign in ------------------------------------------------------------------
create table if not exists public.allowed_signup_domains (
  id bigint generated always as identity primary key,
  apex_domain text not null unique,
  created_datetime_utc timestamptz not null default now()
);

create table if not exists public.whitelist_email_addresses (
  id bigint generated always as identity primary key,
  email_address text not null unique,
  created_datetime_utc timestamptz not null default now()
);

-- True when the signed-in user's e-mail domain is allowed, the e-mail is whitelisted,
-- the user is a superadmin, or no restrictions are configured at all.
create or replace function public.can_sign_in()
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select
    (not exists (select 1 from public.allowed_signup_domains) and not exists (select 1 from public.whitelist_email_addresses))
    or exists (select 1 from public.allowed_signup_domains d where lower(split_part(auth.jwt() ->> 'email', '@', 2)) = lower(d.apex_domain))
    or exists (select 1 from public.whitelist_email_addresses w where lower(w.email_address) = lower(auth.jwt() ->> 'email'))
    or coalesce((select p.is_superadmin from public.profiles p where p.id = auth.uid()), false);
$fn$;
revoke all on function public.can_sign_in() from public, anon;
grant execute on function public.can_sign_in() to authenticated;

-- 6. Access rules -----------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['llm_providers','llm_models','prompt_chains','prompt_chain_steps','prompt_chain_mix',
                           'llm_prompt_chains','llm_responses','terms','generation_examples',
                           'allowed_signup_domains','whitelist_email_addresses']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "Admins manage %s" on public.%I', t, t);
    execute format('create policy "Admins manage %s" on public.%I for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin())', t, t);
  end loop;

  -- Members' AI calls read the prompt configuration...
  foreach t in array array['llm_providers','llm_models','prompt_chains','prompt_chain_steps','prompt_chain_mix','terms','generation_examples']
  loop
    execute format('drop policy if exists "Members read %s" on public.%I', t, t);
    execute format('create policy "Members read %s" on public.%I for select to authenticated using (true)', t, t);
  end loop;

  -- ...and log their own runs and responses.
  foreach t in array array['llm_prompt_chains','llm_responses']
  loop
    execute format('drop policy if exists "Members log own %s" on public.%I', t, t);
    execute format('create policy "Members log own %s" on public.%I for insert to authenticated with check ((select auth.uid()) = profile_id)', t, t);
  end loop;
end $$;


-- 6b. Images: admins can manage member uploads (and their Storage files).
alter table public.uploads add column if not exists description text;
grant select, insert, update, delete on public.uploads to authenticated;
drop policy if exists "Admins manage uploads" on public.uploads;
create policy "Admins manage uploads" on public.uploads for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists "Admins manage upload files" on storage.objects;
create policy "Admins manage upload files" on storage.objects for all to authenticated
  using (bucket_id = 'uploads' and public.is_superadmin()) with check (bucket_id = 'uploads' and public.is_superadmin());

-- 7. Seed data ------------------------------------------------------------------------------
insert into public.llm_providers (name) values ('OpenAI'), ('Google'), ('xAI') on conflict (name) do nothing;

insert into public.llm_models (name, llm_provider_id, provider_model_id, is_temperature_supported)
select v.name, p.id, v.model_id, v.temp
from (values
  ('Gemini 3.8 Flash', 'Google', 'gemini-3.8-flash', true),
  ('Gemini Flash (latest)', 'Google', 'gemini-flash-latest', true),
  ('GPT-4.1', 'OpenAI', 'gpt-4.1-2025-04-14', true),
  ('GPT-4o-mini', 'OpenAI', 'gpt-4o-mini-2024-07-18', true),
  ('Grok-2-vision', 'xAI', 'grok-2-vision', false)
) as v(name, provider, model_id, temp)
join public.llm_providers p on p.name = v.provider
on conflict (provider_model_id) do nothing;

insert into public.prompt_chains (slug, description) values
  ('quick-picks', 'One step: read the mood and return three NYC spots as JSON.'),
  ('think-then-pick', 'Two steps: first turn the mood into concrete needs, then pick three spots that meet them.'),
  ('suggest-another', 'One step: add one more spot to an existing mood, avoiding places already suggested.')
on conflict (slug) do nothing;

insert into public.prompt_chain_steps (prompt_chain_id, step_order, llm_model_id, step_type, input_type, output_type, system_prompt, user_prompt, temperature)
select c.id, v.step_order, m.id, v.step_type, 'text-only', v.output_type, v.system_prompt, v.user_prompt, v.temperature
from (values
  ('quick-picks', 1, 'general', 'json',
   'You recommend real, currently operating places in New York City to Columbia University students. Many are new to the city, live near Morningside Heights, travel by subway and are on a student budget.',
   'A student is in the mood for: "{mood}". {about} Recommend {count} specific places (cafes, parks, museums, bookstores, food spots, viewpoints...). Mix well-known and lesser-known picks. {terms} {examples} Reply with JSON only: an array of objects with keys "name", "area" (neighborhood), "why" (one punchy sentence, max 25 words) and "price" (one of "Free", "$", "$$", "$$$").',
   0.8),
  ('think-then-pick', 1, 'general', 'string',
   'You are a thoughtful NYC local who helps students figure out what they actually need from an outing.',
   'A student is in the mood for: "{mood}". {about} {terms} In 3-5 short bullet lines, spell out what this mood needs: budget, vibe, noise level, indoor/outdoor, distance, time of day. Do not name any places yet.',
   0.4),
  ('think-then-pick', 2, 'general', 'json',
   'You recommend real, currently operating places in New York City to Columbia University students on a student budget.',
   'A student is in the mood for: "{mood}". Their needs, worked out in the previous step: {previous} Recommend {count} specific places that meet those needs. {examples} Reply with JSON only: an array of objects with keys "name", "area", "why" (max 25 words, refer to the needs) and "price" (one of "Free", "$", "$$", "$$$").',
   0.8),
  ('suggest-another', 1, 'general', 'json',
   'You recommend real, currently operating places in New York City to Columbia University students.',
   'A student is in the mood for: "{mood}". {about} Recommend {count} more specific place. Do not repeat any of these: {avoid}. {terms} Reply with JSON only: an array of objects with keys "name", "area", "why" (max 25 words) and "price" (one of "Free", "$", "$$", "$$$").',
   0.9)
) as v(slug, step_order, step_type, output_type, system_prompt, user_prompt, temperature)
join public.prompt_chains c on c.slug = v.slug
cross join lateral (select id from public.llm_models where provider_model_id = 'gemini-3.8-flash') m
on conflict (prompt_chain_id, step_order) do nothing;

insert into public.prompt_chain_mix (prompt_chain_id, weight)
select id, case slug when 'quick-picks' then 50 when 'think-then-pick' then 50 else 0 end
from public.prompt_chains
on conflict (prompt_chain_id) do nothing;

insert into public.terms (term, term_type, definition, example, priority)
select * from (values
  ('bodega', 'Noun', 'A small corner store that sells snacks, coffee and sandwiches, often open late.', 'Grab a BEC from the bodega before class.', 60),
  ('BEC', 'Noun', 'Bacon, egg and cheese on a roll: the classic NYC breakfast sandwich.', 'A $6 BEC is the best study fuel.', 50),
  ('third place', 'Noun', 'A spot that is neither home nor school where you can hang out, like a cafe, library or park.', 'Hungarian Pastry Shop is my third place.', 80),
  ('uptown / downtown', 'Adjective', 'North / south in Manhattan; also the direction a subway train is heading.', 'Take the 1 downtown to get to the West Village.', 40),
  ('stoop', 'Noun', 'The front steps of a brownstone, a classic place to sit and people-watch.', 'We ate dollar slices on a stoop in Harlem.', 30)
) as v(term, term_type, definition, example, priority)
where not exists (select 1 from public.terms);

insert into public.generation_examples (mood, example_output, explanation, priority)
select * from (values
  ('rainy day study spot, under $15',
   '[{"name":"Hungarian Pastry Shop","area":"Morningside Heights","why":"Endless coffee refills, no Wi-Fi to distract you, and pastries under $5.","price":"$"}]',
   'Good pick: close to campus, cheap, and the reason speaks to the mood.', 80),
  ('cheap first date',
   '[{"name":"Little Island","area":"Meatpacking District","why":"Free, beautiful at sunset, and walking gives you something to talk about.","price":"Free"}]',
   'Good pick: free, memorable, and the reason explains why it works for a date.', 70)
) as v(mood, example_output, explanation, priority)
where not exists (select 1 from public.generation_examples);

insert into public.allowed_signup_domains (apex_domain) values ('columbia.edu'), ('barnard.edu')
on conflict (apex_domain) do nothing;

-- Everyone who already uses the app stays allowed (incl. the TA).
insert into public.whitelist_email_addresses (email_address)
select lower(email) from public.profiles
where email is not null and lower(split_part(email, '@', 2)) not in ('columbia.edu', 'barnard.edu')
on conflict (email_address) do nothing;

-- 8. Backfill: turn existing AI picks into chain runs + LLM responses -------------------------
insert into public.llm_prompt_chains (prompt_chain_id, spot_request_id, profile_id, created_datetime_utc)
select (select id from public.prompt_chains where slug = 'quick-picks'), r.id, r.author_id, r.created_at
from public.spot_requests r
where not exists (select 1 from public.llm_prompt_chains c where c.spot_request_id = r.id);

insert into public.llm_responses (created_datetime_utc, llm_model_id, provider_model_id, spot_request_id, profile_id,
                                  prompt_chain_id, llm_prompt_chain_id, prompt_chain_step_id, user_prompt, response)
select cap.created_at, m.id, cap.model, cap.request_id, cap.author_id,
       run.prompt_chain_id, run.id,
       (select s.id from public.prompt_chain_steps s where s.prompt_chain_id = run.prompt_chain_id and s.step_order = 1),
       cap.prompt, cap.content
from public.captions cap
join public.llm_prompt_chains run on run.spot_request_id = cap.request_id
left join public.llm_models m on m.provider_model_id = cap.model
where cap.request_id is not null
  and not exists (select 1 from public.llm_responses x where x.spot_request_id = cap.request_id);

-- Check
select 'providers' as t, count(*) from public.llm_providers
union all select 'models', count(*) from public.llm_models
union all select 'chains', count(*) from public.prompt_chains
union all select 'steps', count(*) from public.prompt_chain_steps
union all select 'runs', count(*) from public.llm_prompt_chains
union all select 'responses', count(*) from public.llm_responses
union all select 'terms', count(*) from public.terms
union all select 'examples', count(*) from public.generation_examples
union all select 'domains', count(*) from public.allowed_signup_domains
union all select 'whitelist', count(*) from public.whitelist_email_addresses;
