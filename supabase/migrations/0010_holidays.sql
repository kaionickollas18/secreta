-- Feriados, pontos facultativos e recessos cadastrados pela escola, exibidos no calendário.
-- Os feriados nacionais não ficam aqui: são calculados na tela (src/utils/holidays.ts).
create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  starts_on date not null,
  -- Um dia só: ends_on = starts_on. Recessos podem durar até 92 dias.
  ends_on date not null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint holidays_range check (ends_on >= starts_on and ends_on - starts_on <= 92)
);
create index holidays_school_idx on public.holidays (school_id, starts_on);
create index holidays_created_by_idx on public.holidays (created_by);

alter table public.holidays enable row level security;
grant select, insert, update, delete on public.holidays to authenticated;

-- A escola lê; só o secretário (ou o auxiliar com acesso de secretário) cria, edita e exclui.
create policy holidays_read on public.holidays
  for select using (school_id = public.current_school_id());
create policy holidays_write on public.holidays
  for all using (
    public.current_role_name() = 'secretary' and school_id = public.current_school_id()
  ) with check (
    public.current_role_name() = 'secretary' and school_id = public.current_school_id()
  );
