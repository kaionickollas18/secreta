# v2 — Login, papéis e Supabase

A v1 era 100% local, sem backend nem autenticação. A v2 adiciona login e dados compartilhados por escola usando o Supabase. Este documento substitui, para a v2, a restrição "sem backend/autenticação" do `CLAUDE.md`.

## Papéis

| Nº | Papel (`role`) | Pode |
|----|----------------|------|
| 1 | `master` | Cadastrar, editar e excluir escolas e o secretário de cada uma. Não vê tarefas. |
| 2 | `secretary` | Cadastrar/editar/excluir auxiliares da própria escola. Criar e excluir tarefas, definir responsáveis, mover para Concluído, aprovar ou recusar pedidos de conclusão. Configurar a base de dados do Dashboard. |
| 3 | `assistant` | Ver e editar tarefas da escola e movê-las entre colunas, **exceto** para Concluído. Pode pedir a conclusão. Não cria tarefas, não altera responsáveis, não mexe na base do Dashboard. |

Responsáveis de uma tarefa são `secretary` e `assistant` da mesma escola (até 3). Na tela aparece o **sobrenome** (`profiles.last_name`, derivado do nome completo no cadastro).

## Fluxo de conclusão
1. Auxiliar arrasta/solicita "Concluído" → a tarefa fica em **Em Revisão** com `completion_requested = true` (selo "Aguardando aprovação").
2. Secretário **aprova** (status `done`) ou **devolve** (`completion_requested = false`).

## Onde as regras são aplicadas
A interface só esconde botões. As regras valem de verdade no banco, em `supabase/migrations/0001_init.sql`:
- **RLS** isola cada escola e restringe escrita por papel.
- **Trigger `tasks_guard`** impede o auxiliar de: concluir, reabrir, alterar responsáveis ou responder ao próprio pedido; também valida que os responsáveis são ativos e da mesma escola.
- **Edge Function `manage-users`** (`supabase/functions/manage-users`) é o único caminho para criar/editar/excluir usuários, pois isso exige a *service role*, que não pode ir ao navegador.

## Segredos
- Pode ir ao front-end/GitHub Pages: **Project URL** e **publishable key** (são públicas por desenho; a segurança vem da RLS).
- **Nunca** no repositório nem no front-end: senha do banco (`DB password`), *service role key* e *secret key*. A service role já existe dentro da Edge Function como variável automática.

## Setup (uma vez)
1. Instale o Supabase CLI e, na raiz do projeto: `supabase login`, depois `supabase link --project-ref phecndafqugukaupvpkz` (o `supabase init` não é necessário, a pasta `supabase/` já existe; se o CLI pedir `config.toml`, rode `supabase init` e mantenha `migrations/` e `functions/`).
2. Aplique o banco: `supabase db push` (ou cole `0001_init.sql` no SQL Editor do painel).
3. Publique a função: `supabase functions deploy manage-users`.
4. Crie o Master: siga o bloco "Bootstrap do Master" no fim do `0001_init.sql`.
5. Em **Authentication → Sign In / Providers**, desative **Allow new users to sign up**, para que ninguém se registre sozinho. A Edge Function já confirma o e-mail dos usuários que cria.

## Variáveis de ambiente
O arquivo `.env` (versionado) tem só a URL e a publishable key, que são públicas. O Vite as embute no build, então o GitHub Pages não precisa de configuração extra. Nunca coloque ali senha do banco, service role ou tokens `sbp_...`.

## Fases
- [x] **Fase 1 — Backend**: schema, RLS, triggers, bucket, Edge Function, docs.
- [x] **Fase 2 — Login e sessão**: `@supabase/supabase-js`, `src/store/supabaseClient.ts`, `authStore`, `LoginPage`, `AuthGate` (protege `index.html` e `frequencia.html` por papel) e `UserMenu` (Sair). Permissões como funções puras em `src/utils/roles.ts`.
- [x] **Fase 3 — Master e Secretário**: página `gestao.html` (`src/gestao`). O Master cadastra/renomeia/exclui escolas e edita o secretário (`MasterPanel`); o Secretário cadastra/edita/desativa/exclui auxiliares (`AssistantsPanel`). Lógica em `directoryStore` + `utils/userValidation.ts` e `utils/directory.ts`. O Master é redirecionado do quadro para a gestão.
- [x] **Fase 4 — Kanban no Supabase**: `taskStore` usa a tabela `tasks` via `store/taskApi.ts` (atualização otimista + Realtime). Responsáveis são o secretário e os auxiliares do cadastro, exibidos pelo sobrenome (`utils/assignees.ts`); a equipe fixa antiga e o localStorage foram removidos. Regra de conclusão em `resolveStatusChange` (`utils/tasks.ts`). Ordem dos cartões na coluna `position`. **Histórico**: cada conclusão grava um registro permanente em `task_history` (trigger `tasks_history`), que sobrevive à exclusão da tarefa; reabrir a tarefa remove o registro. Tela `HistoryModal` com período (7/30/90 dias/tudo) e download em CSV (`utils/history.ts`).
- [x] **Fase 4b — Barra lateral, lembretes e mensagens**:
  - `components/layout/AppShell.tsx`: navegação escura (lateral no desktop, inferior no celular) com Quadro, Lembretes, Mensagens, Dashboard e Equipe (só secretário); o Master vê só Escolas. Mostra contadores de lembretes pendentes e mensagens novas. Cada área continua sendo uma página (`lembretes.html`, `mensagens.html`…), compatível com o GitHub Pages.
  - **Lembretes** (`reminders`, `reminder_completions`): o secretário cria, edita, exclui e marca como feito; a escola toda vê. Repetição: única, semanal ou a cada N meses com período de dias (ex.: do dia 15 ao 20). Um ciclo vale do seu início até o início do seguinte: no período está "no prazo"; depois, "atrasado" até ser marcado ou o próximo começar. Lógica pura em `utils/reminders.ts`.
  - **Mensagens** (`messages`): mural único por escola, ao vivo (Realtime). Autor, nome e horário são gravados pelo banco. Cada um apaga a própria mensagem; o secretário modera. O aviso de "não lidas" é guardado por navegador (localStorage).
- [x] **Fase 5 — Dashboard**: cada escola configura a própria base (`school_settings`), só o secretário edita (`DataSourceModal`). Duas fontes: **planilha online** (link do Google Sheets + nomes das abas, uma por turma) ou **base offline** (um CSV por turma, lido no navegador e gravado como um JSON privado em `attendance-data/<school_id>/frequencia.json`). Com a planilha em uso, a base offline serve de reserva se o link falhar. A cópia embutida `src/data/frequencia.json` foi removida: ela publicava nomes de alunos no site, sem login. Lógica em `utils/attendanceSource.ts` e `store/attendanceStore.ts`.
- [x] **Fase 6 — Testes e docs**: README, `CLAUDE.md`, `architecture.md`, `security.md` e `test-plan.md` reescritos para a v2; roteiro manual por perfil.
- [x] **Pesquisa de aluno no dashboard**: `StudentSearch` busca em todas as turmas e `StudentReportCard` mostra o resumo do aluno com a frequência mês a mês (`studentReport` em `utils/attendance.ts`). Limite dos dados: a planilha registra só os ausentes, então só aparecem alunos com pelo menos uma falta, e a frequência usa os dias de chamada da turma.

## Pendências
- Percorrer o roteiro manual de `docs/test-plan.md` com usuários reais: as regras de RLS/triggers ainda não foram exercitadas ponta a ponta.
- Ligar a proteção contra senhas vazadas e confirmar que o cadastro público está desligado (painel do Supabase).
- A coluna `school_settings.data_file_name` ficou sem uso (removê-la exige confirmação, por ser destrutivo).

## Decisões
- Supabase Auth com e-mail e senha; o Master e o Secretário definem a senha inicial do cadastrado.
- Tarefas antigas do `localStorage` não são migradas (eram dados de teste); a Fase 4 avisa isso.
- `@supabase/supabase-js` é a única dependência nova (cliente oficial; escrever as chamadas REST/Auth à mão seria mais código e mais risco).
