# PRD — Quadro (Kanban)

> **Nota (v2):** este documento descreve a v1 do quadro (local, sem login). A experiência do Kanban continua valendo, mas login, perfis, persistência no Supabase, histórico, lembretes, mensagens e dashboard estão em `docs/v2-supabase.md`.

## 1. Visão geral
O Quadro é um aplicativo web de Kanban para organizar tarefas pessoais ou de equipe pequena. Abre direto no navegador, sem cadastro, e guarda os dados no próprio dispositivo.

## 2. Problema
Listas de tarefas soltas (notas, planilhas, mensagens) não mostram em que etapa cada coisa está, o que está atrasado nem o que é prioridade. Ferramentas completas de gestão exigem conta, configuração e são pesadas para uso diário simples.

## 3. Público-alvo
Pessoas que organizam o próprio trabalho e equipes pequenas que querem um quadro visual rápido, sem setup.

## 4. Objetivos principais
- Visualizar o fluxo de trabalho em quatro colunas.
- Criar, editar, excluir e mover tarefas com poucas ações.
- Priorizar e acompanhar vencimentos.
- Encontrar tarefas por busca e filtros.
- Não perder dados ao recarregar a página.
- Funcionar bem no celular e no desktop.

## 5. Fora de escopo (v1)
Backend/API, banco externo, login e contas, colaboração em tempo real, notificações, anexos, subtarefas, etiquetas, múltiplos quadros, sincronização entre dispositivos.

## 6. Personas
- **Marina, freelancer**: alterna entre clientes, precisa ver o que vence primeiro e o que aguarda revisão.
- **Diego, líder de equipe pequena**: usa o quadro em reuniões rápidas para alinhar o que está em progresso.
- **Paula, estudante**: organiza trabalhos e provas, usa principalmente o celular.

## 7. Jornada do usuário
1. Abre o app e vê o quadro (vazio, com dicas por coluna).
2. Cria a primeira tarefa em "Nova tarefa" ou no "+" de uma coluna.
3. Define prioridade e vencimento.
4. Arrasta a tarefa conforme avança.
5. Usa busca e filtros quando o quadro cresce.
6. Conclui tarefas e acompanha o progresso no cabeçalho.
7. Volta outro dia e encontra tudo como deixou.

## 8. Funcionalidades essenciais
Criar, editar e excluir tarefa (com confirmação e desfazer) · mover entre colunas e reordenar por drag and drop (mouse, toque e teclado) · alterar prioridade (no cartão ou no formulário) · título, descrição, coluna, prioridade e vencimento · busca · filtro por prioridade e por atrasadas · persistência local · layout responsivo · feedback visual (toasts, destaque da coluna alvo, cartão em arraste).

## 9. Funcionalidades futuras
Backend e contas · sincronização · etiquetas · subtarefas · responsáveis · modo escuro · exportar/importar JSON · colunas personalizáveis · atalhos de teclado globais · limite de trabalho em progresso (WIP).

## 10. Regras de negócio
- RN1. Título obrigatório, até 120 caracteres; descrição até 1000.
- RN2. Prioridades: baixa, média, alta, urgente (padrão: média).
- RN3. Vencimento opcional, formato AAAA-MM-DD, deve ser data real.
- RN4. Tarefa está "atrasada" se o vencimento é anterior a hoje e a tarefa não está em Concluído.
- RN5. A ordem em cada coluna é a ordem manual do usuário.
- RN6. Mover entre colunas atualiza `updatedAt`.
- RN7. Exclusão exige confirmação e pode ser desfeita por alguns segundos.
- RN8. Busca ignora maiúsculas e acentos e olha título e descrição.

## 11. Requisitos funcionais
RF1 criar · RF2 editar · RF3 excluir · RF4 mover/reordenar por DnD · RF5 alternativa por teclado para mover · RF6 alterar prioridade · RF7 buscar · RF8 filtrar por prioridade/atrasadas · RF9 limpar filtros · RF10 persistir e restaurar · RF11 tratar dados corrompidos sem travar · RF12 estados vazios · RF13 resumo de progresso.

## 12. Requisitos não funcionais
- Desempenho: interação fluida com centenas de tarefas.
- Acessibilidade: WCAG 2.1 AA como meta (contraste, foco, rótulos, teclado, anúncios do DnD).
- Responsividade: de 360 px a telas largas.
- Segurança: sem HTML injetado, validação no cliente (ver `docs/security.md`).
- Manutenibilidade: TypeScript estrito, camadas separadas, testes da lógica crítica.
- Privacidade: dados ficam só no navegador.

## 13. Métricas de sucesso
- Criar uma tarefa em menos de 10 segundos.
- 100% dos fluxos essenciais funcionando sem erro de console.
- Zero perda de dados em recarregamentos.
- Lighthouse de acessibilidade ≥ 95.
- Cobertura de testes nas funções puras de domínio e nos fluxos principais.

## 14. Critérios de aceite
- [ ] Criar, editar, excluir (com confirmação e desfazer) e mover tarefas funciona.
- [ ] Arrastar entre colunas e dentro da coluna funciona com mouse, toque e teclado.
- [ ] Prioridade e vencimento aparecem no cartão e podem ser alterados.
- [ ] Busca e filtros combinam entre si e podem ser limpos.
- [ ] Recarregar a página mantém as tarefas.
- [ ] Dados corrompidos no localStorage não quebram o app.
- [ ] Layout utilizável em 360 px.
- [ ] `npm run check` passa.
