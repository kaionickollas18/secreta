-- Lembretes recorrentes do secretário e mural de mensagens da escola.

-- Lembrete: 'once' (due_date) · 'weekly' (weekday 0=domingo) ·
-- 'monthly' (a cada interval_months meses desde start_month, do dia day_start ao day_end).
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  notes text check (notes is null or char_length(notes) <= 1000),
  kind text not null check (kind in ('once', 'weekly', 'monthly')),
  due_date date,
  weekday smallint check (weekday between 0 and 6),
  interval_months smallint check (interval_months between 1 and 12),
  start_month date,
  day_start smallint check (day_start between 1 and 31),
  day_end smallint check (day_end between 1 and 31),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint reminders_shape check (
    (kind = 'once' and due_date is not null)
    or (kind = 'weekly' and weekday is not null)
    or (kind = 'monthly' and interval_months is not null and start_month is not null
        and day_start is not null and day_end is not null and day_end >= day_start)
  )
);
create index reminders_school_idx on public.reminders (school_id);

-- Uma linha por ciclo cumprido. period_key identifica o ciclo (ex.: "2026-10", "2026-10-12", "once").
create table public.reminder_completions (
  reminder_id uuid not null references public.reminders (id) on delete cascade,
  period_key text not null check (char_length(period_key) between 1 and 20),
  school_id uuid not null references public.schools (id) on delete cascade,
  completed_by uuid references public.profiles (id) on delete set null,
  completed_at timestamptz not null default now(),
  primary key (reminder_id, period_key)
);
create index reminder_completions_school_idx on public.reminder_completions (school_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  sender_name text not null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_school_created_idx on public.messages (school_id, created_at desc);

-- Autor, nome e horário vêm do servidor: o cliente não consegue se passar por outra pessoa.
create function public.messages_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.sender_id := auth.uid();
  new.created_at := now();
  select full_name into new.sender_name from public.profiles where id = auth.uid();
  if new.sender_name is null then
    raise exception 'Usuário sem perfil.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger messages_stamp_trg
  before insert on public.messages
  for each row execute function public.messages_stamp();
revoke execute on function public.messages_stamp() from public, anon, authenticated;

alter table public.reminders enable row level security;
alter table public.reminder_completions enable row level security;
alter table public.messages enable row level security;

-- Lembretes: a escola lê; só o secretário cria, edita, exclui e marca como feito.
create policy reminders_read on public.reminders
  for select using (school_id = public.current_school_id());
create policy reminders_write on public.reminders
  for all using (
    public.current_role_name() = 'secretary' and school_id = public.current_school_id()
  ) with check (
    public.current_role_name() = 'secretary' and school_id = public.current_school_id()
  );

create policy reminder_completions_read on public.reminder_completions
  for select using (school_id = public.current_school_id());
create policy reminder_completions_insert on public.reminder_completions
  for insert with check (
    public.current_role_name() = 'secretary'
    and school_id = public.current_school_id()
    and exists (select 1 from public.reminders r
                where r.id = reminder_id and r.school_id = public.current_school_id())
  );
create policy reminder_completions_delete on public.reminder_completions
  for delete using (
    public.current_role_name() = 'secretary' and school_id = public.current_school_id()
  );

-- Mural: secretário e auxiliares da escola leem e escrevem. Cada um apaga a própria
-- mensagem; o secretário pode apagar qualquer uma (moderação). Não há edição.
create policy messages_read on public.messages
  for select using (school_id = public.current_school_id());
create policy messages_insert on public.messages
  for insert with check (
    public.current_role_name() in ('secretary', 'assistant')
    and school_id = public.current_school_id()
  );
create policy messages_delete on public.messages
  for delete using (
    school_id = public.current_school_id()
    and (sender_id = auth.uid() or public.current_role_name() = 'secretary')
  );

alter publication supabase_realtime add table public.messages;
