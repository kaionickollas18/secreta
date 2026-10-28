-- Anexos (PDF e imagens) nas conversas diretas.
-- O arquivo é embaralhado no navegador com a chave da conversa, como o texto: o bucket guarda
-- só bytes ilegíveis. Nome, tipo e tamanho do arquivo vão dentro do texto embaralhado da
-- mensagem; o banco conhece só o caminho do arquivo, para saber quem pode baixá-lo.

-- ───────────────────────────── Caminho do anexo na mensagem ─────────────────────────────
-- Formato: <school_id>/<sender_id>/<uuid do arquivo>.
alter table public.direct_messages
  add column attachment_path text unique
    check (
      attachment_path is null
      or attachment_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}$'
    );

-- Mesma guarda da 0017 (com o professor), mais a regra do anexo: ele precisa estar na pasta
-- de quem envia, dentro da pasta da escola.
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
  if new.attachment_path is not null and (
    split_part(new.attachment_path, '/', 1) <> new.school_id::text
    or split_part(new.attachment_path, '/', 2) <> new.sender_id::text
  ) then
    raise exception 'Anexo inválido.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.direct_messages_guard() from public, anon, authenticated;

-- ───────────────────────────────── Bucket dos anexos ─────────────────────────────────
-- Privado. Até 10 MB por arquivo (mais 1 KB da marca de integridade da criptografia).
-- Só aceita bytes embaralhados: o tipo real do arquivo fica dentro da mensagem.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-files', 'chat-files', false, 10486784, array['application/octet-stream'])
on conflict (id) do nothing;

-- Envia: quem conversa nas diretas (secretário, auxiliar ou professor), na própria pasta,
-- dentro da pasta da escola.
create policy chat_files_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'chat-files'
    and public.current_role_name() in ('secretary', 'assistant', 'teacher')
    and (storage.foldername(name))[1] = public.current_school_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Baixa: só quem participa da conversa em que o arquivo foi enviado.
create policy chat_files_read on storage.objects
  for select to authenticated using (
    bucket_id = 'chat-files'
    and exists (
      select 1 from public.direct_messages m
      where m.attachment_path = storage.objects.name
        and (m.sender_id = auth.uid() or m.recipient_id = auth.uid())
    )
  );

-- Apaga: quem enviou (ao apagar a mensagem, ou se o envio da mensagem falhar).
create policy chat_files_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'chat-files'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
