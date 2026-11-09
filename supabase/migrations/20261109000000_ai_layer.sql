-- AI layer: answer cache, shared rate limits and usage counters.
-- All three tables are written only by the server (service role): RLS is on and
-- no policy lets anon or signed-in users write. No text of children's requests
-- is stored in ai_usage; rate_limits holds only keyed hashes.

-- ── Cache of generated programs ─────────────────────────────────────────

create table public.gen_cache (
  key text primary key check (char_length(key) = 64),
  mode text not null check (mode in ('blocks', 'python', 'python-free')),
  dsl_version integer not null,
  response jsonb not null check (pg_column_size(response) < 64000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index gen_cache_expires on public.gen_cache (expires_at);
alter table public.gen_cache enable row level security;

-- ── Rate limits shared by all server instances ──────────────────────────

create table public.rate_limits (
  key text not null check (char_length(key) <= 120),
  window_start timestamptz not null,
  hits integer not null default 1,
  expires_at timestamptz not null,
  primary key (key, window_start)
);
create index rate_limits_expires on public.rate_limits (expires_at);
alter table public.rate_limits enable row level security;

-- Counts one hit in the current fixed window. Atomic, so parallel requests cannot slip past the limit.
create function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns table (allowed boolean, remaining integer, retry_after integer)
language plpgsql security definer set search_path = '' as $$
declare
  now_epoch double precision := extract(epoch from now());
  start_epoch double precision := floor(now_epoch / p_window_seconds) * p_window_seconds;
  used integer;
begin
  insert into public.rate_limits as r (key, window_start, hits, expires_at)
  values (p_key, to_timestamp(start_epoch), 1, to_timestamp(start_epoch + p_window_seconds))
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into used;
  return query select
    used <= p_limit,
    greatest(p_limit - used, 0),
    case when used <= p_limit then 0 else greatest(1, ceil(start_epoch + p_window_seconds - now_epoch)::integer) end;
end
$$;

-- ── Usage counters (no request text) ────────────────────────────────────

create table public.ai_usage (
  id bigint generated always as identity primary key,
  day date not null default (timezone('utc', now()))::date,
  at timestamptz not null default now(),
  kind text not null check (kind in ('generate', 'mentor', 'site_mentor', 'fll_plan', 'video', 'vibe')),
  model text check (char_length(model) <= 80),
  cached boolean not null default false,
  ok boolean not null,
  error text check (error in ('quota', 'overload', 'timeout', 'invalid', 'other'))
);
create index ai_usage_day on public.ai_usage (day);
alter table public.ai_usage enable row level security;
create policy "ai usage: admins read" on public.ai_usage for select using (public.is_admin());

-- ── Housekeeping ────────────────────────────────────────────────────────

create function public.prune_ai_tables() returns void
language sql security definer set search_path = '' as $$
  delete from public.gen_cache where expires_at < now();
  delete from public.rate_limits where expires_at < now() - interval '1 day';
  delete from public.ai_usage where at < now() - interval '180 days';
$$;

revoke all on function public.rate_limit_hit(text, integer, integer), public.prune_ai_tables() from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer), public.prune_ai_tables() to service_role;
