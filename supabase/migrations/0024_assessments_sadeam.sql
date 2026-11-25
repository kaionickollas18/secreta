-- Avaliações: aceita a matriz do SADEAM (8º ano) além de Saeb 9º ano, CNCA 1º ano e a da escola.
-- Só amplia a lista permitida; nenhuma linha existente muda.

alter table public.assessments drop constraint if exists assessments_matrix_check;
alter table public.assessments
  add constraint assessments_matrix_check check (matrix in ('saeb9', 'sadeam8', 'cnca1', 'custom'));
