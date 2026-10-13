-- O calendário passa a ter outros eventos da escola além de feriados e recessos. A tabela
-- continua se chamando `holidays`; `kind` diz o que cada linha é. As regras de acesso não mudam.
--   holiday  = feriado ou recesso            planning = Planejamento Pedagógico
--   meeting  = Reunião Administrativa        training = Formação Pedagógica
--   council  = Conselho de Classe            semec    = Entrega das Atas e Índices na SEMEC
--   grades   = Entrega das Notas na Secretaria da Escola
alter table public.holidays
  add column kind text not null default 'holiday'
  check (kind in ('holiday', 'planning', 'meeting', 'training', 'council', 'semec', 'grades'));
