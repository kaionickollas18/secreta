# SECRETA

Sistema web para a secretaria de escolas: quadro Kanban de tarefas, lembretes de prazos que se repetem, calendário com feriados, notas e listas de marcação, conversas da equipe (mural, canal anônimo e mensagens diretas criptografadas) e dashboard de frequência dos alunos. Cada escola enxerga apenas os próprios dados.

O site é estático (pode ser publicado no GitHub Pages) e usa o [Supabase](https://supabase.com) para login, banco de dados, arquivos e atualização ao vivo.

## Perfis de acesso
| Perfil | O que faz |
|---|---|
| **Master** | Cadastra, renomeia e exclui escolas; cadastra e edita o secretário de cada uma. Não vê tarefas. |
| **Secretário** | Cadastra auxiliares. Cria e exclui tarefas, define responsáveis, conclui e aprova pedidos de conclusão. Cria lembretes e cadastra feriados. Configura a base de dados do dashboard. Modera o mural. |
| **Auxiliar Administrativo** | Edita e move tarefas, pede a conclusão ao secretário. Vê lembretes e dashboard. Participa do mural. |

As regras valem no banco (RLS e triggers), não só na tela. Detalhes em [docs/v2-supabase.md](docs/v2-supabase.md).

## Funcionalidades
- **Login** com e-mail e senha; ninguém se cadastra sozinho.
- **Quadro Kanban**: A Fazer, Em Progresso, Em Revisão e Concluído; arrastar e soltar (mouse, toque e teclado); prioridade, vencimento, responsáveis (secretário e auxiliares, pelo sobrenome); busca e filtros; atualização ao vivo entre usuários.
- **Conclusão com aprovação**: o auxiliar pede, o secretário aprova ou devolve.
- **Histórico** permanente das tarefas concluídas, com filtro de período e download em CSV. No quadro, a tarefa concluída fica em Concluído por 3 dias e depois aparece só no histórico.
- **Lembretes**: uma vez, toda semana ou a cada N meses com período de dias (ex.: todo mês, do dia 15 ao 20).
- **Mensagens**: mural único por escola, ao vivo.
- **Dashboard de frequência**: lê uma planilha do Google ou arquivos CSV enviados pelo secretário.
- **Gestão**: escolas e secretários (Master); auxiliares (Secretário).
- Interface em português, escura, responsiva (a partir de 360 px) e acessível por teclado.

## Stack
React 18 · TypeScript (strict) · Vite · Tailwind CSS 3 · Zustand · dnd-kit · Supabase (Auth, Postgres, Storage, Realtime, Edge Functions) · Vitest + React Testing Library · ESLint + Prettier

## Como instalar e rodar
Requisitos: Node.js 18 ou superior.
```bash
npm install
npm run dev       # desenvolvimento (http://localhost:5173)
npm run build     # build de produção em dist/
npm run preview   # serve o build
```
O arquivo `.env` já traz a URL e a *publishable key* do projeto Supabase (valores públicos). Para usar outro projeto Supabase, siga o "Setup" em [docs/v2-supabase.md](docs/v2-supabase.md) e troque esses dois valores.

## Como testar
```bash
npm run test      # testes (Vitest)
npm run lint      # ESLint
npm run typecheck # TypeScript
npm run check     # tudo: lint + typecheck + testes + build
```
Roteiro manual por perfil em [docs/test-plan.md](docs/test-plan.md).

## Publicar no GitHub Pages
1. Suba o código para o GitHub na branch `main`.
2. No repositório: **Settings → Pages → Source: GitHub Actions**.
3. A cada push, `.github/workflows/deploy.yml` gera e publica o site.

O `vite.config.ts` usa `base: "./"`, então o site funciona em qualquer nome de repositório.

## Estrutura de pastas
```
index.html, lembretes.html, calendario.html, notas.html, documentos.html, mensagens.html, frequencia.html, gestao.html   uma página por área
src/
  components/
    auth/        LoginPage, AuthGate
    layout/      AppShell (barra de navegação)
    board/       Board, Column, FilterBar, HistoryModal
    task/        TaskCard, TaskForm, TaskModal, AssigneeBadge…
    reminders/   ReminderCard, ReminderForm
    attendance/  gráficos, tabelas e DataSourceModal
    admin/       MasterPanel, AssistantsPanel, MemberForm
    ui/          Button, Modal, ConfirmDialog, EmptyState, ToastViewport, Icons
  lembretes/ mensagens/ frequencia/ gestao/   entrada de cada página
  hooks/       composição (permissões, filtros, frequência)
  store/       Zustand + acesso ao Supabase (*Api.ts)
  types/ constants/ utils/   domínio e funções puras
  tests/       testes
supabase/
  migrations/  schema, RLS e triggers
  functions/   manage-users (criação e gestão de usuários)
docs/          PRD, specs, arquitetura, segurança, testes e a v2
CLAUDE.md      instruções para o Claude Code
```

## Privacidade e segurança
- O sistema guarda nomes de funcionários e, no dashboard, nomes de alunos. Trate o acesso com cuidado.
- A planilha online do dashboard precisa estar compartilhada por link: quem tiver o link vê os nomes dos alunos. A base offline (arquivos) é privada da escola.
- Nunca coloque no repositório a senha do banco, a *service role key* ou tokens pessoais (`sbp_…`).
- Mais em [docs/security.md](docs/security.md).

## Roadmap
- Conversas privadas no mural
- Notificações de lembretes por e-mail
- Etiquetas e subtarefas
- E2E com Playwright

## Licença
MIT — veja `LICENSE`.
