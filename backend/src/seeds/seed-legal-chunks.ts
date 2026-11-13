/**
 * Seed: Chunks de texto da Lei 14.133/2021 para RAG (Retrieval-Augmented Generation)
 *
 * Fragmenta artigos-chave da lei em chunks pesquisáveis pelo LEX,
 * permitindo que a IA cite diretamente o texto legal nas respostas.
 *
 * Fonte oficial: https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm
 */

import 'dotenv/config';
import { prisma } from '../database/prisma';
import * as crypto from 'crypto';

interface LegalChunk {
  sourceType: string;
  sourceId: string;
  content: string;
  metadata: {
    lei: string;
    artigo: string;
    tema: string;
  };
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

const CHUNKS: LegalChunk[] = [
  // ─── PRINCÍPIOS (Art. 5) ───────────────────────────────────────────────
  {
    sourceType: 'legal_text',
    sourceId: 'lei-14133-art5',
    content: `Art. 5º Na aplicação desta Lei, serão observados os princípios da legalidade, da impessoalidade, da moralidade, da publicidade, da eficiência, do interesse público, da probidade administrativa, da igualdade, do planejamento, da transparência, da eficácia, da segregação de funções, da motivação, da vinculação ao edital, do julgamento objetivo, da segurança jurídica, da razoabilidade, da competitividade, da proporcionalidade, da celeridade, da economicidade e do desenvolvimento nacional sustentável.`,
    metadata: { lei: 'Lei 14.133/2021', artigo: 'Art. 5', tema: 'Princípios' },
  },

  // ─── VEDAÇÕES (Art. 9) ─────────────────────────────────────────────────
  {
    sourceType: 'legal_text',
    sourceId: 'lei-14133-art9',
    content: `Art. 9º É vedado ao agente público designado para atuar na área de licitações e contratos, ressalvados os casos previstos em lei:
I – admitir, prever, incluir ou tolerar, nos atos de convocação, cláusulas ou condições que comprometam, restrinjam ou frustrem o seu caráter competitivo, inclusive nos casos de sociedades cooperativas, e estabeleçam preferências ou distinções em razão da naturalidade, da sede ou domicílio dos licitantes ou de qualquer outra circunstância impertinente ou irrelevante para o específico objeto do contrato;
II – estabelecer tratamento diferenciado de natureza comercial, legal, trabalhista, previdenciária ou qualquer outra entre empresas brasileiras e estrangeiras, inclusive no que se refere a moeda, modalidade e local de pagamento, mesmo quando envolvido financiamento de agência internacional.`,
    metadata: { lei: 'Lei 14.133/2021', artigo: 'Art. 9', tema: 'Vedações' },
  },

  // ─── PESQUISA DE PREÇOS (Art. 23) ──────────────────────────────────────
  {
    sourceType: 'legal_text',
    sourceId: 'lei-14133-art23',
    content: `Art. 23. O valor previamente estimado da contratação deverá ser compatível com os valores praticados pelo mercado, considerados os preços constantes de bancos de dados públicos e as quantidades a serem contratadas, observadas a potencial economia de escala e as peculiaridades do local de execução do objeto.
§ 1º No processo licitatório para aquisição de bens e contratação de serviços em geral, conforme regulamento, o valor estimado será definido com base no melhor preço aferido por meio da utilização dos seguintes parâmetros, adotados de forma combinada ou não:
I – composição de custos unitários menores ou iguais à mediana do item correspondente no painel de preços ou no banco de preços em saúde disponíveis no Portal Nacional de Contratações Públicas (PNCP);
II – contratações similares feitas pela Administração Pública, em execução ou concluídas no período de 1 (um) ano anterior à data da pesquisa de preços;
III – dados de pesquisa publicada em mídia especializada, de tabela de referência formalmente aprovada pelo Poder Executivo federal e de sítios eletrônicos especializados ou de domínio amplo;
IV – pesquisa direta com no mínimo 3 (três) fornecedores, mediante solicitação formal de cotação.`,
    metadata: { lei: 'Lei 14.133/2021', artigo: 'Art. 23', tema: 'Pesquisa de Preços' },
  },

  // ─── MODALIDADES (Art. 28) ─────────────────────────────────────────────
  {
    sourceType: 'legal_text',
    sourceId: 'lei-14133-art28',
    content: `Art. 28. São modalidades de licitação:
I – pregão;
II – concorrência;
III – concurso;
IV – leilão;
V – diálogo competitivo.
§ 1º Além das modalidades referidas no caput deste artigo, a Administração pode servir-se dos procedimentos auxiliares previstos no art. 78 desta Lei.
§ 2º É vedada a criação de outras modalidades de licitação ou, ainda, a combinação das referidas neste artigo.`,
    metadata: { lei: 'Lei 14.133/2021', artigo: 'Art. 28', tema: 'Modalidades' },
  },

  // ─── CRITÉRIOS DE JULGAMENTO (Art. 33) ─────────────────────────────────
  {
    sourceType: 'legal_text',
    sourceId: 'lei-14133-art33',
    content: `Art. 33. O julgamento das propostas será realizado de acordo com os seguintes critérios:
I – menor preço;
II – maior desconto;
III – melhor técnica ou conteúdo artístico;
IV – técnica e preço;
V – maior lance, no caso de leilão;
VI – maior retorno econômico.
§ 1º O critério de julgamento de menor preço ou de maior desconto considerará o menor dispêndio para a Administração, atendidos os parâmetros mínimos de qualidade definidos no edital de licitação.`,
    metadata: { lei: 'Lei 14.133/2021', artigo: 'Art. 33', tema: 'Critérios de Julgamento' },
  },

  // ─── HABILITAÇÃO (Art. 62-70) ──────────────────────────────────────────
  {
    sourceType: 'legal_text',
    sourceId: 'lei-14133-art67',
    content: `Art. 67. A documentação relativa à qualificação econômico-financeira será restrita a:
I – balanço patrimonial, demonstração de resultado de exercício e demais demonstrações contábeis dos 2 (dois) últimos exercícios sociais;
II – certidão negativa de feitos sobre falência expedida pelo distribuidor da sede do licitante;
III – índices de Liquidez Geral (LG), Solvência Geral (SG) e Liquidez Corrente (LC), maiores que 1 (um);
IV – capital mínimo ou de patrimônio líquido mínimo de até 10% (dez por cento) do valor estimado da contratação;
V – relação dos compromissos assumidos pelo licitante que importem em diminuição da capacidade operativa ou absorção de disponibilidade financeira, calculada esta em função do patrimônio líquido atualizado e sua capacidade de rotação.
Parágrafo único. É vedada a exigência de valores mínimos de faturamento anterior e de índices de rentabilidade ou lucratividade.`,
    metadata: { lei: 'Lei 14.133/2021', artigo: 'Art. 67', tema: 'Habilitação Econômico-Financeira' },
  },

  // ─── PUBLICIDADE E PRAZOS (Art. 54-55) ─────────────────────────────────
  {
    sourceType: 'legal_text',
    sourceId: 'lei-14133-art55',
    content: `Art. 55. Os prazos mínimos para apresentação de propostas e lances, contados a partir da data de divulgação do edital de licitação, são de:
I – para aquisição de bens:
a) 8 (oito) dias úteis, quando adotados os critérios de julgamento de menor preço ou de maior desconto;
b) 15 (quinze) dias úteis, quando adotado o critério de julgamento de melhor técnica ou conteúdo artístico;
c) 15 (quinze) dias úteis, quando adotado o critério de julgamento de técnica e preço;
II – para contratação de obras e serviços de engenharia:
a) 15 (quinze) dias úteis, quando adotados os critérios de julgamento de menor preço ou de maior desconto;
b) 35 (trinta e cinco) dias úteis, quando adotado o critério de julgamento de melhor técnica ou conteúdo artístico;
c) 35 (trinta e cinco) dias úteis, quando adotado o critério de julgamento de técnica e preço;
III – para contratação de serviços em geral:
a) 10 (dez) dias úteis, quando adotados os critérios de julgamento de menor preço ou de maior desconto;
b) 25 (vinte e cinco) dias úteis, quando adotado o critério de julgamento de melhor técnica ou conteúdo artístico;
c) 25 (vinte e cinco) dias úteis, quando adotado o critério de julgamento de técnica e preço.`,
    metadata: { lei: 'Lei 14.133/2021', artigo: 'Art. 55', tema: 'Prazos Mínimos de Publicidade' },
  },

  // ─── DESEMPATE (Art. 60) ───────────────────────────────────────────────
  {
    sourceType: 'legal_text',
    sourceId: 'lei-14133-art60',
    content: `Art. 60. Em caso de empate entre duas ou mais propostas, serão utilizados os seguintes critérios de desempate, nesta ordem:
I – disputa final, hipótese em que os licitantes empatados poderão apresentar nova proposta em ato contínuo à classificação;
II – avaliação do desempenho contratual prévio dos licitantes, para a qual deverão preferencialmente ser utilizados registros cadastrais para efeito de atesto de cumprimento de obrigações previstos nesta Lei;
III – desenvolvimento pelo licitante de ações de equidade entre homens e mulheres no ambiente de trabalho, conforme regulamento;
IV – desenvolvimento pelo licitante de programa de integridade, conforme orientações dos órgãos de controle.
§ 1º Em igualdade de condições, se não houver desempate, será assegurada preferência, sucessivamente, aos bens e serviços produzidos ou prestados por:
I – empresas estabelecidas no território do Estado ou do Distrito Federal do órgão ou entidade da Administração Pública estadual ou distrital licitante ou, no caso de licitação realizada por órgão ou entidade de Município, no território do Estado em que este se localize;
II – empresas brasileiras;
III – empresas que invistam em pesquisa e no desenvolvimento de tecnologia no País;
IV – empresas que comprovem a prática de mitigação, nos termos da Lei nº 12.187, de 29 de dezembro de 2009.`,
    metadata: { lei: 'Lei 14.133/2021', artigo: 'Art. 60', tema: 'Critérios de Desempate' },
  },

  // ─── GARANTIA (Art. 96-98) ─────────────────────────────────────────────
  {
    sourceType: 'legal_text',
    sourceId: 'lei-14133-art98',
    content: `Art. 98. Nas contratações de obras, serviços e fornecimentos, a garantia poderá ser de até 5% (cinco por cento) do valor inicial do contrato, autorizada a majoração para até 10% (dez por cento), desde que justificada mediante análise da complexidade técnica e dos riscos envolvidos.
§ 1º A garantia prevista no caput deste artigo somente será liberada ante a comprovação de que a empresa pagou todas as verbas rescisórias trabalhistas decorrentes da contratação.
§ 2º Caso a contratação de mão de obra envolva o fornecimento de materiais ou utilização de equipamentos, o edital poderá prever condições especiais para a garantia.`,
    metadata: { lei: 'Lei 14.133/2021', artigo: 'Art. 98', tema: 'Garantia Contratual' },
  },

  // ─── IMPUGNAÇÃO (Art. 164) ─────────────────────────────────────────────
  {
    sourceType: 'legal_text',
    sourceId: 'lei-14133-art164',
    content: `Art. 164. Qualquer pessoa é parte legítima para impugnar edital de licitação por irregularidade na aplicação desta Lei ou para solicitar esclarecimento sobre os seus termos, devendo protocolar o pedido até 3 (três) dias úteis antes da data de abertura do certame.
Parágrafo único. A resposta à impugnação ou ao pedido de esclarecimento será divulgada em sítio eletrônico oficial no prazo de até 3 (três) dias úteis, limitado ao último dia útil anterior à data da abertura do certame.`,
    metadata: { lei: 'Lei 14.133/2021', artigo: 'Art. 164', tema: 'Impugnação' },
  },

  // ─── LC 123/2006 - ME/EPP ──────────────────────────────────────────────
  {
    sourceType: 'legal_text',
    sourceId: 'lc-123-art44',
    content: `Art. 44. Nas licitações será assegurada, como critério de desempate, preferência de contratação para as microempresas e empresas de pequeno porte.
§ 1º Entende-se por empate aquelas situações em que as propostas apresentadas pelas microempresas e empresas de pequeno porte sejam iguais ou até 5% (cinco por cento) superiores à proposta mais bem classificada.
§ 2º Na modalidade de pregão, o intervalo percentual estabelecido no § 1º deste artigo será de até 5% (cinco por cento) superior ao melhor preço.`,
    metadata: { lei: 'LC 123/2006', artigo: 'Art. 44', tema: 'Desempate ME/EPP' },
  },
  {
    sourceType: 'legal_text',
    sourceId: 'lc-123-art48',
    content: `Art. 48. Para o cumprimento do disposto no art. 47 desta Lei Complementar, a administração pública:
I – deverá realizar processo licitatório destinado exclusivamente à participação de microempresas e empresas de pequeno porte nos itens de contratação cujo valor seja de até R$ 80.000,00 (oitenta mil reais);
II – poderá, em relação aos processos licitatórios destinados à aquisição de obras e serviços, exigir dos licitantes a subcontratação de microempresa ou empresa de pequeno porte;
III – deverá estabelecer, em certames para aquisição de bens de natureza divisível, cota de até 25% (vinte e cinco por cento) do objeto para a contratação de microempresas e empresas de pequeno porte.`,
    metadata: { lei: 'LC 123/2006', artigo: 'Art. 48', tema: 'Tratamento Diferenciado ME/EPP' },
  },
  // PLAYBOOK TÁTICO DE 40 ANOS DE EXPERIÊNCIA EM LICITAÇÕES (sourceType: 'tactical_playbook')
  {
    sourceType: 'tactical_playbook',
    sourceId: 'PLAYBOOK-NEGOCIACAO-ART61',
    content: `PLAYBOOK TÁTICO LEX (40 ANOS): Rito de Negociação com o Pregoeiro (Art. 61 da Lei 14.133/2021 e IN SEGES/ME 73/2022).
Encerrada a fase de lances e definida a primeira colocação, o Pregoeiro abrirá negociação obrigatória no chat (Art. 61 da Lei 14.133/2021).
1. Psicologia e Tempo de Resposta: Responda ao chamado do Pregoeiro em até 60 segundos com cordialidade institucional ("Bom dia, Sr(a). Pregoeiro(a), empresa conectada e pronta para negociação").
2. Reserva de Gordura Tática e Stop-Loss: Nunca queime 100% da margem na fase de lances se não houver pressão direta; reserve entre 0,5% e 1,5% acima do seu Stop-Loss (Piso Mínimo Exequível calculado com tributos reais, frete, encargos e taxa financeira) para conceder um desconto simbólico ao Pregoeiro no chat, viabilizando a aceitação imediata da proposta. Caso já esteja no Stop-Loss, decline da redução fundamentando que o valor ofertado já contempla o limite operacional exequível com todos os encargos fiscais e trabalhistas.
3. Envio da Proposta Readequada: O prazo mínimo para envio da proposta ajustada ao último lance e planilhas de custos é de 2 (duas) horas (Art. 29, § 2º da IN SEGES/ME 73/2022), prorrogável por igual período mediante solicitação motivada no chat ANTES do encerramento do prazo original.`,
    metadata: { lei: 'Lei 14.133/2021 e IN 73/2022', artigo: 'Art. 61', tema: 'Rito de Negociação com o Pregoeiro e Stop-Loss' },
  },
  {
    sourceType: 'tactical_playbook',
    sourceId: 'PLAYBOOK-DILIGENCIA-ACORDAO-1211',
    content: `PLAYBOOK TÁTICO LEX (40 ANOS): Defesa contra Inabilitação Formal (Acórdão 1211/2021-TCU-Plenário e Art. 64 da Lei 14.133/2021).
1. Regra de Ouro do Formalismo Moderado: Nos termos do Art. 64 da Lei 14.133/2021 e da jurisprudência pacificada do TCU (Acórdão 1211/2021-Plenário, Rel. Min. Walton Alencar Rodrigues; Acórdão 2443/2021-Plenário), a vedação à inclusão de documento novo não alcança documento ausente que comprove condição PREEXISTENTE à abertura da sessão pública.
2. Tática de Defesa Imediata no Chat e Recurso: Se o Pregoeiro ameaçar inabilitar sua empresa por falha formal no envio de certidão, balanço ou atestado emitido antes da sessão, invoque imediatamente no chat o dever-poder de diligência do Art. 64 da Lei 14.133/2021 c/c Acórdão 1211/2021-TCU-Plenário, pois inabilitar a proposta mais vantajosa por erro sanável configura excesso de formalismo e dano ao erário.`,
    metadata: { lei: 'Lei 14.133/2021 e Jurisprudência TCU', artigo: 'Art. 64 / Acórdão 1211/2021-TCU', tema: 'Defesa contra Inabilitação Formal e Diligência' },
  },
  {
    sourceType: 'tactical_playbook',
    sourceId: 'PLAYBOOK-INEXEQUIBILIDADE-SUMULA-262',
    content: `PLAYBOOK TÁTICO LEX (40 ANOS): Ataque e Defesa de Preço Inexequível (Súmula 262 do TCU e Art. 59, §§ 2º e 4º da Lei 14.133/2021).
1. Defesa da Própria Proposta: A Súmula 262 do TCU estabelece que o critério de inexequibilidade conduz a uma presunção RELATIVA (juris tantum), devendo a Administração dar oportunidade ao licitante para demonstrar a exequibilidade de sua proposta (Art. 59, § 2º da Lei 14.133/2021). Para defender seu lance, apresente planilha de composição de custos acompanhada de notas fiscais de entrada (XMLs de compra), contratos vigentes, regime tributário real (Simples Nacional, Lucro Presumido ou Créditos de PIS/COFINS/ICMS) e estoque já adquirido.
2. Ataque Técnico a Concorrente Aventureiro (Mergulho de Preço): Quando o primeiro colocado ofertar preço manifestamente abaixo do custo de matéria-prima ou inferior a 75% do valor orçado em obras e serviços de engenharia (Art. 59, § 4º da Lei 14.133/2021), solicite abertura de diligência para comprovação documental de custos, encargos sociais (CCT), alíquotas tributárias reais e exequibilidade logística.`,
    metadata: { lei: 'Lei 14.133/2021 e Súmula 262/TCU', artigo: 'Art. 59, §§ 2º e 4º', tema: 'Ataque e Defesa de Preço Inexequível' },
  },
  {
    sourceType: 'tactical_playbook',
    sourceId: 'PLAYBOOK-MODOS-DISPUTA-IN73',
    content: `PLAYBOOK TÁTICO LEX (40 ANOS): Estratégia Matemática nos Modos Aberto e Aberto-Fechado (IN SEGES/ME 73/2022, LC 123/2006, Súmulas 247 e 263 do TCU).
1. Modo Aberto (Art. 23 da IN 73/2022): Etapa de 10 minutos com prorrogação automática de 2 minutos sempre que houver lance nos últimos 2 minutos. Tática: não inicie guerra de preços nos primeiros 8 minutos; utilize lances intermediários para monitorar o ritmo dos concorrentes e posicione-se de forma cirúrgica na prorrogação respeitando seu Stop-Loss.
2. Modo Aberto-Fechado (Art. 24 da IN 73/2022): Etapa aberta de 15 minutos + tempo aleatório de até 10 minutos. Em seguida, o detentor do melhor lance e todos os licitantes dentro da margem de até 10% superior (ou os 3 melhores lances, caso não haja 3 dentro de 10%) são convocados para dar um ÚNICO LANCE FECHADO E SIGILOSO em até 5 minutos. Tática: na fase aberta, garanta estar rigorosamente dentro da faixa de 10% do líder sem revelar seu preço final; no lance fechado de 5 minutos, aplique seu preço competitivo calculado na calculadora de BDI com centavos quebrados (ex.: R$ 98,43 em vez de R$ 98,50) para evitar empates.
3. Empate Ficto ME/EPP (Art. 44, § 2º da LC 123/2006): No pregão, se a melhor proposta for de empresa de médio/grande porte e sua ME/EPP estiver até 5% acima, fique atento ao cronômetro: você terá prazo improrrogável de 5 minutos após o encerramento para enviar lance inferior ao líder.
4. Súmula 247 e Súmula 263 do TCU: Impugne editais que agrupem itens divisíveis em lote único sem justificativa técnica (Súmula 247/TCU e Art. 40, § 2º da Lei 14.133/2021) ou que exijam atestados técnicos superiores a 50% do quantitativo das parcelas de maior relevância (Súmula 263/TCU e Art. 67, § 2º da Lei 14.133/2021).`,
    metadata: { lei: 'IN SEGES/ME 73/2022, LC 123/2006 e TCU', artigo: 'Arts. 23 e 24 IN 73/2022', tema: 'Tática dos Modos Aberto e Aberto-Fechado' },
  },
];

async function seedDocumentChunks() {
  console.log('🔄 Iniciando seed de chunks legais para RAG (Lei 14.133 + LC 123)...');

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < CHUNKS.length; i++) {
    const chunk = CHUNKS[i];
    const contentHash = sha256(chunk.content);

    const existing = await prisma.documentChunk.findFirst({
      where: {
        sourceType: chunk.sourceType,
        sourceId: chunk.sourceId,
        chunkIndex: 0,
      },
    });

    if (existing) {
      console.log(`  ⏭  ${chunk.sourceId} (já existe)`);
      skipped++;
      continue;
    }

    await prisma.documentChunk.create({
      data: {
        sourceType: chunk.sourceType,
        sourceId: chunk.sourceId,
        chunkIndex: 0,
        contentHash,
        content: chunk.content,
        tokenCount: Math.ceil(chunk.content.length / 4), // estimativa
        metadata: chunk.metadata,
      },
    });

    console.log(`  ✅ ${chunk.sourceId} — ${chunk.metadata.tema}`);
    created++;
  }

  console.log(`\n📊 Resultado: ${created} chunks criados, ${skipped} já existentes.`);
  console.log('✅ Seed de chunks legais concluído!\n');
}

seedDocumentChunks()
  .catch((err) => {
    console.error('❌ Erro no seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
