# Regras obrigatórias

1. **TypeScript estrito**; sem `any` sem justificativa em comentário (a regra do ESLint está como erro).
2. **Componentes pequenos e reutilizáveis**; se um componente passa de ~150 linhas, avalie dividir.
3. **Separar lógica de UI**: regras e cálculos em `utils`/`store`; componentes apenas apresentam.
4. **Não misturar regra de negócio com visual** (ex.: decidir "atrasada" é `isOverdue`, não JSX).
5. **Não duplicar lógica**: antes de criar, procure se já existe em `utils`, `constants` ou `ui`.
6. **Nomes consistentes**: `PascalCase.tsx` para componentes, `camelCase.ts` para o resto, `useX` para hooks, `xStore` para stores.
7. **Acessibilidade básica** em todo componente novo: rótulo, foco visível, teclado, semântica correta.
8. **Mobile-first**: estilos base para telas estreitas; breakpoints ampliam.
9. **Testes para lógica crítica** (validação, filtros, movimentação, persistência, store) e para cada fluxo novo importante.
10. **Não quebrar o que existe**: rode os testes antes e depois da mudança.
11. **Dependências**: só com justificativa e peso razoável.
12. **Segurança**: sem `dangerouslySetInnerHTML`, `eval` ou HTML montado por string com dados do usuário.
13. **Dados**: só `store/*Api.ts` fala com o Supabase; componentes e utilitários não importam o cliente. Toda regra de acesso precisa existir no banco (RLS/trigger), não só na tela.
14. **Antes de finalizar**: `npm run lint`, `npm run typecheck`, `npm run test` e `npm run build` (ou `npm run check`).
15. **Mudanças pequenas**: um assunto por vez, fáceis de revisar e reverter.
