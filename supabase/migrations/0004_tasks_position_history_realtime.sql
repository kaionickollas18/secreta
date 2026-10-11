-- Fase 4: ordem dos cartões, data de conclusão, histórico permanente e atualização ao vivo.

alter table public.tasks add column position double precision not null default 0;
alter table public.tasks add column completed_at timestamptz;

-- Registro permanente de cada conclusão. Guarda nomes como texto para sobreviver
-- à exclusão da tarefa ou das pessoas.
create table public.task_history (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  title text not null,
  description text,
  priority text not null,
  assignee_names text[] not null default '{}',
  due_date date,
  task_created_at timestamptz not null,
  completed_at timestamptz not null default now(),
  completed_by_name text
);
create index task_history_school_completed_idx on public.task_history (school_id, completed_at desc);
create index task_history_task_idx on public.task_history (task_id);

-- Só leitura pela escola; quem escreve é o trigger.
alter table public.task_history enable row level security;
create policy task_history_read on public.task_history
  for select using (school_id = public.current_school_id());

-- Mudanças em relação à 0001: preenche completed_at e deixa o auxiliar cancelar o próprio pedido.
create or replace function public.tasks_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  caller_role text := public.current_role_name();
  bad_count int;
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.completion_requested := false;
    new.completed_at := null;
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
    end if;

    if new.status = 'done' then
      new.completion_requested := false;
      new.completed_at := case when old.status = 'done' then old.completed_at else now() end;
    else
      new.completed_at := null;
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

-- Concluir grava no histórico; reabrir remove o registro daquela conclusão.
create function public.tasks_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'done' and old.status <> 'done' then
    insert into public.task_history (
      school_id, task_id, title, description, priority, assignee_names,
      due_date, task_created_at, completed_at, completed_by_name
    ) values (
      new.school_id, new.id, new.title, new.description, new.priority,
      coalesce((select array_agg(p.full_name order by p.full_name)
                from public.profiles p where p.id = any (new.assignee_ids)), '{}'),
      new.due_date, new.created_at, new.completed_at,
      (select full_name from public.profiles where id = auth.uid())
    );
  elsif old.status = 'done' and new.status <> 'done' then
    delete from public.task_history where task_id = new.id;
  end if;
  return null;
end $$;

create trigger tasks_history_trg
  after update on public.tasks
  for each row execute function public.tasks_history();

revoke execute on function public.tasks_history() from public, anon, authenticated;
revoke execute on function public.tasks_guard() from public, anon, authenticated;

alter publication supabase_realtime add table public.tasks;
