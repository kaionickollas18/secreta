import type { AssessmentSubject, Descriptor, DescriptorMatrix } from "../types/assessment";

/*
 * Catálogo de descritores das matrizes usadas pela escola.
 *
 * Saeb 9º ano: Matriz de Referência de Língua Portuguesa e de Matemática do Saeb (Inep),
 * 9º ano do Ensino Fundamental. Até nov/2026 o Inep não publicou matriz nova para o Saeb 2027;
 * se publicar, atualize as listas abaixo.
 *
 * CNCA 1º ano: Matrizes de Referência da Avaliação Contínua da Aprendizagem do Compromisso
 * Nacional Criança Alfabetizada (SEB/MEC e CAEd/UFJF, 2026), 1º ano do Ensino Fundamental.
 * Língua Portuguesa – Leitura e Matemática, com a habilidade da BNCC de cada descritor.
 */

type Row = [code: string, topic: string, text: string, bncc?: string];

const build = (matrix: DescriptorMatrix, subject: AssessmentSubject, rows: Row[]): Descriptor[] =>
  rows.map(([code, topic, text, bncc]) => ({ code, matrix, subject, topic, text, ...(bncc ? { bncc } : {}) }));

const LP_I = "I. Procedimentos de leitura";
const LP_II = "II. Implicações do suporte, do gênero e/ou do enunciador na compreensão do texto";
const LP_III = "III. Relação entre textos";
const LP_IV = "IV. Coerência e coesão no processamento do texto";
const LP_V = "V. Relações entre recursos expressivos e efeitos de sentido";
const LP_VI = "VI. Variação linguística";

const SAEB9_LP = build("saeb9", "lp", [
  ["D1", LP_I, "Localizar informações explícitas em um texto."],
  ["D2", LP_IV, "Estabelecer relações entre partes de um texto, identificando repetições ou substituições que contribuem para a continuidade de um texto."],
  ["D3", LP_I, "Inferir o sentido de uma palavra ou expressão."],
  ["D4", LP_I, "Inferir uma informação implícita em um texto."],
  ["D5", LP_II, "Interpretar texto com auxílio de material gráfico diverso (propagandas, quadrinhos, foto etc.)."],
  ["D6", LP_I, "Identificar o tema de um texto."],
  ["D7", LP_IV, "Identificar a tese de um texto."],
  ["D8", LP_IV, "Estabelecer relação entre a tese e os argumentos oferecidos para sustentá-la."],
  ["D9", LP_IV, "Diferenciar as partes principais das secundárias em um texto."],
  ["D10", LP_IV, "Identificar o conflito gerador do enredo e os elementos que constroem a narrativa."],
  ["D11", LP_IV, "Estabelecer relação causa/consequência entre partes e elementos do texto."],
  ["D12", LP_II, "Identificar a finalidade de textos de diferentes gêneros."],
  ["D13", LP_VI, "Identificar as marcas linguísticas que evidenciam o locutor e o interlocutor de um texto."],
  ["D14", LP_I, "Distinguir um fato da opinião relativa a esse fato."],
  ["D15", LP_IV, "Estabelecer relações lógico-discursivas presentes no texto, marcadas por conjunções, advérbios etc."],
  ["D16", LP_V, "Identificar efeitos de ironia ou humor em textos variados."],
  ["D17", LP_V, "Reconhecer o efeito de sentido decorrente do uso da pontuação e de outras notações."],
  ["D18", LP_V, "Reconhecer o efeito de sentido decorrente da escolha de uma determinada palavra ou expressão."],
  ["D19", LP_V, "Reconhecer o efeito de sentido decorrente da exploração de recursos ortográficos e/ou morfossintáticos."],
  ["D20", LP_III, "Reconhecer diferentes formas de tratar uma informação na comparação de textos que tratam do mesmo tema, em função das condições em que ele foi produzido e daquelas em que será recebido."],
  ["D21", LP_III, "Reconhecer posições distintas entre duas ou mais opiniões relativas ao mesmo fato ou ao mesmo tema."],
]);

const MT_I = "I. Espaço e forma";
const MT_II = "II. Grandezas e medidas";
const MT_III = "III. Números e operações / Álgebra e funções";
const MT_IV = "IV. Tratamento da informação";

const SAEB9_MT = build("saeb9", "mt", [
  ["D1", MT_I, "Identificar a localização/movimentação de objeto em mapas, croquis e outras representações gráficas."],
  ["D2", MT_I, "Identificar propriedades comuns e diferenças entre figuras bidimensionais e tridimensionais, relacionando-as com as suas planificações."],
  ["D3", MT_I, "Identificar propriedades de triângulos pela comparação de medidas de lados e ângulos."],
  ["D4", MT_I, "Identificar relação entre quadriláteros por meio de suas propriedades."],
  ["D5", MT_I, "Reconhecer a conservação ou modificação de medidas dos lados, do perímetro, da área em ampliação e/ou redução de figuras poligonais usando malhas quadriculadas."],
  ["D6", MT_I, "Reconhecer ângulos como mudança de direção ou giros, identificando ângulos retos e não-retos."],
  ["D7", MT_I, "Reconhecer que as imagens de uma figura construída por uma transformação homotética são semelhantes, identificando propriedades e/ou medidas que se modificam ou não se alteram."],
  ["D8", MT_I, "Resolver problema utilizando a propriedade dos polígonos (soma de seus ângulos internos, número de diagonais, cálculo da medida de cada ângulo interno nos polígonos regulares)."],
  ["D9", MT_I, "Interpretar informações apresentadas por meio de coordenadas cartesianas."],
  ["D10", MT_I, "Utilizar relações métricas do triângulo retângulo para resolver problemas significativos."],
  ["D11", MT_I, "Reconhecer círculo/circunferência, seus elementos e algumas de suas relações."],
  ["D12", MT_II, "Resolver problema envolvendo o cálculo de perímetro de figuras planas."],
  ["D13", MT_II, "Resolver problema envolvendo o cálculo de área de figuras planas."],
  ["D14", MT_II, "Resolver problema envolvendo noções de volume."],
  ["D15", MT_II, "Resolver problema utilizando relações entre diferentes unidades de medida."],
  ["D16", MT_III, "Identificar a localização de números inteiros na reta numérica."],
  ["D17", MT_III, "Identificar a localização de números racionais na reta numérica."],
  ["D18", MT_III, "Efetuar cálculos com números inteiros, envolvendo as operações (adição, subtração, multiplicação, divisão, potenciação)."],
  ["D19", MT_III, "Resolver problema com números naturais, envolvendo diferentes significados das operações (adição, subtração, multiplicação, divisão, potenciação)."],
  ["D20", MT_III, "Resolver problema com números inteiros envolvendo as operações (adição, subtração, multiplicação, divisão, potenciação)."],
  ["D21", MT_III, "Reconhecer as diferentes representações de um número racional."],
  ["D22", MT_III, "Identificar fração como representação que pode estar associada a diferentes significados."],
  ["D23", MT_III, "Identificar frações equivalentes."],
  ["D24", MT_III, "Reconhecer as representações decimais dos números racionais como uma extensão do sistema de numeração decimal, identificando a existência de \"ordens\" como décimos, centésimos e milésimos."],
  ["D25", MT_III, "Efetuar cálculos que envolvam operações com números racionais (adição, subtração, multiplicação, divisão, potenciação)."],
  ["D26", MT_III, "Resolver problema com números racionais envolvendo as operações (adição, subtração, multiplicação, divisão, potenciação)."],
  ["D27", MT_III, "Efetuar cálculos simples com valores aproximados de radicais."],
  ["D28", MT_III, "Resolver problema que envolva porcentagem."],
  ["D29", MT_III, "Resolver problema que envolva variações proporcionais, diretas ou inversas entre grandezas."],
  ["D30", MT_III, "Calcular o valor numérico de uma expressão algébrica."],
  ["D31", MT_III, "Resolver problema que envolva equação do 2º grau."],
  ["D32", MT_III, "Identificar a expressão algébrica que expressa uma regularidade observada em sequências de números ou figuras (padrões)."],
  ["D33", MT_III, "Identificar uma equação ou inequação do 1º grau que expressa um problema."],
  ["D34", MT_III, "Identificar um sistema de equações do 1º grau que expressa um problema."],
  ["D35", MT_III, "Identificar a relação entre as representações algébrica e geométrica de um sistema de equações do 1º grau."],
  ["D36", MT_IV, "Resolver problema envolvendo informações apresentadas em tabelas e/ou gráficos."],
  ["D37", MT_IV, "Associar informações apresentadas em listas e/ou tabelas simples aos gráficos que as representam e vice-versa."],
]);

const READING = "Leitura";

const CNCA1_LP = build("cnca1", "lp", [
  ["1EF01_P", READING, "Distinguir letras do alfabeto de desenhos e/ou outros sinais gráficos.", "EF01LP04"],
  ["1EF02_P", READING, "Reconhecer letras do alfabeto.", "EF01LP10"],
  ["1EF03_P", READING, "Reconhecer as direções da escrita.", "EF01LP01"],
  ["1EF04_P", READING, "Identificar a correta segmentação das palavras na escrita.", "EF01LP12"],
  ["1EF05_P", READING, "Reconhecer o local de inserção de uma palavra na ordem alfabética.", "EF01LP10"],
  ["1EF06_P", READING, "Identificar rimas.", "EF12LP19"],
  ["1EF07_P", READING, "Identificar semelhanças entre sílabas (inicial, medial, final) de palavras.", "EF01LP09"],
  ["1EF08_P", READING, "Ler palavras formadas exclusivamente por sílabas canônicas.", "EF02LP04"],
  ["1EF09_P", READING, "Ler palavras formadas por sílabas não canônicas.", "EF02LP04"],
  ["1EF10_P", READING, "Ler frases (ordem direta, estrutura canônica: sujeito, verbo, objeto - um complemento).", "EF01LP02"],
  ["1EF11_P", READING, "Localizar informações explícitas em textos, recuperadas por meio de uma repetição.", "EF15LP03"],
  ["1EF12_P", READING, "Reconhecer o assunto de um texto ouvido.", "EF35LP03"],
  ["1EF13_P", READING, "Inferir informação em texto que articula linguagem verbal e não verbal.", "EF15LP14"],
  ["1EF14_P", READING, "Reconhecer o gênero de um texto que circula no campo de atuação da vida cotidiana.", "EF15LP02"],
  ["1EF15_P", READING, "Identificar a finalidade de um texto do campo de atuação da vida cotidiana.", "EF15LP01"],
]);

const NU = "Números";
const AL = "Álgebra";
const GE = "Geometria";
const GM = "Grandezas e medidas";
const PE = "Probabilidade e estatística";

const CNCA1_MT = build("cnca1", "mt", [
  ["1EF01_M", NU, "Contar a quantidade de objetos de uma coleção contendo até 20 elementos, apresentando o resultado em registro numérico.", "EF01MA04"],
  ["1EF02_M", NU, "Comparar quantidades de objetos de coleções, contendo até 20 elementos cada, com suporte de imagens, indicando qual tem mais, qual tem menos ou quais têm a mesma quantidade.", "EF01MA03"],
  ["1EF03_M", NU, "Comparar números naturais formados por até dois algarismos, em situações do cotidiano, indicando o menor ou o maior dentre eles.", "EF01MA05"],
  ["1EF04_M", NU, "Utilizar a operação de adição entre números naturais, formados por até dois algarismos, envolvendo o significado de juntar ou de acrescentar, com suporte de imagens, na resolução de problema.", "EF01MA08"],
  ["1EF05_M", NU, "Utilizar a operação de subtração entre números naturais, formados por até dois algarismos, envolvendo o significado de retirar ou de separar, com suporte de imagens, na resolução de problema.", "EF01MA08"],
  ["1EF06_M", AL, "Classificar objetos segundo atributos de cor, forma ou medida.", "EF01MA09"],
  ["1EF07_M", AL, "Determinar termos ausentes em sequências de figuras.", "EF01MA10"],
  ["1EF08_M", GE, "Interpretar localização de pessoas, animais ou objetos no espaço, considerando um ponto de referência e noções de orientação (à direita, à esquerda, em frente, atrás, em cima ou embaixo).", "EF01MA12"],
  ["1EF09_M", GE, "Reconhecer figura geométrica espacial (cone, cilindro, esfera ou bloco retangular) em objetos do mundo físico, pela sua forma.", "EF01MA13"],
  ["1EF10_M", GE, "Reconhecer figuras geométricas planas (círculo, quadrado, retângulo ou triângulo) desenhadas em diferentes disposições.", "EF01MA14"],
  ["1EF11_M", GM, "Comparar objetos de uso cotidiano por meio de um dos atributos: comprimento, capacidade ou massa.", "EF01MA15"],
  ["1EF12_M", GM, "Reconhecer valores convencionados de moedas ou de cédulas do sistema monetário brasileiro, em situações do cotidiano.", "EF01MA19"],
  ["1EF13_M", PE, "Identificar dados estatísticos dispostos em tabelas simples, em gráficos de colunas ou de barras simples.", "EF01MA21"],
]);

/*
 * SADEAM 8º ano (Sistema de Avaliação de Desempenho Educacional do Amazonas, Seduc/AM + CAEd/UFJF).
 * A matriz da prova do 8º ano de 2026 não foi publicada. A edição mais recente do SADEAM para os
 * anos finais com Língua Portuguesa e Matemática juntas é a de 2019 ("SADEAM 2019 MATRIZ LP 7EF" e
 * "MT 7EF", em prototipos.caeddigital.net/arquivos/am/matrizes). Os códigos são os do SADEAM
 * (diferentes do Saeb). Quando a Seduc/AM publicar a matriz do 8º ano, atualize estas listas.
 */
const SADEAM8_LP = build("sadeam8", "lp", [
  ["D01", LP_I, "Localizar informações explícitas em um texto."],
  ["D02", LP_I, "Inferir o sentido de uma palavra ou expressão."],
  ["D03", LP_I, "Inferir uma informação implícita em um texto."],
  ["D04", LP_I, "Identificar o tema de um texto."],
  ["D05", LP_I, "Distinguir um fato da opinião relativa a esse fato."],
  ["D06", LP_II, "Interpretar texto com auxílio de material gráfico diverso (propagandas, quadrinhos, foto etc.)."],
  ["D07", LP_II, "Identificar a finalidade de textos de diferentes gêneros."],
  ["D08", LP_III, "Reconhecer diferentes formas de tratar uma informação na comparação de textos que tratam do mesmo tema, em função das condições em que ele foi produzido e daquelas em que será recebido."],
  ["D10", LP_IV, "Estabelecer relações entre partes de um texto, identificando repetições ou substituições que contribuem para a continuidade de um texto."],
  ["D13", LP_IV, "Diferenciar as partes principais das secundárias em um texto."],
  ["D14", LP_IV, "Identificar o conflito gerador do enredo e os elementos que constroem a narrativa."],
  ["D15", LP_IV, "Estabelecer relação causa/consequência entre partes e elementos do texto."],
  ["D16", LP_IV, "Estabelecer relações lógico-discursivas presentes no texto, marcadas por conjunções, advérbios etc."],
  ["D17", LP_V, "Identificar efeitos de ironia ou humor em textos variados."],
  ["D18", LP_V, "Reconhecer o efeito de sentido decorrente do uso da pontuação e de outras notações."],
  ["D20", LP_V, "Reconhecer o efeito de sentido decorrente da exploração de recursos ortográficos e/ou morfossintáticos."],
  ["D21", LP_VI, "Identificar as marcas linguísticas que evidenciam o locutor e o interlocutor de um texto."],
]);

const SADEAM8_MT = build("sadeam8", "mt", [
  ["D01", MT_I, "Identificar a localização/movimentação de objeto em mapas, croquis e outras representações gráficas."],
  ["D02", MT_I, "Identificar propriedades comuns e diferenças entre figuras bidimensionais e tridimensionais, relacionando-as com as suas planificações."],
  ["D03", MT_I, "Identificar propriedades comuns e diferenças entre figuras bidimensionais pelo número de lados, pelos tipos de ângulos."],
  ["D04", MT_I, "Identificar relação entre quadriláteros por meio de suas propriedades."],
  ["D05", MT_I, "Reconhecer a conservação ou modificação de medidas dos lados, do perímetro, da área em ampliação e/ou redução de figuras poligonais usando malhas quadriculadas."],
  ["D06", MT_I, "Reconhecer ângulos como mudança de direção ou giros, identificando ângulos retos e não retos."],
  ["D10", MT_I, "Interpretar informações apresentadas por meio de coordenadas cartesianas."],
  ["D14", MT_II, "Estabelecer relações entre o horário de início e término e/ou o intervalo da duração de um evento ou acontecimento."],
  ["D16", MT_II, "Resolver problema envolvendo o cálculo de perímetro de figuras planas."],
  ["D17", MT_II, "Resolver problema envolvendo o cálculo de área de figuras planas."],
  ["D18", MT_II, "Resolver problema envolvendo noções de volume."],
  ["D19", MT_II, "Resolver problemas significativos utilizando unidades de medida padronizadas como km/m/cm/mm, kg/g/mg, l/ml."],
  ["D20", MT_III, "Reconhecer e utilizar características do Sistema de Numeração Decimal, tais como agrupamentos e trocas na base 10 e princípio do valor posicional."],
  ["D22", MT_III, "Identificar a localização de números inteiros na reta numérica."],
  ["D23", MT_III, "Identificar a localização de números racionais na reta numérica."],
  ["D27", MT_III, "Efetuar cálculos com números inteiros, envolvendo as operações (adição, subtração, multiplicação, divisão, potenciação)."],
  ["D30", MT_III, "Resolver problema com números naturais, envolvendo diferentes significados das operações (adição, subtração, multiplicação, divisão, potenciação)."],
  ["D32", MT_III, "Resolver problema com números inteiros envolvendo as operações (adição, subtração, multiplicação, divisão, potenciação)."],
  ["D33", MT_III, "Reconhecer as diferentes representações de um número racional."],
  ["D34", MT_III, "Identificar fração como representação que pode estar associada a diferentes significados."],
  ["D35", MT_III, "Identificar frações equivalentes."],
  ["D36", MT_III, "Reconhecer as representações decimais dos números racionais como uma extensão do Sistema de Numeração Decimal, identificando a existência de \"ordens\" como décimos, centésimos e milésimos."],
  ["D37", MT_III, "Efetuar cálculos que envolvam operações com números racionais (adição, subtração, multiplicação, divisão, potenciação)."],
  ["D38", MT_III, "Resolver problema com números racionais envolvendo as operações (adição, subtração, multiplicação, divisão, potenciação)."],
  ["D40", MT_III, "Resolver problema que envolva porcentagem."],
  ["D41", MT_III, "Resolver problema que envolva variação proporcional, direta ou inversa, entre grandezas."],
  ["D42", MT_III, "Calcular o valor numérico de uma expressão algébrica."],
  ["D43", MT_III, "Identificar uma equação ou inequação do 1º grau que expressa um problema."],
  ["D58", MT_IV, "Resolver problema envolvendo informações apresentadas em tabelas e/ou gráficos."],
  ["D59", MT_IV, "Associar informações apresentadas em listas e/ou tabelas simples aos gráficos que as representam e vice-versa."],
]);

export const DESCRIPTOR_CATALOG: readonly Descriptor[] = [
  ...SAEB9_LP,
  ...SAEB9_MT,
  ...SADEAM8_LP,
  ...SADEAM8_MT,
  ...CNCA1_LP,
  ...CNCA1_MT,
];

export const MATRIX_LABELS: Record<DescriptorMatrix, string> = {
  saeb9: "Saeb · 9º ano",
  sadeam8: "SADEAM · 8º ano",
  cnca1: "CNCA · 1º ano",
  custom: "Descritores da escola",
};

export const SUBJECT_LABELS: Record<AssessmentSubject, string> = {
  lp: "Língua Portuguesa",
  mt: "Matemática",
};

/** Matriz sugerida para o ano escolar. */
export function defaultMatrix(grade: number): DescriptorMatrix {
  if (grade === 9) return "saeb9";
  if (grade === 8) return "sadeam8";
  if (grade === 1) return "cnca1";
  return "custom";
}
