-- Cloud saves and leaderboards. Paste the whole file into Supabase: SQL Editor -> New query -> Run.
-- Safe to run again (it only adds what's missing and resets the rules to these).

-- Your name on the leaderboards
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null unique check (char_length(name) between 2 and 16 and name ~ '^[A-Za-z0-9 _.-]+$'),
  created_at timestamptz not null default now()
);

-- Your save: everything the game keeps in your browser, as one blob
create table if not exists public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null check (octet_length(data::text) < 500000),   -- (about half a megabyte at most)
  updated_at timestamptz not null default now()
);

-- Every score posted; a board shows each player's best. Boards ending in _time: lower is better; the rest, higher
create table if not exists public.scores (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  board text not null check (board ~ '^[a-z0-9_]{2,40}$'),
  value numeric not null check (value >= 0 and value < 1000000000),
  created_at timestamptz not null default now(),
  check (board <> 'hall_time' or value >= 20)   -- nobody gets out of the Hall of Reflections in under 20 seconds
);
create index if not exists scores_board_value on public.scores (board, value);

-- Each player's best on each board, with their name
create or replace view public.leaderboard with (security_invoker = true) as
select distinct on (s.board, s.user_id) s.board, s.user_id, p.name, s.value, s.created_at
from public.scores s
join public.profiles p on p.user_id = s.user_id
order by s.board, s.user_id, case when s.board like '%\_time' then s.value else -s.value end, s.created_at;

-- The rules: names and scores anyone can read; you can only write your own name, your own save, your own scores
alter table public.profiles enable row level security;
alter table public.saves enable row level security;
alter table public.scores enable row level security;

drop policy if exists "names are public" on public.profiles;
create policy "names are public" on public.profiles for select using (true);
drop policy if exists "you name yourself" on public.profiles;
create policy "you name yourself" on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "you rename yourself" on public.profiles;
create policy "you rename yourself" on public.profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "your save is yours" on public.saves;
create policy "your save is yours" on public.saves for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "scores are public" on public.scores;
create policy "scores are public" on public.scores for select using (true);
drop policy if exists "you post your own" on public.scores;
create policy "you post your own" on public.scores for insert to authenticated with check (user_id = (select auth.uid()));

-- What the game's key may touch at all (new tables aren't exposed by default in this project)
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.scores, public.leaderboard to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.saves to authenticated;
grant insert on public.scores to authenticated;
