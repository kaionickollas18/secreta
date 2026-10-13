# Arquitetura

## Visão
Site estático multipágina (Vite) + Supabase como back-end. Não há servidor próprio: o navegador fala direto com o Supabase, e as regras de acesso são impostas pelo banco.

```
UI (components) ──► Estado (Zustand stores) ──► Domínio (utils puros)
                          │
                          └──► Acesso a dados (store/*Api.ts) ──► Supabase
                                                                  ├─ Auth (login)
                                                                  ├─ Postgres + RLS + triggers
                                                                  ├─ Storage (base offline do dashboard)
                                                                  ├─ Realtime (tarefas e mensagens)
                                                                  └─ Edge Function manage-users
```

## Camadas
| Camada | Local | Responsabilidade | Não faz |
|---|---|---|---|
| UI | `components/`, `App.tsx`, `*/…App.tsx` | Renderizar, capturar eventos, acessibilidade | Regra de negócio, acesso ao Supabase |
| Estado | `store/*Store.ts`, `hooks/` | Guardar dados, expor ações, derivar listas | Detalhes de DOM, SQL |
| Domínio | `utils/`, `types/`, `constants/` | Validar, filtrar, mover, ciclos de lembrete, permissões (funções puras) | Efeitos colaterais |
| Dados | `store/*Api.ts`, `store/supabaseClient.ts` | Ler/gravar no Supabase, converter e validar linhas | Conhecer React |
| Banco | `supabase/migrations` | Schema, RLS, triggers: a autoridade sobre quem pode o quê | — |

## Páginas
Uma página HTML por área, cada uma com sua entrada em `src/<área>/main.tsx`:
`index.html` (quadro) · `lembretes.html` · `calendario.html` · `mensagens.html` · `frequencia.html` (dashboard) · `gestao.html`.
Todas são envolvidas por `AuthGate` (login e perfis permitidos) e `AppShell` (barra de navegação e avisos).

## Decisões e trade-offs
- **Supabase em vez de servidor próprio**: login, banco, arquivos e tempo real prontos, e o site continua estático (GitHub Pages). Custo: as regras precisam ser escritas em SQL (RLS/triggers) e só são comprovadas contra o banco real.
- **Permissões no banco, espelhadas na tela**: `utils/roles.ts` decide o que mostrar; RLS e o trigger `tasks_guard` decidem o que é permitido. A publishable key é pública por desenho.
- **Edge Function para usuários**: criar contas exige a service role, que não pode ir ao navegador. `manage-users` confere o papel de quem chama antes de agir.
- **Multipágina em vez de roteador**: funciona no GitHub Pages sem configuração de rotas e cada área carrega só o seu código. Custo: trocar de área recarrega a página; por isso o `AppShell` recarrega lembretes e mensagens em cada uma.
- **`*Api.ts` separado dos stores**: os testes trocam a camada de dados por uma versão em memória (`tests/fakeTaskApi.ts`) e exercitam a lógica do store sem rede.
- **Zustand em vez de Context**: menos boilerplate e seleção granular.
- **Ordem dos cartões**: no cliente é a ordem do array; no banco é a coluna `position` (fracionária: mover grava só a tarefa movida, no meio das vizinhas).
- **Atualização otimista ao mover**: o cartão muda na hora e volta atrás, com aviso, se o banco recusar.
- **Histórico em tabela própria** (`task_history`, gravada por trigger): sobrevive à exclusão da tarefa e das pessoas, pois guarda nomes como texto.
- **Lembretes sem agendador**: a situação de cada lembrete é calculada na hora por funções puras (`utils/reminders.ts`) a partir da regra de repetição e dos ciclos marcados como feitos. Não há tarefa em segundo plano nem notificação fora do site.
- **Calendário e avisos sem agendador**: o calendário é montado na hora (`utils/calendar.ts`) com as tarefas, os ciclos dos lembretes e os feriados; os nacionais são calculados (`utils/holidays.ts`), sem tabela nem serviço externo. Os avisos do Quadro (`utils/notices.ts`) usam o relógio do navegador (`useClock`, a cada minuto) para aparecer às 8h e às 12h.
- **Dashboard**: os CSVs são lidos no navegador e gravados como um único JSON no Storage, validado ao carregar.
- **dnd-kit**: acessível (teclado, anúncios) e leve. Arraste só pela alça; o drop é resolvido em `onDragEnd`.
- **Tailwind 3 com tokens no `tailwind.config.js`**: paleta e prioridades centralizadas.

## Limites conhecidos
- O aviso de mensagens "não lidas" é guardado por navegador, não por conta.
- O mural carrega as 100 mensagens mais recentes.
- A planilha online do dashboard precisa ser pública por link (limitação do acesso sem chave ao Google Sheets).
- O e-mail de um usuário não pode ser alterado depois do cadastro.
