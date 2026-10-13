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
- [x] **Perfil próprio** (`perfil.html`, `src/perfil`): cada pessoa troca a foto, o sobrenome e a senha. No banco (`0007`): `profiles.avatar_path`; o cliente só pode atualizar `last_name` e `avatar_path` da própria linha (permissão por coluna + policy `profiles_update_self`); bucket `avatars` com escrita só na própria pasta. A foto é recortada e reduzida no navegador (`utils/profileForm.ts`), o que também remove os metadados da câmera. A senha é trocada pelo Supabase Auth depois de conferir a atual. A função `manage-users` (v3) só recalcula o sobrenome quando o nome completo muda e apaga as fotos ao excluir alguém.
- [x] **Cartão de tarefa**: cabeçalho com as fotos dos responsáveis, linhas de informação, ação no rodapé e faixa de prioridade na base. Ao abrir a tarefa, os responsáveis aparecem em lista, um abaixo do outro, com foto.
- [x] **Tela de login**: fundo em vídeo (`src/assets/login-bg.mp4`, 409 KB, com imagem parada `login-bg.jpg` para o primeiro instante, para quem pede menos movimento e para economia de dados) e, abaixo do formulário, 10 filmes e séries em destaque na semana, em português (`LoginMovies`, no desenho do Card 03). Os dados vêm da Edge Function pública `login-movies`, que consulta o TMDB com o token guardado no segredo `TMDB_READ_TOKEN` e mantém o resultado por 6 horas na tabela `news_cache` (`0008`, linha `tmdb`). Conteúdo marcado como adulto é descartado. Se a busca falhar, a seção não aparece. A atribuição ao TMDB no rodapé da seção é exigida pelos termos de uso.
- [x] **Acesso de secretário para auxiliares** (`0009`): o secretário marca, em Equipe, quais auxiliares têm acesso especial (`profiles.elevated`). A função `current_role_name()` passa a devolver `secretary` para eles, então todas as policies e o trigger de tarefas os tratam como secretário de uma vez: tarefas, lembretes, base do dashboard e moderação do mural. A gestão da equipe é a exceção: a Edge Function `manage-users` olha a coluna `role` (o papel real), e só o secretário cadastra pessoas ou muda esse acesso. Na tela, `effectiveRole(profile)` (`utils/roles.ts`) espelha a regra. O cliente não consegue alterar `elevated` (permissão por coluna da `0007`).
- [x] **Calendário e avisos** (`0010`, `calendario.html`, `src/calendario`): a grade do mês mostra feriados, tarefas (pelo prazo) e lembretes (em todos os dias do período); o dia escolhido abre o detalhe ao lado. Feriados nacionais e os pontos facultativos de data móvel (Carnaval, Corpus Christi) são calculados em `utils/holidays.ts`; os municipais e os recessos ficam na tabela `holidays`, que a escola lê e só o secretário (ou o auxiliar com acesso de secretário) altera. Feriados aparecem apenas no calendário, não nas listas de tarefas e lembretes. **Avisos** (`NoticeStrip`, no topo do Quadro): cada pessoa vê as tarefas em que é responsável e que vencem hoje ou estão atrasadas, até concluí-las; os lembretes pendentes aparecem a partir das 8h e, se dispensados, voltam às 12h (`utils/notices.ts`; a dispensa fica no navegador). Os avisos existem só com o sistema aberto: não há notificação do navegador nem do celular.
- [x] **Notas** (`0011`, `notas.html`, `src/notas`): anotações da escola em dois formatos, texto livre ou lista de marcação (ex.: o que falta para a ornamentação), com vínculo opcional a **uma** tarefa ou **um** lembrete. A escola toda lê; secretário e auxiliares criam, editam e marcam itens; só o autor ou o secretário exclui (RLS). O trigger `notes_guard` grava autor e datas, confere o formato dos itens (`items` em jsonb, até 60) e que o vínculo é da mesma escola. Marcar um item usa a função `set_note_item_done`, que altera só aquele item: duas pessoas marcando ao mesmo tempo não se atrapalham. Excluir a tarefa ou o lembrete solta a nota (não a apaga). Na tela: página Notas; ao abrir uma tarefa aparecem as notas dela, com "Nova nota" já vinculada; o cartão da tarefa mostra quantos itens faltam; o cartão do lembrete lista as notas dele (`LinkedNotes`). Atualiza ao vivo (Realtime). Lógica em `utils/notes.ts`.
- [x] **Eventos da escola no calendário** (`0012`): além de feriado ou recesso, o secretário marca Planejamento Pedagógico, Reunião Administrativa, Formação Pedagógica, Conselho de Classe, Entrega das Atas e Índices Bimestrais na SEMEC e Entrega das Notas na Secretaria da Escola. A tabela continua sendo `holidays`, com a coluna `kind`; as regras de acesso são as mesmas. Recesso é um tipo próprio (`0013`), separado de feriado. Cada tipo tem ícone e cor (`components/calendar/KindIcon.tsx`), e a cor **preenche o quadro do dia**: feriado em vermelho pastel, recesso em amarelo pastel e os quatro eventos pedagógicos e administrativos em verde pastel (prancheta, caderno, três livros, ampulheta), com o texto escuro por cima. As duas entregas não preenchem o dia: aparecem como pasta laranja e pasta rosa. Com vários eventos no mesmo dia, vale a cor de feriado, depois recesso, depois verde. Nos tipos novos o nome é opcional: em branco, vale o nome do tipo.

## Pendências
- Percorrer o roteiro manual de `docs/test-plan.md` com usuários reais: as regras de RLS/triggers ainda não foram exercitadas ponta a ponta.
- Ligar a proteção contra senhas vazadas e confirmar que o cadastro público está desligado (painel do Supabase).
- A coluna `school_settings.data_file_name` ficou sem uso (removê-la exige confirmação, por ser destrutivo).

## Decisões
- Supabase Auth com e-mail e senha; o Master e o Secretário definem a senha inicial do cadastrado.
- Tarefas antigas do `localStorage` não são migradas (eram dados de teste); a Fase 4 avisa isso.
- `@supabase/supabase-js` é a única dependência nova (cliente oficial; escrever as chamadas REST/Auth à mão seria mais código e mais risco).
