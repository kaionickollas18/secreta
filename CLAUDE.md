# CLAUDE.md — SECRETA

## Papel
Você é o(a) engenheiro(a) responsável por evoluir o **SECRETA**, um sistema web para a secretaria de escolas. Trabalhe como Tech Lead: planeje, implemente em passos pequenos, valide e explique decisões relevantes.

## Objetivo do sistema
Organizar o trabalho da secretaria de cada escola: quadro Kanban de tarefas (A Fazer, Em Progresso, Em Revisão, Concluído) com aprovação de conclusão e histórico, lembretes recorrentes, mural de mensagens e dashboard de frequência dos alunos. Há três perfis: **Master** (gerencia escolas e secretários), **Secretário** (gerencia a escola) e **Auxiliar Administrativo**. Cada escola só vê os próprios dados.

## Stack
React 18 + TypeScript (strict) · Vite (multipágina) · Tailwind CSS 3 · Zustand · dnd-kit · Supabase (Auth, Postgres com RLS, Storage, Realtime, Edge Functions) · Vitest + React Testing Library · ESLint + Prettier.

## Antes de qualquer mudança
1. Leia `docs/v2-supabase.md` (papéis, regras e fases) e, conforme o assunto, `docs/architecture.md`, `docs/security.md` e `docs/rules.md`. `docs/prd.md` e `docs/specs.md` descrevem a v1 do quadro e continuam valendo para a experiência do Kanban.
2. **Planeje antes de codar**: escreva em poucas linhas o que vai mudar e quais arquivos serão tocados.
3. Faça mudanças pequenas e verificáveis. Evite overengineering.
4. Não crie dependências sem necessidade; se precisar, justifique.
5. Explique decisões técnicas importantes (em `docs/architecture.md` ou `docs/v2-supabase.md`).

## Regras de implementação
- **Permissões valem no banco.** Toda regra de acesso precisa existir em RLS/trigger (`supabase/migrations`). A tela apenas reflete, usando `src/utils/roles.ts`. Nunca confie só em esconder um botão.
- Regras de negócio ficam em `src/utils` (funções puras) e `src/store`; componentes só apresentam e disparam ações.
- Acesso ao Supabase fica em `src/store/*Api.ts`. Stores usam essas funções; componentes não importam o cliente do Supabase.
- Dados vindos do banco, de arquivos e de planilhas são externos: validar antes de usar (`guards`, `*FromRow`, `isAttendanceData`).
- Nada de `any` sem comentário justificando. `strict` não pode ser relaxado.
- Texto da interface em português do Brasil; identificadores de código em inglês.
- Sem `dangerouslySetInnerHTML`. Todo texto do usuário é renderizado como texto.
- Acessibilidade é requisito: rótulos, foco visível, teclado, `aria-*` onde necessário.
- Mobile-first: comece pelo layout estreito e amplie com breakpoints.

## Banco de dados
- Toda mudança de schema vira um arquivo novo em `supabase/migrations/NNNN_descricao.sql` **e** é aplicada no projeto. Não edite migrations já aplicadas.
- Operações destrutivas (apagar coluna, tabela ou dados) exigem confirmação explícita do usuário.
- Criar, editar ou excluir usuários só pela Edge Function `manage-users` (ela usa a service role, que nunca vai ao navegador).
- Depois de mexer no schema, rode os avisos de segurança do Supabase.

## Segredos
`.env` contém só a URL e a publishable key (públicas). Senha do banco, service role key e tokens pessoais (`sbp_…`) nunca entram no repositório, em arquivos de configuração versionados ou no front-end.

## Convenções
- Componentes: `PascalCase.tsx`, um componente principal por arquivo, props tipadas com `interface`.
- Hooks: `useAlgo.ts`. Stores: `algoStore.ts`. Acesso a dados: `algoApi.ts`. Utilitários e constantes: `camelCase.ts`.
- Testes em `src/tests/*.test.ts(x)`, nomeados pelo assunto. Testes não acessam a rede: simule `store/supabaseClient` e os `*Api.ts`.
- Imports relativos; sem barrels (`index.ts`).
- Página nova: `nome.html` + `src/nome/main.tsx` (com `AuthGate` e `AppShell`) + entrada no `vite.config.ts` + item no `AppShell`.

## Restrições
Sem servidor próprio: o back-end é o Supabase. Sem bibliotecas pesadas. Sem arquivos vazios ou código incompleto. Sem ignorar erros de TypeScript (`@ts-ignore` proibido). Sem dados reais de alunos ou funcionários no repositório (inclusive em testes).

## Estrutura
```
*.html                          uma página por área (quadro, lembretes, calendario, notas, mensagens, frequencia, gestao)
src/
  components/{auth,layout,board,task,reminders,calendar,notes,attendance,admin,ui}/   UI
  {lembretes,calendario,notas,mensagens,frequencia,gestao}/   entrada de cada página
  hooks/                        hooks de composição
  store/                        Zustand e acesso ao Supabase (*Api.ts)
  types/  constants/  utils/    domínio e funções puras
  tests/                        testes
supabase/{migrations,functions}/  schema, regras e Edge Function
```

## Comandos
```
npm install        # dependências
npm run dev        # servidor local
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run test       # Vitest (uma vez)
npm run build      # typecheck + build de produção
npm run check      # lint + typecheck + test + build
npm run format     # Prettier
```

## Como validar cada entrega
Rode `npm run check`. Em seguida percorra, em `docs/test-plan.md`, o roteiro manual do que foi alterado, **com o perfil certo** (Master, Secretário e Auxiliar). Os testes automáticos não tocam o banco real: regras de RLS e triggers só são comprovadas no roteiro manual.

## Critérios de qualidade
Build sem erros · lint limpo · testes passando · lógica crítica coberta por testes · permissões conferidas no banco e na tela · nenhuma regressão · usável com teclado · layout correto de 360 px a desktop · README e docs atualizados quando o comportamento mudar.
