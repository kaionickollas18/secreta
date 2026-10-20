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
| `notes.test.tsx` | Validação e itens das notas, conversão do banco, vínculos, quem exclui; tela de notas e notas dentro de tarefa/lembrete |
| `team.test.tsx` | Lista da equipe, apelido, idade, validação de apelido e nascimento; perfil de um colega na tela |
| `chatCrypto.test.ts`, `conversas.test.tsx` | Criptografia das conversas (os dois lados leem, terceiro não, senha errada não abre, chave não exportável); lista de conversas, não lidas, canal anônimo e moderação, pedido de senha |
| `documentos.test.tsx`, `schoolIdentity.test.tsx` | Regras e tela de memorandos e ofícios (registro, entrega com resumo, ordem, quem exclui); dados da escola e conteúdo do documento do aluno em PDF |
| `AppShell.test.tsx` | Itens da barra por perfil e avisos |
| `attendance.test.ts`, `sheetParser.test.ts`, `attendanceSource.test.ts` | Indicadores, leitura da planilha, link, arquivos CSV e base offline |
| `studentReport.test.tsx` | Pesquisa de aluno, resumo individual e frequência por mês |

## Roteiro manual
Use quatro contas (Master, Secretário, Auxiliar, Professor) e, de preferência, duas escolas. Abra Secretário e Auxiliar em janelas diferentes (uma anônima).

### 1. Login e perfis
1. Senha errada mostra "E-mail ou senha incorretos."
2. Master entra e cai em **Gestão de escolas**; a barra mostra só "Escolas".
3. Secretário vê Quadro, Lembretes, Calendário, Notas, Documentos, Conversas, Dashboard e Equipe. Auxiliar não vê Equipe.
4. Auxiliar abrindo `gestao.html` direto vê "Sem acesso a esta página".
   - Professor vê só Conversas, Calendário, Dashboard e Perfil. Abrindo `index.html`, `lembretes.html`, `notas.html` ou `documentos.html` direto, vai para Conversas.
5. **Sair** volta ao login.

### 2. Gestão
1. Master cria uma escola com secretário; renomeia; edita o secretário (nome, senha, desativar).
2. Secretário desativado não consegue entrar; reativado, entra.
3. Secretário cria um auxiliar; edita; desativa; exclui.
4. E-mail repetido mostra "Já existe um usuário com este e-mail."
   - Secretário cria um **professor** (Nova pessoa → Professor(a)); ele aparece na lista com o papel e sem o botão de acesso de secretário.
   - Secretário edita alguém: muda nome (o sobrenome acompanha), sobrenome, apelido, nascimento e e-mail; salva; a pessoa passa a entrar com o e-mail novo e vê os dados novos no Perfil. "Remover a foto de perfil" tira a foto.
   - Trocar um auxiliar responsável por tarefas para professor: ele sai dos responsáveis e perde o acesso de secretário, se tinha.
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
5. Tarefa concluída há mais de 3 dias some da coluna Concluído, mas continua no histórico e no CSV (para testar, no SQL Editor: `update tasks set completed_at = now() - interval '4 days' where id = '…'` e recarregar o quadro).

### 5. Lembretes
1. Secretário cria "Todo mês, do dia 15 ao 20" e "A cada 2 meses".
2. Conferir a situação (por vir, no prazo, atrasado) de acordo com a data de hoje.
3. **Marcar como feito** e **Desfazer**; o contador na barra acompanha.
4. Auxiliar vê os lembretes, sem botões de criar, editar, excluir ou marcar.

### 5b. Calendário e avisos
1. Abrir **Calendário**: o mês atual aparece com o dia de hoje marcado; os feriados nacionais já estão lá (ex.: 12/10, 02/11, 15/11).
2. Uma tarefa com prazo aparece no dia do prazo; um lembrete "do dia 15 ao 20" aparece em cada um desses dias.
3. Secretário: **Novo feriado** com um dia só e um recesso de vários dias; editar; excluir. Recarregar e conferir.
3b. **Novo evento** de cada tipo (Planejamento, Reunião, Formação, Conselho, Entrega na SEMEC, Entrega das Notas): cada um aparece no dia com o seu ícone; feriado preenche o dia em vermelho pastel, recesso em amarelo pastel e Planejamento, Reunião, Formação e Conselho em verde pastel; as entregas aparecem como pasta laranja e rosa; sem nome, mostra o nome do tipo; um dia com vários eventos mostra os ícones e "+1".
4. Auxiliar vê os feriados e eventos da escola, sem botões de criar, editar ou excluir. Com duas escolas: o feriado de uma não aparece na outra.
5. No **Quadro**, quem é responsável por uma tarefa que vence hoje ou está atrasada vê "Suas tarefas" no topo; quem não é responsável não vê. **Ver minhas** filtra o quadro. Concluída a tarefa, o aviso some.
6. Com um lembrete pendente: antes das 8h não há aviso; a partir das 8h ele aparece; ao dispensar, some e volta às 12h; marcado como feito, não volta.

### 5c. Notas
1. Criar uma **lista de marcação** (um item por linha) e uma nota de **texto**. Marcar e desmarcar itens; recarregar e conferir.
2. Em duas janelas (Secretário e Auxiliar): marcar um item em uma aparece na outra sem recarregar; cada um marcando um item diferente ao mesmo tempo, as duas marcações ficam.
3. Editar a lista acrescentando uma linha: os itens já marcados continuam marcados.
4. Vincular a uma tarefa: abrir a tarefa no Quadro e ver a nota, marcar um item ali; o cartão mostra "faltam N itens". **Nova nota** dentro da tarefa abre o formulário já vinculado.
5. Vincular a um lembrete: a nota aparece no cartão do lembrete.
6. Auxiliar não vê a lixeira nas notas dos outros; o Secretário vê em todas. Excluir a tarefa vinculada: a nota continua, sem vínculo.
7. Com duas escolas: as notas de uma não aparecem na outra.

### 6. Mensagens
1. Enviar uma mensagem em uma janela: aparece na outra sem recarregar.
2. Em outra página, a barra mostra o contador de mensagens novas; ao abrir o mural, some.
3. Cada um apaga a própria mensagem; o Secretário apaga a de qualquer pessoa; o Auxiliar não vê a lixeira nas mensagens dos outros.
4. Enter envia; Shift+Enter quebra a linha; mensagem vazia mostra erro.

### 6b. Conversas (diretas e anônimo)
1. A aba **Conversas** lista Geral, Anônimo e cada colega ativo (foto e sobrenome). No celular, tocar abre a conversa e a seta volta para a lista.
2. **Geral** continua sendo o mural (roteiro 6).
3. **Anônimo**: escrever uma mensagem; na outra conta ela aparece como "Anônimo", sem recarregar. Só quem escreveu e o Secretário veem a lixeira.
4. **Direta**: sair e entrar de novo com as duas contas (o login cria a chave). Enviar uma mensagem para o colega: chega na outra janela sem recarregar; o contador aparece no menu e na lista.
5. No painel do Supabase, abrir a tabela `direct_messages`: a coluna `ciphertext` é ilegível.
6. Uma terceira conta da mesma escola não vê a conversa entre as outras duas.
7. Sessão que já estava aberta antes desta versão: a conversa direta pede a senha uma vez; senha errada mostra o erro.
8. Trocar a senha em Perfil, sair e entrar com a nova: as conversas antigas continuam abrindo.
9. Secretário redefine a senha de um auxiliar em Equipe: ao entrar, o auxiliar usa **Recomeçar**; as mensagens antigas aparecem para ele como "protegida que este aparelho não consegue abrir", e o colega continua lendo as dele.
10. Colega que nunca entrou depois desta versão: o campo de escrever fica desligado, com o aviso.
11. **Marcações**: no Geral, digitar `@` e parte do sobrenome de um colega, escolher com as setas e Enter; digitar `#` e parte do título de uma tarefa e escolher com o mouse. Enviar: as marcações aparecem como botões. Na conta do colega marcado, a mensagem fica em destaque ("marcou você") e o Geral mostra um `@` na lista.
12. Repetir a marcação numa conversa direta: o colega vê a marcação; no Supabase, `ciphertext` continua ilegível.
13. Tocar na marcação da pessoa (ou no nome de quem escreveu, ou em "Ver perfil"): abre o perfil; **Conversar com …** abre a conversa direta. Tocar na marcação da tarefa: abre o resumo; **Abrir no quadro** abre a tarefa no quadro.
14. **Emojis**: no Windows, **Win + .** no campo de escrever insere um emoji; o botão de emoji ao lado do campo também. Os emojis aparecem coloridos para quem recebe (computador e celular).

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

### 7c. Documento do aluno em PDF
1. Secretário, no Dashboard: **Dados da escola** → conferir nome, INEP, endereço, CEP e ato de criação; enviar a logo. Auxiliar não vê esse botão.
2. Pesquisar um aluno e clicar em **Baixar PDF**: na janela de impressão, escolher "Salvar como PDF". Conferir fundo branco, cabeçalho com logo e dados, tabelas, linha de assinatura e a logo clara ao fundo.
3. Aluno com muitos meses: o documento quebra de página sem cortar linha de tabela.
4. No celular (Chrome/Safari): o mesmo botão abre a impressão do aparelho, com a opção de salvar em PDF.

### 7d. Memorandos e ofícios
0. A aba abre no **Quadro de números**. Tocar em um número livre abre o registro com o número preenchido; depois de salvar, o número fica azul. Tocar no azul abre a entrega; depois de marcar, fica rosa. Tocar no rosa mostra o documento com o resumo. Trocar para **Ofícios** mostra a numeração deles. Os passos abaixo são na visão **Lista**.
1. Em **Documentos**, registrar um memorando e um ofício; os dois aparecem em "Aguardando entrega".
2. **Marcar como entregue** sem resumo mostra o erro; com resumo, data e quem recebeu, o documento vai para "Entregues" mostrando o resumo.
3. Data de entrega anterior à do documento, ou no futuro, é recusada.
4. **Desfazer entrega** devolve o documento para a lista de pendentes, mantendo o resumo.
5. Auxiliar registra, edita e marca, mas não vê a lixeira; o Secretário exclui. Com duas escolas: os documentos de uma não aparecem na outra.

### 8. Perfil
1. Abrir **Perfil** na barra; enviar uma foto (JPG do celular): ela aparece no perfil, na barra e nos cartões em que a pessoa é responsável.
2. Em outra conta da mesma escola, a foto aparece no cartão e na lista de responsáveis ao abrir a tarefa.
3. Trocar o sobrenome: muda nos cartões. Editar a mesma pessoa em Equipe (ex.: desativar e reativar) não desfaz o sobrenome escolhido.
4. Trocar a senha: senha atual errada mostra o erro no campo; com a certa, sair e entrar com a nova.
5. Remover a foto: volta a inicial.
6. Arquivo que não é imagem (PDF) é recusado com explicação.

### 8b. Perfis das pessoas
1. Em **Perfil**, preencher apelido e data de nascimento e salvar; recarregar e conferir. Apagar os dois e salvar de novo.
2. Data no futuro mostra erro no campo.
3. Em "Pessoas da escola", tocar em um colega: abre o perfil com foto, apelido, nome, função, nascimento, e-mail e as tarefas em aberto dele.
4. Em outra conta da mesma escola, o apelido e o nascimento novos aparecem. Com duas escolas: ninguém de uma aparece na lista da outra.
5. Tentar alterar o apelido de outra pessoa não é possível pela tela (não há campo); o banco só aceita a própria linha.
6. No perfil de um colega ativo aparece **Conversar com …**, que abre Conversas já na conversa com ele. No próprio perfil e no de um inativo, o botão não aparece.

### 9. Responsivo e acessibilidade
1. Largura de 360 px: a barra vai para baixo; colunas rolam; modais abrem como gaveta.
2. Só com teclado: Tab/Shift+Tab, Enter, Esc; mover cartão (espaço, setas, espaço).
3. Foco visível; foco volta ao botão de origem ao fechar um modal; zoom de 200%.

### 10. Professor
1. Entrar como professor: a barra mostra Conversas, Calendário, Dashboard e Perfil.
2. Conversas: envia no Geral e no Anônimo; conversa direta com o secretário funciona nos dois sentidos. `#` não sugere tarefas.
3. Calendário mostra feriados e eventos, sem tarefas nem lembretes e sem botões de criar. Dashboard abre só para leitura (sem "Configurar base de dados" nem "Dados da escola").
4. Perfil → Pessoas da escola: o perfil dos colegas não mostra "Tarefas em aberto".
5. **No banco** (SQL Editor, como o professor, ou pelo console do navegador com a sessão dele): `select` em `tasks`, `task_history`, `reminders`, `notes` e `official_documents` volta vazio.
6. Numa conversa direta, marcar com `@` alguém de fora mostra o aviso de que essa pessoa não vai ver a mensagem.

## Casos críticos
Um perfil fazendo o que não pode · dados de uma escola aparecendo em outra · conclusão sem aprovação · perda do histórico · lembrete com prazo errado · nomes de alunos expostos sem login.

## Fora desta versão
- Testes automáticos contra o banco (RLS/triggers) com um projeto Supabase de teste.
- E2E com Playwright (arrastar de verdade no navegador; o jsdom não simula layout para o dnd-kit).
- `vitest-axe` nos componentes principais.
