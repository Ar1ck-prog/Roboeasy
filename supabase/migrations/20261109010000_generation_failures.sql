-- Generations that failed a check, for improving the prompt.
-- The server writes (service role), admins read. The request is scrubbed of
-- contact details before it gets here (lib/ai/failures.ts).

create table public.generation_failures (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  prompt text not null check (char_length(prompt) <= 300),
  lang text not null check (lang in ('ru', 'kk', 'en')),
  mode text not null check (mode in ('blocks', 'python', 'python-free')),
  answer text not null check (char_length(answer) <= 4000),
  error text not null check (char_length(error) <= 1000),
  attempt integer not null check (attempt between 1 and 3)
);
create index generation_failures_at on public.generation_failures (at);
alter table public.generation_failures enable row level security;
create policy "generation failures: admins read" on public.generation_failures for select using (public.is_admin());

create or replace function public.prune_ai_tables() returns void
language sql security definer set search_path = '' as $$
  delete from public.gen_cache where expires_at < now();
  delete from public.rate_limits where expires_at < now() - interval '1 day';
  delete from public.ai_usage where at < now() - interval '180 days';
  delete from public.generation_failures where at < now() - interval '90 days';
$$;
