# Diretrizes de UX/UI

## Princípios
- **Interface limpa**: o quadro é o protagonista; controles aparecem onde são usados.
- **Linguagem simples**: verbos claros e consistentes ("Criar tarefa", "Salvar alterações", "Excluir"). Sentença em caixa normal, sem jargão técnico.
- **Uma ação, um nome**: o botão "Excluir" gera o aviso "Tarefa excluída".

## Visual
- Fundo azul-acinzentado claro, colunas translúcidas, cartões brancos; azul vibrante só para ação principal e foco.
- Tipografia: Schibsted Grotesk (fallback: fontes do sistema); títulos de cartão em semibold, descrições em tom suave.
- Raios e sombras discretos; sombra maior apenas no cartão em arraste.

## Cores por prioridade
Cada prioridade tem faixa lateral no cartão e selo com **texto** (a cor nunca é o único sinal):
| Prioridade | Cor |
|---|---|
| Baixa | verde |
| Média | âmbar |
| Alta | laranja |
| Urgente | vermelho |
Tarefas atrasadas mostram "Atrasada:" em vermelho com a data.

## Feedback visual
Toast para criar/salvar/mover/excluir; coluna alvo ganha destaque no arraste; cartão original fica translúcido e o `DragOverlay` acompanha o cursor; botões desabilitados ficam esmaecidos; erros aparecem junto ao campo.

## Estados vazios úteis
Cada coluna explica seu propósito e oferece "Adicionar tarefa". Com filtros sem resultado: "Nada por aqui com esses filtros" + "Limpar filtros" na barra.

## Exclusão
Sempre com confirmação (foco inicial em "Cancelar") e "Desfazer" no toast por 7 segundos.

## Criar/editar
Modal centralizado no desktop e gaveta inferior no celular. Foco inicial no título; Enter envia; Esc fecha; foco volta ao elemento de origem.

## Mobile-first
Colunas em rolagem horizontal com encaixe; botões ≥ 36–40 px; arrastar por toque segurando ~0,2 s na alça; sem hover como único caminho.

## Teclado
Tab percorre a interface; alça de arraste: espaço/Enter pega, setas movem, espaço solta, Esc cancela; Esc fecha modais. Anúncios em português para leitores de tela.

## Acessibilidade visual
Contraste mínimo 4,5:1 em texto; foco visível em todos os controles; movimento reduzido respeitado.

## Papéis tipográficos
Uma família só (Schibsted Grotesk, variável). Cada papel tem uma classe em `src/index.css`; não repita a sequência de utilitários nos componentes.

| Papel | Classe | Uso |
|---|---|---|
| Título da página | `page-title` | o único `h1` de cada página |
| Frase de apoio | `page-lede` | logo abaixo do título; até ~65 caracteres por linha |
| Título de painel/janela | `panel-title` | `h2` de destaque, título de modal |
| Título de seção | `section-title` | `h2`/`h3` de blocos |
| Título de cartão/coluna | `card-title` | cartões de tarefa, colunas e blocos pequenos (mesmo tamanho do corpo, separado pelo peso) |
| Corpo de interface | `text-sm` | textos e campos (16px nos campos em telas estreitas, para o iPhone não dar zoom) |
| Legenda | `caption` | dicas, legendas e metadados em parágrafo (limite de ~75 caracteres por linha) |
| Mínimo | `text-2xs` (11px) | selos, contadores e rótulos da barra; nada menor que isso |

Regras: números em tabelas, contadores e horários usam `tabular-nums`; títulos quebram de forma equilibrada (`text-wrap: balance`); mensagens ao usuário usam aspas tipográficas (“ ”) e reticências (…).
Texto de leitura contínua (mensagens do mural) usa `text-base`. Cursor de texto, caixas de seleção, barras de rolagem e sublinhados seguem a paleta (definidos em `src/index.css`).

## Movimento
O movimento existe para dar retorno ou explicar uma mudança de estado. Nada anima ao carregar a página, e nada fica em laço infinito. As animações são utilitários do Tailwind definidos em `tailwind.config.js`.

| Situação | Classe | Duração |
|---|---|---|
| Fundo de janela aparece | `animate-overlay-in` | 200 ms |
| Janela: gaveta no celular, do centro no computador | `animate-sheet-in` / `sm:animate-dialog-in` | 360 / 320 ms |
| Aviso (toast) entra | `animate-toast-in` | 260 ms |
| Item novo em lista (cartão, mensagem, resumo do aluno) | `animate-enter` | 280 ms |
| **Cartão que chegou a uma coluna** (contorno que se apaga) | `animate-arrive` | 1100 ms |
| Contador da barra aumentou | `animate-pop` | 320 ms |
| Barra de frequência cresce até o valor | `animate-bar` | 640 ms |
| Selo "Aguardando aprovação" chama atenção (3 vezes) | `animate-attention` | 900 ms × 3 |

- **O cartão pousa**: é o movimento próprio do produto. `utils/arrivals.ts` decide o que anima: nada na primeira carga; depois, só tarefas novas ou que mudaram de coluna (inclusive por outra pessoa, ao vivo). Reordenar ou limpar um filtro não anima.
- **Curva**: chegada que desacelera no fim (`cubic-bezier(0.16, 1, 0.3, 1)`); sem quique. Saídas são imediatas.
- **Custo**: só opacidade, transformação e uma sombra em elementos pequenos; sem biblioteca de animação.
- **Menos movimento** (`prefers-reduced-motion`): o que deslizava apenas aparece; contador, barras e selo ficam parados; o contorno do cartão e as trocas de cor permanecem, porque informam o que mudou.

## Navegação contínua
Cada área é uma página separada, mas a troca deve parecer uma tela só.

- **Transição entre páginas** (`@view-transition` em `src/index.css`): o conteúdo (`.page-view`) se funde, e o destaque da barra (`.nav-pill`) desliza do item antigo ao novo, por baixo dos rótulos (`.nav-items`). Navegador sem suporte troca de página como sempre.
- **Primeiro quadro pronto**: as entradas usam `flushSync` e o build marca o script como `blocking="render"` (plugin em `vite.config.ts`), para a transição ter a tela nova para animar.
- **Moldura sem espera**: o perfil da última sessão fica em `localStorage` (`secreta:perfil`) e desenha a barra na hora; é validado ao ler, conferido de novo no servidor a cada página e apagado ao sair. Não concede permissão nenhuma.
- **Pré-carregamento** (`speculationrules` nos `.html`, Chrome/Edge): a página do item sob o mouse é preparada em segundo plano; o Dashboard só no clique, porque busca a planilha inteira. Efeitos que registram algo "visto" esperam a página aparecer (`utils/pageLifecycle.ts`).
- **Esqueletos** (`ui/Skeleton.tsx`): enquanto os dados chegam, blocos no lugar do conteúdo, nunca uma mensagem de lista vazia.

## Cor como informação
- **Título de página**: cor sólida. A ênfase vem do tamanho e do peso, não de degradê.
- **Prioridade da tarefa**: uma faixa na base do cartão, na cor da prioridade (verde, amarelo, laranja, vermelho), e o selo traz o nome. Definido em `PRIORITY_STYLES` (`constants/board.ts`).
- **Editar é verde, excluir é vermelho** em todos os cartões (`EDIT_BUTTON` e `DELETE_BUTTON` em `ui/Button.tsx`); o rótulo acessível continua dizendo a ação.
- **Situação do lembrete**: mesmo princípio; só o que pede ação (no prazo, atrasado) ganha contorno forte.
- **Avisos**: o tipo aparece por ícone e cor (certo, alerta, informação).
- Não usar faixa colorida grossa em um lado do cartão, nem cor como único sinal de um estado.

## Menu lateral
- **Computador**: dois modos, estendido (240 px: logo, foto com sobrenome e cargo, itens com ícone e rótulo, "Retrair menu" e "Sair" no rodapé) e retraído (72 px: só ícones, com dica ao passar o mouse). A escolha fica em `localStorage` (`secreta:menu`, em `utils/navPreference.ts`) e é lida no primeiro desenho, para o menu não trocar de modo ao abrir a página.
- **Fluidez**: os ícones ocupam sempre a mesma casa de 40 px, na mesma posição. Ao retrair, só a largura diminui e os rótulos somem; nada muda de lugar.
- **Perfil**: a foto no topo leva à página de perfil. No celular, o perfil é um item da barra.
- **Celular**: barra inferior com ícone sobre o rótulo; não há modo retraído.
- Retraído, cada item mantém o nome para leitores de tela.