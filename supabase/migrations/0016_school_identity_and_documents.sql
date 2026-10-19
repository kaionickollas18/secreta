-- 1) Dados oficiais da escola, usados no cabeçalho dos documentos em PDF.
-- 2) Acompanhamento de memorandos e ofícios.

-- ───────────────────────────── Dados oficiais da escola ─────────────────────────────
-- Ficam em `school_settings`: a escola lê, só o secretário grava (policies da 0001).
alter table public.school_settings
  add column official_name text check (official_name is null or char_length(official_name) <= 160),
  add column inep text check (inep is null or inep ~ '^[0-9]{8}$'),
  add column address text check (address is null or char_length(address) <= 200),
  add column cep text check (cep is null or cep ~ '^[0-9]{5}-[0-9]{3}$'),
  add column decree text check (decree is null or char_length(decree) <= 160),
  -- Caminho da logo no bucket "school-logos" (<school_id>/<arquivo>).
  add column logo_path text;

-- Logo da escola: leitura pública pelo endereço (é o brasão que vai nos documentos);
-- escrita só do secretário, na pasta da própria escola.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('school-logos', 'school-logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy school_logos_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'school-logos'
    and public.current_role_name() = 'secretary'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );
create policy school_logos_update on storage.objects
  for update to authenticated using (
    bucket_id = 'school-logos'
    and public.current_role_name() = 'secretary'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  ) with check (
    bucket_id = 'school-logos'
    and public.current_role_name() = 'secretary'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );
create policy school_logos_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'school-logos'
    and public.current_role_name() = 'secretary'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

-- ───────────────────────────── Memorandos e ofícios ─────────────────────────────
-- `delivered_on` nulo = ainda não entregue. Ao marcar a entrega, a tela pede o resumo.
create table public.official_documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  kind text not null check (kind in ('memo', 'oficio')),
  number text not null check (char_length(btrim(number)) between 1 and 30),
  issued_on date not null,
  recipient text not null check (char_length(btrim(recipient)) between 1 and 120),
  subject text not null check (char_length(btrim(subject)) between 1 and 160),
  summary text check (summary is null or char_length(summary) <= 2000),
  delivered_on date,
  received_by text check (received_by is null or char_length(received_by) <= 120),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint official_documents_delivery check (delivered_on is null or delivered_on >= issued_on),
  -- Entregue sempre tem resumo.
  constraint official_documents_summary check (
    delivered_on is null or char_length(btrim(coalesce(summary, ''))) > 0
  )
);
create index official_documents_school_idx on public.official_documents (school_id, issued_on desc);
create index official_documents_created_by_idx on public.official_documents (created_by);

alter table public.official_documents enable row level security;
grant select, insert, update, delete on public.official_documents to authenticated;

-- A escola lê; secretário e auxiliares registram, editam e marcam a entrega; só o
-- secretário exclui.
create policy official_documents_read on public.official_documents
  for select using (school_id = public.current_school_id());
create policy official_documents_insert on public.official_documents
  for insert with check (
    public.current_role_name() in ('secretary', 'assistant')
    and school_id = public.current_school_id()
  );
create policy official_documents_update on public.official_documents
  for update using (
    public.current_role_name() in ('secretary', 'assistant')
    and school_id = public.current_school_id()
  ) with check (
    public.current_role_name() in ('secretary', 'assistant')
    and school_id = public.current_school_id()
  );
create policy official_documents_delete on public.official_documents
  for delete using (
    public.current_role_name() = 'secretary' and school_id = public.current_school_id()
  );
