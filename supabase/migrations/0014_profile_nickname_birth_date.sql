-- Apelido e data de nascimento no perfil. Cada pessoa edita os próprios (permissão por
-- coluna, como `last_name` e `avatar_path` na 0007; a policy `profiles_update_self` já limita
-- à própria linha). Quem lê são as pessoas da mesma escola (policy `profiles_read`).
alter table public.profiles
  add column nickname text
    check (nickname is null or char_length(btrim(nickname)) between 1 and 30),
  add column birth_date date
    check (birth_date is null or birth_date >= date '1900-01-01');

grant update (nickname, birth_date) on public.profiles to authenticated;
