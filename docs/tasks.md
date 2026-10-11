# Plano de implementação

Legenda: [x] implementado no código. A validação executada (`npm run check`) deve ser feita localmente após `npm install`.

## 1. Setup do projeto [x]
- **Descrição**: Vite + React + TS, scripts, ESLint, Prettier, Vitest.
- **Arquivos**: `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc`, `index.html`.
- **Aceite**: `npm run dev` abre o app; `npm run lint` e `npm run typecheck` sem erros.
- **Dependências**: nenhuma.

## 2. Configuração do Tailwind [x]
- **Descrição**: Tailwind 3, tokens de cor (canvas, ink, accent, prioridades), fonte, foco visível, movimento reduzido.
- **Arquivos**: `tailwind.config.js`, `postcss.config.js`, `src/index.css`.
- **Aceite**: classes utilitárias e tokens funcionam na build.
- **Dependências**: 1.

## 3. Tipos [x]
- **Descrição**: `Task`, `TaskStatus`, `TaskPriority`, `TaskInput`, `TaskFormValues`, `TaskFilters`.
- **Arquivos**: `src/types/task.ts`, `src/constants/board.ts`, `src/utils/guards.ts`.
- **Aceite**: tipos derivados de arrays constantes; guards cobrem dados externos.
- **Dependências**: 1.

## 4. Store [x]
- **Descrição**: ações de tarefas, filtros e toasts; utilitários de domínio (`filterTasks`, `moveTask`, `groupByStatus`), validação e datas.
- **Arquivos**: `src/store/*`, `src/utils/*`, `src/hooks/useFilteredTasks.ts`.
- **Aceite**: ações cobertas por testes unitários.
- **Dependências**: 3.

## 5. Componentes base [x]
- **Descrição**: Button, Modal acessível, ConfirmDialog, EmptyState, ToastViewport, ícones.
- **Arquivos**: `src/components/ui/*`.
- **Aceite**: Modal com foco inicial, Tab preso, Esc e retorno do foco.
- **Dependências**: 2.

## 6. Board Kanban [x]
- **Descrição**: quatro colunas, cartões, contadores, estados vazios, resumo no cabeçalho.
- **Arquivos**: `src/components/board/Board.tsx`, `Column.tsx`, `src/components/task/TaskCard.tsx`, `src/App.tsx`.
- **Aceite**: tarefas aparecem na coluna do `status`; colunas vazias mostram dica e ação.
- **Dependências**: 4, 5.

## 7. Drag and drop [x]
- **Descrição**: dnd-kit com mouse, toque (segurar), teclado e anúncios em pt-BR; mover e reordenar.
- **Arquivos**: `Board.tsx`, `Column.tsx`, `TaskCard.tsx`, `src/utils/tasks.ts`.
- **Aceite**: arrastar entre colunas e dentro da coluna persiste a nova ordem; toast ao mudar de coluna.
- **Dependências**: 6.

## 8. Formulário de tarefas [x]
- **Descrição**: criar/editar em modal (gaveta inferior no celular), validação por campo, exclusão com confirmação e desfazer.
- **Arquivos**: `src/components/task/TaskForm.tsx`, `TaskModal.tsx`, `src/utils/validation.ts`, `App.tsx`.
- **Aceite**: título obrigatório; erros acessíveis; dados normalizados.
- **Dependências**: 4, 5.

## 9. Busca e filtros [x]
- **Descrição**: busca sem acento, filtro por prioridade, "só atrasadas", limpar, contagem de resultados.
- **Arquivos**: `src/components/board/FilterBar.tsx`, `src/store/filterStore.ts`, `src/utils/tasks.ts`.
- **Aceite**: filtros combinam; colunas sem resultado explicam o motivo.
- **Dependências**: 6.

## 10. Persistência local [x]
- **Descrição**: salvar a cada mudança, validar ao carregar, backup de dados corrompidos, aviso de falha.
- **Arquivos**: `src/store/storage.ts`, `persistence.ts`, `src/main.tsx`.
- **Aceite**: recarregar mantém tudo; JSON inválido não quebra o app.
- **Dependências**: 4.

## 11. Testes [x]
- **Descrição**: unitários, componente e integração (ver `docs/test-plan.md`).
- **Arquivos**: `src/tests/*`.
- **Aceite**: `npm run test` passa.
- **Dependências**: 4–10.

## 12. Polimento visual [x]
- **Descrição**: paleta, tipografia, foco, estados de hover, cartão em arraste, responsividade.
- **Arquivos**: `tailwind.config.js`, `src/index.css`, componentes.
- **Aceite**: uso confortável de 360 px a desktop; contraste adequado.
- **Dependências**: 6–9.

## 13. Documentação final [x]
- **Descrição**: README e docs atualizados.
- **Arquivos**: `README.md`, `docs/*`, `CLAUDE.md`.
- **Aceite**: um novo dev instala e roda em menos de 5 minutos.
- **Dependências**: todas.

## v2 — Login, perfis e Supabase [x]
As etapas 1 a 13 acima são a v1 (quadro local, sem login). A v2 trocou o `localStorage` pelo Supabase e acrescentou perfis, gestão, histórico, lembretes, mensagens e a base de dados do dashboard. As fases, com arquivos e decisões, estão em `docs/v2-supabase.md`.

## Pendências conhecidas
- Percorrer o roteiro manual de `docs/test-plan.md` com os três perfis (as regras do banco não têm teste automático).
- Testar DnD em dispositivo de toque real.
