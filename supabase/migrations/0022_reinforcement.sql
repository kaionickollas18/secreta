-- Turma de reforço: alunos que a secretaria acompanha de perto. Mais adiante, as avaliações
-- bimestrais lançadas no sistema (com o assunto de cada questão) vão mostrar, para esses
-- alunos, onde estão as maiores dificuldades.
--
-- Regras de acesso, como as do cadastro dos alunos: só a secretaria da própria escola
-- (secretário e assistentes) vê, adiciona, edita e tira alunos do reforço. Tirar do reforço não
-- apaga nada do aluno, só a marcação. Professor e master não têm acesso.

create table public.reinforcement_students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  -- Motivo ou foco do reforço (ex.: "Matemática: frações"). Opcional.
  note text check (note is null or char_length(note) <= 300),
  added_by uuid references public.profiles (id) on delete set null,
  added_by_name text,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Um aluno entra uma vez só (o cadastro do aluno já é por ano letivo).
  constraint reinforcement_students_unique unique (student_id)
);
create index reinforcement_students_school_idx on public.reinforcement_students (school_id);

-- Quem adicionou e quando vêm do servidor; o aluno precisa ser da mesma escola.
create function public.reinforcement_students_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.added_by := auth.uid();
    new.added_at := now();
    select full_name into new.added_by_name from public.profiles where id = auth.uid();
  else
    new.school_id := old.school_id;
    new.student_id := old.student_id;
    new.added_by := old.added_by;
    new.added_by_name := old.added_by_name;
    new.added_at := old.added_at;
  end if;
  new.updated_at := now();
  if not exists (select 1 from public.students s where s.id = new.student_id and s.school_id = new.school_id) then
    raise exception 'O aluno não é desta escola.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger reinforcement_students_guard_trg
  before insert or update on public.reinforcement_students
  for each row execute function public.reinforcement_students_guard();
revoke execute on function public.reinforcement_students_guard() from public, anon, authenticated;

alter table public.reinforcement_students enable row level security;
grant select, insert, update, delete on public.reinforcement_students to authenticated;

create policy reinforcement_students_read on public.reinforcement_students
  for select using (
    school_id = public.current_school_id()
    and public.current_role_name() in ('secretary', 'assistant')
  );
create policy reinforcement_students_insert on public.reinforcement_students
  for insert with check (
    public.current_role_name() in ('secretary', 'assistant')
    and school_id = public.current_school_id()
  );
create policy reinforcement_students_update on public.reinforcement_students
  for update using (
    public.current_role_name() in ('secretary', 'assistant')
    and school_id = public.current_school_id()
  ) with check (
    public.current_role_name() in ('secretary', 'assistant')
    and school_id = public.current_school_id()
  );
-- Tirar do reforço é só desmarcar: a secretaria toda pode.
create policy reinforcement_students_delete on public.reinforcement_students
  for delete using (
    public.current_role_name() in ('secretary', 'assistant')
    and school_id = public.current_school_id()
  );
