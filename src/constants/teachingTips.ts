import type { AssessmentSubject, Descriptor } from "../types/assessment";

/*
 * Sugestões de intervenção por tipo de habilidade, para a devolutiva ao professor. A habilidade é
 * reconhecida por palavras do texto do descritor (vale para Saeb, SADEAM, CNCA e os da escola).
 * São pontos de partida: o professor adapta à turma e ao material que tem.
 */

export interface TeachingTip {
  /** Nome curto do foco (ex.: "Inferência"). */
  focus: string;
  /** O que fazer em sala, em frases curtas. */
  actions: string[];
}

interface Rule {
  subject: AssessmentSubject | "both";
  /** Trechos procurados no texto do descritor (sem acento, minúsculo). */
  match: string[];
  tip: TeachingTip;
}

const RULES: Rule[] = [
  // ── Alfabetização (CNCA e anos iniciais) ──
  {
    subject: "lp",
    match: ["letras do alfabeto", "direcoes da escrita", "segmentacao", "ordem alfabetica"],
    tip: {
      focus: "Sistema de escrita",
      actions: [
        "Rotina diária com alfabeto móvel e nomes da turma.",
        "Escrita e leitura de listas, apontando o sentido da escrita e o espaço entre as palavras.",
      ],
    },
  },
  {
    subject: "lp",
    match: ["rimas", "silabas", "elementos sonoros"],
    tip: {
      focus: "Consciência fonológica",
      actions: [
        "Jogos orais de rima, sílaba inicial e final (parlendas, cantigas, bingo de sílabas).",
        "Comparar palavras que começam ou terminam igual, primeiro oralmente e depois por escrito.",
      ],
    },
  },
  {
    subject: "lp",
    match: ["ler palavras", "ler frases", "silabas canonicas", "nao canonicas"],
    tip: {
      focus: "Decodificação e fluência",
      actions: [
        "Leitura diária em voz alta de palavras e frases curtas, do simples (CV) ao complexo (CCV, CVC).",
        "Leitura compartilhada com o dedo acompanhando o texto; registrar o avanço de cada aluno.",
      ],
    },
  },
  // ── Leitura (anos iniciais e finais) ──
  {
    subject: "lp",
    match: ["localizar informac"],
    tip: {
      focus: "Localização de informação explícita",
      actions: [
        "Perguntas do tipo \"onde está escrito?\": o aluno grifa no texto a resposta antes de marcar.",
        "Mostrar que o enunciado costuma dizer com outras palavras (paráfrase) o que está no texto.",
        "Começar com textos curtos e aumentar a extensão aos poucos.",
      ],
    },
  },
  {
    subject: "lp",
    match: ["sentido de uma palavra", "sentido de palavra", "sentido de metaforas", "expressao idiomatica", "palavras ou expressoes"],
    tip: {
      focus: "Vocabulário em contexto",
      actions: [
        "Antes do dicionário, pedir que o aluno troque a palavra por outra que faça sentido na frase.",
        "Destacar as pistas ao redor da palavra (sinônimos, exemplos, oposições).",
        "Manter um glossário coletivo das palavras novas de cada texto.",
      ],
    },
  },
  {
    subject: "lp",
    match: ["inferir uma informac", "informacao implicita", "inferir informac", "sentido global", "inferir o assunto"],
    tip: {
      focus: "Inferência",
      actions: [
        "Depois de cada resposta, perguntar \"como você descobriu?\" e apontar as pistas no texto.",
        "Trabalhar com tirinhas, charges e anúncios, que dizem mais do que está escrito.",
        "Separar o que o texto diz do que dá para concluir a partir dele.",
      ],
    },
  },
  {
    subject: "lp",
    match: ["tema de um texto", "assunto de", "partes principais", "ideia principal"],
    tip: {
      focus: "Tema e ideia principal",
      actions: [
        "Pedir que o aluno resuma o texto em uma frase e compare com o título.",
        "Identificar a ideia que se repete ao longo dos parágrafos.",
        "Diferenciar o que é central do que é detalhe ou exemplo.",
      ],
    },
  },
  {
    subject: "lp",
    match: ["fato da opiniao", "fato e opiniao"],
    tip: {
      focus: "Fato e opinião",
      actions: [
        "Classificar frases de notícias e artigos em fato (verificável) ou opinião (juízo de valor).",
        "Destacar as marcas de opinião: adjetivos avaliativos, \"acredito\", \"é preciso\", advérbios.",
      ],
    },
  },
  {
    subject: "lp",
    match: ["material grafico", "linguagem verbal e nao verbal", "grafico-visuais", "conjugam linguagem"],
    tip: {
      focus: "Leitura de textos multimodais",
      actions: [
        "Ler imagem e texto juntos: o que a imagem acrescenta ao que está escrito?",
        "Trabalhar com quadrinhos, propagandas, infográficos e capas de revista.",
      ],
    },
  },
  {
    subject: "lp",
    match: ["finalidade", "genero de", "generos"],
    tip: {
      focus: "Gêneros e finalidade dos textos",
      actions: [
        "Comparar gêneros diferentes sobre o mesmo assunto: quem escreve, para quem e para quê.",
        "Observar o suporte e a organização (lista, instrução, notícia, anúncio) como pistas da finalidade.",
      ],
    },
  },
  {
    subject: "lp",
    match: ["tese", "argumento"],
    tip: {
      focus: "Argumentação",
      actions: [
        "Ler artigos de opinião e montar um quadro: tese de um lado, argumentos do outro.",
        "Pedir que o aluno defenda e conteste uma posição sobre um tema da escola.",
      ],
    },
  },
  {
    subject: "lp",
    match: ["comparacao de textos", "posicoes distintas", "mesmo tema", "mesmo fato"],
    tip: {
      focus: "Comparação entre textos",
      actions: [
        "Ler duas notícias ou opiniões sobre o mesmo fato e listar o que muda entre elas.",
        "Discutir por que o autor, o veículo e o público mudam o jeito de contar.",
      ],
    },
  },
  {
    subject: "lp",
    match: ["conflito gerador", "narrativa", "narrador", "personagem", "tempo e o lugar"],
    tip: {
      focus: "Elementos da narrativa",
      actions: [
        "Montar o esquema do conto: situação inicial, conflito, clímax e desfecho.",
        "Identificar narrador, personagens, tempo e lugar em contos curtos e crônicas.",
      ],
    },
  },
  {
    subject: "lp",
    match: ["causa/consequencia", "causa e consequencia", "causalidade"],
    tip: {
      focus: "Relações de causa e consequência",
      actions: [
        "Usar organizadores gráficos (\"porque… então…\") a partir de trechos do texto.",
        "Destacar conectivos de causa e de consequência e o que acontece quando são trocados.",
      ],
    },
  },
  {
    subject: "lp",
    match: ["logico-discursivas", "conjuncoes", "adverbios"],
    tip: {
      focus: "Conectivos e relações lógicas",
      actions: [
        "Trocar o conectivo de uma frase (mas, porque, portanto, embora) e discutir como o sentido muda.",
        "Completar textos lacunados com o conectivo adequado.",
      ],
    },
  },
  {
    subject: "lp",
    match: ["repeticoes ou substituicoes", "referente", "pronomes"],
    tip: {
      focus: "Coesão referencial",
      actions: [
        "Ligar com setas cada pronome ou sinônimo ao termo que ele retoma no texto.",
        "Reescrever trechos repetitivos usando pronomes e sinônimos.",
      ],
    },
  },
  {
    subject: "lp",
    match: ["ironia", "humor", "critica"],
    tip: {
      focus: "Humor e ironia",
      actions: [
        "Em tirinhas e piadas, pedir que o aluno explique o que provoca o riso (a quebra de expectativa).",
        "Comparar o que é dito com o que se quer dizer em textos irônicos.",
      ],
    },
  },
  {
    subject: "lp",
    match: ["pontuacao", "exclamacao", "aspas", "reticencias"],
    tip: {
      focus: "Pontuação e efeitos de sentido",
      actions: [
        "Ler a mesma frase em voz alta com pontuações diferentes e comparar o sentido.",
        "Observar aspas, reticências e exclamações em diálogos e manchetes.",
      ],
    },
  },
  {
    subject: "lp",
    match: ["recursos ortograficos", "morfossintatic", "escolha de uma determinada palavra", "diagramacao"],
    tip: {
      focus: "Escolhas linguísticas e efeitos de sentido",
      actions: [
        "Comparar versões de um trecho com palavras ou grafias diferentes e discutir o efeito.",
        "Explorar poemas, anúncios e títulos em que a forma da palavra cria o sentido.",
      ],
    },
  },
  {
    subject: "lp",
    match: ["locutor", "interlocutor", "variacao"],
    tip: {
      focus: "Variação linguística",
      actions: [
        "Comparar falas de personagens e registros (formal, informal, regional) sem tratá-los como erro.",
        "Identificar no texto as marcas de quem fala e para quem fala.",
      ],
    },
  },
  // ── Matemática ──
  {
    subject: "mt",
    match: ["porcentagem"],
    tip: {
      focus: "Porcentagem",
      actions: [
        "Relacionar 50%, 25% e 10% com metade, um quarto e um décimo, com cálculo mental.",
        "Problemas de desconto, acréscimo e tabelas de preços do dia a dia.",
      ],
    },
  },
  {
    subject: "mt",
    match: ["proporciona"],
    tip: {
      focus: "Proporcionalidade",
      actions: [
        "Tabelas de razão (receitas, mapas, velocidade) antes da regra de três.",
        "Discutir quando as grandezas variam no mesmo sentido e quando variam em sentidos opostos.",
      ],
    },
  },
  {
    subject: "mt",
    match: ["fracao", "fracoes", "racional", "racionais", "decimais"],
    tip: {
      focus: "Frações e números racionais",
      actions: [
        "Material concreto e desenhos (barras, pizzas) antes do algoritmo.",
        "Localizar frações e decimais na reta numérica e comparar representações (½ = 0,5 = 50%).",
        "Frações equivalentes por dobradura e por multiplicação do numerador e do denominador.",
      ],
    },
  },
  {
    subject: "mt",
    match: ["numeros inteiros", "reta numerica"],
    tip: {
      focus: "Números inteiros e reta numérica",
      actions: [
        "Usar situações com negativos (temperatura, saldo bancário, altitude).",
        "Reta numérica na parede para operar e comparar inteiros.",
      ],
    },
  },
  {
    subject: "mt",
    match: ["expressao algebrica", "equacao", "inequacao", "sistema de equacoes", "regularidade", "2o grau", "2º grau"],
    tip: {
      focus: "Álgebra e linguagem algébrica",
      actions: [
        "Traduzir frases para a linguagem matemática e vice-versa (\"o dobro de um número mais três\").",
        "Partir de sequências e padrões para chegar à expressão; usar balança para equações.",
      ],
    },
  },
  {
    subject: "mt",
    match: ["perimetro", "area de figuras", "volume", "malhas quadriculadas"],
    tip: {
      focus: "Perímetro, área e volume",
      actions: [
        "Medir objetos e espaços da escola; usar malha quadriculada para contar e comparar.",
        "Diferenciar perímetro (contorno) de área (superfície) com o mesmo desenho.",
      ],
    },
  },
  {
    subject: "mt",
    match: ["unidades de medida", "unidade de medida", "horario", "moedas", "cedulas", "comprimento", "capacidade ou massa"],
    tip: {
      focus: "Grandezas e medidas",
      actions: [
        "Atividades práticas com régua, balança, recipientes, relógio e dinheiro de brinquedo.",
        "Conversões a partir de situações reais (receitas, viagens, compras).",
      ],
    },
  },
  {
    subject: "mt",
    match: ["tabelas", "graficos"],
    tip: {
      focus: "Leitura de tabelas e gráficos",
      actions: [
        "Montar tabelas e gráficos com dados da própria turma e interpretá-los juntos.",
        "Ler título, eixos e legenda antes de responder; comparar o mesmo dado em tabela e em gráfico.",
      ],
    },
  },
  {
    subject: "mt",
    match: ["coordenadas", "localizacao", "movimentacao", "mapas", "croquis", "ponto de referencia"],
    tip: {
      focus: "Localização e coordenadas",
      actions: [
        "Batalha naval, mapas da escola e do bairro com caminhos descritos pelos alunos.",
        "Plano cartesiano no chão da quadra para marcar e ler pontos.",
      ],
    },
  },
  {
    subject: "mt",
    match: ["angulo", "triangulo", "quadrilatero", "poligono", "figura geometrica", "figuras geometricas", "bidimensionais", "planificac", "circunferencia", "circulo", "homotetica"],
    tip: {
      focus: "Geometria",
      actions: [
        "Manipular sólidos e planificações; classificar figuras por lados e ângulos.",
        "Dobraduras, geoplano e softwares de geometria para observar propriedades.",
      ],
    },
  },
  {
    subject: "mt",
    match: ["sistema de numeracao", "valor posicional", "agrupamentos"],
    tip: {
      focus: "Sistema de numeração decimal",
      actions: [
        "Material dourado e quadro valor-lugar para agrupar e trocar na base 10.",
        "Compor e decompor números (345 = 300 + 40 + 5).",
      ],
    },
  },
  {
    subject: "mt",
    match: ["sequencia", "termos ausentes", "classificar objetos"],
    tip: {
      focus: "Padrões e regularidades",
      actions: [
        "Criar e completar sequências de figuras e números, explicando a regra.",
        "Classificar coleções por critérios diferentes (cor, forma, tamanho).",
      ],
    },
  },
  {
    subject: "mt",
    match: ["resolver problema", "operacao", "operacoes", "calculos", "contar", "comparar"],
    tip: {
      focus: "Resolução de problemas e operações",
      actions: [
        "Ler o problema em etapas: o que se pede, quais dados servem, qual operação, o resultado faz sentido?",
        "Variar o significado das operações (juntar, tirar, comparar, repartir, combinar).",
        "Cálculo mental diário e verificação da resposta pela operação inversa.",
      ],
    },
  },
];

const GENERIC: Record<AssessmentSubject, TeachingTip> = {
  lp: {
    focus: "Leitura e compreensão",
    actions: [
      "Retomar a habilidade com textos curtos, leitura compartilhada e perguntas guiadas.",
      "Pedir que o aluno justifique cada resposta com um trecho do texto.",
    ],
  },
  mt: {
    focus: "Retomada do conteúdo",
    actions: [
      "Retomar o conteúdo com material concreto e problemas do cotidiano.",
      "Pedir que o aluno explique o raciocínio, oralmente ou por escrito.",
    ],
  },
};

const normalize = (text: string): string => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Sugestão de intervenção para o descritor (a regra mais específica primeiro). */
export function teachingTip(descriptor: Pick<Descriptor, "subject" | "text" | "topic">): TeachingTip {
  const text = normalize(`${descriptor.text} ${descriptor.topic}`);
  const rule = RULES.find(
    (r) => (r.subject === "both" || r.subject === descriptor.subject) && r.match.some((m) => text.includes(normalize(m))),
  );
  return rule?.tip ?? GENERIC[descriptor.subject];
}
