-- Notas bimestrais: turmas, disciplinas e a média (MD) e as faltas (FT) de cada aluno em cada
-- disciplina e bimestre, lidas do boletim escolar em PDF do sistema da rede. Também completa o
-- cadastro dos alunos (0019) com matrícula, situação (transferido) e observações, lidos da
-- "Relação de alunos matriculados por turma".
--
-- Regras de acesso, iguais às de `students`: só a secretaria da própria escola (secretário e
-- assistentes) lê, envia e edita; só o secretário exclui. Professor e master não têm acesso.
-- Notas são dados de menores e vêm do sistema da rede: nunca entram no repositório.

-- 1. Cadastro dos alunos --------------------------------------------------------------------

alter table public.students
  -- Número de matrícula no sistema da rede: liga o boletim ao aluno mesmo com o nome grafado
  -- de outro jeito. Não é único: a lista às vezes repete o aluno remanejado.
  add column registration text check (registration is null or registration ~ '^[0-9]{1,12}$'),
  add column status text not null default 'active' check (status in ('active', 'transferred')),
  -- Data do "TRF dd/mm/aaaa" da lista da turma.
  add column transferred_on date,
  -- Observação da lista (ex.: "TEA/AUTISMO").
  add column notes text check (notes is null or char_length(notes) <= 200),
  add constraint students_transfer_date check (status = 'transferred' or transferred_on is null);
create index students_registration_idx on public.students (school_id, school_year, registration);

-- 2. Turmas ---------------------------------------------------------------------------------

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  school_year smallint not null check (school_year between 2000 and 2100),
  -- Mesmo nome usado em students.class_name e no dashboard (ex.: "5 ano A").
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- Ensino Fundamental I (1º ao 5º ano) ou II (6º ao 9º ano).
  segment text not null check (segment in ('ef1', 'ef2')),
  -- Como vem no PDF (ex.: "INTEGRAL").
  shift text not null default 'INTEGRAL' check (char_length(btrim(shift)) between 1 and 30),
  -- "Professores(a)" da lista de matriculados: o boletim não diz quem dá cada disciplina.
  teachers text check (teachers is null or char_length(teachers) <= 600),
  created_at timestamptz not null default now(),
  constraint classrooms_unique_name unique (school_id, school_year, name)
);

-- 3. Disciplinas ----------------------------------------------------------------------------

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  -- Como vem no boletim (ex.: "LÍNGUA PORTUGUESA").
  name text not null check (char_length(btrim(name)) between 1 and 120),
  -- Ordem do boletim.
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint subjects_unique_name unique (school_id, name)
);

-- 4. Notas ----------------------------------------------------------------------------------

create table public.grades (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  school_year smallint not null check (school_year between 2000 and 2100),
  term smallint not null check (term between 1 and 4),
  student_id uuid not null references public.students (id) on delete cascade,
  -- Turma do aluno no boletim.
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  -- Média do bimestre, de 0 a 10 com uma casa. Vazio: disciplina sem nota ("--" no boletim).
  md numeric(3, 1) check (md between 0 and 10),
  -- Faltas na disciplina no bimestre.
  ft smallint check (ft between 0 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grades_unique unique (student_id, subject_id, term)
);
create index grades_term_idx on public.grades (school_id, school_year, term);
create index grades_classroom_idx on public.grades (classroom_id);

-- Último envio de cada segmento no ano: até que bimestre foi gravado, o arquivo, quem e quando.
create table public.grade_imports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  school_year smallint not null check (school_year between 2000 and 2100),
  segment text not null check (segment in ('ef1', 'ef2')),
  up_to_term smallint not null check (up_to_term between 1 and 4),
  file_name text check (file_name is null or char_length(file_name) <= 200),
  row_count integer not null default 0,
  imported_by uuid references public.profiles (id) on delete set null,
  imported_by_name text,
  imported_at timestamptz not null default now(),
  constraint grade_imports_unique unique (school_id, school_year, segment)
);

-- 5. Integridade ----------------------------------------------------------------------------

-- Aluno, turma e disciplina de uma nota precisam ser da mesma escola. Datas vêm do servidor.
create function public.grades_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.school_id := old.school_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  if not exists (select 1 from public.students s where s.id = new.student_id and s.school_id = new.school_id) then
    raise exception 'O aluno não é desta escola.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.classrooms c where c.id = new.classroom_id and c.school_id = new.school_id) then
    raise exception 'A turma não é desta escola.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.subjects s where s.id = new.subject_id and s.school_id = new.school_id) then
    raise exception 'A disciplina não é desta escola.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger grades_guard_trg
  before insert or update on public.grades
  for each row execute function public.grades_guard();
revoke execute on function public.grades_guard() from public, anon, authenticated;

-- 6. Acesso ---------------------------------------------------------------------------------

alter table public.classrooms enable row level security;
alter table public.subjects enable row level security;
alter table public.grades enable row level security;
alter table public.grade_imports enable row level security;

grant select, insert, update, delete on public.classrooms, public.subjects, public.grades to authenticated;
-- O registro do envio só é gravado pela função save_grades.
grant select on public.grade_imports to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['classrooms', 'subjects', 'grades'] loop
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
    execute format(
      'create policy %1$s_delete on public.%1$s for delete using (
         public.current_role_name() = ''secretary'' and school_id = public.current_school_id())', t);
  end loop;
end $$;

create policy grade_imports_read on public.grade_imports
  for select using (
    school_id = public.current_school_id()
    and public.current_role_name() in ('secretary', 'assistant')
  );

-- 7. Envio do boletim -----------------------------------------------------------------------

-- Grava as notas de um segmento do 1º até o bimestre escolhido, numa transação só: apaga as
-- notas desses bimestres nas turmas do segmento e insere as novas. Bimestres depois do
-- escolhido ficam como estão. O assistente também envia, mas não exclui notas soltas: por
-- isso a troca passa por esta função, que confere o papel e a escola de quem chama.
-- Formato compacto (o EF II passa de 15 mil notas): p_rows é uma lista de
-- [aluno, turma, disciplina, bimestre, md, ft], em que aluno, turma e disciplina são posições
-- (a partir de 0) em p_students, p_classrooms e p_subjects.
create function public.save_grades(
  p_school_year smallint, p_segment text, p_up_to_term smallint, p_file_name text,
  p_students uuid[], p_classrooms uuid[], p_subjects uuid[], p_rows jsonb
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := public.current_school_id();
  v_count integer;
begin
  if public.current_role_name() not in ('secretary', 'assistant') or v_school is null then
    raise exception 'Sem permissão para enviar notas.' using errcode = '42501';
  end if;
  if p_segment not in ('ef1', 'ef2') or p_up_to_term not between 1 and 4 then
    raise exception 'Segmento ou bimestre inválido.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'Notas inválidas.' using errcode = 'P0001';
  end if;
  -- As turmas precisam ser desta escola e do segmento; os bimestres, até o escolhido.
  if exists (
    select 1 from unnest(p_classrooms) as t (id)
    left join public.classrooms c on c.id = t.id and c.school_id = v_school
    where c.segment is distinct from p_segment
  ) or exists (
    select 1 from jsonb_array_elements(p_rows) r
    where jsonb_typeof(r) <> 'array' or (r ->> 3)::smallint not between 1 and p_up_to_term
  ) then
    raise exception 'Há notas de outro segmento ou de bimestre não escolhido.' using errcode = 'P0001';
  end if;

  delete from public.grades g
  using public.classrooms c
  where g.classroom_id = c.id
    and g.school_id = v_school and g.school_year = p_school_year
    and c.segment = p_segment and g.term <= p_up_to_term;

  -- O gatilho grades_guard confere que aluno, turma e disciplina são desta escola.
  insert into public.grades (school_id, school_year, term, student_id, classroom_id, subject_id, md, ft)
  select v_school, p_school_year, (r ->> 3)::smallint,
         p_students[(r ->> 0)::int + 1], p_classrooms[(r ->> 1)::int + 1], p_subjects[(r ->> 2)::int + 1],
         (r ->> 4)::numeric(3, 1), (r ->> 5)::smallint
  from jsonb_array_elements(p_rows) r;
  get diagnostics v_count = row_count;

  insert into public.grade_imports
    (school_id, school_year, segment, up_to_term, file_name, row_count, imported_by, imported_by_name, imported_at)
  values (v_school, p_school_year, p_segment, p_up_to_term, left(p_file_name, 200), v_count, auth.uid(),
          (select full_name from public.profiles where id = auth.uid()), now())
  on conflict (school_id, school_year, segment) do update set
    up_to_term = excluded.up_to_term, file_name = excluded.file_name, row_count = excluded.row_count,
    imported_by = excluded.imported_by, imported_by_name = excluded.imported_by_name,
    imported_at = excluded.imported_at;
  return v_count;
end $$;
revoke execute on function public.save_grades(smallint, text, smallint, text, uuid[], uuid[], uuid[], jsonb)
  from public, anon;
grant execute on function public.save_grades(smallint, text, smallint, text, uuid[], uuid[], uuid[], jsonb)
  to authenticated;
