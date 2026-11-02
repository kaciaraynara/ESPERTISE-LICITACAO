import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { prisma } from '../database/prisma';
import { gerarEmbeddingTexto } from '../services/base-juridica.service';

interface DocumentoBase {
  titulo: string;
  autoridade: string;
  referencia: string;
  fonte: string;
  tipoNorma: string;
  numeroNorma: string;
  artigoReferencia: string;
  tema: string;
  tags: string[];
  resumo: string;
  conteudo: string;
  urlOficial: string;
}

const DOCUMENTOS_ESSENCIAIS: DocumentoBase[] = [
  // ---------------------------------------------------------------------------
  // 1. IN SEGES/MP nº 05/2017 — Planilha de Custos e Formação de Preços (Mão de Obra Exclusiva)
  // ---------------------------------------------------------------------------
  {
    titulo: 'IN SEGES/MP nº 5/2017 — Planilhas de Custos e Formação de Preços para Serviços com Dedicação Exclusiva (Servente de Limpeza, Portaria e Asseio)',
    autoridade: 'SEGES_MPDG',
    fonte: 'IN_05_2017',
    tipoNorma: 'INSTRUCAO_NORMATIVA',
    numeroNorma: 'Instrução Normativa SEGES/MP nº 5/2017',
    referencia: 'Art. 30 e Anexo VII-D da IN SEGES/MP nº 5/2017 c/c Portaria SEGES/ME nº 21.262/2020',
    artigoReferencia: 'Anexo VII-D da IN SEGES 05/2017',
    tema: 'Planilha de Custos, Servente de Limpeza, Convenção Coletiva (CCT), Encargos Sociais, Provisões Trabalhistas e BDI de Serviços',
    tags: [
      'in_05_2017',
      'planilha_de_custos',
      'servente_de_limpeza',
      'dedicacao_exclusiva',
      'encargos_sociais',
      'bdi',
      'convencao_coletiva',
      'cct',
      'modulo_1',
      'modulo_2',
      'modulo_3',
      'modulo_4',
      'modulo_5',
      'modulo_6',
      'insalubridade',
      'fgts',
      'aviso_previo'
    ],
    resumo: 'Regras contábeis obrigatórias da IN 05/2017 para estruturação da Planilha de Custos e Formação de Preços em contratos com dedicação de mão de obra exclusiva (servente de limpeza, portaria, vigilância e copeiragem), dividida em 6 Módulos com respeito irrestrito à Convenção Coletiva de Trabalho (CCT) e vedação à inclusão de IRPJ/CSLL (Súmula 254 TCU).',
    conteudo: `INSTRUÇÃO NORMATIVA SEGES/MP Nº 5/2017 — ANEXO VII-D (PLANILHA DE CUSTOS E FORMAÇÃO DE PREÇOS PARA MÃO DE OBRA EXCLUSIVA - SERVENTE DE LIMPEZA E CONSERVAÇÃO):

A elaboração da proposta e da planilha de custos para servente de limpeza em licitações públicas federais, estaduais e municipais rege-se estritamente pela IN SEGES/MP nº 05/2017 e pela Convenção Coletiva de Trabalho (CCT) da base territorial onde o serviço será executado (ex: SIEMACO / Fenascon), dividindo-se em 6 Módulos Contábeis:

1. MÓDULO 1: COMPOSIÇÃO DA REMUNERAÇÃO
- Salário-Base Normativo: Piso salarial fixado na CCT vigente para a categoria de Servente de Limpeza / Auxiliar de Serviços Gerais (não pode ser inferior ao piso da categoria nem ao salário mínimo nacional).
- Adicional de Insalubridade: Calculado sobre o salário mínimo vigente (ou base fixada na CCT), nos graus: Médio (20%) ou Máximo (40%), aplicável caso a limpeza envolva sanitários de grande circulação de público ou coleta de resíduos sólidos (Súmula 448 do TST e NR-15).
- Adicional de Periculosidade: 30% sobre o salário-base, devido quando houver exposição direta a inflamáveis, explosivos ou energia elétrica.
- Adicional Noturno: 20% sobre a hora diurna para jornadas prestadas entre 22h e 5h, acrescido do cômputo da hora noturna reduzida (52 minutos e 30 segundos).
- Gratificações, adicional de função e assiduidade expressamente previstos na CCT.

2. MÓDULO 2: ENCARGOS E BENEFÍCIOS ANUAIS, MENSAIS E DIÁRIOS
- Submódulo 2.1 (13º Salário e Férias):
  * 13º Salário: 8,33% (1/12 avos ao mês).
  * Férias e Adicional Constitucional de 1/3: 8,33% de férias + 2,78% de terço constitucional = 11,11%.
- Submódulo 2.2 (Encargos Previdenciários, FGTS e FAP):
  * Regime de Lucro Real ou Presumido (Não desonerado): INSS Patronal (20,00%), Seguro Acidente de Trabalho (SAT/RAT x FAP ajustado, geralmente de 1% a 3%), Salário-Educação (2,50%), INCRA (0,20%), Sistema S / SENAC / SESC / SEBRAE (3,10%) e FGTS (8,00%), totalizando aproximadamente 36,80% a 38,80%.
  * Empresas optantes pela Desoneração da Folha (Lei 12.546/2011 - CPRB): Substitui a cota patronal de 20% pelo percentual de 1,5% a 4,5% sobre a receita bruta, mantendo terceiros e FGTS.
  * Microempresa e EPP (Simples Nacional): É VEDADA a contratação de ME/EPP pelo regime do Simples Nacional em serviços com cessão de mão de obra exclusiva sujeitos à retenção de 11% do INSS (Art. 17, XII da LC 123/2006).
- Submódulo 2.3 (Benefícios Diários e Mensais):
  * Vale-Transporte: Custo real das passagens diárias deduzido o desconto legal em folha de até 6% do salário-base do servente de limpeza (Art. 4º da Lei 7.418/1985).
  * Auxílio-Alimentação / Cesta Básica: Valor facial diário estabelecido na CCT da categoria, com aplicação do desconto de até 20% previsto pelo Programa de Alimentação do Trabalhador (PAT - Lei 6.321/1976).
  * Assistência Médica, Odontológica e Seguro de Vida em Grupo conforme exigido pela Convenção Coletiva.

3. MÓDULO 3: PROVISÃO PARA RESCISÃO CONTRATUAL
- Aviso Prévio Trabalhado: Fração mensal provisionada (aproximadamente 1,94%) e respectiva incidência do Submódulo 2.2.
- Aviso Prévio Indenizado (Lei 12.506/2011): Provisionamento proporcional aos anos de serviço (média de 0,42% a 1,20%).
- Multa Rescisória do FGTS e Contribuição Social: 40% do FGTS acumulado destinado ao empregado + 10% de contribuição social (Lei Complementar 110/2001), totalizando 50% sobre os depósitos do FGTS (provisão média de 4,35% a 5,00%).

4. MÓDULO 4: CUSTO DE REPOSIÇÃO DO PROFISSIONAL AUSENTE
- Reposição de Servente Ausente durante o gozo de férias regulamentares (8,33% multiplicado pelo custo do substituto).
- Ausências legais abonadas pela CLT (casamento, falecimento de familiar, alistamento eleitoral, doação de sangue).
- Licença-maternidade e licença-paternidade.
- Cobertura de afastamentos por doença ou acidente de trabalho nos primeiros 15 dias pagos pelo empregador (média de 1,00% a 1,50%).

5. MÓDULO 5: INSUMOS DIVERSOS (MATERIAIS, UNIFORMES E EQUIPAMENTOS)
- Uniformes: Conjunto completo semestral (calça, camisa de manga curta/longa, bota de PVC impermeável ou sapato fechado antiderrapante, avental).
- Equipamentos de Proteção Individual (EPIs): Luvas nitrílicas/látex, óculos de proteção ampla visão, protetor auricular, máscara facial contra poeiras e produtos químicos.
- Materiais e Equipamentos de Limpeza: Carrinho funcional multifuncional, balde espremedor tipo MOP, lavadora/enceradeira de piso industrial, aspirador de pó e líquidos profissional, produtos químicos saneantes registrados na ANVISA (desinfetantes, detergentes neutros, cloro, sacos plásticos para descarte comum e infectante).

6. MÓDULO 6: CUSTOS INDIRETOS, LUCRO E TRIBUTOS (BDI DE SERVIÇOS)
- Custos Indiretos da Administração Central (gerência, supervisão operacional, suporte de RH e logística): Taxa praticada entre 3% e 6%.
- Lucro Operacional Líquido da Empresa Prestadora: Margem saudável entre 4% e 10%.
- Tributos Incidentes sobre o Faturamento:
  * PIS: 0,65% (Regime Cumulativo) ou 1,65% (Regime Não-Cumulativo).
  * COFINS: 3,00% (Regime Cumulativo) ou 7,60% (Regime Não-Cumulativo).
  * ISSQN: Alíquota de 2,00% a 5,00% conforme a legislação tributária do município de prestação dos serviços (local da execução).
  * VEDAÇÃO ABSOLUTA DA SÚMULA 254 DO TCU: É terminantemente proibido incluir valores referentes a Imposto de Renda Pessoa Jurídica (IRPJ) e Contribuição Social sobre o Lucro Líquido (CSLL) na composição de custos indiretos, BDI ou na planilha de formação de preços, pois tratam-se de tributos diretos e personalíssimos da atividade empresarial que devem ser suportados pelo lucro líquido.`,
    urlOficial: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-5-de-26-de-maio-de-2017',
  },

  // ---------------------------------------------------------------------------
  // 2. IN SEGES/ME nº 73/2020 — Pesquisa de Preços e Formação de Preço de Referência
  // ---------------------------------------------------------------------------
  {
    titulo: 'IN SEGES/ME nº 73/2020 — Procedimento Administrativo para Realização de Pesquisa de Preços para Aquisição de Bens e Contratação de Serviços',
    autoridade: 'SEGES_ME',
    fonte: 'IN_73_2020',
    tipoNorma: 'INSTRUCAO_NORMATIVA',
    numeroNorma: 'Instrução Normativa SEGES/ME nº 73/2020',
    referencia: 'Arts. 1º a 9º da IN SEGES/ME nº 73/2020 c/c IN SEGES/ME nº 65/2021',
    artigoReferencia: 'Arts. 3º, 5º e 6º da IN SEGES 73/2020',
    tema: 'Pesquisa de Preços, Painel de Preços, Parâmetros Oficiais, Expurgo de Outliers, Mediana e Média Saneada',
    tags: [
      'in_73_2020',
      'in_65_2021',
      'pesquisa_de_precos',
      'painel_de_precos',
      'outliers',
      'mediana',
      'media_saneada',
      'teto_orcamentario',
      'inexequibilidade',
      'cesta_de_precos'
    ],
    resumo: 'Estabelece a metodologia formal e a ordem de prioridade para estimativa do valor de referência nas licitações públicas: Painel de Preços e compras públicas similares (inciso I), contratações de outros entes (inciso II), publicações especializadas (inciso III) e propostas de fornecedores (inciso IV), com descarte obrigatório de valores inexequíveis ou excessivamente elevados (outliers).',
    conteudo: `INSTRUÇÃO NORMATIVA SEGES/ME Nº 73, DE 5 DE AGOSTO DE 2020 (PESQUISA DE PREÇOS NO ÂMBITO FEDERAL):

Dispõe sobre o procedimento administrativo para a realização de pesquisa de preços para a aquisição de bens e contratação de serviços em geral:

1. ORDEM DE PREFERÊNCIA DAS FONTES DE PESQUISA (ART. 5º):
A pesquisa de preços para fins de fixação do preço estimado ou do preço máximo aceitável na licitação deve ser realizada mediante a utilização dos seguintes parâmetros, observada a seguinte prioridade:
I - Painel de Preços disponível no portal Compras.gov.br e contratações similares de outros órgãos e entidades públicas, concluídas no período de 1 (um) ano anterior à data da pesquisa de preços;
II - Contratações similares feitas pela Administração Pública em execução ou concluídas nos 1 (um) ano anterior à data da pesquisa de preços, inclusive mediante sistema de registro de preços;
III - Dados publicados em mídia especializada, sítios eletrônicos especializados ou de domínio amplo, desde que contenham a data e hora de acesso;
IV - Pesquisa direta com fornecedores, mediante solicitação formal de cotação por e-mail ou documento eletrônico, com prazo de resposta compatível com a complexidade do objeto (mínimo de 3 orçamentos válidos).

2. CRITÉRIOS DE ACEITABILIDADE E EXPURGO DE OUTLIERS (ART. 6º):
- Devem ser desconsiderados os valores inexequíveis, inconsistentes e os excessivamente elevados da amostra coletada (outliers).
- Critério Estatístico Recomendado: Desvio padrão em relação à média ou método dos quartis (amplitude interquartil - IQR), eliminando preços fora de 25% a 30% da mediana amostral.
- O resultado da pesquisa de preços será apurado por meio de média, mediana ou menor dos valores obtidos no conjunto de preços coletados.
- Preferência pela Mediana: A utilização da mediana é a metodologia preferencial recomendada pela jurisprudência do TCU (Acórdãos 2.637/2015 e 1.875/2021-Plenário), pois a mediana é imune à distorção gerada por cotações extremas pontuais.

3. PRAZO DE VALIDADE DAS COTAÇÕES (ART. 7º):
Os preços coletados diretamente com fornecedores têm validade máxima de 6 (seis) meses a contar da data de sua emissão, devendo conter CNPJ, razão social, data, descrição detalhada do bem e assinatura do responsável.`,
    urlOficial: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-73-de-5-de-agosto-de-2020',
  },

  // ---------------------------------------------------------------------------
  // 3. Manual de Atuação do Pregoeiro e Agente de Contratação (CGU)
  // ---------------------------------------------------------------------------
  {
    titulo: 'Manual de Atuação do Pregoeiro e Agente de Contratação (CGU) — Boas Práticas, Saneamento de Propostas e Julgamento',
    autoridade: 'CGU',
    fonte: 'MANUAL_PREGOEIRO_CGU',
    tipoNorma: 'MANUAL_TECNICO',
    numeroNorma: 'Manual de Licitações e Contratos da Controladoria-Geral da União',
    referencia: 'Orientações da CGU para Pregoeiros c/c Arts. 8º, 12, 59, 61 e 64 da Lei 14.133/2021',
    artigoReferencia: 'Arts. 12, 59, 61 e 64 da Lei 14.133/2021',
    tema: 'Dever de Diligência, Saneamento de Falhas Formais, Negociação de Preços, Inexequibilidade e Prevenção de Nulidades',
    tags: [
      'pregoeiro',
      'agente_de_contratacao',
      'manual_cgu',
      'diligencia',
      'negociacao',
      'desclassificacao',
      'erro_formal',
      'inexequibilidade',
      'amostra',
      'cgu'
    ],
    resumo: 'Guia oficial da Controladoria-Geral da União com diretrizes práticas e limites de atuação do pregoeiro e da equipe de apoio: dever fundamental de diligência saneadora (vedada a eliminação de licitante por erro sanável), rito de negociação após lances, procedimentos formais para exame de inexequibilidade e aceitabilidade de propostas.',
    conteudo: `MANUAL DE ATUAÇÃO DO PREGOEIRO E DO AGENTE DE CONTRATAÇÃO — CONTROLADORIA-GERAL DA UNIÃO (CGU):

O pregoeiro e o agente de contratação exercem função de estado na condução da sessão pública, devendo pautar suas decisões pelas diretrizes de governança pública da CGU e da jurisprudência pacífica do TCU:

1. O PRINCÍPIO DO FORMALISMO MODERADO E O DEVER DE DILIGÊNCIA SANEADORA (ART. 12, III E ART. 64 DA LEI 14.133/2021):
- O agente público não deve agir como mero homologador nem como inquisidor burocrático. O rigor formal não pode ser transformado em um fim em si mesmo que sacrifique a busca da proposta mais vantajosa para o erário e a ampla competitividade.
- É dever (e não mera faculdade) do pregoeiro promover diligências para sanar erros materiais, omissões involuntárias de cálculos, divergências formais de planilhas de custos ou ausência de documentos que atestem condição pré-existente à data da sessão pública (Art. 64, § 1º).
- É vedada a desclassificação sumária de proposta quando a falha for passível de retificação ou esclarecimento por meio de diligência eletrônica registrada em ata.

2. RITO OBRIGATÓRIO DE NEGOCIAÇÃO DE PREÇOS (ART. 61 DA LEI 14.133/2021):
- Definido o resultado do julgamento dos lances, o pregoeiro DEVERÁ negociar condições mais vantajosas com o primeiro colocado.
- A negociação é obrigatória mesmo quando a proposta já tiver ficado abaixo do valor estimado pelo órgão público, buscando obter a maior economicidade sustentável.
- Quando o primeiro colocado for desclassificado ou inabilitado, o pregoeiro negociará com os demais licitantes subsequentes, na ordem de classificação.

3. JULGAMENTO DA EXEQUIBILIDADE DA PROPOSTA (ART. 59 DA LEI 14.133/2021):
- A presunção de inexequibilidade de preços em compras e serviços comuns é RELATIVA (juris tantum).
- Se a proposta apresentar desconto substancial ou ficar abaixo de 50% do valor orçado pela Administração (nos termos do art. 34 da IN SEGES 73/2022), o pregoeiro NÃO PODE desclassificar de imediato.
- O pregoeiro deve abrir prazo formal (mínimo de 2 horas na sessão ou até 3 dias úteis) para que o licitante comprove a viabilidade econômica de sua oferta, mediante apresentação de:
  a) Notas fiscais de aquisição de insumos a preços diferenciados;
  b) Contratos de fornecimento em escala;
  c) Comprovação de custos de oportunidade e margem líquida positiva.

4. EXAME DE AMOSTRAS E PROVA DE CONCEITO:
- É absolutamente ilegal exigir apresentação de amostras de todos os concorrentes na fase de habilitação prévia ou junto com a proposta comercial (Súmula 272 do TCU).
- A exigência de amostras só é lícita para o licitante classificado provisoriamente em primeiro lugar, após a fase de julgamento de lances, e deve constar expressamente justificada no Termo de Referência.`,
    urlOficial: 'https://www.gov.br/cgu/pt-br/assuntos/auditoria-e-fiscalizacao/manuais',
  },

  // ---------------------------------------------------------------------------
  // 4. Súmulas Consolidadas do Tribunal de Contas da União (TCU)
  // ---------------------------------------------------------------------------
  {
    titulo: 'Súmulas Consolidadas do TCU em Licitações Públicas (Súmulas 222, 247, 254, 263, 272 e 275)',
    autoridade: 'TCU',
    fonte: 'SUMULAS_TCU',
    tipoNorma: 'SUMULA_JURISPRUDENCIAL',
    numeroNorma: 'Súmulas do TCU nº 222, 247, 254, 263, 272 e 275',
    referencia: 'Súmulas 222, 247, 254, 263, 272 e 275 do Tribunal de Contas da União',
    artigoReferencia: 'Súmulas TCU nº 222 a 275',
    tema: 'Jurisprudência Vinculante do TCU, Vedação a IRPJ/CSLL no BDI, Parcelamento do Objeto e Limites de Qualificação Técnica',
    tags: [
      'sumulas_tcu',
      'sumula_254',
      'sumula_247',
      'sumula_222',
      'sumula_263',
      'sumula_272',
      'sumula_275',
      'tcu',
      'bdi',
      'irpj_csll',
      'atestado_tecnico',
      'parcelamento'
    ],
    resumo: 'Enunciados sumulares fundamentais do Tribunal de Contas da União que vinculam a Administração Pública Federal e orientam editais em todo o Brasil: obrigatoriedade de seguir deliberações do TCU (Súmula 222), parcelamento de compras divisíveis (Súmula 247), vedação expressa de IRPJ e CSLL na planilha/BDI (Súmula 254), limite máximo de 50% de quantitativo para atestados técnicos (Súmula 263) e proibição de exigência de certidão territorial ou conselho local (Súmula 272).',
    conteudo: `SÚMULAS CONSOLIDADAS DO TRIBUNAL DE CONTAS DA UNIÃO (TCU) APLICÁVEIS A LICITAÇÕES E CONTRATOS ADMINISTRATIVOS:

1. SÚMULA Nº 222 DO TCU:
"As Decisões do Tribunal de Contas da União, relativas à aplicação de normas gerais de licitação, sobre as quais cabe privativamente à União legislar, devem ser acatadas pelos administradores dos Poderes da União, dos Estados, do Distrito Federal e dos Municípios."
-> Efeito Prático: Vinculação de toda a Administração Pública Federal e subsidiariamente de órgãos estaduais e municipais que recebam recursos federais voluntários (convênios, repasses e transferências).

2. SÚMULA Nº 247 DO TCU:
"É obrigatória a admissão da adjudicação por item e não por preço global, nos editais das licitações para a contratação de bens e serviços divisíveis, desde que não haja prejuízo para o conjunto ou complexo ou perda de economia de escala, tendo em vista o objetivo de propiciar a ampla participação de licitantes que, embora não dispondo de capacidade para a execução, fornecimento ou aquisição da totalidade do objeto, possam fazê-lo com relação a itens ou lotes isolados."
-> Efeito Prático: Proíbe o agrupamento indevido de itens sem justificativa técnica minuciosa. O parcelamento do objeto é regra geral, devendo a adjudicação por lote global ser tratada como exceção motivada.

3. SÚMULA Nº 254 DO TCU:
"Nas licitações para contratação de serviços contínuos com dedicação exclusiva de mão de obra e obras públicas, é vedada a inclusão, na taxa de Benefícios e Despesas Indiretas (BDI) ou na planilha de custos e formação de preços, de parcelas relativas ao Imposto sobre a Renda da Pessoa Jurídica (IRPJ) e à Contribuição Social sobre o Lucro Líquido (CSLL)."
-> Efeito Prático: IRPJ e CSLL são tributos diretos que variam conforme a forma de tributação da empresa (Lucro Real ou Presumido) e não podem ser repassados no preço ao Estado; devem ser pagos com a margem de lucro líquido da contratada.

4. SÚMULA Nº 263 DO TCU:
"Para a comprovação da capacidade técnico-operacional das licitantes, e desde que limitada, simultaneamente, aos aspectos de maior relevância e valor significativo do objeto a ser contratado, é legal a exigência de comprovação da execução de quantitativos mínimos em obras ou serviços com características semelhantes, devendo essa exigência guardar proporção com a dimensão e a complexidade do objeto e não exceder a 50% (cinquenta por cento) dos quantitativos previstos."
-> Efeito Prático: Qualquer edital que exija comprovação técnica superior a 50% dos quantitativos do objeto da licitação é flagrantemente ilegal e deve ser objeto de impugnação imediata.

5. SÚMULA Nº 272 DO TCU:
"No edital de licitação, é vedada a inclusão de exigências de habilitação que não guardem conformidade com a legislação federal, sendo nula a cláusula que condicione a participação ao registro ou visto em conselho de fiscalização profissional exclusivamente no estado em que será executado o objeto, bastando o visto por ocasião da assinatura do contrato."
-> Efeito Prático: Impede barreiras protecionistas locais de prefeituras ou governos estaduais contra empresas de outros estados da federação.`,
    urlOficial: 'https://pesquisa.apps.tcu.gov.br/#/documento/sumula',
  },

  // ---------------------------------------------------------------------------
  // 5. Íntegra Sistematizada da Lei 14.133/2021 (Nova Lei de Licitações)
  // ---------------------------------------------------------------------------
  {
    titulo: 'Lei nº 14.133/2021 na Íntegra Sistematizada — Nova Lei de Licitações e Contratos Administrativos',
    autoridade: 'PLANALTO',
    fonte: 'LEI_14133_INTEGRA',
    tipoNorma: 'LEI_FEDERAL',
    numeroNorma: 'Lei nº 14.133, de 1º de abril de 2021',
    referencia: 'Lei Federal nº 14.133/2021 (Arts. 1º a 194)',
    artigoReferencia: 'Arts. 1º a 194 da Lei 14.133/2021',
    tema: 'Regime Jurídico Completo de Licitações, Ritos de Disputa, Habilitação, Contratos, Sanções e Reequilíbrio',
    tags: [
      'lei_14133',
      'nllc',
      'nova_lei_licitacoes',
      'fase_preparatoria',
      'habilitacao',
      'pregao',
      'concorrencia',
      'dispensa_eletronica',
      'reequilibrio',
      'repactuacao',
      'reajuste',
      'sancoes_administrativas'
    ],
    resumo: 'Estatuto completo das licitações e contratos administrativos no Brasil: regras gerais para a Administração Pública direta, autárquica e fundacional de todos os entes da Federação, integrando fase preparatória (ETP, TR e Matriz de Riscos), critérios de julgamento, fase recursal com efeito suspensivo e regras de execução, reajuste por índices e repactuação por CCT.',
    conteudo: `LEI FEDERAL Nº 14.133, DE 1º DE ABRIL DE 2021 (NOVA LEI DE LICITAÇÕES E CONTRATOS ADMINISTRATIVOS):

Estabelece normas gerais de licitação e contratação para as Administrações Públicas diretas, autárquicas e fundacionais da União, dos Estados, do Distrito Federal e dos Municípios:

1. PRINCÍPIOS FUNDAMENTAIS (ART. 5º):
Na aplicação desta Lei, serão observados os princípios da legalidade, da impessoalidade, da moralidade, da publicidade, da eficiência, do interesse público, da probidade administrativa, da igualdade, do planejamento, da transparência, da eficácia, da segregação de funções, da motivação, da vinculação ao edital, do julgamento objetivo, da segurança jurídica, da razoabilidade, da proporcionalidade, da celeridade, da economicidade e do desenvolvimento nacional sustentável.

2. MODALIDADES DE LICITAÇÃO (ART. 28):
São modalidades de licitação: I - pregão; II - concorrência; III - concurso; IV - leilão; V - diálogo competitivo. Ficaram extintas as modalidades de tomada de preços e convite.

3. FASE DE JULGAMENTO E CRITÉRIOS DE DESCLASSIFICAÇÃO (ARTS. 56 A 61):
- Critérios de Julgamento (Art. 33): menor preço, maior desconto, melhor técnica ou conteúdo artístico, técnica e preço, maior lance (leilão) e maior retorno econômico.
- Desclassificação (Art. 59): Serão desclassificadas as propostas que:
  I - contiverem vícios insanáveis;
  II - não obedecerem às especificações técnicas pormenorizadas no edital;
  III - apresentarem preços manifestamente inexequíveis ou permanecerem acima do orçamento estimado para a contratação;
  IV - não tiverem sua exequibilidade demonstrada, quando exigido pela Administração.
- Erros Formais e Saneamento (Art. 12, III e Art. 59, § 2º): A desclassificação não será admitida se for possível sanar o vício mediante diligência, vedada a inserção posterior de documento ou informação que devesse constar originariamente da proposta.

4. HABILITAÇÃO DAS LICITANTES (ARTS. 62 A 70):
Compreende:
- Habilitação Jurídica (Art. 66): existência legal da pessoa jurídica e capacidade societária.
- Habilitação Técnica (Art. 67): certidões de registro em conselho profissional competente e atestados de capacidade técnica, limitados aos aspectos de maior relevância e valor significativo (máximo de 50% dos quantitativos conforme Súmula 263 TCU).
- Habilitação Fiscal, Social e Trabalhista (Art. 68): regularidade com a Fazenda Nacional (RFB/PGFN), Fazendas Estaduais e Municipais, Seguridade Social (INSS), FGTS e inexistência de débitos inadimplidos perante a Justiça do Trabalho (CNDT).
- Qualificação Econômico-Financeira (Art. 69): balanço patrimonial, índices contábeis de Liquidez Geral (LG), Liquidez Corrente (LC) e Solvência Geral (SG) maiores que 1,0, vedada a exigência de índices que não tenham embasamento técnico justificado.

5. DURAÇÃO DOS CONTRATOS E REAJUSTAMENTO FINANCEIRO (ARTS. 105 A 136):
- Duração (Art. 106): Serviços e fornecimentos contínuos podem ter prazo inicial de até 5 (cinco) anos, prorrogáveis sucessivamente até o limite de 10 (dez) anos.
- Reajuste em Sentido Estrito (Art. 25, § 7º e Art. 135): Obrigatório em contratos sem dedicação exclusiva de mão de obra após o interregno mínimo de 1 (um) ano contado da data do orçamento ou da proposta, aplicando-se índices oficiais setoriais ou gerais (IPCA, INPC, IGP-M).
- Repactuação por Dedicação Exclusiva (Art. 135): Aplica-se a serviços com mão de obra exclusiva para adequação aos novos custos decorrentes de Convenção ou Acordo Coletivo de Trabalho (CCT/ACT), exigindo demonstração analítica da variação de cada módulo da planilha de custos.
- Reequilíbrio Econômico-Financeiro (Art. 124, II, "d"): Garantia constitucional (Art. 37, XXI da CF) restabelecida a qualquer tempo para compensar eventos imprevisíveis ou previsíveis de consequências incalculáveis (álea extraordinária).

6. REGIME DE RECURSOS E IMPUGNAÇÕES (ARTS. 164 A 168):
- Impugnação ao Edital (Art. 164): Qualquer pessoa é parte legítima para impugnar edital por irregularidade até 3 (três) dias úteis antes da data de abertura do certame, devendo a Administração responder no prazo de 3 (três) dias úteis.
- Recursos Administrativos (Art. 165): Prazo único de 3 (três) dias úteis, tanto para manifestação motivada na sessão pública quanto para apresentação das razões e contrarrazões, dotado de efeito suspensivo para julgamento e habilitação.`,
    urlOficial: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm',
  },
];

async function main() {
  console.log('========================================================================');
  console.log('EXPERTISE — SEEDING DA BASE JURÍDICA: NORMAS ESSENCIAIS E REGRAS PRÁTICAS');
  console.log('========================================================================\n');

  for (let i = 0; i < DOCUMENTOS_ESSENCIAIS.length; i++) {
    const doc = DOCUMENTOS_ESSENCIAIS[i];
    console.log(`[${i + 1}/${DOCUMENTOS_ESSENCIAIS.length}] Processando: ${doc.titulo.slice(0, 70)}...`);

    // Gera o vetor matemático de 768 dimensões usando Gemini text-embedding-004
    console.log(`  -> Gerando coordenadas vetoriais (768 dimensões)...`);
    const embedding = await gerarEmbeddingTexto(doc.conteudo);
    const vectorLiteral = `[${embedding.join(',')}]`;

    // Verifica se já existe um documento com essa fonte na base_juridica
    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM base_juridica WHERE fonte = $1 LIMIT 1;`,
      doc.fonte
    );

    if (existing && existing.length > 0) {
      const docId = existing[0].id;
      console.log(`  -> Atualizando documento existente (ID: ${docId})...`);
      await prisma.$executeRawUnsafe(
        `UPDATE base_juridica
         SET titulo = $1,
             autoridade = $2,
             referencia = $3,
             tipo_norma = $4,
             numero_norma = $5,
             artigo_referencia = $6,
             tema = $7,
             conteudo = $8,
             resumo = $9,
             url_oficial = $10,
             tags = $11,
             embedding_model = 'gemini-embedding-001',
             embedding = CAST($12 AS vector(768)),
             ativo = true,
             updated_at = NOW()
         WHERE id = CAST($13 AS uuid);`,
        doc.titulo,
        doc.autoridade,
        doc.referencia,
        doc.tipoNorma,
        doc.numeroNorma,
        doc.artigoReferencia,
        doc.tema,
        doc.conteudo,
        doc.resumo,
        doc.urlOficial,
        doc.tags,
        vectorLiteral,
        docId
      );
    } else {
      console.log(`  -> Inserindo novo documento oficial na tabela base_juridica...`);
      await prisma.$executeRawUnsafe(
        `INSERT INTO base_juridica (
           titulo, autoridade, referencia, fonte, tipo_norma, numero_norma,
           artigo_referencia, tema, conteudo, resumo, url_oficial, tags,
           embedding_model, embedding, ativo, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
           'gemini-embedding-001', CAST($13 AS vector(768)), true, NOW(), NOW()
         );`,
        doc.titulo,
        doc.autoridade,
        doc.referencia,
        doc.fonte,
        doc.tipoNorma,
        doc.numeroNorma,
        doc.artigoReferencia,
        doc.tema,
        doc.conteudo,
        doc.resumo,
        doc.urlOficial,
        doc.tags,
        vectorLiteral
      );
    }

    console.log(`  ✅ Gravado com sucesso no PostgreSQL Neon (Vetor 768d ok).\n`);
  }

  // Verificação de linhas vazias
  const nullCount = await prisma.$queryRawUnsafe<any[]>(
    `SELECT count(*)::int as total FROM base_juridica WHERE embedding IS NULL AND ativo = true;`
  );
  const totalCount = await prisma.$queryRawUnsafe<any[]>(
    `SELECT count(*)::int as total FROM base_juridica WHERE ativo = true;`
  );

  console.log('------------------------------------------------------------------------');
  console.log(`STATUS FINAL DA TABELA base_juridica:`);
  console.log(`- Total de normas/documentos ativos: ${totalCount[0]?.total}`);
  console.log(`- Linhas com embedding vazio (NULL): ${nullCount[0]?.total}`);
  console.log('------------------------------------------------------------------------\n');
}

main()
  .catch((err) => {
    console.error('❌ Erro no seeding:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

