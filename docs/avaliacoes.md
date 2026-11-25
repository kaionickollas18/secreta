# Avaliações: correção automática por cartão-resposta e análise por descritores

Página `avaliacoes.html`. A secretaria cria a avaliação de uma turma (só **Língua Portuguesa** ou
**Matemática**), define o gabarito com os descritores de cada questão, imprime os cartões-resposta,
corrige pela câmera do celular ou por PDF escaneado e acompanha o resultado da turma.

## Fluxo

```
Gabarito ──► Cartões ──► Correção ──────────────────────────► Resultados
(questões,   (A4, 2 por   câmera / foto / PDF                  média, questões mais erradas,
 descritores, folha, com   └─► leitor óptico (OMR) ─► revisão   descritores, alunos críticos,
 alunos)      código)          └─► conferência manual ──┘        comparativo com avaliações anteriores
```

## Camadas (mesmo padrão do resto do SECRETA)

| Camada | Arquivos | O que faz |
|---|---|---|
| Domínio (puro) | `types/assessment.ts`, `constants/descriptors.ts`, `utils/assessments.ts` | Modelo, catálogo de descritores (Saeb 9º, CNCA 1º), validação, correção de um cartão |
| Análise (puro) | `utils/assessmentAnalytics.ts` | Resumo da turma, ranking de questões, agregação por descritor, alunos críticos, histórico |
| Leitura óptica (puro) | `utils/omr/cardLayout.ts`, `cardCode.ts`, `homography.ts`, `omrReader.ts` | Geometria única do cartão (a impressão e a leitura usam a mesma), código do cartão, perspectiva, leitura das bolhas |
| Captura (navegador) | `utils/omr/imageSource.ts` | Foto/arquivo/quadro da câmera → imagem em tons de cinza; PDF → uma imagem por cartão (pdf.js) |
| Dados | `store/assessmentApi.ts`, `utils/assessmentRows.ts` | Leitura e gravação no Supabase (`assessments`, `answer_sheets`), com validação das linhas |
| Estado | `store/assessmentStore.ts` | Zustand: avaliações e cartões corrigidos |
| UI | `components/assessments/*`, `avaliacoes/*` | Telas |

## Modelo de dados

```ts
Assessment {
  id, code (1–511, impresso no cartão), title, date (YYYY-MM-DD),
  className, classroomId | null,        // turma do cadastro (Notas) ou digitada
  grade (1–9), subject ("lp" | "mt"), matrix ("saeb9" | "cnca1" | "custom"),
  alternatives (4 | 5), criticalThreshold (0–1, padrão 0,5),
  questions: { number, key: "A"…"E" | null (anulada), descriptorCodes: string[] }[],
  roster: { slot (1–127, impresso no cartão), studentId | null, name, rollNumber | null }[],
  customDescriptors: Descriptor[], createdAt, updatedAt
}
Descriptor { code, matrix, subject, topic, text, bncc? }
AnswerSheet {                           // um cartão corrigido = um aluno numa avaliação
  id, assessmentId, slot, studentId | null, studentName,
  answers: ("A"…"E" | null)[],           // marcação final (depois da revisão)
  flags: ("ok" | "blank" | "multiple" | "uncertain")[], // o que o leitor viu em cada questão
  source ("camera" | "image" | "pdf" | "manual"), edited (houve ajuste manual), scannedAt
}
```

Métricas são **sempre calculadas** a partir de `Assessment` + `AnswerSheet[]` (nada de número
guardado que possa ficar desatualizado): `scoreSheet`, `classSummary`, `questionStats`,
`descriptorStats`, `criticalStudents`, `classHistory`.

Regras:
- Questão anulada (`key: null`) não conta na nota nem nas análises.
- Em branco ou com dupla marcação conta como erro (e aparece separada como "em branco").
- Aluno crítico: percentual de acerto abaixo do limiar da avaliação (padrão 50%). Os "descritores
  não consolidados" dele são os que ele acertou em menos de 50%, os com mais erros primeiro.
- Nível do descritor na turma: < 50% de acerto = crítico, 50–69% = em desenvolvimento,
  ≥ 70% = consolidado.

## Cartão-resposta e leitura óptica

O cartão (A5 deitado, 210 × 148 mm, dois por folha A4 em pé) tem:
- **4 quadrados pretos nos cantos**: o leitor os acha na imagem e calcula a perspectiva
  (homografia), então a foto pode estar inclinada, de lado ou de cabeça para baixo.
- **Faixa de código** (20 quadradinhos no alto): 3 de guarda + código da avaliação (9 bits) +
  número do aluno na avaliação (7 bits) + paridade. Identifica avaliação e aluno sem digitar nada.
  O cartão "em branco" sai com aluno 0, e o aluno é escolhido na revisão.
- **Bolhas** A–D ou A–E, até 45 questões, em colunas de 15.

A posição de tudo sai de `cardLayout()`: a impressão desenha e o leitor mede nos mesmos milímetros.

Leitura (`readAnswerCard`): limiar adaptativo → componentes conectados → os 4 quadrados extremos →
homografia → testa as 4 orientações até a faixa de código bater (guarda + paridade) → mede o
escurecimento de cada bolha contra a mediana do cartão (as bolhas vazias). Por questão:
`ok` (uma marcada), `blank`, `multiple` ou `uncertain` (marca fraca). Tudo que não é `ok`
fica destacado para conferência manual antes de salvar.

PDF: cada página é desenhada com pdf.js; página em pé é cortada em duas metades (dois cartões).
Tudo roda no navegador: nenhuma imagem sai do aparelho.

**Onde plugar outro leitor**: `readAnswerCard(image, assessments)` recebe uma `GrayImage` e devolve
`CardReading`. Um OCR/OMR externo (ou uma Edge Function) só precisa devolver o mesmo `CardReading`.

## Descritores

- **Saeb 9º ano** (`saeb9`): Matriz de Referência de Língua Portuguesa (D1–D21, 6 tópicos) e de
  Matemática (D1–D37, 4 temas) do Inep. Até a publicação deste módulo o Inep não divulgou matriz
  nova para o Saeb 2027; se divulgar, atualize `constants/descriptors.ts`.
- **CNCA 1º ano** (`cnca1`): Matrizes de Referência da Avaliação Contínua da Aprendizagem do
  Compromisso Nacional Criança Alfabetizada (SEB/MEC + CAEd/UFJF, 2026): Leitura 1EF01_P–1EF15_P e
  Matemática 1EF01_M–1EF13_M, com a habilidade da BNCC e os ciclos de cada uma.
- **SADEAM 8º ano** (`sadeam8`, sugerida para turmas de 8º ano): Sistema de Avaliação de Desempenho
  Educacional do Amazonas (Seduc/AM + CAEd/UFJF). A matriz da prova do 8º ano de 2026 não foi
  publicada; usamos a edição mais recente do SADEAM para os anos finais com LP e MT juntas, a de 2019
  (LP D01–D21, 17 descritores; MT D01–D59, 30 descritores), com a numeração própria do SADEAM
  (diferente da do Saeb). Fonte: portal avaliacaoemonitoramentoamazonas.caeddigital.net, pacote
  "Matrizes das avaliações anteriores". Precisa da migration `0024_assessments_sadeam.sql`.
- **Personalizado**: a escola cadastra código + descrição na própria avaliação (outros anos).

## Devolutiva pedagógica e planilhas

Aba **Devolutiva**: o resultado escrito como um pedagogo entregaria ao professor regente
(`utils/pedagogicalReport.ts`, funções puras, tudo calculado dos cartões):

1. **Leitura geral**: média, mediana, quantos corrigidos e faltantes, nível da turma (abaixo de 50%,
   intermediário ou consolidado), comparação com a avaliação anterior da turma e alerta de muitas
   questões em branco.
2. **O que retomar primeiro**: até 5 descritores abaixo de 70% de acerto, do mais errado para o
   menos; para cada um, onde a turma errou (distrator marcado por 25% ou mais), como trabalhar e com
   quais alunos (os que acertaram menos da metade das questões daquele descritor).
3. **Alunos**: atenção imediata (abaixo do limiar, com os descritores a reforçar), em
   desenvolvimento e possíveis monitores (70% ou mais).
4. **Questões para corrigir com a turma** (50% ou mais de erro), **o que a turma já domina** e
   **encaminhamentos** (retomada, grupos por descritor, atendimento individual, monitores,
   reaplicação, quem faltou).

As sugestões de "como trabalhar" vêm de `constants/teachingTips.ts`: a habilidade é reconhecida por
palavras do texto do descritor, então valem para todas as matrizes (um teste garante que nenhum
descritor do catálogo fica com a sugestão genérica). Sai impressa em A4 em pé, com espaço para as
assinaturas da coordenação e do professor.

Planilhas CSV (`utils/assessmentExport.ts`, padrão do Excel em português: `;`, vírgula decimal,
UTF-8 com BOM, texto que começa com `= + - @` não vira fórmula): **por aluno** (nota, situação,
descritores não consolidados, resposta e acerto de cada questão), **por descritor**, **por questão**
(quantos marcaram cada alternativa) e **dados completos** (uma linha por resposta e descritor, para
tabela dinâmica e para juntar várias avaliações).

## Persistência (Supabase)

Migration `supabase/migrations/0023_assessments.sql`:
- `assessments`: uma linha por avaliação; gabarito (`questions`), alunos (`roster`) e descritores
  próprios (`custom_descriptors`) em jsonb, sempre lidos e gravados juntos e validados no cliente
  (`utils/assessmentRows.ts` + `isAssessment`). `code` é único por escola.
- `answer_sheets`: um cartão por aluno por avaliação (`unique (assessment_id, slot)`); salvar de novo
  substitui (upsert). Cartões saem junto com a avaliação (`on delete cascade`).
- RLS igual à das notas: só a secretaria da própria escola lê e grava; excluir avaliação é só do
  secretário (a tela esconde o botão pelo `canDeleteAssessments`). Triggers conferem que cartão,
  avaliação e aluno são da mesma escola e gravam autoria e datas pelo servidor.

O Gabarito grava enquanto a pessoa edita, mas sem uma gravação por tecla: a tela muda na hora e o
banco recebe a última versão 600 ms depois da última mudança (`saveDraft`). O pendente é enviado na
hora ao trocar de aba, ao salvar um cartão e ao sair da página (`flushDraft`). O título mostra
"Salvando…/Salvo/Não salvo".

## Limites conhecidos

- Foto com pouca luz, sombra forte sobre as bolhas ou cartão amassado vira `uncertain`: a revisão
  manual resolve. Marcas com lápis muito claro também.
- A câmera exige HTTPS (o GitHub Pages já é) e permissão do navegador.
- Página só para a equipe da secretaria (como Notas), porque usa o cadastro de alunos.
