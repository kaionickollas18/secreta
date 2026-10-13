-- Conversas: diretas entre duas pessoas (criptografadas de ponta a ponta) e canal anônimo.
-- O mural "Geral" continua na tabela `messages` (0005).

-- ───────────────────────────── Chaves das conversas diretas ─────────────────────────────
-- Cada pessoa tem um par de chaves criado no navegador. A pública fica legível para a escola;
-- a privada só é guardada embaralhada com a senha da pessoa (`wrapped_private_key`), e nem
-- assim os colegas a leem: o acesso é por coluna, e a própria pessoa a busca por `my_chat_key()`.
-- Quem recomeça (senha redefinida) ganha uma chave nova; as antigas ficam inativas para o
-- colega ainda conseguir ler o que já tinha recebido.
create table public.chat_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  public_key jsonb not null,
  wrapped_private_key text not null check (char_length(wrapped_private_key) between 1 and 2000),
  salt text not null check (char_length(salt) between 1 and 100),
  iv text not null check (char_length(iv) between 1 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index chat_keys_one_active_idx on public.chat_keys (user_id) where active;
create index chat_keys_school_idx on public.chat_keys (school_id);

create function public.chat_keys_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.school_id := public.current_school_id();
  new.active := true;
  new.created_at := now();
  if new.school_id is null then
    raise exception 'As conversas são só para quem pertence a uma escola.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger chat_keys_stamp_trg
  before insert on public.chat_keys
  for each row execute function public.chat_keys_stamp();
revoke execute on function public.chat_keys_stamp() from public, anon, authenticated;

alter table public.chat_keys enable row level security;
revoke all on public.chat_keys from anon, authenticated;
grant select (id, user_id, school_id, public_key, active, created_at) on public.chat_keys to authenticated;
grant insert (public_key, wrapped_private_key, salt, iv) on public.chat_keys to authenticated;
grant update (active, wrapped_private_key, salt, iv) on public.chat_keys to authenticated;

create policy chat_keys_read on public.chat_keys
  for select using (school_id = public.current_school_id());
create policy chat_keys_insert on public.chat_keys
  for insert with check (user_id = auth.uid() and school_id = public.current_school_id());
create policy chat_keys_update on public.chat_keys
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- A chave privada embaralhada da própria pessoa (a ativa).
create function public.my_chat_key()
returns table (id uuid, wrapped_private_key text, salt text, iv text)
language sql stable security definer set search_path = public as $$
  select k.id, k.wrapped_private_key, k.salt, k.iv
  from public.chat_keys k
  where k.user_id = auth.uid() and k.active
$$;
revoke execute on function public.my_chat_key() from public, anon;
grant execute on function public.my_chat_key() to authenticated;

-- ───────────────────────────────── Conversas diretas ─────────────────────────────────
-- O banco guarda só o texto embaralhado (`ciphertext`); quem tem acesso ao banco não lê.
create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  sender_key_id uuid not null references public.chat_keys (id) on delete cascade,
  recipient_key_id uuid not null references public.chat_keys (id) on delete cascade,
  iv text not null check (char_length(iv) between 1 and 100),
  ciphertext text not null check (char_length(ciphertext) between 1 and 12000),
  created_at timestamptz not null default now(),
  constraint direct_messages_not_self check (sender_id <> recipient_id)
);
create index direct_messages_recipient_idx on public.direct_messages (recipient_id, created_at desc);
create index direct_messages_sender_idx on public.direct_messages (sender_id, created_at desc);
create index direct_messages_school_idx on public.direct_messages (school_id);
create index direct_messages_sender_key_idx on public.direct_messages (sender_key_id);
create index direct_messages_recipient_key_idx on public.direct_messages (recipient_key_id);

-- Remetente, escola e horário vêm do servidor. O destinatário precisa ser um colega ativo
-- da mesma escola, e cada chave precisa ser de quem a mensagem diz que é.
create function public.direct_messages_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.sender_id := auth.uid();
  new.school_id := public.current_school_id();
  new.created_at := now();
  if not exists (
    select 1 from public.profiles p
    where p.id = new.recipient_id and p.school_id = new.school_id and p.active
      and p.role in ('secretary', 'assistant')
  ) then
    raise exception 'Só é possível conversar com colegas ativos da sua escola.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.chat_keys k where k.id = new.sender_key_id and k.user_id = new.sender_id)
     or not exists (select 1 from public.chat_keys k where k.id = new.recipient_key_id and k.user_id = new.recipient_id) then
    raise exception 'Chave de conversa inválida.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger direct_messages_guard_trg
  before insert on public.direct_messages
  for each row execute function public.direct_messages_guard();
revoke execute on function public.direct_messages_guard() from public, anon, authenticated;

alter table public.direct_messages enable row level security;
grant select, insert, delete on public.direct_messages to authenticated;

-- Só os dois participantes leem. Cada um apaga o que enviou. Não há edição nem moderação.
create policy direct_messages_read on public.direct_messages
  for select using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy direct_messages_insert on public.direct_messages
  for insert with check (
    sender_id = auth.uid()
    and school_id = public.current_school_id()
    and public.current_role_name() in ('secretary', 'assistant')
  );
create policy direct_messages_delete on public.direct_messages
  for delete using (sender_id = auth.uid());

-- ─────────────────────────────────── Canal anônimo ───────────────────────────────────
-- A mensagem não tem autor. A autoria fica em outra tabela, que só mostra a cada pessoa as
-- linhas dela (para poder apagar o que escreveu). Ninguém na escola vê o autor dos outros;
-- quem administra o banco consegue, e a tela avisa isso a quem escreve.
create table public.anonymous_messages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index anonymous_messages_school_idx on public.anonymous_messages (school_id, created_at desc);

create table public.anonymous_message_authors (
  message_id uuid primary key references public.anonymous_messages (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade
);
create index anonymous_message_authors_author_idx on public.anonymous_message_authors (author_id);

create function public.anonymous_messages_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_when = 'BEFORE' then
    new.created_at := now();
    return new;
  end if;
  insert into public.anonymous_message_authors (message_id, author_id) values (new.id, auth.uid());
  return null;
end $$;
create trigger anonymous_messages_stamp_trg
  before insert on public.anonymous_messages
  for each row execute function public.anonymous_messages_stamp();
create trigger anonymous_messages_author_trg
  after insert on public.anonymous_messages
  for each row execute function public.anonymous_messages_stamp();
revoke execute on function public.anonymous_messages_stamp() from public, anon, authenticated;

alter table public.anonymous_messages enable row level security;
alter table public.anonymous_message_authors enable row level security;
grant select, insert, delete on public.anonymous_messages to authenticated;
grant select on public.anonymous_message_authors to authenticated;

create policy anonymous_message_authors_read_own on public.anonymous_message_authors
  for select using (author_id = auth.uid());

-- A escola lê e escreve; apaga quem escreveu ou o secretário (moderação).
create policy anonymous_messages_read on public.anonymous_messages
  for select using (school_id = public.current_school_id());
create policy anonymous_messages_insert on public.anonymous_messages
  for insert with check (
    public.current_role_name() in ('secretary', 'assistant')
    and school_id = public.current_school_id()
  );
create policy anonymous_messages_delete on public.anonymous_messages
  for delete using (
    school_id = public.current_school_id()
    and (
      public.current_role_name() = 'secretary'
      or exists (
        select 1 from public.anonymous_message_authors a
        where a.message_id = id and a.author_id = auth.uid()
      )
    )
  );

alter publication supabase_realtime add table public.direct_messages;
alter publication supabase_realtime add table public.anonymous_messages;
