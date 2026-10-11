-- Secretaria Escolar v2: escolas, perfis, tarefas e base de dados do dashboard.
-- Papéis: master (1) · secretary (2) · assistant (3).
-- As regras de acesso são impostas aqui (RLS + triggers); a UI apenas reflete.

create extension if not exists pgcrypto;

-- ───────────────────────── Tabelas ─────────────────────────

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('master', 'secretary', 'assistant')),
  school_id uuid references public.schools (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  -- Sobrenome exibido como responsável nas tarefas.
  last_name text not null check (char_length(btrim(last_name)) between 1 and 60),
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- master não pertence a escola; os demais precisam de uma.
  constraint profiles_school_by_role check (
    (role = 'master' and school_id is null) or (role <> 'master' and school_id is not null)
  )
);
create index profiles_school_idx on public.profiles (school_id);
-- Uma escola tem um único secretário.
create unique index profiles_one_secretary_per_school
  on public.profiles (school_id) where role = 'secretary';

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text check (description is null or char_length(description) <= 2000),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'review', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  -- Ids de profiles (secretário e/ou auxiliares da mesma escola).
  assignee_ids uuid[] not null default '{}' check (cardinality(assignee_ids) <= 3),
  due_date date,
  -- Auxiliar pediu para concluir; o secretário aprova ou devolve.
  completion_requested boolean not null default false,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_school_idx on public.tasks (school_id);

create table public.school_settings (
  school_id uuid primary key references public.schools (id) on delete cascade,
  -- Link da planilha (Google Sheets) usada pelo dashboard.
  sheet_url text check (sheet_url is null or sheet_url ~* '^https://'),
  -- Arquivo CSV offline no bucket "attendance-data" (caminho: <school_id>/<arquivo>).
  data_file_path text,
  data_file_name text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ───────────────────── Funções auxiliares ─────────────────────
-- security definer evita recursão de RLS ao consultar profiles dentro das policies.

create function public.current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create function public.current_school_id() returns uuid
language sql stable security definer set search_path = public as $$
  select school_id from public.profiles where id = auth.uid() and active
$$;

-- ───────────────────────── Triggers ─────────────────────────

-- Valida responsáveis (mesma escola, ativos) e regras por papel nas tarefas.
create function public.tasks_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  caller_role text := public.current_role_name();
  bad_count int;
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.completion_requested := false;
    if new.status = 'done' then
      raise exception 'Crie a tarefa e conclua depois.' using errcode = 'P0001';
    end if;
  else
    if new.school_id <> old.school_id or new.created_by <> old.created_by then
      raise exception 'Escola e autor da tarefa não podem mudar.' using errcode = 'P0001';
    end if;

    if caller_role = 'assistant' then
      if new.assignee_ids is distinct from old.assignee_ids then
        raise exception 'Somente o secretário altera responsáveis.' using errcode = 'P0001';
      end if;
      if new.status = 'done' and old.status <> 'done' then
        raise exception 'Somente o secretário move para Concluído. Peça autorização.' using errcode = 'P0001';
      end if;
      if old.status = 'done' and new.status <> 'done' then
        raise exception 'Somente o secretário reabre uma tarefa concluída.' using errcode = 'P0001';
      end if;
      -- O auxiliar só pode ligar o pedido; aprovar/recusar é do secretário.
      if old.completion_requested and not new.completion_requested then
        raise exception 'Somente o secretário responde ao pedido de conclusão.' using errcode = 'P0001';
      end if;
      if new.completion_requested and new.status = 'done' then
        raise exception 'Pedido de conclusão exige aprovação do secretário.' using errcode = 'P0001';
      end if;
    end if;

    -- Concluir ou devolver encerra qualquer pedido pendente.
    if new.status = 'done' then
      new.completion_requested := false;
    end if;
    new.updated_at := now();
  end if;

  if new.assignee_ids is distinct from
     (case when tg_op = 'UPDATE' then old.assignee_ids else null end) then
    select count(*) into bad_count
    from unnest(new.assignee_ids) as a(id)
    where not exists (
      select 1 from public.profiles p
      where p.id = a.id and p.school_id = new.school_id
        and p.active and p.role in ('secretary', 'assistant')
    );
    if bad_count > 0 then
      raise exception 'Responsável inválido para esta escola.' using errcode = 'P0001';
    end if;
  end if;

  return new;
end $$;

create trigger tasks_guard_trg
  before insert or update on public.tasks
  for each row execute function public.tasks_guard();

-- ───────────────────────── RLS ─────────────────────────

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.school_settings enable row level security;

-- schools: master gerencia tudo; os demais leem a própria escola.
create policy schools_master_all on public.schools
  for all using (public.current_role_name() = 'master')
  with check (public.current_role_name() = 'master');
create policy schools_member_read on public.schools
  for select using (id = public.current_school_id());

-- profiles: leitura por escola (master vê todos). Escrita só pela Edge Function (service role).
create policy profiles_read on public.profiles
  for select using (
    public.current_role_name() = 'master'
    or id = auth.uid()
    or school_id = public.current_school_id()
  );

-- tasks: todos da escola leem; secretário cria/exclui; auxiliar edita (limites no trigger).
create policy tasks_read on public.tasks
  for select using (school_id = public.current_school_id());
create policy tasks_insert on public.tasks
  for insert with check (
    public.current_role_name() = 'secretary' and school_id = public.current_school_id()
  );
create policy tasks_update on public.tasks
  for update using (
    public.current_role_name() in ('secretary', 'assistant')
    and school_id = public.current_school_id()
  ) with check (school_id = public.current_school_id());
create policy tasks_delete on public.tasks
  for delete using (
    public.current_role_name() = 'secretary' and school_id = public.current_school_id()
  );

-- school_settings: todos da escola leem; só o secretário grava.
create policy settings_read on public.school_settings
  for select using (school_id = public.current_school_id());
create policy settings_write on public.school_settings
  for all using (
    public.current_role_name() = 'secretary' and school_id = public.current_school_id()
  ) with check (
    public.current_role_name() = 'secretary' and school_id = public.current_school_id()
  );

-- ───────────────────── Storage (CSV offline) ─────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attendance-data', 'attendance-data', false, 5242880,
        array['text/csv', 'application/vnd.ms-excel', 'text/plain'])
on conflict (id) do nothing;

create policy attendance_read on storage.objects
  for select using (
    bucket_id = 'attendance-data'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );
create policy attendance_write on storage.objects
  for all using (
    bucket_id = 'attendance-data'
    and public.current_role_name() = 'secretary'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  ) with check (
    bucket_id = 'attendance-data'
    and public.current_role_name() = 'secretary'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

-- ───────────────── Bootstrap do Master (rodar uma vez) ─────────────────
-- 1) Authentication → Users → Add user (e-mail + senha, marque "Auto Confirm").
-- 2) Rode, trocando o e-mail e o nome:
--
--   insert into public.profiles (id, role, school_id, full_name, last_name)
--   select id, 'master', null, 'Nome Completo', 'Sobrenome'
--   from auth.users where email = 'master@exemplo.com';
