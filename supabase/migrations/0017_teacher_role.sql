-- Papel "teacher" (Professor): pessoa da escola que conversa, vê o calendário e a frequência,
-- mas não participa do trabalho interno da secretaria (quadro, histórico, lembretes, notas,
-- memorandos e ofícios). Quem cadastra e edita professores é o secretário, pela Edge
-- Function `manage-users`.

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('master', 'secretary', 'assistant', 'teacher'));

-- ───────────────────── Trabalho da secretaria: só secretário e auxiliares leem ─────────────────────
-- A escrita nessas tabelas já era só de secretário/auxiliar; agora a leitura também.
alter policy tasks_read on public.tasks
  using (school_id = public.current_school_id() and public.current_role_name() in ('secretary', 'assistant'));
alter policy task_history_read on public.task_history
  using (school_id = public.current_school_id() and public.current_role_name() in ('secretary', 'assistant'));
alter policy reminders_read on public.reminders
  using (school_id = public.current_school_id() and public.current_role_name() in ('secretary', 'assistant'));
alter policy reminder_completions_read on public.reminder_completions
  using (school_id = public.current_school_id() and public.current_role_name() in ('secretary', 'assistant'));
alter policy notes_read on public.notes
  using (school_id = public.current_school_id() and public.current_role_name() in ('secretary', 'assistant'));
alter policy official_documents_read on public.official_documents
  using (school_id = public.current_school_id() and public.current_role_name() in ('secretary', 'assistant'));

-- ─────────────────────────── Conversas: o professor participa ───────────────────────────
alter policy messages_insert on public.messages
  with check (
    public.current_role_name() in ('secretary', 'assistant', 'teacher')
    and school_id = public.current_school_id()
  );
alter policy anonymous_messages_insert on public.anonymous_messages
  with check (
    public.current_role_name() in ('secretary', 'assistant', 'teacher')
    and school_id = public.current_school_id()
  );
alter policy direct_messages_insert on public.direct_messages
  with check (
    sender_id = auth.uid()
    and school_id = public.current_school_id()
    and public.current_role_name() in ('secretary', 'assistant', 'teacher')
  );

-- Mesmo corpo da 0015, com o professor entre os destinatários possíveis.
create or replace function public.direct_messages_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.sender_id := auth.uid();
  new.school_id := public.current_school_id();
  new.created_at := now();
  if not exists (
    select 1 from public.profiles p
    where p.id = new.recipient_id and p.school_id = new.school_id and p.active
      and p.role in ('secretary', 'assistant', 'teacher')
  ) then
    raise exception 'Só é possível conversar com colegas ativos da sua escola.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.chat_keys k where k.id = new.sender_key_id and k.user_id = new.sender_id)
     or not exists (select 1 from public.chat_keys k where k.id = new.recipient_key_id and k.user_id = new.recipient_id) then
    raise exception 'Chave de conversa inválida.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.direct_messages_guard() from public, anon, authenticated;
