-- Recesso deixa de ser o mesmo tipo que feriado: `recess` entra na lista de tipos aceitos.
-- As linhas existentes continuam como `holiday`; nenhum dado é alterado.
alter table public.holidays drop constraint holidays_kind_check;
alter table public.holidays add constraint holidays_kind_check
  check (kind in ('holiday', 'recess', 'planning', 'meeting', 'training', 'council', 'semec', 'grades'));
