-- Perfil próprio: cada pessoa troca a foto e o sobrenome. A senha é trocada pelo Supabase Auth.

alter table public.profiles
  add column avatar_path text check (avatar_path is null or char_length(avatar_path) <= 200);

-- Cada pessoa edita só o próprio sobrenome e a própria foto. Papel, escola, nome completo e
-- situação continuam fora do alcance do cliente (só a Edge Function altera).
revoke update on public.profiles from authenticated, anon;
grant update (last_name, avatar_path) on public.profiles to authenticated;

-- A foto de alguém só pode apontar para um arquivo da própria pasta.
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and (avatar_path is null or avatar_path like auth.uid()::text || '/%')
  );

-- Fotos de perfil: leitura pública pelo endereço (nome de arquivo aleatório), escrita só na
-- própria pasta (<id do usuário>/arquivo). As imagens chegam já reduzidas pelo navegador.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

create policy avatars_insert_own on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy avatars_update_own on storage.objects
  for update to authenticated using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy avatars_delete_own on storage.objects
  for delete to authenticated using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
