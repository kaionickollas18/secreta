# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Secretário(a) escolar** (usuário principal): responde pela secretaria de uma escola pública municipal. Distribui e acompanha o trabalho da equipe, cumpre prazos que se repetem (memorandos, sistemas do governo) e precisa saber, a qualquer momento, o que está pendente e com quem.
- **Assistente administrativo**: executa as tarefas atribuídas pelo secretário, atualiza o andamento e pede a conclusão.
- **Master**: administra a rede. Cadastra as escolas e o secretário de cada uma. Não participa do trabalho diário das escolas.

Situação de uso: no computador da secretaria durante o expediente e no celular para consultas rápidas, mensagens e lembretes. A familiaridade da equipe com tecnologia é **mista**: parte usa com facilidade, parte tem dificuldade e depende de telas simples e textos claros.

## Product Purpose

O SECRETA organiza o trabalho da secretaria de cada escola em um só lugar: quem faz o quê, o que vence quando, o que a equipe precisa comunicar e como está a frequência dos alunos.

Sucesso significa: o secretário enxerga a situação do trabalho sem perguntar a ninguém; nenhuma tarefa é dada como concluída sem a aprovação dele; prazos recorrentes não são esquecidos; e é possível comprovar depois o que foi feito, por quem e quando.

## Positioning

Um quadro de tarefas feito para a hierarquia e a rotina reais de uma secretaria escolar, não um Kanban genérico: o assistente não conclui sozinho (pede, e o secretário aprova), os lembretes seguem os ciclos da administração escolar (ex.: "todo mês, do dia 15 ao 20"), cada conclusão vira registro permanente, e a frequência dos alunos fica ao lado do trabalho da equipe. Cada escola só enxerga os próprios dados.

## Operating Context

- **Rotinas com prazo que se repetem**, citadas pelo secretário: entregar, do dia 15 ao dia 20 de cada mês, o memorando com o anexo da frequência de pessoal de toda a escola; preencher a cada dois meses a frequência do Sistema Presença (Bolsa Família).
- **Fluxo de tarefas**: o secretário cria a tarefa e define os responsáveis (ele mesmo e/ou assistentes); o assistente executa e pede a conclusão; o secretário aprova ou devolve.
- **Frequência dos alunos**: registrada pela escola em planilha (Google Sheets), uma aba por turma, com os ausentes de cada dia. O dashboard lê essa planilha ou arquivos CSV enviados pelo secretário.
- **Prestação de contas**: o histórico de tarefas concluídas é baixado como planilha (CSV) por período.
- **Comunicação**: mural único da escola, visto por toda a equipe.
- **Adoção**: começa em uma escola e deve ser adotado por outras escolas da mesma rede municipal. Os testes de campo com usuários reais começam em 13/10/2026.

## Capabilities and Constraints

**Funcionalidades confirmadas**
- Login por e-mail e senha; ninguém se cadastra sozinho. O Master cria secretários; o secretário cria assistentes.
- Quadro Kanban com quatro colunas (A Fazer, Em Progresso, Em Revisão, Concluído), prioridade, vencimento, responsáveis, busca e filtros, atualização ao vivo.
- Conclusão com aprovação do secretário e histórico permanente, com download.
- Lembretes: uma vez, toda semana ou a cada N meses com período de dias. Só o secretário cria e marca como feito; toda a escola vê.
- Mural de mensagens por escola, ao vivo; o secretário modera.
- Dashboard de frequência: indicadores, pesquisa por aluno e frequência mês a mês.
- Gestão de escolas (Master) e de assistentes (secretário).

**Termos do produto**: Master, Secretário, Assistente Administrativo, Quadro, Lembretes, Mensagens (mural), Dashboard, Equipe, Histórico, "Pedir conclusão", "Aprovar", "Devolver".

**Restrições**
- Interface em português do Brasil.
- Site estático publicado no GitHub Pages; o back-end é o Supabase. Não há servidor próprio.
- As permissões valem no banco de dados; a tela apenas as reflete.
- O sistema guarda nomes de funcionários e de alunos (menores de idade): privacidade é requisito, e dados reais não entram no repositório, que é público.
- Uma página por área (quadro, lembretes, mensagens, dashboard, gestão).

**Limites conhecidos dos dados**
- A planilha de frequência registra só os ausentes, sem a lista completa da turma: alunos que nunca faltaram não aparecem.
- A planilha online precisa estar compartilhada por link para ser lida.

**Em aberto**
- Formato aceito para os arquivos de frequência: as escolas podem organizar a planilha de formas diferentes (inclusive na horizontal, que o sistema não aceita). Falta definir a validação, a pré-visualização e um modelo oficial.
- Se o sistema deve receber a lista completa de alunos por turma.
- Conversas privadas no mural e notificações de lembretes fora do site.

## Brand Commitments

- Nome: **SECRETA**.
- Tema escuro: pedido explícito do responsável ("ainda com as cores escuras").
- Navegação por barra lateral, inspirada em CRMs, com as áreas do sistema.
- Voz: direta e em linguagem do dia a dia da secretaria, sem termos técnicos.

## Evidence on Hand

- Documentação do projeto: `README.md`, `docs/v2-supabase.md` (papéis, regras e fases), `docs/test-plan.md` (roteiro manual por perfil), `docs/security.md`, `docs/ux-guidelines.md`.
- Regras de acesso em `supabase/migrations/`.
- Não há depoimentos, números de uso, estudos de caso nem logotipo. Nada disso deve ser inventado. Os resultados dos testes de campo ainda não existem.
- O repositório não contém dados reais de alunos ou funcionários; exemplos e testes usam nomes fictícios.

## Product Principles

1. **O secretário decide; o sistema registra.** Aprovação, responsáveis e prazos são do secretário, e cada decisão deixa rastro.
2. **Claro para quem tem dificuldade.** Cada tela precisa ser entendida por quem usa pouco o computador: textos simples, uma ação principal evidente, erros que dizem o que fazer.
3. **Nada some sem aviso.** Ações que apagam pedem confirmação; o que foi concluído fica no histórico.
4. **Cada escola no seu espaço.** Dados de uma escola nunca aparecem para outra.
5. **Serve no balcão e no bolso.** Funciona bem no computador da secretaria e no celular.

## Accessibility & Inclusion

- Equipe com familiaridade mista com tecnologia: priorizar clareza, rótulos explícitos e mensagens que orientem o próximo passo.
- Requisitos já adotados no projeto: uso completo por teclado, foco visível, rótulos e `aria-*`, estados com ícone e texto (nunca só cor), respeito a movimento reduzido e layout utilizável a partir de 360 px de largura.
