# Especificações técnicas

> **Nota (v2):** este documento descreve a v1 do quadro (local, sem login). A experiência do Kanban continua valendo, mas login, perfis, persistência no Supabase, histórico, lembretes, mensagens e dashboard estão em `docs/v2-supabase.md`.

## 1. Arquitetura do frontend
SPA em React com camadas: **UI** (componentes) → **estado** (Zustand) → **domínio** (funções puras em `utils`) → **persistência** (`store/storage.ts`). Detalhes em `docs/architecture.md`.

## 2. Estrutura de pastas
```
src/
  App.tsx, main.tsx, index.css
  components/
    board/  Board, Column, FilterBar
    task/   TaskCard, TaskForm, TaskModal, PrioritySelect, PriorityBadge
    ui/     Button, Modal, ConfirmDialog, EmptyState, ToastViewport, Icons
  hooks/    useFilteredTasks
  store/    taskStore, filterStore, toastStore, storage, persistence
  types/    task.ts
  constants/board.ts
  utils/    tasks, validation, date, guards, id
  tests/
```

## 3. Modelos e tipos
```ts
type TaskStatus = "todo" | "in_progress" | "review" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;   // AAAA-MM-DD
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
}
```
Também: `TaskInput` (dados validados), `TaskFormValues` (strings do formulário), `TaskFilters`, `FieldErrors`. Fonte: `src/types/task.ts`. Os arrays `TASK_STATUSES` e `TASK_PRIORITIES` derivam os tipos, evitando divergência.

## 4. Componentes principais
- `App`: orquestra modais, confirmação de exclusão, cabeçalho e avisos.
- `Board`: `DndContext`, sensores, `DragOverlay`, anúncios em pt-BR; decide o destino do drop.
- `Column`: área solta (`useDroppable`) + `SortableContext`; estados vazios.
- `TaskCard`: cartão ordenável com alça de arraste, editar, excluir e prioridade.
- `TaskForm` / `TaskModal`: criação e edição com validação.
- `FilterBar`: busca, prioridade, "só atrasadas", limpar.
- `Modal`, `ConfirmDialog`, `ToastViewport`, `EmptyState`, `Button`.

## 5. Hooks
- `useFilteredTasks`: combina tarefas e filtros; devolve agrupamento por coluna, totais e contadores (memoizado).

## 6. Fluxo de estado
- `taskStore`: `tasks` (fonte da verdade) e ações `addTask`, `updateTask`, `setPriority`, `deleteTask`, `restoreTask`, `moveTask`.
- `filterStore`: filtros da sessão (não persistem).
- `toastStore`: mensagens transitórias (até 3).
- Fluxo: evento na UI → ação do store → novo array imutável → assinatura de persistência grava no localStorage → componentes reagem.

## 7. Ordenação
Não há campo `order`: a ordem de uma coluna é a ordem relativa das tarefas no array. `moveTask(tasks, id, status, overId?)` calcula a nova posição (ver testes em `src/tests/tasks.test.ts`).

## 8. Persistência
Chave `kanban:v1` com `{ version: 1, tasks: Task[] }`. Leitura valida cada tarefa (`isTask`); inválidas são descartadas e o conteúdo original vai para `kanban:v1:backup`. Falha de gravação (cota, modo privado) gera aviso e o app continua em memória. A camada `storage.ts` é a única que conhece `localStorage`, o que facilita trocar por API.

## 9. Validação
`validateTaskForm` (puro): título obrigatório e ≤ 120; descrição ≤ 1000; data real; status e prioridade dentro dos conjuntos; remove caracteres de controle e aparas. Erros por campo, exibidos junto ao campo com `role="alert"`.

## 10. Tratamento de erros
Dados corrompidos → banner informativo; falha ao salvar → toast; exclusão acidental → "Desfazer"; drop fora das colunas → nada acontece.

## 11. Estados vazios e de carregamento
Vazio: cada coluna tem uma dica e um botão de adicionar; com filtros ativos e sem resultado, mostra "Nada por aqui com esses filtros". Carregamento: a leitura do localStorage é síncrona, então não há tela de loading na v1; quando houver API, usar skeletons nas colunas.

## 12. Acessibilidade
Rótulos em todos os campos; `aria-invalid`/`aria-describedby` em erros; modal com `role="dialog"`, `aria-modal`, foco inicial, armadilha de Tab, Esc e retorno do foco; DnD por teclado (espaço/Enter, setas) com anúncios em português; foco visível; cor nunca é o único indicador (prioridade tem texto; atraso tem texto); `prefers-reduced-motion` respeitado.

## 13. Responsividade
Mobile-first: colunas em rolagem horizontal com `snap`; a partir de `xl` as quatro colunas dividem a largura. Alvos de toque ≥ 36–40 px; arraste por toque exige segurar ~200 ms para não competir com a rolagem; a alça tem `touch-action: none`.

## 14. Estratégia de testes
Vitest + RTL. Unitários para utilitários, validação, storage e store; componente para `TaskForm`; integração para `App`. Plano completo em `docs/test-plan.md`.
