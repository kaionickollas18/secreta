-- Fase 5: base de dados do dashboard por escola.
-- data_source: 'sheet' (planilha do Google: sheet_url + class_names, uma aba por turma)
--              'file'  (base offline: JSON já processado em attendance-data/<school_id>/frequencia.json)
-- A coluna data_file_name (da 0001) ficou sem uso; não foi removida para evitar operação destrutiva.
alter table public.school_settings
  add column data_source text check (data_source in ('sheet', 'file')),
  add column class_names text[] not null default '{}' check (cardinality(class_names) <= 60),
  add column data_file_updated_at timestamptz;

-- Os CSVs são lidos no navegador e gravados como um único JSON (até 5 MB).
update storage.buckets
  set allowed_mime_types = array['application/json'], file_size_limit = 5242880
  where id = 'attendance-data';
