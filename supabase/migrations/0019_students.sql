-- Cadastro dos alunos por turma: matrícula, responsável e endereço.
-- Serve à pesquisa de aluno no dashboard e à busca ativa (documento de visita/contato).
-- Os dados vêm da "Relação de Alunos & Responsáveis" do sistema da rede e são carregados
-- direto no banco: dados reais de alunos nunca entram no repositório.

create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  school_year smallint not null check (school_year between 2000 and 2100),
  -- Mesmo nome da turma usado no dashboard de frequência (ex.: "6 ano A").
  class_name text not null check (char_length(btrim(class_name)) between 1 and 60),
  -- Número do aluno na lista da turma.
  roll_number smallint check (roll_number is null or roll_number > 0),
  enrolled_on date,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  sex text check (sex is null or sex in ('F', 'M')),
  birth_date date,
  guardian_name text check (guardian_name is null or char_length(guardian_name) <= 160),
  -- NIS do responsável, como veio da origem (há registros com dígitos a mais ou a menos).
  guardian_nis text check (guardian_nis is null or guardian_nis ~ '^[0-9]{1,14}$'),
  phone text check (phone is null or char_length(phone) <= 40),
  -- Logradouro e número.
  address text check (address is null or char_length(address) <= 200),
  neighborhood text check (neighborhood is null or char_length(neighborhood) <= 80),
  cep text check (cep is null or cep ~ '^[0-9]{5}-[0-9]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Também serve de índice para as consultas por escola, ano e turma.
  constraint students_unique_in_class unique (school_id, school_year, class_name, name)
);

alter table public.students enable row level security;
grant select, insert, update, delete on public.students to authenticated;

-- Endereço e responsável são dados pessoais de menores: só a secretaria (secretário e
-- assistentes) da própria escola lê. Professor e master não têm acesso.
create policy students_read on public.students
  for select using (
    school_id = public.current_school_id()
    and public.current_role_name() in ('secretary', 'assistant')
  );
create policy students_insert on public.students
  for insert with check (
    public.current_role_name() in ('secretary', 'assistant')
    and school_id = public.current_school_id()
  );
create policy students_update on public.students
  for update using (
    public.current_role_name() in ('secretary', 'assistant')
    and school_id = public.current_school_id()
  ) with check (
    public.current_role_name() in ('secretary', 'assistant')
    and school_id = public.current_school_id()
  );
create policy students_delete on public.students
  for delete using (
    public.current_role_name() = 'secretary' and school_id = public.current_school_id()
  );
