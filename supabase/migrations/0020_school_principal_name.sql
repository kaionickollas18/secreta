-- Nome do(a) gestor(a) da escola: citado no termo de ciência da busca ativa.
-- Fica em `school_settings`, junto dos demais dados oficiais (a escola lê, só o secretário grava).
alter table public.school_settings
  add column principal_name text check (principal_name is null or char_length(principal_name) <= 120);
