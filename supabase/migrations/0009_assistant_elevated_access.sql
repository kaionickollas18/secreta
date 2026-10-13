-- Acesso especial: um auxiliar marcado pelo secretário age como secretário no trabalho do dia a dia.
alter table public.profiles
  add column elevated boolean not null default false,
  add constraint profiles_elevated_only_assistant check (not elevated or role = 'assistant');

-- Papel efetivo de quem está logado. As policies e o trigger de tarefas perguntam por ele, então
-- o auxiliar com acesso especial passa a valer como 'secretary' em todas as regras de uma vez.
-- A gestão da equipe (Edge Function manage-users) consulta a coluna `role` diretamente e por
-- isso continua exclusiva do secretário de verdade. O cliente não consegue alterar `elevated`:
-- a permissão de update em profiles é só para last_name e avatar_path (migration 0007).
create or replace function public.current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select case when role = 'assistant' and elevated then 'secretary' else role end
  from public.profiles where id = auth.uid() and active
$$;
