import { getPrismaClient } from '../src/database/prisma';
import crypto from 'crypto';

const prisma = getPrismaClient();

function hash(str: string) {
  return crypto.createHash('md5').update(str).digest('hex');
}

async function main() {
  console.log('Iniciando o Mega Seeding B2G (Nova Lei 14.133, TCU, CADE, ETP)...');

  // ==========================================
  // 1. JURISPRUDÊNCIA DENSA (TCU e CADE)
  // ==========================================
  console.log('Semeando Jurisprudência...');
  
  const jurisprudenceData = [
    {
      source: 'TCU', externalId: 'SUMULA-247', dedupeKey: 'TCU-SUMULA-247',
      court: 'Tribunal de Contas da União', title: 'Súmula 247 - Agrupamento Indevido e Parcelamento',
      summary: 'Obrigatório o parcelamento do objeto em lotes quando técnica e economicamente viável.',
      decisionText: 'É obrigatória a admissão da adjudicação por item e não por preço global, nos editais das licitações para a contratação de obras, serviços, compras e alienações, cujo objeto seja divisível, desde que não haja prejuízo para o conjunto ou complexo ou perda de economia de escala, tendo em vista o objetivo de propiciar a ampla participação de licitantes que, embora não dispondo de capacidade para a execução, fornecimento ou aquisição da totalidade do objeto, possam fazê-lo com relação a itens ou unidades autônomas.',
      decisionDate: new Date('2004-12-01T00:00:00Z'),
    },
    {
      source: 'TCU', externalId: 'SUMULA-263', dedupeKey: 'TCU-SUMULA-263',
      court: 'Tribunal de Contas da União', title: 'Súmula 263 - Exigência de Comprovação de Vínculo Empregatício',
      summary: 'É irregular exigir vínculo de emprego prévio do responsável técnico.',
      decisionText: 'Para a comprovação da capacidade técnico-operacional das licitantes, e desde que limitada, simultaneamente, às parcelas de maior relevância e valor significativo do objeto a ser contratado, é lícita a exigência de comprovação da execução de quantitativos mínimos em obras ou serviços com características semelhantes, devendo essa exigência guardar proporção com a dimensão e a complexidade do objeto a ser executado. Porém, é vedada a exigência de comprovação de vínculo empregatício do profissional responsável técnico com a empresa licitante.',
      decisionDate: new Date('2011-05-18T00:00:00Z'),
    },
    {
      source: 'TCU', externalId: 'ACORDAO-1214-2013-PLENARIO', dedupeKey: 'TCU-ACORDAO-1214-2013-PLENARIO',
      court: 'Tribunal de Contas da União - Plenário', title: 'Atestados de Capacidade Técnica Restritivos',
      summary: 'Vedação à exigência de quantitativos mínimos ou prazos máximos desarrazoados em atestados de capacidade técnica.',
      decisionText: 'É irregular a exigência, para fins de qualificação técnico-operacional, de atestados que comprovem a execução de quantitativos mínimos em prazos máximos, salvo quando a dimensão e a complexidade do objeto assim o exigirem, devendo haver, em qualquer caso, motivação prévia e fundamentada no processo licitatório.',
      decisionDate: new Date('2013-05-22T00:00:00Z'),
    },
    {
      source: 'CADE', externalId: 'GUIA-CARTEL-2022', dedupeKey: 'CADE-GUIA-CARTEL-2022',
      court: 'Conselho Administrativo de Defesa Econômica', title: 'Indicadores de Conluio em Licitações',
      summary: 'Sinais vermelhos de cartel: rodízio, propostas de fachada e lances coordenados.',
      decisionText: 'Os principais indícios de cartel incluem: (a) Propostas de cobertura, onde empresas ofertam valores claramente inaceitáveis; (b) Revezamento de vencedores em contratos sucessivos; (c) Indícios físicos ou digitais, como mesmo IP, mesmos representantes legais ou formatação idêntica dos documentos.',
      decisionDate: new Date('2022-01-01T00:00:00Z'),
    },
    {
      source: 'CGU', externalId: 'MANUAL-RISCOS-2023', dedupeKey: 'CGU-MANUAL-RISCOS-2023',
      court: 'Controladoria-Geral da União', title: 'Matriz de Risco nas Licitações (Lei 14.133)',
      summary: 'Diretrizes sobre a alocação de riscos em contratos administrativos.',
      decisionText: 'A matriz de alocação de riscos é obrigatória para contratações de grande vulto e regimes de contratação integrada ou semi-integrada. A CGU recomenda que riscos imprevisíveis ou de consequências incalculáveis recaiam sobre a Administração Pública, enquanto riscos ordinários recaiam sobre o contratado.',
      decisionDate: new Date('2023-03-15T00:00:00Z'),
    }
  ];

  for (const item of jurisprudenceData) {
    await prisma.jurisprudence.upsert({
      where: { dedupeKey: item.dedupeKey },
      update: {},
      create: { ...item, contentHash: hash(item.decisionText) },
    });
  }

  // ==========================================
  // 2. DOCUMENT TEMPLATES (Artefatos, Minutas, Guias)
  // ==========================================
  console.log('Semeando Templates e Manuais...');

  const templatesData = [
    {
      title: 'Manual Completo: Qualificação Econômico-Financeira na Lei 14.133',
      description: 'Índices exigidos, limites percentuais e regras para balanço patrimonial e falência.',
      templateType: 'conteudo_educativo',
      contentTemplate: `
# 💰 Guia de Qualificação Econômico-Financeira (Lei 14.133/21)

A saúde financeira da sua empresa será provada através dos índices contábeis no Balanço Patrimonial.

## Índices Básicos (Art. 69)
Para a maioria dos editais, os índices usuais exigidos (com valor maior que 1,0) são:
- **ILC (Índice de Liquidez Corrente):** Ativo Circulante / Passivo Circulante.
- **ILG (Índice de Liquidez Geral):** (Ativo Circulante + Realizável a Longo Prazo) / (Passivo Circulante + Não Circulante).
- **ISG (Índice de Solvência Geral):** Ativo Total / (Passivo Circulante + Passivo Não Circulante).

Se o edital exigir um índice muito restritivo (ex: maior que 1,5) sem justificativa no ETP, **cabe impugnação baseada no princípio da competitividade**.

## Exigência de Patrimônio Líquido ou Capital Social
A Lei 14.133 limitou rigorosamente:
- A exigência máxima permitida de patrimônio líquido ou capital social é de **até 10% do valor estimado** da contratação (Art. 69, § 4º).
- É proibido exigir ambos (patrimônio líquido e capital social) cumulativamente.

## Certidão de Falência e Concordata
- **Recuperação Judicial:** Empresas em RJ **podem** participar da licitação, desde que comprovem aptidão econômica (Súmula 50 do TCE-SP e entendimento do STJ).

*Fique de olho: Use a Expertise Licitum para checar seu Balanço Patrimonial automaticamente antes de disputar!*
      `,
    },
    {
      title: 'Artefato: Estudo Técnico Preliminar (ETP) Padrão',
      description: 'Modelo de estrutura de ETP (Art. 18, § 1º da Lei 14.133/21) para análise de fornecedores.',
      templateType: 'artefato_referencia',
      contentTemplate: `
# ESTUDO TÉCNICO PRELIMINAR (ETP)

O ETP é o documento que fundamenta a necessidade de compra da Administração. Se ele estiver fraco, o edital é nulo.
Como fornecedor, analise o ETP buscando direcionamento de marca ou especificações restritivas!

**1. Descrição da Necessidade**
Qual problema a Administração tenta resolver? (O objeto da licitação deve ser a solução, não uma marca específica).

**2. Requisitos da Contratação**
Conjunto de especificações. É aqui que o Governo exige selos ISO, sustentabilidade ou características. Requisitos não justificados cabem impugnação.

**3. Levantamento de Mercado (Pesquisa de Preços)**
A Administração pesquisou no Portal Nacional de Contratações Públicas (PNCP)? Eles consultaram fornecedores? Se o preço estimado for muito baixo (inexequível), o erro está aqui.

**4. Parcelamento do Objeto**
Justificativa para o parcelamento (Súmula 247 TCU) ou contratação em lote único. Lote único sem economia de escala comprovada é impugnável.

**5. Justificativa da Quantidade**
A matemática usada para definir quantos itens serão comprados.
      `,
    },
    {
      title: 'Minuta de Impugnação: Restrição à Competitividade (Lotes Agrupados)',
      description: 'Modelo para derrubar editais que agrupam itens distintos em um lote único sem justificativa.',
      templateType: 'minuta_impugnacao',
      mergeTags: { empresa: '{{NOME_EMPRESA}}', orgao: '{{ORGAO}}', licitacao: '{{NUM_LICITACAO}}' },
      contentTemplate: `
**ILMO. SR. AGENTE DE CONTRATAÇÃO / PREGOEIRO DA {{ORGAO}}**
Ref.: Edital do Pregão / Concorrência nº {{NUM_LICITACAO}}

A empresa **{{NOME_EMPRESA}}**, inscrita no CNPJ [...], vem interpor **IMPUGNAÇÃO AO EDITAL**, pelos fatos e fundamentos a seguir:

**1. DO AGRUPAMENTO INDEVIDO DE LOTES (VIOLAÇÃO À SÚMULA 247 DO TCU)**
O edital em análise estabeleceu a adjudicação por "Preço Global do Lote", agrupando em um único bloco produtos de naturezas completamente distintas (ex: material de expediente agrupado com equipamentos de informática).

A Súmula 247 do Tribunal de Contas da União é clara:
*“É obrigatória a admissão da adjudicação por item e não por preço global, nos editais das licitações [...] cujo objeto seja divisível, desde que não haja prejuízo para o conjunto.”*

A Lei 14.133/2021, em seu art. 40, inciso V, reitera o princípio do parcelamento, visando a ampla participação de licitantes e o fomento à competitividade. O agrupamento injustificado no ETP limita a participação de microempresas e restringe o certame a gigantes do mercado, encarecendo a compra.

**2. DO PEDIDO**
Requer-se a revisão do edital para separar o Lote X em itens individuais ou, no mínimo, lotes segmentados por similaridade de mercado, republicando-se o edital com devolução do prazo legal.

Pede Deferimento.
Local, Data.
      `,
    },
    {
      title: 'Minuta de Recurso: Desclassificação por Inexequibilidade',
      description: 'Recurso contra pregoeiro que desclassificou a proposta alegando preço inexequível sem dar chance de defesa.',
      templateType: 'minuta_recurso',
      mergeTags: { empresa: '{{NOME_EMPRESA}}', orgao: '{{ORGAO}}', licitacao: '{{NUM_LICITACAO}}' },
      contentTemplate: `
**ILMO. SR. AGENTE DE CONTRATAÇÃO / PREGOEIRO DA {{ORGAO}}**
Ref.: Recurso Administrativo - Licitação nº {{NUM_LICITACAO}}

A empresa **{{NOME_EMPRESA}}**, inconformada com a decisão que desclassificou sua proposta sob a alegação de "preço inexequível", vem apresentar **RECURSO ADMINISTRATIVO**.

**FUNDAMENTAÇÃO (Art. 59, § 4º da Lei 14.133/2021)**
A decisão do Agente de Contratação foi arbitrária e violou frontalmente a nova Lei de Licitações. O art. 59, § 2º define o critério matemático para inexequibilidade em obras e serviços de engenharia. Para compras gerais, a inexequibilidade não pode ser presumida de forma absoluta!

O **§ 4º do art. 59 da Lei 14.133/2021** é taxativo:
*"No caso de obras e serviços de engenharia e arquitetura, para efeito de avaliação da exequibilidade e de sobrepreço, serão considerados o preço global, os quantitativos e os preços unitários [...], sendo que a Administração DEVERÁ REALIZAR DILIGÊNCIA para atestar a exequibilidade da proposta."*

A jurisprudência pacífica do TCU (Súmula 262) estabelece que o critério de inexequibilidade é de presunção RELATIVA (juris tantum), DEVENDO o pregoeiro conceder à empresa a oportunidade de provar que consegue executar o contrato àquele valor (demonstrando ganhos de escala, baixos custos indiretos ou insumos adquiridos a baixo custo).

A desclassificação sumária, sem abertura de prazo para a licitante apresentar sua planilha de custos e comprovar a exequibilidade, é ilegal.

**DO PEDIDO**
Requer o recebimento deste recurso para reformar a decisão, concedendo o prazo legal para a juntada de documentos e planilhas que comprovam a total viabilidade econômica da proposta, e subsequente adjudicação do objeto.
      `,
    },
    {
      title: 'Guia Educativo: Fase de Lances e Robôs de Licitação',
      description: 'Instruções aos clientes de como usar modos de disputa ABERTO e ABERTO-FECHADO.',
      templateType: 'conteudo_educativo',
      contentTemplate: `
# 🤖 Guia Tático: Como operar na Fase de Lances (Lei 14.133)

Na Nova Lei de Licitações, a dinâmica da fase competitiva mudou.

## Modo Aberto
- Lances públicos e sucessivos. 
- O certame tem uma etapa de 10 minutos. Cada lance prorroga o tempo em 2 minutos (tempo randômico foi extinto no modo aberto).
- **Tática Expertise:** Se usar nosso "Robô Sniper", deixe-o programado para dar o lance nos últimos 3 segundos do encerramento prorrogável, esgotando a paciência do concorrente.

## Modo Aberto e Fechado
- Fase aberta (15 minutos) seguida de um encerramento aleatório (de zero a 10 minutos).
- Após o encerramento, o primeiro colocado e todos que estiverem até 10% do menor preço vão para o "Lance Fechado".
- Cada um dá um lance cego em 5 minutos.
- **Tática Expertise:** Tente se manter a todo custo dentro da margem de 10% do líder. No final, dê seu Bottom Line (preço mínimo) de uma vez só! Nosso Robô "Conservador" garante sua permanência no pelotão de 10%.
      `,
    }
  ];

  await prisma.documentTemplate.createMany({
    skipDuplicates: true,
    data: templatesData
  });

  console.log('Mega Seeding finalizado com estrondoso sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro no Mega Seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
