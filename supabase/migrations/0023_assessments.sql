-- Avaliações com cartão-resposta (página avaliacoes.html): a avaliação (gabarito, descritores e
-- lista de alunos com o número impresso no cartão) e os cartões corrigidos (um por aluno).
--
-- Regras de acesso, iguais às das notas (0021): só a secretaria da própria escola (secretário e
-- assistentes) lê, cria e corrige; só o secretário exclui avaliações. Professor e master não têm
-- acesso. Respostas de alunos são dados de menores: nunca entram no repositório.
--
-- Gabarito, alunos e descritores próprios ficam em jsonb: são sempre lidos e gravados junto com a
-- avaliação, e o cliente valida o formato ao ler (isAssessment em src/utils/assessments.ts).

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  -- Impresso no cartão (9 bits): único por escola.
  code smallint not null check (code between 1 and 511),
  title text not null default '' check (char_length(title) <= 120),
  applied_on date not null,
  class_name text not null default '' check (char_length(class_name) <= 60),
  classroom_id uuid references public.classrooms (id) on delete set null,
  grade smallint not null check (grade between 1 and 9),
  -- Só Língua Portuguesa e Matemática neste módulo.
  subject text not null check (subject in ('lp', 'mt')),
  matrix text not null check (matrix in ('saeb9', 'cnca1', 'custom')),
  alternatives smallint not null default 4 check (alternatives in (4, 5)),
  critical_threshold numeric(3, 2) not null default 0.5 check (critical_threshold between 0 and 1),
  -- [{ number, key: "A".."E" | null, descriptorCodes: [] }] — validado no cliente (isAssessment).
  questions jsonb not null default '[]' check (
    case when jsonb_typeof(questions) = 'array' then jsonb_array_length(questions) <= 45 else false end),
  -- [{ slot, studentId, name, rollNumber }] — número fixo de cada aluno, impresso no cartão.
  roster jsonb not null default '[]' check (
    case when jsonb_typeof(roster) = 'array' then jsonb_array_length(roster) <= 127 else false end),
  -- Descritores próprios da escola (matriz "custom").
  custom_descriptors jsonb not null default '[]' check (jsonb_typeof(custom_descriptors) = 'array'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessments_unique_code unique (school_id, code)
);
create index assessments_school_idx on public.assessments (school_id, applied_on desc);

create table public.answer_sheets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  slot smallint not null check (slot between 1 and 127),
  student_id uuid references public.students (id) on delete set null,
  student_name text not null check (char_length(student_name) between 1 and 160),
  -- Resposta final de cada questão ("A".."E" ou null = em branco/anulada).
  answers text[] not null check (
    coalesce(array_length(answers, 1), 0) <= 45
    and array_remove(answers, null) <@ array['A', 'B', 'C', 'D', 'E']),
  -- O que o leitor viu em cada questão.
  flags text[] not null check (
    coalesce(array_length(flags, 1), 0) <= 45
    and flags <@ array['ok', 'blank', 'multiple', 'uncertain']),
  source text not null check (source in ('camera', 'image', 'pdf', 'manual')),
  edited boolean not null default false,
  scanned_by uuid references public.profiles (id) on delete set null,
  scanned_at timestamptz not null default now(),
  -- Um cartão por aluno por avaliação: salvar de novo substitui (upsert).
  constraint answer_sheets_unique unique (assessment_id, slot)
);
create index answer_sheets_assessment_idx on public.answer_sheets (assessment_id);

-- Cartão e avaliação da mesma escola; autoria e datas vêm do servidor.
create function public.answer_sheets_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.assessments a where a.id = new.assessment_id and a.school_id = new.school_id) then
    raise exception 'A avaliação não é desta escola.' using errcode = 'P0001';
  end if;
  if new.student_id is not null
     and not exists (select 1 from public.students s where s.id = new.student_id and s.school_id = new.school_id) then
    raise exception 'O aluno não é desta escola.' using errcode = 'P0001';
  end if;
  new.scanned_by := auth.uid();
  new.scanned_at := now();
  return new;
end $$;
create trigger answer_sheets_guard_trg
  before insert or update on public.answer_sheets
  for each row execute function public.answer_sheets_guard();
revoke execute on function public.answer_sheets_guard() from public, anon, authenticated;

create function public.assessments_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
  else
    new.school_id := old.school_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger assessments_guard_trg
  before insert or update on public.assessments
  for each row execute function public.assessments_guard();
revoke execute on function public.assessments_guard() from public, anon, authenticated;

alter table public.assessments enable row level security;
alter table public.answer_sheets enable row level security;
grant select, insert, update, delete on public.assessments, public.answer_sheets to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['assessments', 'answer_sheets'] loop
    execute format(
      'create policy %1$s_read on public.%1$s for select using (
         school_id = public.current_school_id()
         and public.current_role_name() in (''secretary'', ''assistant''))', t);
    execute format(
      'create policy %1$s_insert on public.%1$s for insert with check (
         public.current_role_name() in (''secretary'', ''assistant'')
         and school_id = public.current_school_id())', t);
    execute format(
      'create policy %1$s_update on public.%1$s for update using (
         public.current_role_name() in (''secretary'', ''assistant'')
         and school_id = public.current_school_id()
       ) with check (
         public.current_role_name() in (''secretary'', ''assistant'')
         and school_id = public.current_school_id())', t);
  end loop;
end $$;

-- Excluir avaliação: só o secretário. Excluir um cartão (para corrigir de novo): a secretaria.
create policy assessments_delete on public.assessments for delete using (
  public.current_role_name() = 'secretary' and school_id = public.current_school_id());
create policy answer_sheets_delete on public.answer_sheets for delete using (
  public.current_role_name() in ('secretary', 'assistant') and school_id = public.current_school_id());
