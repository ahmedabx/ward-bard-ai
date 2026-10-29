-- Practice: topics taxonomy + sessions + per-item storage (merges Qbank Maker & My Patient)
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  exam text not null check (exam in ('step1','step2ck','mbbs_fcps')),
  mode text not null check (mode in ('preclinical','clinical')),
  system text not null,
  name text not null,
  parent_id uuid references public.topics(id),
  case_eligible boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (exam, mode, system, name)
);

create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  format text not null check (format in ('questions','cases')),
  exam text check (exam in ('step1','step2ck','mbbs_fcps')),
  mode text not null check (mode in ('preclinical','clinical')),
  topic_ids uuid[] not null default '{}'::uuid[],
  custom_topic text,
  difficulty text not null default 'mixed' check (difficulty in ('easy','medium','mixed','hard')),
  item_count int not null default 5,
  status text not null default 'active' check (status in ('active','generating','completed','abandoned')),
  score int,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.practice_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  user_id uuid not null,
  topic_id uuid references public.topics(id),
  item_type text not null check (item_type in ('mcq','case_checkpoint')),
  payload jsonb not null,
  user_answer text,
  is_correct boolean,
  time_spent_ms int,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Grants (required for the Data API)
grant select on public.topics to authenticated;
grant all on public.topics to service_role;
grant select, insert, update, delete on public.practice_sessions to authenticated;
grant all on public.practice_sessions to service_role;
grant select, insert, update, delete on public.practice_items to authenticated;
grant all on public.practice_items to service_role;

alter table public.topics enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.practice_items enable row level security;

-- Topics are shared reference data: readable by any signed-in user.
create policy "Topics readable by authenticated users"
  on public.topics for select to authenticated using (true);

-- Sessions and items are strictly per-user.
create policy "Users manage their own practice sessions"
  on public.practice_sessions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users manage their own practice items"
  on public.practice_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index topics_exam_mode_idx on public.topics (exam, mode, sort_order);
create index topics_case_eligible_idx on public.topics (case_eligible) where case_eligible;
create index practice_sessions_user_started_idx on public.practice_sessions (user_id, started_at desc);
create index practice_items_session_idx on public.practice_items (session_id, sort_order);

-- ---- Legacy backfill: keep every existing quiz and case working (additive, no data loss) ----
-- Old Qbank quizzes become questions-format Practice sessions.
insert into public.practice_sessions (id, user_id, format, exam, mode, topic_ids, difficulty, item_count, status, score, started_at, completed_at)
select q.id, q.user_id, 'questions', null, q.mode, '{}'::uuid[], q.difficulty,
  coalesce(jsonb_array_length(q.questions), 0),
  case when q.completed then 'completed' else 'active' end,
  q.score, q.created_at, case when q.completed then q.updated_at else null end
from public.qbank_quizzes q
where not exists (select 1 from public.practice_sessions ps where ps.id = q.id);

-- Their questions become mcq items (topic_id null: generated before the topics table existed).
insert into public.practice_items (session_id, user_id, topic_id, item_type, payload, user_answer, is_correct, sort_order)
select s.id, s.user_id, null, 'mcq', q.value,
  qb.answers ->> ((q.ord - 1)::int),
  case when qb.answers ->> ((q.ord - 1)::int) is null then null
       else (qb.answers ->> ((q.ord - 1)::int)) = (q.value ->> 'answer') end,
  q.ord - 1
from public.practice_sessions s
join public.qbank_quizzes qb on qb.id = s.id,
lateral jsonb_array_elements(qb.questions) with ordinality as q(value, ord);

-- Old My Patient cases become cases-format Practice sessions.
insert into public.practice_sessions (id, user_id, format, exam, mode, topic_ids, difficulty, item_count, status, score, started_at, completed_at)
select pc.id, pc.user_id, 'cases', null, pc.mode, '{}'::uuid[], 'mixed',
  coalesce(jsonb_array_length(pc.decision_points), 0),
  case when pc.completed_at is not null then 'completed' else 'active' end,
  pc.final_score, pc.created_at, pc.completed_at
from public.patient_cases pc
where not exists (select 1 from public.practice_sessions ps where ps.id = pc.id);

-- Their decision points become case_checkpoint items distributed across the five stages.
insert into public.practice_items (session_id, user_id, topic_id, item_type, payload, user_answer, is_correct, sort_order)
select s.id, s.user_id, null, 'case_checkpoint',
  jsonb_build_object(
    'presentation', pc.chief_complaint,
    'specialty', pc.specialty,
    'mode', pc.mode,
    'case_index', 0,
    'stage', least(4, floor(((q.ord - 1) * 5) / 6)::int),
    'question', q.value->>'question',
    'options', q.value->'options',
    'stabilize_threshold', pc.stabilize_threshold,
    'critical_threshold', pc.critical_threshold,
    'starting_vitals', pc.starting_vitals
  ),
  case when jsonb_typeof(pc.progress->'log') = 'array' and jsonb_array_length(pc.progress->'log') >= q.ord
       then pc.progress->'log'->((q.ord-1)::int)->>'choice' end,
  case when jsonb_typeof(pc.progress->'log') = 'array' and jsonb_array_length(pc.progress->'log') >= q.ord
       then (pc.progress->'log'->((q.ord-1)::int)->>'score')::int > 0 end,
  q.ord - 1
from public.practice_sessions s
join public.patient_cases pc on pc.id = s.id,
lateral jsonb_array_elements(pc.decision_points) with ordinality as q(value, ord);