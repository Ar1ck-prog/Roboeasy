-- Classes and the built-in pilot: teachers create classes, learners join with a
-- code, a nickname and a 4-digit PIN (no email or phone). Learners are anonymous
-- Supabase users; results hang on the membership, so a learner can come back
-- from another computer with the same nickname and PIN.
-- Every table has RLS. Learners write only through the functions below.

create extension if not exists pgcrypto with schema extensions;

-- True for a signed-in account with an email; anonymous learners cannot run a class.
create function public.is_real_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
$$;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  post_open boolean not null default false,
  created_at timestamptz not null default now()
);
create index classes_teacher on public.classes (teacher_id);
alter table public.classes enable row level security;
create policy "classes: teacher reads" on public.classes for select using (teacher_id = auth.uid() and public.is_real_user());
create policy "classes: teacher updates" on public.classes for update using (teacher_id = auth.uid() and public.is_real_user()) with check (teacher_id = auth.uid());
create policy "classes: teacher deletes" on public.classes for delete using (teacher_id = auth.uid() and public.is_real_user());

create table public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes on delete cascade,
  user_id uuid references auth.users on delete set null,
  nickname text not null check (char_length(btrim(nickname)) between 1 and 24),
  lessons_done integer not null default 0 check (lessons_done >= 0),
  joined_at timestamptz not null default now()
);
create unique index class_members_nickname on public.class_members (class_id, lower(btrim(nickname)));
create index class_members_user on public.class_members (user_id);
alter table public.class_members enable row level security;

-- Separate, with no policies at all: nothing in the browser can read a PIN hash.
create table public.class_member_secrets (
  member_id uuid primary key references public.class_members on delete cascade,
  pin_hash text not null,
  failed integer not null default 0,
  locked_until timestamptz
);
alter table public.class_member_secrets enable row level security;

create function public.owns_member(member uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.class_members where id = member and user_id = auth.uid())
$$;

create function public.teaches_member(member uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_real_user() and exists (
    select 1 from public.class_members m join public.classes c on c.id = m.class_id
    where m.id = member and c.teacher_id = auth.uid()
  )
$$;

create policy "members: self or teacher reads" on public.class_members for select using (user_id = auth.uid() or public.teaches_member(id));
create policy "members: teacher removes" on public.class_members for delete using (public.teaches_member(id));

create table public.pilot_answer_key (question_id text primary key, correct integer not null);
alter table public.pilot_answer_key enable row level security;

create table public.pilot_tests (
  member_id uuid not null references public.class_members on delete cascade,
  kind text not null check (kind in ('pre', 'post')),
  score integer not null,
  total integer not null,
  at timestamptz not null default now(),
  primary key (member_id, kind)
);
alter table public.pilot_tests enable row level security;
create policy "tests: self or teacher reads" on public.pilot_tests for select using (public.owns_member(member_id) or public.teaches_member(member_id));

create table public.pilot_tasks (
  member_id uuid not null references public.class_members on delete cascade,
  task_id text not null check (char_length(task_id) <= 40),
  passed boolean not null,
  hints integer not null check (hints >= 0),
  attempts integer not null check (attempts >= 1),
  seconds integer not null check (seconds >= 0),
  at timestamptz not null default now(),
  primary key (member_id, task_id)
);
alter table public.pilot_tasks enable row level security;
create policy "tasks: self or teacher reads" on public.pilot_tasks for select using (public.owns_member(member_id) or public.teaches_member(member_id));

create table public.pilot_surveys (
  member_id uuid primary key references public.class_members on delete cascade,
  clarity integer not null check (clarity between 1 and 5),
  at timestamptz not null default now()
);
alter table public.pilot_surveys enable row level security;
create policy "surveys: self or teacher reads" on public.pilot_surveys for select using (public.owns_member(member_id) or public.teaches_member(member_id));

create table public.class_attendance (
  member_id uuid not null references public.class_members on delete cascade,
  day date not null,
  primary key (member_id, day)
);
alter table public.class_attendance enable row level security;
create policy "attendance: self or teacher reads" on public.class_attendance for select using (public.owns_member(member_id) or public.teaches_member(member_id));

-- ── Teacher ─────────────────────────────────────────────────────────────

create function public.create_class(p_name text) returns public.classes
language plpgsql security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
  created public.classes;
begin
  if not public.is_real_user() then raise exception 'teacher_account_required'; end if;
  if (select count(*) from public.classes where teacher_id = auth.uid()) >= 30 then raise exception 'too_many_classes'; end if;
  loop
    select string_agg(substr(alphabet, 1 + get_byte(extensions.gen_random_bytes(1), 0) % 32, 1), '') into new_code from generate_series(1, 6);
    begin
      insert into public.classes (teacher_id, name, code) values (auth.uid(), btrim(p_name), new_code) returning * into created;
      return created;
    exception when unique_violation then
      -- Another class has this code: draw again.
    end;
  end loop;
end
$$;

-- ── Learner ─────────────────────────────────────────────────────────────

create function public.join_class(p_code text, p_nickname text, p_pin text)
returns table (member_id uuid, class_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  target public.classes;
  existing public.class_members;
  secret public.class_member_secrets;
  nick text := btrim(p_nickname);
  created uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'bad_pin'; end if;
  if char_length(nick) not between 1 and 24 then raise exception 'bad_nickname'; end if;
  select * into target from public.classes c where c.code = upper(btrim(p_code));
  if target.id is null then raise exception 'class_not_found'; end if;

  select * into existing from public.class_members m where m.class_id = target.id and lower(btrim(m.nickname)) = lower(nick);
  if existing.id is null then
    insert into public.class_members (class_id, user_id, nickname) values (target.id, auth.uid(), nick) returning id into created;
    insert into public.class_member_secrets (member_id, pin_hash) values (created, extensions.crypt(p_pin, extensions.gen_salt('bf')));
    return query select created, target.id;
    return;
  end if;

  -- The nickname is taken: it is this learner coming back only if the PIN matches.
  select * into secret from public.class_member_secrets s where s.member_id = existing.id for update;
  if secret.locked_until is not null and secret.locked_until > now() then raise exception 'pin_locked'; end if;
  if secret.pin_hash <> extensions.crypt(p_pin, secret.pin_hash) then
    update public.class_member_secrets s set
      failed = case when s.failed + 1 >= 5 then 0 else s.failed + 1 end,
      locked_until = case when s.failed + 1 >= 5 then now() + interval '15 minutes' else null end
    where s.member_id = existing.id;
    -- Raising would roll the counter back, so the failure is returned as "no row".
    return;
  end if;
  update public.class_member_secrets s set failed = 0, locked_until = null where s.member_id = existing.id;
  update public.class_members m set user_id = auth.uid() where m.id = existing.id;
  return query select existing.id, target.id;
end
$$;

create function public.my_class_status()
returns table (member_id uuid, class_id uuid, class_name text, nickname text, post_open boolean, pre_score integer, post_score integer, total integer, tasks_done text[], survey_done boolean)
language sql stable security definer set search_path = '' as $$
  select m.id, c.id, c.name, m.nickname, c.post_open,
    (select t.score from public.pilot_tests t where t.member_id = m.id and t.kind = 'pre'),
    (select t.score from public.pilot_tests t where t.member_id = m.id and t.kind = 'post'),
    (select count(*)::integer from public.pilot_answer_key),
    coalesce((select array_agg(t.task_id) from public.pilot_tasks t where t.member_id = m.id and t.passed), '{}'),
    exists (select 1 from public.pilot_surveys s where s.member_id = m.id)
  from public.class_members m join public.classes c on c.id = m.class_id
  where m.user_id = auth.uid()
  order by m.joined_at desc
$$;

-- One attempt per test. The score is computed here, from a key the browser cannot read.
create function public.submit_pilot_test(p_member uuid, p_kind text, p_answers jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  got integer;
  all_questions integer;
  saved integer;
begin
  if not public.owns_member(p_member) then raise exception 'not_your_membership'; end if;
  if p_kind not in ('pre', 'post') then raise exception 'bad_kind'; end if;
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'bad_answers'; end if;
  if p_kind = 'post' and not exists (
    select 1 from public.class_members m join public.classes c on c.id = m.class_id where m.id = p_member and c.post_open
  ) then raise exception 'post_test_closed'; end if;
  select count(*) filter (where p_answers ->> k.question_id = k.correct::text), count(*) into got, all_questions from public.pilot_answer_key k;
  insert into public.pilot_tests (member_id, kind, score, total) values (p_member, p_kind, got, all_questions) on conflict do nothing;
  select t.score into saved from public.pilot_tests t where t.member_id = p_member and t.kind = p_kind;
  return saved;
end
$$;

-- A solved task stays solved, with the numbers of the try that solved it.
create function public.record_pilot_task(p_member uuid, p_task text, p_passed boolean, p_hints integer, p_attempts integer, p_seconds integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.owns_member(p_member) then raise exception 'not_your_membership'; end if;
  insert into public.pilot_tasks as t (member_id, task_id, passed, hints, attempts, seconds)
  values (p_member, p_task, p_passed, greatest(p_hints, 0), greatest(p_attempts, 1), greatest(p_seconds, 0))
  on conflict (member_id, task_id) do update set
    passed = true, hints = excluded.hints, attempts = excluded.attempts, seconds = excluded.seconds, at = now()
    where not t.passed and excluded.passed;
end
$$;

create function public.submit_pilot_survey(p_member uuid, p_clarity integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.owns_member(p_member) then raise exception 'not_your_membership'; end if;
  insert into public.pilot_surveys (member_id, clarity) values (p_member, p_clarity)
  on conflict (member_id) do update set clarity = excluded.clarity, at = now();
end
$$;

-- Called when a learner opens the class page: a visit today and the lessons finished so far.
create function public.mark_attendance(p_member uuid, p_lessons integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.owns_member(p_member) then raise exception 'not_your_membership'; end if;
  insert into public.class_attendance (member_id, day) values (p_member, (timezone('Asia/Almaty', now()))::date) on conflict do nothing;
  update public.class_members m set lessons_done = greatest(m.lessons_done, least(greatest(p_lessons, 0), 1000)) where m.id = p_member;
end
$$;

-- A learner can leave and take their results with them.
create function public.leave_class(p_member uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.owns_member(p_member) then raise exception 'not_your_membership'; end if;
  delete from public.class_members m where m.id = p_member;
end
$$;

revoke all on function public.is_real_user(), public.owns_member(uuid), public.teaches_member(uuid) from public, anon;
grant execute on function public.is_real_user(), public.owns_member(uuid), public.teaches_member(uuid) to authenticated;
revoke all on function
  public.create_class(text), public.join_class(text, text, text), public.my_class_status(),
  public.submit_pilot_test(uuid, text, jsonb), public.record_pilot_task(uuid, text, boolean, integer, integer, integer),
  public.submit_pilot_survey(uuid, integer), public.mark_attendance(uuid, integer), public.leave_class(uuid)
from public, anon;
grant execute on function
  public.create_class(text), public.join_class(text, text, text), public.my_class_status(),
  public.submit_pilot_test(uuid, text, jsonb), public.record_pilot_task(uuid, text, boolean, integer, integer, integer),
  public.submit_pilot_survey(uuid, integer), public.mark_attendance(uuid, integer), public.leave_class(uuid)
to authenticated;

-- Generated from content/pilot/test.json (a test checks they match).
insert into public.pilot_answer_key (question_id, correct) values
  ('senses', 0),
  ('hub', 1),
  ('motor', 2),
  ('distance', 3),
  ('color', 0),
  ('force', 1),
  ('program', 2),
  ('order', 3),
  ('loop', 0),
  ('square-count', 2),
  ('square-angle', 1),
  ('condition', 3),
  ('rotation', 0),
  ('big-wheel', 1),
  ('miss', 2),
  ('bug', 3),
  ('debug', 0),
  ('gyro', 1),
  ('reflection', 2),
  ('sensor-loop', 3);
