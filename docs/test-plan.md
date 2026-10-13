# Plano de testes

Ferramentas: Vitest, React Testing Library, user-event, jsdom. Comando: `npm run test`.

**Importante:** os testes automáticos não acessam a rede. Eles simulam o Supabase (`store/supabaseClient` nulo e `tests/fakeTaskApi.ts`). As regras do banco (RLS e triggers) só são comprovadas pelo **roteiro manual** abaixo, com usuários reais de cada perfil.

## Automáticos (`src/tests`)
| Arquivo | Cobre |
|---|---|
| `roles.test.ts` | O que cada perfil pode fazer |
| `authErrors.test.ts`, `LoginPage.test.tsx` | Validação e mensagens do login |
| `userValidation.test.ts`, `directory.test.ts` | Cadastro de pessoas, ordenação e busca |
| `validation.test.ts`, `tasks.test.ts` | Formulário de tarefa, filtros, agrupamento, `moveTask` |
| `boardRules.test.ts` | Regra de conclusão por perfil, posição dos cartões, responsáveis, conversão de linhas do banco |
| `taskStore.test.ts` | Carregar, criar, editar, excluir, mover (otimista e desfazer em erro), aprovar/devolver |
| `TaskForm.test.tsx`, `App.test.tsx` | Fluxos do quadro como Secretário e como Auxiliar; histórico |
| `history.test.ts` | Períodos e CSV (escape e proteção contra fórmulas) |
| `reminders.test.ts` | Ciclos mensais/bimestrais/semanais/únicos, atraso, virada de ano, validação |
| `messages.test.ts` | Validação, agrupamento por dia, não lidas |
| `calendar.test.ts`, `CalendarioApp.test.tsx` | Feriados nacionais, validação de feriados, grade do mês, lembretes e tarefas por dia, horários e regras dos avisos; tela do calendário por perfil |
| `AppShell.test.tsx` | Itens da barra por perfil e avisos |
| `attendance.test.ts`, `sheetParser.test.ts`, `attendanceSource.test.ts` | Indicadores, leitura da planilha, link, arquivos CSV e base offline |
| `studentReport.test.tsx` | Pesquisa de aluno, resumo individual e frequência por mês |

## Roteiro manual
Use três contas (Master, Secretário, Auxiliar) e, de preferência, duas escolas. Abra Secretário e Auxiliar em janelas diferentes (uma anônima).

### 1. Login e perfis
1. Senha errada mostra "E-mail ou senha incorretos."
2. Master entra e cai em **Gestão de escolas**; a barra mostra só "Escolas".
3. Secretário vê Quadro, Lembretes, Calendário, Mensagens, Dashboard e Equipe. Auxiliar não vê Equipe.
4. Auxiliar abrindo `gestao.html` direto vê "Sem acesso a esta página".
5. **Sair** volta ao login.

### 2. Gestão
1. Master cria uma escola com secretário; renomeia; edita o secretário (nome, senha, desativar).
2. Secretário desativado não consegue entrar; reativado, entra.
3. Secretário cria um auxiliar; edita; desativa; exclui.
4. E-mail repetido mostra "Já existe um usuário com este e-mail."
5. Com duas escolas: o secretário de uma não vê pessoas, tarefas, lembretes nem mensagens da outra.

### 3. Quadro
1. Secretário cria tarefas com responsáveis (aparecem pelo sobrenome); edita; exclui com confirmação.
2. Arrastar entre colunas e reordenar; recarregar e conferir a ordem.
3. Auxiliar não vê "Nova tarefa" nem a lixeira; no formulário não escolhe responsáveis nem "Concluído".
4. Auxiliar clica em **Pedir conclusão** (ou arrasta para Concluído): a tarefa vai para Em Revisão com "Aguardando aprovação".
5. Na janela do Secretário o pedido aparece **sem recarregar**; **Aprovar** conclui; **Devolver** tira o selo.
6. Auxiliar tenta arrastar uma tarefa concluída para fora: recebe o aviso e ela volta.
7. Busca por título e por sobrenome; filtros de prioridade, responsável e atrasadas.

### 4. Histórico
1. Depois de aprovar uma tarefa, ela aparece em **Histórico** (últimos 30 dias).
2. Trocar o período; baixar o CSV e abrir no Excel (acentos corretos, colunas separadas).
3. Excluir a tarefa concluída do quadro: o registro continua no histórico.
4. Reabrir uma tarefa concluída: o registro sai do histórico.

### 5. Lembretes
1. Secretário cria "Todo mês, do dia 15 ao 20" e "A cada 2 meses".
2. Conferir a situação (por vir, no prazo, atrasado) de acordo com a data de hoje.
3. **Marcar como feito** e **Desfazer**; o contador na barra acompanha.
4. Auxiliar vê os lembretes, sem botões de criar, editar, excluir ou marcar.

### 5b. Calendário e avisos
1. Abrir **Calendário**: o mês atual aparece com o dia de hoje marcado; os feriados nacionais já estão lá (ex.: 12/10, 02/11, 15/11).
2. Uma tarefa com prazo aparece no dia do prazo; um lembrete "do dia 15 ao 20" aparece em cada um desses dias.
3. Secretário: **Novo feriado** com um dia só e um recesso de vários dias; editar; excluir. Recarregar e conferir.
4. Auxiliar vê os feriados da escola, sem botões de criar, editar ou excluir. Com duas escolas: o feriado de uma não aparece na outra.
5. No **Quadro**, quem é responsável por uma tarefa que vence hoje ou está atrasada vê "Suas tarefas" no topo; quem não é responsável não vê. **Ver minhas** filtra o quadro. Concluída a tarefa, o aviso some.
6. Com um lembrete pendente: antes das 8h não há aviso; a partir das 8h ele aparece; ao dispensar, some e volta às 12h; marcado como feito, não volta.

### 6. Mensagens
1. Enviar uma mensagem em uma janela: aparece na outra sem recarregar.
2. Em outra página, a barra mostra o contador de mensagens novas; ao abrir o mural, some.
3. Cada um apaga a própria mensagem; o Secretário apaga a de qualquer pessoa; o Auxiliar não vê a lixeira nas mensagens dos outros.
4. Enter envia; Shift+Enter quebra a linha; mensagem vazia mostra erro.

### 7. Dashboard
1. Sem configuração: Secretário vê "Configurar base de dados"; Auxiliar vê o aviso, sem botão.
2. Secretário cola o link e os nomes das abas: os gráficos aparecem com "Ao vivo da planilha".
3. Link inválido e lista de abas vazia mostram erro no campo.
4. Enviar arquivos `.csv` (um por turma): aparecem na lista; reenviar uma turma substitui; remover uma turma; apagar tudo.
5. Arquivo fora do formato é recusado com explicação, sem afetar os demais.
6. Com a planilha em uso e a base offline enviada, usar um link de planilha inexistente: o dashboard mostra a base offline com o aviso.
7. **Pesquisar aluno**: digitar parte do nome (com e sem acento); escolher um resultado; conferir frequência geral, faltas, última falta e a frequência de cada mês (o pior mês vem destacado). Clicar em um nome na tabela "Alunos que mais faltam" abre o mesmo resumo.

### 7b. Acesso de secretário
1. Secretário, em Equipe: **Dar acesso de secretário** a um auxiliar (confirma) e ver o selo no cartão.
2. Esse auxiliar recarrega a página: passa a ver "Nova tarefa", a lixeira, "Aprovar/Devolver", os botões de lembrete e "Base de dados" no dashboard; **não** vê a aba Equipe.
3. Ele cria uma tarefa, aprova um pedido e marca um lembrete como feito: tudo é aceito pelo banco.
4. Abrindo `gestao.html` direto, ele vê "Sem acesso a esta página".
5. Secretário retira o acesso: depois de recarregar, o auxiliar volta ao normal; uma tentativa de criar tarefa com a tela antiga aberta é recusada.

### 8. Perfil
1. Abrir **Perfil** na barra; enviar uma foto (JPG do celular): ela aparece no perfil, na barra e nos cartões em que a pessoa é responsável.
2. Em outra conta da mesma escola, a foto aparece no cartão e na lista de responsáveis ao abrir a tarefa.
3. Trocar o sobrenome: muda nos cartões. Editar a mesma pessoa em Equipe (ex.: desativar e reativar) não desfaz o sobrenome escolhido.
4. Trocar a senha: senha atual errada mostra o erro no campo; com a certa, sair e entrar com a nova.
5. Remover a foto: volta a inicial.
6. Arquivo que não é imagem (PDF) é recusado com explicação.

### 9. Responsivo e acessibilidade
1. Largura de 360 px: a barra vai para baixo; colunas rolam; modais abrem como gaveta.
2. Só com teclado: Tab/Shift+Tab, Enter, Esc; mover cartão (espaço, setas, espaço).
3. Foco visível; foco volta ao botão de origem ao fechar um modal; zoom de 200%.

## Casos críticos
Um perfil fazendo o que não pode · dados de uma escola aparecendo em outra · conclusão sem aprovação · perda do histórico · lembrete com prazo errado · nomes de alunos expostos sem login.

## Fora desta versão
- Testes automáticos contra o banco (RLS/triggers) com um projeto Supabase de teste.
- E2E com Playwright (arrastar de verdade no navegador; o jsdom não simula layout para o dnd-kit).
- `vitest-axe` nos componentes principais.
