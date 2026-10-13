-- Notas da escola: texto livre ou lista de marcação, com vínculo opcional a uma tarefa ou a
-- um lembrete. Itens da lista ficam em `items`: [{ "id": "...", "text": "...", "done": false }].
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  author_name text not null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  kind text not null check (kind in ('text', 'checklist')),
  body text check (body is null or char_length(body) <= 4000),
  items jsonb not null default '[]'::jsonb,
  task_id uuid references public.tasks (id) on delete set null,
  reminder_id uuid references public.reminders (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_single_link check (task_id is null or reminder_id is null),
  constraint notes_items_array check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 60)
);
create index notes_school_idx on public.notes (school_id, updated_at desc);
create index notes_task_idx on public.notes (task_id);
create index notes_reminder_idx on public.notes (reminder_id);
create index notes_author_idx on public.notes (author_id);

-- Autor, nome e datas vêm do servidor e não mudam depois. Também confere o formato dos itens
-- e que a tarefa ou o lembrete vinculado é da mesma escola.
create function public.notes_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  item jsonb;
begin
  if tg_op = 'INSERT' then
    new.author_id := auth.uid();
    new.created_at := now();
    select full_name into new.author_name from public.profiles where id = auth.uid();
    if new.author_name is null then
      raise exception 'Usuário sem perfil.' using errcode = 'P0001';
    end if;
  else
    new.school_id := old.school_id;
    new.author_name := old.author_name;
    new.created_at := old.created_at;
    -- Nulo só acontece quando o autor é excluído (on delete set null); aí não se restaura.
    if new.author_id is not null then
      new.author_id := old.author_id;
    end if;
  end if;
  new.updated_at := now();

  if new.kind = 'text' then
    new.items := '[]'::jsonb;
  else
    new.body := null;
  end if;

  for item in select * from jsonb_array_elements(new.items) loop
    if jsonb_typeof(item) <> 'object'
       or jsonb_typeof(item -> 'id') is distinct from 'string'
       or jsonb_typeof(item -> 'text') is distinct from 'string'
       or jsonb_typeof(item -> 'done') is distinct from 'boolean'
       or char_length(item ->> 'id') not between 1 and 40
       or char_length(btrim(item ->> 'text')) not between 1 and 200 then
      raise exception 'Item da lista inválido.' using errcode = 'P0001';
    end if;
  end loop;

  if new.task_id is not null and not exists (
    select 1 from public.tasks t where t.id = new.task_id and t.school_id = new.school_id
  ) then
    raise exception 'A tarefa vinculada não é desta escola.' using errcode = 'P0001';
  end if;
  if new.reminder_id is not null and not exists (
    select 1 from public.reminders r where r.id = new.reminder_id and r.school_id = new.school_id
  ) then
    raise exception 'O lembrete vinculado não é desta escola.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger notes_guard_trg
  before insert or update on public.notes
  for each row execute function public.notes_guard();
revoke execute on function public.notes_guard() from public, anon, authenticated;

-- Marca ou desmarca um item sem regravar a lista inteira: duas pessoas marcando itens
-- diferentes ao mesmo tempo não desfazem a marcação uma da outra. Roda com as permissões de
-- quem chama (a RLS da tabela vale).
create function public.set_note_item_done(p_note uuid, p_item text, p_done boolean) returns void
language sql security invoker set search_path = public as $$
  update public.notes n
  set items = (
    select coalesce(
      jsonb_agg(
        case when x.e ->> 'id' = p_item then jsonb_set(x.e, '{done}', to_jsonb(p_done)) else x.e end
        order by x.ord
      ),
      '[]'::jsonb
    )
    from jsonb_array_elements(n.items) with ordinality as x (e, ord)
  )
  where n.id = p_note;
$$;
revoke execute on function public.set_note_item_done(uuid, text, boolean) from public, anon;
grant execute on function public.set_note_item_done(uuid, text, boolean) to authenticated;

alter table public.notes enable row level security;
grant select, insert, update, delete on public.notes to authenticated;

-- A escola lê; secretário e auxiliares criam, editam e marcam itens (trabalho em conjunto).
-- Excluir: só o autor ou o secretário.
create policy notes_read on public.notes
  for select using (school_id = public.current_school_id());
create policy notes_insert on public.notes
  for insert with check (
    public.current_role_name() in ('secretary', 'assistant')
    and school_id = public.current_school_id()
  );
create policy notes_update on public.notes
  for update using (
    public.current_role_name() in ('secretary', 'assistant')
    and school_id = public.current_school_id()
  ) with check (
    public.current_role_name() in ('secretary', 'assistant')
    and school_id = public.current_school_id()
  );
create policy notes_delete on public.notes
  for delete using (
    school_id = public.current_school_id()
    and (author_id = auth.uid() or public.current_role_name() = 'secretary')
  );

alter publication supabase_realtime add table public.notes;
