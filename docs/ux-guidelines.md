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
